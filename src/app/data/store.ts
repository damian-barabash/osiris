// Данные пользователя — порт Store из приложения (app/lib/data/store.dart), без офлайн-очереди:
// таблицы грузятся целиком (данных мало), запись сразу меняет локальную копию (оптимистично) и уходит на сервер,
// realtime перечитывает изменённую таблицу. Имена методов те же, что в приложении.
import { useSyncExternalStore } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { sb } from "../sb";
import { tr } from "@/i18n";
import { reportError } from "@/lib/report";
import { AgendaItem, ChatMessage, Client, Critical, Entry, Event, Job, Mood, Note, Payment, Profile, Project, Row, Sphere, Stage, Task, Tracker, WorkExtra, WorkSession } from "./models";
import { dateOnly, day0, monthsGen, sameDate } from "./repeat";

export const TABLES = ["profiles", "clients", "projects", "payments", "tasks", "events", "moods", "trackers", "tracker_stages", "tracker_entries", "notes", "ai_messages", "jobs", "work_sessions", "work_extras"] as const;
export type Table = (typeof TABLES)[number];

export const uuid = () => crypto.randomUUID();
const sum = (m: Record<string, number>, k: string, v: number) => void (m[k] = (m[k] ?? 0) + v);

class Store {
  loaded = false;
  online = true;
  error: string | null = null;
  /** Короткое сообщение для тоста («Готово ✓ Следующий раз — …»). */
  notice: string | null = null;
  /** Сервер отказал из-за лимита бесплатного плана → показать окно подписок. */
  onPlanBlocked: ((why: string) => void) | null = null;

  profile: Profile | null = null;
  clients: Client[] = [];
  projects: Project[] = [];
  payments: Payment[] = [];
  tasks: Task[] = [];
  events: Event[] = [];
  moods: Mood[] = [];
  trackers: Tracker[] = [];
  stages: Stage[] = [];
  entries: Entry[] = [];
  notes: Note[] = [];
  chat: ChatMessage[] = [];
  jobs: Job[] = [];
  sessions: WorkSession[] = [];
  extras: WorkExtra[] = [];

  private rows: Partial<Record<Table, Row[]>> = {};
  private uid: string | null = null;
  private channel: RealtimeChannel | null = null;
  private debounce: Partial<Record<Table, ReturnType<typeof setTimeout>>> = {};
  private pending = 0;
  private version = 0;
  private subs = new Set<() => void>();
  private occ = new Map<number, Map<string, Event[]>>();
  private agendaCache = new Map<string, AgendaItem[]>();
  private byId: { client: Map<string, Client>; project: Map<string, Project>; tracker: Map<string, Tracker>; job: Map<string, Job> } = { client: new Map(), project: new Map(), tracker: new Map(), job: new Map() };

  // ------------------------------------------------------------------ подписка для React
  subscribe = (f: () => void) => { this.subs.add(f); return () => void this.subs.delete(f); };
  snapshot = () => this.version;
  private notify() { this.version++; this.subs.forEach((f) => f()); }

  get userId() { return this.uid; }

  // ------------------------------------------------------------------ запуск
  async start(uid: string) {
    if (this.uid === uid && this.loaded) return;
    this.uid = uid;
    this.subscribeRealtime();
    await this.loadAll();
  }

  async stop() {
    if (this.channel) await sb.removeChannel(this.channel);
    this.channel = null;
    this.loaded = false;
    this.uid = null;
    this.rows = {};
    for (const t of TABLES) this.assign(t);
    this.notify();
  }

  async loadAll() {
    try {
      const fresh = await Promise.all(TABLES.map((t) => this.fetch(t)));
      TABLES.forEach((t, k) => { this.rows[t] = fresh[k]; this.assign(t); });
      this.loaded = true;
      this.error = null;
      this.online = true;
    } catch (e) {
      if (isNetwork(e)) this.online = false;
      else { this.error = String((e as Error).message ?? e); reportError(e, "store.loadAll"); }
    }
    this.notify();
  }

  private async fetch(t: Table): Promise<Row[]> {
    const since = new Date(Date.now() - 400 * 86400_000);
    let q;
    switch (t) {
      case "profiles": q = sb.from(t).select().eq("id", this.uid!); break;
      case "moods": q = sb.from(t).select().gte("created_at", since.toISOString()).order("created_at"); break;
      case "ai_messages": q = sb.from(t).select().order("created_at", { ascending: false }).limit(200); break;
      case "work_sessions": q = sb.from(t).select().gte("started_at", since.toISOString()).order("started_at"); break;
      case "work_extras": q = sb.from(t).select().gte("done_on", dateOnly(since)); break;
      default: q = sb.from(t).select().order("created_at");
    }
    const { data, error } = await q;
    if (error) throw error;
    return t === "ai_messages" ? (data as Row[]).reverse() : (data as Row[]);
  }

  /** Перечитать одну таблицу с сервера. */
  async refresh(t: Table) {
    try {
      this.rows[t] = await this.fetch(t);
      this.assign(t);
      this.notify();
    } catch (e) {
      if (isNetwork(e)) { this.online = false; this.notify(); }
    }
  }
  reloadChat = () => this.refresh("ai_messages");
  reloadProfile = () => this.refresh("profiles");

  private subscribeRealtime() {
    if (this.channel) void sb.removeChannel(this.channel);
    let ch = sb.channel("db-" + this.uid);
    for (const t of TABLES) {
      ch = ch.on("postgres_changes", { event: "*", schema: "public", table: t }, () => {
        if (this.pending > 0) return; // свои же изменения — локальная копия уже свежая
        clearTimeout(this.debounce[t]);
        this.debounce[t] = setTimeout(() => void this.refresh(t), 250);
      });
    }
    this.channel = ch.subscribe();
  }

  private assign(t: Table) {
    const r = this.rows[t] ?? [];
    switch (t) {
      case "profiles": this.profile = r[0] ? new Profile(r[0]) : null; break;
      case "clients": this.clients = r.map((x) => new Client(x)); this.byId.client = new Map(this.clients.map((x) => [x.id, x])); break;
      case "projects": this.projects = r.map((x) => new Project(x)); this.byId.project = new Map(this.projects.map((x) => [x.id, x])); break;
      case "payments": this.payments = r.map((x) => new Payment(x)); break;
      case "tasks": this.tasks = r.map((x) => new Task(x)); break;
      case "events": this.events = r.map((x) => new Event(x)); this.occ.clear(); break;
      case "moods": this.moods = r.map((x) => new Mood(x)).sort((a, b) => a.at.getTime() - b.at.getTime()); break;
      case "trackers": this.trackers = r.map((x) => new Tracker(x)); this.byId.tracker = new Map(this.trackers.map((x) => [x.id, x])); break;
      case "tracker_stages": this.stages = r.map((x) => new Stage(x)); break;
      case "tracker_entries": this.entries = r.map((x) => new Entry(x)); break;
      case "notes": this.notes = r.map((x) => new Note(x)); break;
      case "ai_messages": this.chat = r.map((x) => new ChatMessage(x)).sort((a, b) => a.at.getTime() - b.at.getTime()); break;
      case "jobs": this.jobs = r.map((x) => new Job(x)); this.byId.job = new Map(this.jobs.map((x) => [x.id, x])); break;
      case "work_sessions": this.sessions = r.map((x) => new WorkSession(x)).sort((a, b) => a.start.getTime() - b.start.getTime()); break;
      case "work_extras": this.extras = r.map((x) => new WorkExtra(x)); break;
    }
    this.agendaCache.clear();
  }

  // ------------------------------------------------------------------ запись (сразу локально, затем сервер)
  private async send(t: Table, run: () => PromiseLike<{ error: unknown }>) {
    this.pending++;
    try {
      const { error } = await run();
      if (error) throw error;
      this.online = true;
    } catch (e) {
      const msg = String((e as { message?: string }).message ?? e);
      if (isNetwork(e)) { this.online = false; this.error = tr("Нет связи с сервером. Проверь интернет."); }
      else if (msg.includes("plan_limit") || msg.includes("plan_icon")) this.onPlanBlocked?.(msg);
      else { this.error = msg; reportError(e, `store.${t}`); }
      await this.refresh(t); // вернуть правду с сервера
      throw e;
    } finally {
      setTimeout(() => this.pending--, 600);
      this.notify();
    }
  }

  /** Вставить строку. id создаётся на клиенте, поэтому ссылки можно ставить сразу. Возвращает id. */
  async insert(t: Table, row: Row): Promise<string> {
    const now = new Date().toISOString();
    const send = { id: row.id ?? uuid(), ...row, created_at: row.created_at ?? now };
    (this.rows[t] ??= []).push({ user_id: this.uid, updated_at: now, ...send });
    this.assign(t);
    this.notify();
    await this.send(t, () => sb.from(t).upsert(send, { onConflict: "id" })).catch(() => {});
    return send.id;
  }

  /** Вставить или обновить пачку строк (импорт). */
  async upsertMany(t: Table, rows: Row[]) {
    const now = new Date().toISOString();
    const send: Row[] = rows.map((r) => ({ created_at: now, ...r }));
    const list = (this.rows[t] ??= []);
    for (const r of send) {
      const i = list.findIndex((x) => x.id === r.id);
      const local = { user_id: this.uid, updated_at: now, ...r };
      if (i >= 0) list[i] = { ...list[i], ...local };
      else list.push(local);
    }
    this.assign(t);
    this.notify();
    for (let k = 0; k < send.length; k += 200) await this.send(t, () => sb.from(t).upsert(send.slice(k, k + 200), { onConflict: "id" }));
  }

  async update(t: Table, id: string, patch: Row) {
    const list = this.rows[t] ?? [];
    const i = list.findIndex((r) => r.id === id);
    if (i >= 0) list[i] = { ...list[i], ...patch, ...("updated_at" in list[i] ? { updated_at: new Date().toISOString() } : {}) };
    this.assign(t);
    this.notify();
    await this.send(t, () => sb.from(t).update(patch).eq("id", id)).catch(() => {});
  }

  /** Обновить несколько строк разными значениями: {id: patch}. */
  async updateMany(t: Table, patches: Record<string, Row>) {
    const list = this.rows[t] ?? [];
    for (let k = 0; k < list.length; k++) {
      const p = patches[list[k].id];
      if (p) list[k] = { ...list[k], ...p };
    }
    this.assign(t);
    this.notify();
    for (const [id, p] of Object.entries(patches)) await this.send(t, () => sb.from(t).update(p).eq("id", id)).catch(() => {});
  }

  async delete(t: Table, id: string) {
    this.removeLocal(t, id);
    this.notify();
    await this.send(t, () => sb.from(t).delete().eq("id", id)).catch(() => {});
  }

  async deleteMany(t: Table, ids: string[]) {
    for (const id of ids) this.removeLocal(t, id);
    this.notify();
    for (let k = 0; k < ids.length; k += 100) await this.send(t, () => sb.from(t).delete().in("id", ids.slice(k, k + 100))).catch(() => {});
  }

  /** Локальный каскад — как внешние ключи в базе. */
  private removeLocal(t: Table, id: string) {
    this.rows[t] = (this.rows[t] ?? []).filter((r) => r.id !== id);
    this.assign(t);
    const unlink = (tt: Table, col: string) => {
      this.rows[tt] = (this.rows[tt] ?? []).map((r) => (r[col] === id ? { ...r, [col]: null } : r));
      this.assign(tt);
    };
    const cascade = (tt: Table, col: string) => {
      for (const r of (this.rows[tt] ?? []).filter((x) => x[col] === id)) this.removeLocal(tt, r.id);
    };
    if (t === "clients") { cascade("projects", "client_id"); unlink("events", "client_id"); unlink("notes", "client_id"); }
    if (t === "projects") { cascade("payments", "project_id"); cascade("tasks", "project_id"); unlink("events", "project_id"); unlink("notes", "project_id"); }
    if (t === "trackers") { cascade("tracker_stages", "tracker_id"); cascade("tracker_entries", "tracker_id"); }
    if (t === "jobs") { cascade("work_sessions", "job_id"); cascade("work_extras", "job_id"); }
  }

  updateProfile = (patch: Row) => this.update("profiles", this.uid!, patch);

  /** Галочка ставится сразу. У повторяющейся задачи срок переносится на следующий раз, а сама она остаётся открытой. */
  async toggleTask(t: Task) {
    const rule = t.repeat, due = t.dueAt;
    if (!t.done && rule && due) {
      const today = day0(new Date());
      let next = rule.nextAfter(due, due);
      while (next && next < today) next = rule.nextAfter(due, next);
      if (next) {
        const at = new Date(next.getFullYear(), next.getMonth(), next.getDate(), due.getHours(), due.getMinutes());
        this.notice = tr("Готово ✓ Следующий раз — {0}", [`${at.getDate()} ${monthsGen()[at.getMonth()]}`]);
        return this.update("tasks", t.id, { due_at: at.toISOString() });
      }
    }
    return this.update("tasks", t.id, { done_at: t.done ? null : new Date().toISOString() });
  }

  // ------------------------------------------------------------------ события и повторения
  private occYear(year: number): Map<string, Event[]> {
    let out = this.occ.get(year);
    if (out) return out;
    out = new Map();
    const yEnd = new Date(year, 11, 31), yStart = new Date(year, 0, 1);
    for (const e of this.events) {
      const rule = e.repeat;
      if (!rule) continue;
      const skip = new Set(e.skip);
      const span = e.endsAt == null ? 0 : Math.min(31, Math.max(0, Math.round((day0(e.endsAt).getTime() - day0(e.startsAt).getTime()) / 86400_000)));
      for (const d of rule.dates(e.startsAt, yEnd)) {
        if (d.getTime() < yStart.getTime() - span * 86400_000) continue;
        if (skip.has(dateOnly(d))) continue;
        const o = e.at(d);
        for (let k = 0; k <= span; k++) {
          const day = new Date(d.getFullYear(), d.getMonth(), d.getDate() + k);
          if (day.getFullYear() !== year) continue;
          const key = dateOnly(day);
          out.has(key) ? out.get(key)!.push(o) : out.set(key, [o]);
        }
      }
    }
    this.occ.set(year, out);
    return out;
  }

  /** События дня: обычные + экземпляры серий. */
  eventsOn(day: Date): Event[] {
    const dayStart = day0(day), dayEnd = new Date(dayStart.getTime() + 86400_000);
    const out: Event[] = [];
    for (const e of this.events) {
      if (e.repeat) continue;
      const start = e.startsAt, end = e.endsAt ?? start;
      if (sameDate(start, day) || (start < dayEnd && end > dayStart)) out.push(e);
    }
    out.push(...(this.occYear(day.getFullYear()).get(dateOnly(day)) ?? []));
    return out.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  }

  eventsBetween(from: Date, to: Date): Event[] {
    const out = this.events.filter((e) => !e.repeat && e.startsAt >= from && e.startsAt < to);
    for (let y = from.getFullYear(); y <= to.getFullYear(); y++) {
      const seen = new Set<string>();
      for (const list of this.occYear(y).values()) {
        for (const o of list) {
          if (o.startsAt < from || o.startsAt >= to) continue;
          const k = o.id + o.raw._occ;
          if (!seen.has(k)) { seen.add(k); out.push(o); }
        }
      }
    }
    return out.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  }

  /** Удалить повторение: scope = 'this' | 'future' | 'all'. */
  async deleteOccurrence(occ: Event, scope: "this" | "future" | "all") {
    const series = this.events.find((e) => e.id === occ.id);
    const day = occ.occurrence;
    if (!series || !day || scope === "all") return this.delete("events", occ.id);
    if (scope === "this") return this.update("events", occ.id, { repeat_skip: [...new Set([...series.skip, dateOnly(day)])] });
    const until = new Date(day.getFullYear(), day.getMonth(), day.getDate() - 1);
    if (until < day0(series.startsAt)) return this.delete("events", occ.id);
    return this.update("events", occ.id, { repeat: series.repeat!.copyWith({ until }).toJson() });
  }

  // ------------------------------------------------------------------ справочники
  client = (id?: string | null) => (id ? this.byId.client.get(id) ?? null : null);
  project = (id?: string | null) => (id ? this.byId.project.get(id) ?? null : null);
  tracker = (id?: string | null) => (id ? this.byId.tracker.get(id) ?? null : null);
  job = (id?: string | null) => (id ? this.byId.job.get(id) ?? null : null);

  projectsOf = (clientId: string) => this.projects.filter((p) => p.clientId === clientId);
  tasksOf = (projectId: string) => this.tasks.filter((t) => t.projectId === projectId);
  paymentsOf = (projectId: string) => this.payments.filter((p) => p.projectId === projectId);
  stagesOf = (trackerId: string) => this.stages.filter((s) => s.trackerId === trackerId).sort((a, b) => a.position - b.position);
  entriesOf = (trackerId: string) => this.entries.filter((s) => s.trackerId === trackerId);

  paidOf = (projectId: string) => this.paymentsOf(projectId).reduce((a, p) => a + p.amount, 0);
  dueOf = (p: Project) => p.budget - this.paidOf(p.id);

  /** Долг клиента по валютам (суммы в разных валютах не складываются). */
  clientDue(clientId: string) {
    const out: Record<string, number> = {};
    for (const p of this.projectsOf(clientId)) { const d = this.dueOf(p); if (d > 0.009) sum(out, p.currency, d); }
    return out;
  }
  totalDue() {
    const out: Record<string, number> = {};
    for (const p of this.projects) { const d = this.dueOf(p); if (d > 0.009) sum(out, p.currency, d); }
    return out;
  }
  receivedInMonth(month: Date) {
    const out: Record<string, number> = {};
    for (const pay of this.payments) if (pay.paidOn.getFullYear() === month.getFullYear() && pay.paidOn.getMonth() === month.getMonth()) sum(out, this.project(pay.projectId)?.currency ?? "PLN", pay.amount);
    return out;
  }
  trackerSum = (trackerId: string) => this.entriesOf(trackerId).reduce((a, e) => a + e.amount, 0);
  get lastMood() { return this.moods.at(-1) ?? null; }

  // ------------------------------------------------------------------ часы
  get running() { return this.sessions.filter((x) => x.running); }
  sessionsBetween = (from: Date, to: Date, jobId?: string) => this.sessions.filter((x) => x.start >= from && x.start < to && (!jobId || x.jobId === jobId));
  rateOf = (x: WorkSession) => ((x.rate ?? 0) > 0 ? x.rate! : this.job(x.jobId)?.rate ?? 0);
  extrasBetween = (from: Date, to: Date, jobId?: string) => this.extras.filter((x) => x.day >= day0(from) && x.day < to && (!jobId || x.jobId === jobId));

  /** Заработок по валютам: часы × ставка + задания за цену (withExtras: false — только часы, для прогноза). */
  earned(from: Date, to: Date, { jobId, withExtras = true }: { jobId?: string; withExtras?: boolean } = {}) {
    const out: Record<string, number> = {};
    const now = new Date();
    for (const x of this.sessionsBetween(from, to, jobId)) { const j = this.job(x.jobId); if (j) sum(out, j.currency, x.hours(now) * this.rateOf(x)); }
    if (withExtras) for (const x of this.extrasBetween(from, to, jobId)) { const j = this.job(x.jobId); if (j) sum(out, j.currency, x.amount); }
    return out;
  }
  extrasEarned(from: Date, to: Date, jobId?: string) {
    const out: Record<string, number> = {};
    for (const x of this.extrasBetween(from, to, jobId)) { const j = this.job(x.jobId); if (j) sum(out, j.currency, x.amount); }
    return out;
  }
  hoursBetween(from: Date, to: Date, jobId?: string) {
    const now = new Date();
    return this.sessionsBetween(from, to, jobId).reduce((a, x) => a + x.hours(now), 0);
  }
  async startShift(j: Job, at = new Date()) {
    if (this.running.some((x) => x.jobId === j.id)) return;
    await this.insert("work_sessions", { job_id: j.id, started_at: at.toISOString(), rate: j.rate > 0 ? j.rate : null });
  }
  stopShift = (x: WorkSession, at = new Date()) => this.update("work_sessions", x.id, { ended_at: at.toISOString() });

  // ------------------------------------------------------------------ повестка дня
  agenda(day: Date, sphere?: Sphere | null): AgendaItem[] {
    const key = `${dateOnly(day)}|${sphere ?? ""}`;
    let out = this.agendaCache.get(key);
    if (out) return out;
    out = [];
    for (const e of this.eventsOn(day)) {
      if (sphere && e.sphere !== sphere) continue;
      const c = this.client(e.clientId);
      out.push({ at: e.startsAt, end: e.endsAt, title: e.title, kind: "event", sphere: e.sphere, allDay: e.allDay, important: e.important, subtitle: [e.location, c?.name].filter(Boolean).join(" · "), color: e.color, id: e.id, event: e, repeats: !!e.repeat });
    }
    for (const t of this.tasks) {
      const d = t.dueAt;
      if (!d || !sameDate(d, day) || (sphere && t.sphere !== sphere)) continue;
      out.push({ at: d, title: t.title, kind: "task", sphere: t.sphere, allDay: t.allDay, important: t.important, subtitle: this.project(t.projectId)?.name, id: t.id, repeats: !!t.repeat });
    }
    for (const s of this.stages) {
      const d = s.dueOn;
      if (!d || !sameDate(d, day) || s.status === "done") continue;
      const trk = this.tracker(s.trackerId);
      if (!trk || (sphere && trk.sphere !== sphere)) continue;
      out.push({ at: d, title: s.title, kind: "stage", sphere: trk.sphere, allDay: true, important: s.critical, subtitle: trk.title, color: trk.color, id: trk.id, repeats: false });
    }
    for (const p of this.projects) {
      const d = p.deadline;
      if (!d || !sameDate(d, day) || p.status === "done" || (sphere && p.sphere !== sphere)) continue;
      out.push({ at: d, title: tr("Дедлайн: {0}", [p.name]), kind: "deadline", sphere: p.sphere, allDay: true, important: true, subtitle: this.client(p.clientId)?.name, color: p.color, id: p.id, repeats: false });
    }
    out.sort((a, b) => (a.allDay !== b.allDay ? (a.allDay ? -1 : 1) : a.at.getTime() - b.at.getTime()));
    this.agendaCache.set(key, out);
    return out;
  }

  /** Решающие даты впереди («Не проспать»). */
  upcomingCritical(days = 60): Critical[] {
    const today = day0(new Date()), limit = new Date(today.getTime() + days * 86400_000);
    const inside = (d: Date | null): d is Date => !!d && d >= today && d <= limit;
    const out: Critical[] = [];
    for (const s of this.stages) {
      if (!inside(s.dueOn) || s.status === "done") continue;
      const trk = this.tracker(s.trackerId);
      if (trk && !trk.archived) out.push({ date: s.dueOn, title: s.title, subtitle: trk.title, kind: "stage", id: trk.id, critical: s.critical });
    }
    for (const trk of this.trackers) if (inside(trk.deadline) && !trk.archived) out.push({ date: trk.deadline, title: tr("Срок цели"), subtitle: trk.title, kind: "tracker", id: trk.id, critical: false });
    for (const p of this.projects) if (inside(p.deadline) && p.status !== "done") out.push({ date: p.deadline, title: tr("Дедлайн проекта"), subtitle: p.name, kind: "project", id: p.id, critical: true });
    for (const t of this.tasks) if (inside(t.dueAt) && !t.done && t.important) out.push({ date: t.dueAt, title: t.title, subtitle: this.project(t.projectId)?.name ?? tr("Важная задача"), kind: "task", id: t.id, critical: true });
    return out.sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  /** Просроченные задачи. */
  get overdue(): Task[] {
    const now = new Date(), today = day0(now);
    return this.tasks.filter((t) => !t.done && t.dueAt && (t.allDay ? t.dueAt < today : t.dueAt < now)).sort((a, b) => a.dueAt!.getTime() - b.dueAt!.getTime());
  }

  clearNotice() { this.notice = null; this.error = null; this.notify(); }
}

function isNetwork(e: unknown) {
  const s = String((e as { message?: string })?.message ?? e);
  return e instanceof TypeError || /Failed to fetch|NetworkError|Load failed|network|timed out|PGRST301/i.test(s);
}

export const store = new Store();
export type { Store };

/** Подписка компонента на данные: перерисовывается при любом изменении (как Watch в приложении). */
export function useStore(): Store {
  useSyncExternalStore(store.subscribe, store.snapshot, store.snapshot);
  return store;
}
