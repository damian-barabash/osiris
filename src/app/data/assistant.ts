// Оси — клиент Edge Function `assistant` и исполнитель предложенных действий.
// Порт app/lib/data/assistant.dart. Отличия веб-версии: офлайн-очереди нет (при обрыве — ошибка),
// а всё, что пришло от модели, считается недоверенным вводом: типы проверяются, id сверяются с локальными данными,
// неизвестные действия отбрасываются, за один раз применяется не больше MAX_ACTIONS.
import { FN, SUPABASE_KEY } from "@/config";
import { L, tr } from "@/i18n";
import { toast } from "@/ui/overlays";
import { NAMED } from "@/ui/palette";
import { fmtDateTime, fmtDay, fmtDayYear, fmtTime, money } from "../format";
import { sb } from "../sb";
import { Plans, showPlans, type Limit } from "../screens/plans/plans";
import { AiConsent } from "../screens/account/consent";
import { friends } from "./friends";
import type { Event, Row, Task } from "./models";
import { RepeatRule, dateOnly } from "./repeat";
import { store } from "./store";

// ====================================================================== запросы

export interface AssistantReply {
  reply: string;
  actions: Row[];
  /** id сохранённого сообщения Оси (в него пишется статус предложений). */
  messageId?: string | null;
  /** Сколько сообщений к Оси осталось сегодня (undefined — не считается). */
  left?: number;
  /** Лимит на сегодня исчерпан (Оси ответил «на сегодня всё»). */
  limitHit?: boolean;
  plan?: string;
}
export interface StreamHandlers {
  /** Весь видимый текст на этот момент (не кусок). */
  onDelta?: (full: string) => void;
  /** «Создаю предложение» — текста больше не будет, модель дописывает действия. */
  onStatus?: (s: string) => void;
}

export class AssistantError extends Error {
  constructor(message: string, public status?: number, public offline = false) { super(message); this.name = "AssistantError"; }
}

/** Маркер, после которого модель пишет JSON действий. Сервер его вырезает сам; здесь — вторая линия защиты. */
const MARK = "@@ACTIONS@@";
const BRIEF_TTL = 3 * 3600_000;

const isObj = (v: unknown): v is Row => !!v && typeof v === "object" && !Array.isArray(v);
const tz = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Warsaw"; } catch { return "Europe/Warsaw"; } };
const p2 = (n: number) => String(n).padStart(2, "0");
const localNow = () => { const d = new Date(); return `${dateOnly(d)}T${p2(d.getHours())}:${p2(d.getMinutes())}`; };

/** Сколько символов в конце могут оказаться началом маркера — их пока не показываем. */
function heldTail(s: string): number {
  for (let k = Math.min(MARK.length - 1, s.length); k > 0; k--) if (s.endsWith(MARK.slice(0, k))) return k;
  return 0;
}
const cutMark = (s: string) => { const i = s.indexOf(MARK); return i >= 0 ? s.slice(0, i).trimEnd() : s; };

function toReply(d: Row): AssistantReply {
  const left = typeof d.left === "number" && Number.isFinite(d.left) ? Math.max(0, Math.trunc(d.left)) : undefined;
  return {
    reply: typeof d.reply === "string" ? cutMark(d.reply) : "",
    actions: Array.isArray(d.actions) ? d.actions.filter(isObj) : [],
    messageId: typeof d.message_id === "string" && d.message_id ? d.message_id : null,
    left,
    limitHit: d.limit_hit === true,
    plan: typeof d.plan === "string" ? d.plan : undefined,
  };
}

async function request(mode: "chat" | "capture" | "brief", text: string, h: StreamHandlers = {}, stream = true): Promise<AssistantReply> {
  // без согласия на работу ИИ Оси не вызывается вообще — ни чат, ни быстрая запись, ни сводка
  if (AiConsent.blocked) throw new AssistantError(tr("Оси выключен: нужно твоё согласие на работу ИИ"), 403);
  let res: Response;
  try {
    const { data } = await sb.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new AssistantError("no auth", 401);
    const call = (tk: string) => fetch(FN + "/assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: stream ? "text/event-stream" : "application/json", Authorization: "Bearer " + tk, apikey: SUPABASE_KEY },
      body: JSON.stringify({ mode, text, tz: tz(), lang: L.code, ...(stream ? { stream: true } : { now: localNow() }) }),
    });
    res = await call(token);
    if (res.status === 401) {
      // сессию завершили с другого устройства: обновить и повторить, иначе — на экран входа
      const { data: fresh, error } = await sb.auth.refreshSession();
      if (error || !fresh.session) { await sb.auth.signOut({ scope: "local" }); throw new AssistantError(tr("Сессия закончилась — войди в аккаунт заново"), 401); }
      res = await call(fresh.session.access_token);
    }
  } catch (e) {
    if (e instanceof AssistantError) throw e;
    throw new AssistantError(String((e as Error)?.message ?? e), undefined, true);
  }

  const type = res.headers.get("content-type") ?? "";
  if (!res.ok || !type.includes("text/event-stream") || !res.body) {
    let d: unknown = null;
    try { d = await res.json(); } catch { /* не JSON */ }
    if (isObj(d) && d.error != null) throw new AssistantError(String(d.error).slice(0, 300), res.status);
    if (!res.ok || !isObj(d)) throw new AssistantError("", res.status);
    return toReply(d);
  }

  // SSE: строки «data: {...}». Куски могут рвать строку и даже символ — копим и режем по \n.
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "", raw = "", shown = "", hidden = false;
  let reply: AssistantReply | null = null;
  const status = () => { if (!hidden) { hidden = true; h.onStatus?.(tr("Создаю предложение{0}", [""])); } };
  const show = () => {
    if (hidden) return;
    const m = raw.indexOf(MARK);
    const vis = m >= 0 ? raw.slice(0, m) : raw.slice(0, raw.length - heldTail(raw));
    if (vis !== shown) { shown = vis; h.onDelta?.(vis); }
    if (m >= 0) status();
  };
  const handle = (line: string) => {
    if (!line.startsWith("data:")) return;
    const payload = line.slice(5).trim();
    if (!payload) return;
    let d: unknown;
    try { d = JSON.parse(payload); } catch { return; }
    if (!isObj(d)) return;
    switch (d.t) {
      case "delta": if (typeof d.text === "string") { raw += d.text; show(); } break;
      case "status": status(); break;
      case "done": reply = toReply(d); break;
      case "error": throw new AssistantError(String(d.error ?? "").slice(0, 300), res.status);
      default: break; // meta и всё незнакомое
    }
  };
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (value) buf += dec.decode(value, { stream: true });
      if (done) buf += dec.decode();
      let i: number;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i).replace(/\r$/, "");
        buf = buf.slice(i + 1);
        handle(line);
      }
      if (done) { if (buf.trim()) handle(buf.trim()); break; }
    }
  } catch (e) {
    if (e instanceof AssistantError) throw e;
    // связь оборвалась посреди ответа
    if (!raw) throw new AssistantError(String((e as Error)?.message ?? e), undefined, true);
  }
  if (reply) return reply;
  const text0 = cutMark(raw).trim();
  if (!text0) throw new AssistantError("empty", res.status);
  return { reply: text0, actions: [], messageId: null };
}

const briefFlights = new Map<string, Promise<string>>();

/** Запрос к Оси (Edge Function assistant). */
export const Assistant = {
  /** Чат: поток SSE; onDelta — текст по мере печати, onStatus — «Создаю предложение». Возвращает итог. */
  chat: (text: string, h: StreamHandlers = {}): Promise<AssistantReply> => request("chat", text, h),
  /** Быстрая запись (mode capture). Обработчики потока — по желанию. */
  capture: (text: string, h: StreamHandlers = {}): Promise<AssistantReply> => request("capture", text, h),

  /** Утренняя сводка (кэш 3 ч на пользователя, язык и день). Не получилось — пустая строка: экран покажет свою. */
  brief: (force = false): Promise<string> => {
    const key = `brief3_${store.userId}_${L.code}_${dateOnly(new Date())}`;
    if (!force) {
      try {
        const m: unknown = JSON.parse(localStorage.getItem(key) ?? "null");
        if (isObj(m) && typeof m.text === "string" && m.text && Date.now() - new Date(String(m.at)).getTime() < BRIEF_TTL) return Promise.resolve(m.text);
      } catch { /* кэш испорчен или недоступен */ }
    }
    // один запрос на ключ, даже если экран спросил дважды (сводка стоит денег)
    const running = briefFlights.get(key);
    if (running) return running;
    const p = request("brief", tr("сводка"), {}, false)
      .then((r) => {
        if (!r.reply) return "";
        try {
          for (let i = localStorage.length - 1; i >= 0; i--) { const k = localStorage.key(i); if (k?.startsWith("brief3_") && k !== key) localStorage.removeItem(k); }
          localStorage.setItem(key, JSON.stringify({ at: new Date().toISOString(), text: r.reply }));
        } catch { /* приватный режим */ }
        return r.reply;
      })
      .catch(() => "")
      .finally(() => briefFlights.delete(key));
    briefFlights.set(key, p);
    return p;
  },

  /** Подсказка «осталось N сообщений», когда лимит на исходе (0 — Оси сам скажет в ответе). */
  leftHint(r: { left?: number }): string | null {
    const n = r.left;
    if (n == null || n > 5 || n === 0) return null;
    return tr("Сообщений Оси на сегодня осталось: {0}", [n]);
  },
  /** Почему сообщения закончились — текст для окна подписок (null — у «Умницы» больше некуда). */
  limitReason(): string | null {
    const p = Plans.current;
    if (p === "smart") return null;
    return p === "free" ? tr("В бесплатном плане Оси отвечает на одно сообщение в день.") : tr("Сообщения Оси на сегодня закончились. В «Умнице» их 100 в день.");
  },
  /** Лимит исчерпан — предложить подписку побольше. */
  offerMore(r: { limitHit?: boolean }): void {
    const why = r.limitHit ? Assistant.limitReason() : null;
    if (why) void showPlans(why);
  },
  /** Ошибка — это отсутствие связи (а не ответ сервера). */
  isOffline: (e: unknown): boolean => (e instanceof AssistantError ? e.offline : e instanceof TypeError),
  errorText(e: unknown): string {
    if (Assistant.isOffline(e)) return tr("Нет связи с сервером. Проверь интернет.");
    if (e instanceof AssistantError) return e.message && e.message !== "empty" ? tr("Оси не смог ответить: {0}", [e.message]) : tr("Оси не смог ответить (код {0}).", [e.status ?? 0]);
    return tr("Оси не смог ответить: {0}", [String((e as Error)?.message ?? e).slice(0, 300)]);
  },
};

// ====================================================================== проверка ввода

/** Сколько действий можно применить за один раз. */
export const MAX_ACTIONS = 60;
const MAX_STAGES = 40;

const KNOWN = new Set([
  "create_client", "create_project", "create_task", "create_event", "invite_friends", "add_payment", "create_tracker", "add_tracker_entry", "set_stage_status", "complete_task",
  "create_note", "remember", "create_job", "add_work_session", "add_work_extra", "start_work", "stop_work", "update_event", "delete_event", "update_task", "delete_task",
  "update_matching", "delete_matching", "update_project", "update_client", "update_note", "delete_note", "update_job", "delete_work_session", "delete_work_extra", "add_mood", "set_remind_default",
]);

/** Строка (обрезанная) или null. */
const str = (v: unknown, max = 500): string | null => (typeof v === "string" ? v.slice(0, max) : null);
/** Непустая строка или null. */
const text = (v: unknown, max = 500): string | null => { const s = str(v, max)?.trim(); return s ? s : null; };
/** Конечное число в разумных пределах или null. */
const num = (v: unknown, min = -1e12, max = 1e12): number | null => (typeof v === "number" && Number.isFinite(v) && v >= min && v <= max ? v : null);
const has = (a: Row, k: string) => Object.prototype.hasOwnProperty.call(a, k);
const sphere = (v: unknown) => (v === "personal" ? "personal" : "work");
const priority = (v: unknown) => (v === "important" ? "important" : "normal");
const currency = (v: unknown) => (typeof v === "string" && /^[A-Z]{3}$/.test(v) ? v : store.profile?.currency ?? "PLN");
const remind = (v: unknown) => { const n = num(v, 0, 60 * 24 * 60); return n == null ? null : Math.round(n); };

/**
 * Время от модели: «YYYY-MM-DD» или «YYYY-MM-DDTHH:MM» — локальное (без зоны), как DateTime.tryParse в Dart.
 * new Date("YYYY-MM-DD") в браузере считает дату в UTC, поэтому разбираем сами.
 */
function parseLocal(v: unknown): Date | null {
  if (typeof v !== "string") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?)?(Z|[+-]\d{2}:?\d{2})?$/.exec(v.trim());
  if (!m) return null;
  const [y, mo, d, hh, mi, ss] = [+m[1], +m[2], +m[3], +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0)];
  if (y < 1970 || y > 2200 || mo < 1 || mo > 12 || d < 1 || d > 31 || hh > 23 || mi > 59 || ss > 59) return null;
  if (m[7]) {
    if (m[4] == null) return null;
    const z = new Date(v.trim().replace(" ", "T"));
    return Number.isNaN(z.getTime()) ? null : z;
  }
  const out = new Date(y, mo - 1, d, hh, mi, ss);
  return Number.isNaN(out.getTime()) || out.getDate() !== d ? null : out;
}
/** Локальное время → UTC ISO (как в базе). */
const iso = (v: unknown): string | null => parseLocal(v)?.toISOString() ?? null;
/** «YYYY-MM-DD» (первые 10 символов), если это настоящая дата. */
const dateStr = (v: unknown): string | null => (typeof v === "string" && v.length >= 10 && parseLocal(v.slice(0, 10)) ? v.slice(0, 10) : null);
const hasTime = (v: unknown) => typeof v === "string" && v.length > 10;

/** Список id друзей из действия (["…"] или одна строка), только настоящие друзья. */
function friendIds(v: unknown): string[] {
  const raw = Array.isArray(v) ? v : v == null ? [] : [v];
  const mine = new Set(friends.accepted.map((f) => f.id));
  return [...new Set(raw.filter((x): x is string => typeof x === "string" && mine.has(x)))];
}
/** Имена друзей по их id (для карточки предложения). */
function names(v: unknown): string {
  const ids = new Set((Array.isArray(v) ? v : v == null ? [] : [v]).filter((x): x is string => typeof x === "string"));
  return friends.list.filter((f) => ids.has(f.id)).map((f) => f.name).join(", ");
}

const eventById = (id: unknown) => (typeof id === "string" ? store.events.find((x) => x.id === id) ?? null : null);
const taskById = (id: unknown) => (typeof id === "string" ? store.tasks.find((x) => x.id === id) ?? null : null);
const noteById = (id: unknown) => (typeof id === "string" ? store.notes.find((x) => x.id === id) ?? null : null);
const stageById = (id: unknown) => (typeof id === "string" ? store.stages.find((x) => x.id === id) ?? null : null);
const idStr = (v: unknown) => (typeof v === "string" ? v : null);

// ====================================================================== условие «все …»

const matchOf = (a: Row): Row => (isObj(a.match) ? a.match : {});

/** Период условия. bad — границу прислали, но разобрать её нельзя: тогда не трогаем ничего. */
function range(a: Row): { from: Date | null; to: Date | null; bad: boolean } {
  const m = matchOf(a);
  const d = (v: unknown) => (typeof v === "string" && v.length >= 10 ? parseLocal(v.slice(0, 10)) : null);
  const from = d(m.from), t = d(m.to);
  const bad = (m.from != null && !from) || (m.to != null && !t);
  return { from, to: t ? new Date(t.getFullYear(), t.getMonth(), t.getDate(), 23, 59, 59) : null, bad };
}
const titleQuery = (m: Row) => (typeof m.title === "string" ? m.title.trim().toLowerCase() : "");
/** Условие само по себе корректно (иначе под него не подходит ничего). */
const matchValid = (m: Row) => (m.title == null || typeof m.title === "string") && (m.sphere == null || m.sphere === "work" || m.sphere === "personal");

/** События (серии — целиком), подходящие под условие «все …». */
function matchEvents(a: Row): Event[] {
  const m = matchOf(a);
  const { from, to, bad } = range(a);
  if (bad || !matchValid(m)) return [];
  const q = titleQuery(m), sph = m.sphere;
  const hasFilter = m.all === true || !!q || sph != null || !!from || !!to;
  if (!hasFilter) return []; // без условия и без явного all:true не трогаем ничего
  return store.events.filter((e) => {
    if (q && !e.title.toLowerCase().includes(q)) return false;
    if (sph != null && e.sphere !== sph) return false;
    if (e.repeat) {
      if (to && e.startsAt > to) return false;
      if (from && e.repeat.until && e.repeat.until < from) return false;
      return true;
    }
    if (from && (e.endsAt ?? e.startsAt) < from) return false;
    if (to && e.startsAt > to) return false;
    return true;
  });
}

function matchTasks(a: Row): Task[] {
  const m = matchOf(a);
  const { from, to, bad } = range(a);
  if (bad || !matchValid(m)) return [];
  const q = titleQuery(m), sph = m.sphere;
  const hasFilter = m.all === true || m.overdue === true || typeof m.done === "boolean" || !!q || sph != null || !!from || !!to;
  if (!hasFilter) return [];
  const now = new Date();
  return store.tasks.filter((t) => {
    if (q && !t.title.toLowerCase().includes(q)) return false;
    if (typeof m.done === "boolean" && t.done !== m.done) return false;
    const d = t.dueAt;
    // просрочено = не выполнено и срок прошёл (для «весь день» — день уже закончился)
    if (m.overdue === true) {
      if (t.done || !d) return false;
      const end = t.allDay ? new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1) : d;
      if (!(end < now)) return false;
    }
    if (sph != null && t.sphere !== sph) return false;
    if ((from || to) && !d) return false;
    if (from && d! < from) return false;
    if (to && d! > to) return false;
    return true;
  });
}

// ====================================================================== что меняет действие

const shiftBy = (d: Date, minutes: number) => new Date(d.getTime() + Math.round(minutes) * 60_000).toISOString();
/** Перенести на другой день, сохранив время суток. */
const moveTo = (d: Date, day: string) => new Date(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10), d.getHours(), d.getMinutes());

/** a — само действие update_event или блок set из update_matching (у него нет type). */
function eventPatch(a: Row, e: Event): Row {
  const p: Row = {};
  for (const k of ["title", "location"]) { const v = text(a[k]); if (v) p[k] = v; }
  if (typeof a.notes === "string") p.notes = a.notes.slice(0, 20000);
  if (typeof a.color === "string" && a.color in NAMED) p.color = a.color;
  if (a.sphere != null) p.sphere = sphere(a.sphere);
  if (a.priority != null) p.priority = priority(a.priority);
  if (typeof a.all_day === "boolean") p.all_day = a.all_day;
  if (has(a, "remind_minutes")) {
    if (a.remind_minutes == null) { if (a.type === "update_event") p.remind_minutes = null; }
    else if (remind(a.remind_minutes) != null) p.remind_minutes = remind(a.remind_minutes);
  }
  const dur = e.endsAt ? e.endsAt.getTime() - e.startsAt.getTime() : null;
  const ns = typeof a.starts_at === "string" ? parseLocal(a.starts_at) : null;
  if (ns) {
    p.starts_at = ns.toISOString();
    // длительность сохраняется, если конец не назван
    if (typeof a.ends_at !== "string" && dur != null && !e.repeat) p.ends_at = new Date(ns.getTime() + dur).toISOString();
  }
  if (typeof a.ends_at === "string" && iso(a.ends_at)) p.ends_at = iso(a.ends_at);
  // у экземпляра серии меняем саму серию
  const base = store.events.find((x) => x.id === e.id) ?? e;
  const day = dateStr(a.move_to_date);
  if (day && !ns) {
    const start = moveTo(base.startsAt, day);
    p.starts_at = start.toISOString();
    if (base.endsAt) p.ends_at = new Date(start.getTime() + (base.endsAt.getTime() - base.startsAt.getTime())).toISOString();
  }
  const sh = num(a.shift_minutes, -525600, 525600);
  if (sh != null && sh !== 0) {
    p.starts_at = shiftBy(base.startsAt, sh);
    if (base.endsAt) p.ends_at = shiftBy(base.endsAt, sh);
  }
  if (has(a, "repeat") && a.type === "update_event") p.repeat = RepeatRule.parse(a.repeat)?.toJson() ?? null;
  return p;
}

function taskPatch(a: Row, t: Task): Row {
  const p: Row = {};
  const title = text(a.title);
  if (title) p.title = title;
  if (typeof a.notes === "string") p.notes = a.notes.slice(0, 20000);
  if (a.sphere != null) p.sphere = sphere(a.sphere);
  if (a.priority != null) p.priority = priority(a.priority);
  const due = typeof a.due_at === "string" ? iso(a.due_at) : null;
  if (due) {
    p.due_at = due;
    p.all_day = typeof a.all_day === "boolean" ? a.all_day : !hasTime(a.due_at);
  } else if (typeof a.all_day === "boolean") p.all_day = a.all_day;
  const day = dateStr(a.move_to_date);
  if (day && !due) {
    if (t.dueAt) p.due_at = moveTo(t.dueAt, day).toISOString();
    else { p.due_at = parseLocal(day)!.toISOString(); p.all_day = true; }
  }
  const sh = num(a.shift_minutes, -525600, 525600);
  if (sh != null && t.dueAt) p.due_at = shiftBy(t.dueAt, sh);
  if (remind(a.remind_minutes) != null) p.remind_minutes = remind(a.remind_minutes);
  if (a.done === false) p.done_at = null;
  if (a.done === true && !t.done) p.done_at = new Date().toISOString();
  return p;
}

// ====================================================================== выполнение

const nextColor = (n: number) => ["clay", "orange", "lavender", "sage", "teal", "mustard", "charcoal", "navy", "blush"][n % 9];
const iconFor = (kind: string) => (kind === "money" ? "coin" : kind === "habit" ? "spark" : kind === "counter" ? "sun" : "star");

const LIMIT_OF: Record<string, Limit> = { create_project: "projects", create_tracker: "trackers", create_note: "notes", create_job: "jobs" };
const limitText = (l: Limit) => ({
  projects: tr("В бесплатном плане — один проект."),
  jobs: tr("В бесплатном плане — одна работа."),
  notes: tr("В бесплатном плане — до 3 заметок."),
  trackers: tr("В бесплатном плане — до 2 целей."),
}[l]);

/** Только то, что приложение умеет выполнять: объекты с известным type, не больше MAX_ACTIONS. */
function clean(actions: unknown): Row[] {
  if (!Array.isArray(actions)) return [];
  const out: Row[] = [];
  for (const a of actions) {
    if (isObj(a) && typeof a.type === "string" && KNOWN.has(a.type)) out.push(a);
    if (out.length >= MAX_ACTIONS) break;
  }
  return out;
}

/** Выполнить проверенный список. Возвращает число выполненных; первая ошибка пробрасывается после всех действий. */
async function run(actions: Row[]): Promise<number> {
  const s = store;
  const refs = new Map<string, string>();
  const invites: [string, string[]][] = []; // событие → кого позвать (после всех действий)
  let blocked: string | null = null; // что не вошло в бесплатный план — после применения покажем подписки
  let done = 0;
  let failure: unknown = null;

  /** id из действия: существующая строка пользователя или ссылка на созданное этим же ответом. */
  const idOf = (a: Row, idKey: string, refKey: string, exists: (id: string) => boolean): string | null => {
    const id = a[idKey];
    if (typeof id === "string" && id && exists(id)) return id;
    const ref = a[refKey];
    return typeof ref === "string" ? refs.get(ref) ?? null : null;
  };
  const remember = (a: Row, id: string) => { if (typeof a.ref === "string" && a.ref) refs.set(a.ref.slice(0, 64), id); };
  const clientOf = (a: Row) => idOf(a, "client_id", "client_ref", (id) => !!s.client(id));
  const projectOf = (a: Row) => idOf(a, "project_id", "project_ref", (id) => !!s.project(id));
  const jobOf = (a: Row) => idOf(a, "job_id", "job_ref", (id) => !!s.job(id));

  const one = async (a: Row): Promise<boolean> => {
    const lim = LIMIT_OF[a.type as string];
    if (lim && Plans.blocked(lim)) { blocked ??= limitText(lim); return false; }
    switch (a.type) {
      case "create_client": {
        const id = await s.insert("clients", { name: text(a.name) ?? tr("Без имени"), company: text(a.company), phone: text(a.phone, 60), email: text(a.email, 200), notes: str(a.notes, 20000) ?? "", color: nextColor(s.clients.length) });
        remember(a, id);
        return true;
      }
      case "create_project": {
        const id = await s.insert("projects", {
          client_id: clientOf(a), name: text(a.name) ?? tr("Проект"), description: str(a.description, 20000) ?? "", budget: num(a.budget, 0) ?? 0, currency: currency(a.currency),
          deadline: dateStr(a.deadline), sphere: sphere(a.sphere), color: nextColor(s.projects.length + 3), icon: "briefcase",
        });
        remember(a, id);
        return true;
      }
      case "create_task": {
        const due = iso(a.due_at);
        await s.insert("tasks", {
          project_id: projectOf(a), title: text(a.title) ?? tr("Задача"), notes: str(a.notes, 20000) ?? "", priority: priority(a.priority), sphere: sphere(a.sphere), due_at: due,
          all_day: typeof a.all_day === "boolean" ? a.all_day : !(due && hasTime(a.due_at)),
          repeat: due ? RepeatRule.parse(a.repeat)?.toJson() ?? null : null,
          ...(remind(a.remind_minutes) != null ? { remind_minutes: remind(a.remind_minutes) } : {}),
        });
        return true;
      }
      case "create_event": {
        const id = await s.insert("events", {
          title: text(a.title) ?? tr("Событие"), notes: str(a.notes, 20000) ?? "", location: text(a.location), starts_at: iso(a.starts_at) ?? new Date().toISOString(), ends_at: iso(a.ends_at),
          all_day: a.all_day === true, sphere: sphere(a.sphere), priority: priority(a.priority), client_id: clientOf(a), project_id: projectOf(a),
          remind_minutes: has(a, "remind_minutes") ? remind(a.remind_minutes) : s.profile?.remindDefault ?? null,
          repeat: RepeatRule.parse(a.repeat)?.toJson() ?? null,
        });
        const who = friendIds(a.invite);
        if (who.length) invites.push([id, who]);
        return true;
      }
      case "invite_friends": {
        const e = eventById(a.event_id), who = friendIds(a.friends);
        if (!e || !who.length) return false;
        invites.push([e.id, who]);
        return true;
      }
      case "add_payment": {
        const pid = projectOf(a), amount = num(a.amount);
        if (!pid || amount == null) return false;
        await s.insert("payments", { project_id: pid, amount, paid_on: dateStr(a.paid_on) ?? dateOnly(new Date()), note: str(a.note, 2000) ?? "" });
        return true;
      }
      case "create_tracker": {
        const kind = ["money", "stages", "counter", "habit"].includes(a.kind) ? (a.kind as string) : "stages";
        const id = await s.insert("trackers", {
          title: text(a.title) ?? tr("Цель"), kind, target: num(a.target, 0), unit: text(a.unit, 40), deadline: dateStr(a.deadline), sphere: sphere(a.sphere ?? "personal"),
          icon: iconFor(kind), color: nextColor(s.trackers.length + 5),
          // копилка на подарок: ссылка на событие (существующее или созданное этим же ответом)
          event_id: idOf(a, "event_id", "event_ref", (x) => s.events.some((e) => e.id === x)),
        });
        remember(a, id);
        // сервер мог отказать (лимит тарифа) — тогда строка уже откатилась и этапы создавать не для чего
        if (!s.tracker(id)) return false;
        const stages = (Array.isArray(a.stages) ? a.stages : []).filter(isObj).slice(0, MAX_STAGES);
        for (let i = 0; i < stages.length; i++) {
          const st = stages[i];
          await s.insert("tracker_stages", { tracker_id: id, title: text(st.title) ?? tr("Этап {0}", [i + 1]), position: i, due_on: dateStr(st.due_on), critical: st.critical === true, status: i === 0 ? "active" : "todo" });
        }
        return true;
      }
      case "add_tracker_entry": {
        const tid = idOf(a, "tracker_id", "tracker_ref", (id) => !!s.tracker(id));
        if (!tid) return false;
        await s.insert("tracker_entries", { tracker_id: tid, amount: num(a.amount) ?? 1, note: str(a.note, 2000) ?? "" });
        return true;
      }
      case "set_stage_status": {
        const st = stageById(a.stage_id), status = a.status;
        if (!st || (status !== "todo" && status !== "active" && status !== "done")) return false;
        await s.update("tracker_stages", st.id, { status, done_at: status === "done" ? new Date().toISOString() : null });
        return true;
      }
      case "complete_task": {
        const t = taskById(a.task_id);
        if (!t || t.done) return false;
        await s.toggleTask(t);
        return true;
      }
      case "create_note":
        await s.insert("notes", { title: str(a.title) ?? "", body: str(a.body, 50000) ?? "", pinned: a.pinned === true, sphere: sphere(a.sphere ?? "personal") });
        return true;
      case "remember": {
        // сервер обычно записывает факт сам и сюда его не присылает; оставлено для старых сообщений
        const about = s.profile?.about ?? "", fact = text(a.fact, 500);
        if (!fact || !s.profile) return false;
        await s.updateProfile({ about: about ? `${about}\n• ${fact}` : `• ${fact}` });
        return true;
      }
      case "create_job": {
        const id = await s.insert("jobs", { name: text(a.name) ?? tr("Работа"), rate: num(a.rate, 0) ?? 0, currency: currency(a.currency), color: ["teal", "sage", "lavender", "apricot", "sky", "plum"][s.jobs.length % 6], icon: "briefcase" });
        remember(a, id);
        return true;
      }
      case "add_work_session": {
        const jid = jobOf(a) ?? (s.jobs.length === 1 ? s.jobs[0].id : null);
        const start = parseLocal(a.started_at);
        if (!jid || !start) return false;
        let end = parseLocal(a.ended_at);
        // конец раньше начала — смена через полночь
        if (end && end <= start) end = new Date(end.getTime() + 86400_000);
        const rate = s.job(jid)?.rate ?? 0;
        await s.insert("work_sessions", { job_id: jid, started_at: start.toISOString(), ended_at: end?.toISOString() ?? null, break_minutes: Math.trunc(num(a.break_minutes, 0, 1440) ?? 0), note: str(a.note, 2000) ?? "", rate: rate > 0 ? rate : null });
        return true;
      }
      case "add_work_extra": {
        const jid = jobOf(a) ?? (s.jobs.length === 1 ? s.jobs[0].id : null);
        const amount = num(a.amount) ?? 0;
        if (!jid || amount <= 0) return false;
        await s.insert("work_extras", { job_id: jid, done_on: dateStr(a.date) ?? dateOnly(new Date()), title: text(a.title) ?? tr("Задание"), amount, note: str(a.note, 2000) ?? "" });
        return true;
      }
      case "start_work": {
        const j = s.job(jobOf(a)) ?? (s.jobs.length === 1 ? s.jobs[0] : null);
        if (!j) return false;
        await s.startShift(j);
        return true;
      }
      case "stop_work": {
        const jid = jobOf(a);
        const list = s.running.filter((x) => !jid || x.jobId === jid);
        for (const x of list) await s.stopShift(x);
        return list.length > 0;
      }
      case "update_event": {
        const e = eventById(a.event_id);
        if (!e) return false;
        const p = eventPatch(a, e);
        if (!Object.keys(p).length) return false;
        await s.update("events", e.id, p);
        return true;
      }
      case "delete_event": {
        const e = eventById(a.event_id);
        if (!e) return false;
        const day = dateStr(a.date);
        if (e.repeat && day) await s.update("events", e.id, { repeat_skip: [...new Set([...e.skip, day])] });
        else await s.delete("events", e.id);
        return true;
      }
      case "update_task": {
        const t = taskById(a.task_id);
        if (!t) return false;
        const p = taskPatch(a, t);
        if (!Object.keys(p).length) return false;
        await s.update("tasks", t.id, p);
        return true;
      }
      case "delete_task": {
        const t = taskById(a.task_id);
        if (!t) return false;
        await s.delete("tasks", t.id);
        return true;
      }
      case "update_matching": {
        const set = isObj(a.set) ? a.set : {};
        const patches: Record<string, Row> = {};
        const add = (id: string, p: Row) => { if (Object.keys(p).length) patches[id] = p; };
        if (a.kind === "tasks") for (const t of matchTasks(a)) add(t.id, taskPatch(set, t));
        else for (const e of matchEvents(a)) add(e.id, eventPatch(set, e));
        if (!Object.keys(patches).length) return false;
        await s.updateMany(a.kind === "tasks" ? "tasks" : "events", patches);
        return true;
      }
      case "delete_matching": {
        if (a.kind === "tasks") {
          const ids = matchTasks(a).map((t) => t.id);
          if (!ids.length) return false;
          await s.deleteMany("tasks", ids);
          return true;
        }
        const { from, to } = range(a);
        const list = matchEvents(a), whole: string[] = [];
        for (const e of list) {
          // серия, которая выходит за период, — пропускаем только дни внутри периода
          if (e.repeat && (from || to)) {
            const skip = new Set(e.skip);
            for (const d of e.repeat.dates(e.startsAt, to ?? new Date(2100, 0, 1))) if (!from || d >= from) skip.add(dateOnly(d));
            await s.update("events", e.id, { repeat_skip: [...skip] });
          } else whole.push(e.id);
        }
        if (whole.length) await s.deleteMany("events", whole);
        return list.length > 0;
      }
      case "update_project": {
        const p0 = s.project(idStr(a.project_id));
        if (!p0) return false;
        const p: Row = {};
        const name = text(a.name);
        if (name) p.name = name;
        if (typeof a.description === "string") p.description = a.description.slice(0, 20000);
        if (a.status === "active" || a.status === "paused" || a.status === "done") p.status = a.status;
        if (num(a.budget, 0) != null) p.budget = num(a.budget, 0);
        if (has(a, "deadline") && (a.deadline == null || dateStr(a.deadline))) p.deadline = dateStr(a.deadline);
        if (a.sphere != null) p.sphere = sphere(a.sphere);
        if (!Object.keys(p).length) return false;
        await s.update("projects", p0.id, p);
        return true;
      }
      case "update_client": {
        const c = s.client(idStr(a.client_id));
        if (!c) return false;
        const p: Row = {};
        const name = text(a.name);
        if (name) p.name = name;
        for (const k of ["company", "phone", "email"]) if (has(a, k) && (typeof a[k] === "string" || a[k] == null)) p[k] = text(a[k], 200);
        if (has(a, "notes") && (typeof a.notes === "string" || a.notes == null)) p.notes = str(a.notes, 20000) ?? "";
        if (!Object.keys(p).length) return false;
        await s.update("clients", c.id, p);
        return true;
      }
      case "update_note": {
        const n = noteById(a.note_id);
        if (!n) return false;
        const p: Row = {};
        if (typeof a.title === "string") p.title = a.title.slice(0, 500);
        if (typeof a.body === "string") p.body = a.body.slice(0, 50000);
        if (typeof a.pinned === "boolean") p.pinned = a.pinned;
        if (!Object.keys(p).length) return false;
        await s.update("notes", n.id, p);
        return true;
      }
      case "delete_note": {
        const n = noteById(a.note_id);
        if (!n) return false;
        await s.delete("notes", n.id);
        return true;
      }
      case "update_job": {
        const j = s.job(idStr(a.job_id));
        if (!j) return false;
        const p: Row = {};
        const name = text(a.name);
        if (name) p.name = name;
        if (num(a.rate, 0) != null) p.rate = num(a.rate, 0);
        if (!Object.keys(p).length) return false;
        await s.update("jobs", j.id, p);
        return true;
      }
      case "delete_work_session": {
        const x = s.sessions.find((y) => y.id === a.session_id);
        if (!x) return false;
        await s.delete("work_sessions", x.id);
        return true;
      }
      case "delete_work_extra": {
        const x = s.extras.find((y) => y.id === a.extra_id);
        if (!x) return false;
        await s.delete("work_extras", x.id);
        return true;
      }
      case "add_mood": {
        const sc = num(a.score);
        const score = sc == null ? null : Math.round(sc);
        if (score == null || score < 1 || score > 5) return false;
        const en = num(a.energy);
        await s.insert("moods", { score, ...(en != null ? { energy: Math.min(5, Math.max(1, Math.round(en))) } : {}), tags: [], note: str(a.note, 2000) ?? "" });
        return true;
      }
      case "set_remind_default":
        if (!s.profile) return false;
        await s.updateProfile({ remind_default: remind(a.minutes) });
        return true;
      default:
        return false; // незнакомое действие — не выполняем
    }
  };

  for (const a of actions) {
    try { if (await one(a)) done++; }
    catch (e) { failure ??= e; }
  }
  if (blocked) void showPlans(blocked);
  for (const [id, who] of invites) {
    try { await friends.inviteToEvent(id, who); }
    catch { toast(tr("Не получилось позвать: нет сети?"), "error"); }
  }
  if (failure) throw failure;
  return done;
}

// ====================================================================== статус предложения и защита от повтора

/** Сообщения, которые применяются прямо сейчас: второй тап (или «давай» вдогонку) не должен создать дубль. */
const inFlight = new Set<string>();
/** Сообщения, по которым решение уже принято в этой вкладке (статус в базе мог ещё не доехать). */
const settled = new Map<string, "applied" | "dismissed">();
const inFlightAnon = new WeakSet<object>();

const statusOf = (messageId: string): string => settled.get(messageId) ?? store.chat.find((m) => m.id === messageId)?.actionsStatus ?? "pending";
const writeStatus = (messageId: string, items: Row[], status: "applied" | "dismissed") => {
  settled.set(messageId, status);
  return store.update("ai_messages", messageId, { actions: { items, status } });
};

export type ApplyResult = { done: number; status: "applied" | "dismissed" | "busy" };

async function apply(messageId: string | null | undefined, actions: Row[]): Promise<ApplyResult> {
  const key = messageId || null;
  if (key) {
    if (inFlight.has(key)) return { done: 0, status: "busy" };
    const st = statusOf(key);
    if (st !== "pending") return { done: 0, status: st === "applied" ? "applied" : "dismissed" };
    inFlight.add(key);
  } else {
    if (inFlightAnon.has(actions)) return { done: 0, status: "busy" };
    inFlightAnon.add(actions);
  }
  try {
    const items = clean(actions);
    if (!items.length) {
      if (key) await writeStatus(key, actions.filter(isObj), "dismissed");
      return { done: 0, status: "dismissed" };
    }
    // статус ставим до выполнения: что бы ни случилось дальше, повторное «Применить» дубль не создаст
    if (key) settled.set(key, "applied");
    let done = 0, failure: unknown = null;
    try { done = await run(items); } catch (e) { failure = e; }
    if (key) await writeStatus(key, items, "applied");
    if (failure) throw failure;
    return { done, status: "applied" };
  } finally {
    if (key) inFlight.delete(key);
    else inFlightAnon.delete(actions);
  }
}

/** Выполнение действий Оси после «Применить» (create_event, add_payment, update_matching …). */
export const ActionRunner = {
  /** Заголовок и подпись карточки действия. */
  describe: (a: Row): { title: string; subtitle: string; icon: string } => describeAction(a),
  /** Применить все действия сообщения; возвращает число выполненных. Статус (applied) пишется в ai_messages. */
  runAll: (messageId: string | null | undefined, actions: Row[]): Promise<number> => apply(messageId, actions).then((r) => r.done),
  /** То же, но с итоговым статусом: busy — уже применяется, applied/dismissed — решение уже было принято раньше. */
  apply,
  /** «Не надо»: статус dismissed в ai_messages. */
  async dismiss(messageId: string | null | undefined, actions: Row[]): Promise<void> {
    if (!messageId || inFlight.has(messageId) || statusOf(messageId) !== "pending") return;
    await writeStatus(messageId, actions.filter(isObj), "dismissed");
  },
  /** Статус предложения с учётом решений, принятых в этой вкладке. */
  status: (messageId: string | null | undefined, fallback = "pending"): string => (messageId ? settled.get(messageId) ?? fallback : fallback),
  /** Действия, которые будут выполнены: известные типы, не больше MAX_ACTIONS. */
  clean,
  /** Сколько строк затронет «все …» (null — действие не массовое). */
  matchCount: (a: Row): number | null => (a.type === "update_matching" || a.type === "delete_matching" ? (a.kind === "tasks" ? matchTasks(a).length : matchEvents(a).length) : null),
  /** Действие удаляет данные (карточка подсвечивается). */
  destructive: (a: Row): boolean => typeof a.type === "string" && a.type.startsWith("delete_"),
  matchEvents,
  matchTasks,
};

// ====================================================================== описание для карточки

/** Значение из действия как короткий текст (всё, что не строка и не число, — пусто). */
const show = (v: unknown, max = 160): string => (typeof v === "string" ? (v.length > max ? v.slice(0, max) + "…" : v) : typeof v === "number" && Number.isFinite(v) ? String(v) : "");
const join = (parts: (string | null | undefined | false)[], sep = " · ") => parts.filter((x): x is string => typeof x === "string" && x.length > 0).join(sep);
/** «d MMMM y» без русского «г.» — как DateFormat в приложении. */
const dayYear = (d: Date) => fmtDayYear(d).replace(/\s*г\.?$/, "");

function when(v: unknown): string {
  if (typeof v !== "string" || !v) return "";
  const d = parseLocal(v);
  if (!d) return show(v, 40);
  const withTime = v.length > 10 && !(d.getHours() === 0 && d.getMinutes() === 0);
  return withTime ? `${dayYear(d)}, ${fmtTime(d)}` : dayYear(d);
}
const sum = (n: unknown, cur: unknown) => (num(n) == null ? "" : money(num(n)!, typeof cur === "string" && cur ? cur.slice(0, 6) : "PLN"));

/** «↻ каждый понедельник до 30 ноября» для карточки действия. */
function repeatText(rule: unknown, start: unknown): string | null {
  const r = RepeatRule.parse(rule), d = parseLocal(start);
  return r && d ? `↻ ${r.describe(d)}` : null;
}

/** «→ Работа · 18:00 · важно» — что меняет действие. */
function changes(a: Row): string {
  const w = (v: unknown) => { const d = parseLocal(v); return d ? (hasTime(v) ? fmtDateTime(d) : fmtDay(d)) : ""; };
  const sh = num(a.shift_minutes);
  const own = a.type === "update_event" || a.type === "update_task";
  const rm = num(a.remind_minutes);
  return join([
    a.sphere === "work" ? tr("→ в «Работу»") : a.sphere === "personal" ? tr("→ в «Личное»") : null,
    typeof a.title === "string" ? (own ? tr("название «{0}»", [show(a.title)]) : `«${show(a.title)}»`) : null,
    typeof a.starts_at === "string" ? w(a.starts_at) : null,
    typeof a.due_at === "string" ? w(a.due_at) : null,
    dateStr(a.move_to_date) ? w(dateStr(a.move_to_date)) : null,
    sh != null && sh !== 0 ? (sh > 0 ? tr("позже на {0} мин", [Math.round(sh)]) : tr("раньше на {0} мин", [-Math.round(sh)])) : null,
    a.priority === "important" ? tr("важно") : a.priority === "normal" ? tr("обычное") : null,
    rm != null ? (rm === 0 ? tr("напомнить в момент начала") : tr("напомнить за {0} мин", [Math.round(rm)])) : null,
    has(a, "remind_minutes") && a.remind_minutes == null && a.type === "update_event" ? tr("без напоминания") : null,
    typeof a.location === "string" ? show(a.location) : null,
    typeof a.status === "string" ? (a.status === "done" ? tr("завершён") : a.status === "paused" ? tr("на паузе") : tr("в работе")) : null,
    num(a.rate) != null ? tr("ставка {0}", [num(a.rate)]) : null,
    a.done === false ? tr("вернуть в работу") : null,
    a.done === true ? tr("выполнено") : null,
    a.pinned === true ? tr("закрепить") : null,
  ]);
}

/** Человеческое описание действия для карточки подтверждения. */
function describeAction(a: Row): { title: string; subtitle: string; icon: string } {
  const s = store;
  if (!isObj(a)) return { title: "", subtitle: "", icon: "plus" };
  switch (a.type) {
    case "create_client":
      return { title: tr("Новый клиент: {0}", [show(a.name)]), subtitle: join([show(a.company), show(a.phone), show(a.email)]), icon: "person" };
    case "create_project":
      return { title: tr("Проект: {0}", [show(a.name)]), subtitle: join([num(a.budget) ? tr("бюджет {0}", [sum(a.budget, a.currency)]) : null, a.deadline != null ? tr("дедлайн {0}", [when(a.deadline)]) : null]), icon: "folder" };
    case "create_task":
      return { title: tr("Задача: {0}", [show(a.title)]), subtitle: join([a.due_at != null ? when(a.due_at) : null, repeatText(a.repeat, a.due_at), a.priority === "important" ? tr("важно") : null, a.sphere === "personal" ? tr("личное") : tr("работа")]), icon: "check" };
    case "create_event": {
      const who = names(a.invite);
      return { title: show(a.title) || tr("Событие"), subtitle: join([when(a.starts_at), repeatText(a.repeat, a.starts_at), show(a.location), a.sphere === "personal" ? tr("личное") : tr("работа"), who ? tr("позвать: {0}", [who]) : null]), icon: "calendar" };
    }
    case "invite_friends": {
      const e = eventById(a.event_id);
      return { title: tr("Позвать: {0}", [names(a.friends)]), subtitle: e ? `${e.title} · ${e.allDay ? dayYear(e.startsAt) : `${dayYear(e.startsAt)}, ${fmtTime(e.startsAt)}`}` : "", icon: "person" };
    }
    case "add_payment": {
      const p = s.project(idStr(a.project_id));
      return { title: tr("Оплата {0}", [sum(a.amount, p?.currency)]), subtitle: join([p?.name, show(a.note)]), icon: "coin" };
    }
    case "create_tracker": {
      const n = Array.isArray(a.stages) ? Math.min(a.stages.length, MAX_STAGES) : 0;
      return { title: tr("Цель: {0}", [show(a.title)]), subtitle: join([a.target != null ? tr("цель {0} {1}", [show(a.target), show(a.unit, 40)]).trim() : null, n > 0 ? tr("{0} этапов", [n]) : null, a.deadline != null ? tr("до {0}", [when(a.deadline)]) : null]), icon: "star" };
    }
    case "add_tracker_entry": {
      const t = s.tracker(idStr(a.tracker_id));
      return { title: `+${show(a.amount) || "1"} ${t?.unit ?? ""}`.trim(), subtitle: t?.title ?? "", icon: "plus" };
    }
    case "set_stage_status":
      return { title: tr("Этап: {0}", [stageById(a.stage_id)?.title ?? ""]), subtitle: a.status === "done" ? tr("готово") : a.status === "active" ? tr("в работе") : tr("впереди"), icon: "flag" };
    case "complete_task":
      return { title: tr("Закрыть задачу"), subtitle: taskById(a.task_id)?.title ?? "", icon: "check" };
    case "create_note":
      return { title: tr("Заметка: {0}", [show(a.title)]), subtitle: show(a.body, 240), icon: "note" };
    case "remember":
      return { title: tr("Запомнить"), subtitle: show(a.fact, 240), icon: "brain" };
    case "create_job":
      return { title: tr("Работа: {0}", [show(a.name)]), subtitle: tr("{0}/ч", [sum(a.rate ?? 0, a.currency ?? s.profile?.currency)]), icon: "briefcase" };
    case "add_work_session": {
      const j = s.job(idStr(a.job_id)) ?? (s.jobs.length === 1 ? s.jobs[0] : null);
      const st = parseLocal(a.started_at), en = parseLocal(a.ended_at);
      const span = st ? `${fmtDateTime(st)}${en ? `–${fmtTime(en)}` : ""}` : "";
      const br = num(a.break_minutes);
      return { title: tr("Смена: {0}", [j?.name ?? ""]), subtitle: join([span, br ? tr("перерыв {0} мин", [Math.round(br)]) : null]), icon: "clock" };
    }
    case "add_work_extra": {
      const j = s.job(idStr(a.job_id)) ?? (s.jobs.length === 1 ? s.jobs[0] : null);
      const day = parseLocal(dateStr(a.date));
      return { title: tr("Задание: {0}", [show(a.title)]), subtitle: join([sum(a.amount ?? 0, j?.currency), j?.name, day ? fmtDay(day) : null]), icon: "star" };
    }
    case "start_work":
      return { title: tr("Начать смену"), subtitle: s.job(idStr(a.job_id))?.name ?? "", icon: "clock" };
    case "stop_work":
      return { title: tr("Закончить смену"), subtitle: s.job(idStr(a.job_id))?.name ?? "", icon: "clock" };
    case "update_event":
      return { title: tr("Изменить: {0}", [eventById(a.event_id)?.title ?? show(a.title)]), subtitle: changes(a), icon: "calendar" };
    case "delete_event": {
      const e = eventById(a.event_id);
      return { title: tr("Удалить: {0}", [e?.title ?? ""]), subtitle: e?.repeat && a.date != null ? tr("только {0}", [when(a.date)]) : e?.repeat ? tr("всю серию") : e ? (e.allDay ? dayYear(e.startsAt) : `${dayYear(e.startsAt)}, ${fmtTime(e.startsAt)}`) : "", icon: "trash" };
    }
    case "update_task":
      return { title: tr("Изменить задачу: {0}", [taskById(a.task_id)?.title ?? show(a.title)]), subtitle: changes(a), icon: "check" };
    case "delete_task":
      return { title: tr("Удалить задачу"), subtitle: taskById(a.task_id)?.title ?? "", icon: "trash" };
    case "update_matching":
    case "delete_matching": {
      const tasks = a.kind === "tasks";
      const n = tasks ? matchTasks(a).length : matchEvents(a).length;
      const m = matchOf(a);
      const what = join([
        typeof m.title === "string" && m.title ? `«${show(m.title)}»` : null,
        m.overdue === true ? tr("просроченные") : null,
        m.done === true ? tr("выполненные") : m.done === false ? tr("невыполненные") : null,
        m.sphere === "work" ? tr("из «Работы»") : m.sphere === "personal" ? tr("из «Личного»") : null,
        m.from != null ? tr("с {0}", [when(m.from)]) : null,
        m.to != null ? tr("по {0}", [when(m.to)]) : null,
      ], " ");
      const del = a.type === "delete_matching";
      return {
        title: (del ? (tasks ? tr("Удалить все задачи {0}", [what]) : tr("Удалить все события {0}", [what])) : tasks ? tr("Все задачи {0}", [what]) : tr("Все события {0}", [what])).trim(),
        subtitle: join([tr("найдено: {0}", [n]), del ? null : changes(isObj(a.set) ? a.set : {})]),
        icon: del ? "trash" : "calendar",
      };
    }
    case "update_project":
      return { title: tr("Проект: {0}", [s.project(idStr(a.project_id))?.name ?? show(a.name)]), subtitle: changes(a), icon: "folder" };
    case "update_client":
      return { title: tr("Клиент: {0}", [s.client(idStr(a.client_id))?.name ?? show(a.name)]), subtitle: changes(a), icon: "person" };
    case "update_note":
      return { title: tr("Изменить заметку"), subtitle: show(a.title) || (noteById(a.note_id)?.title ?? ""), icon: "note" };
    case "delete_note": {
      const n = noteById(a.note_id);
      return { title: tr("Удалить заметку"), subtitle: n ? show(n.title || n.body, 240) : "", icon: "trash" };
    }
    case "update_job":
      return { title: tr("Работа: {0}", [s.job(idStr(a.job_id))?.name ?? show(a.name)]), subtitle: changes(a), icon: "briefcase" };
    case "delete_work_session": {
      const x = s.sessions.find((y) => y.id === a.session_id);
      return { title: tr("Удалить смену"), subtitle: x ? fmtDateTime(x.start) : "", icon: "trash" };
    }
    case "delete_work_extra":
      return { title: tr("Удалить задание"), subtitle: s.extras.find((y) => y.id === a.extra_id)?.title ?? "", icon: "trash" };
    case "set_remind_default": {
      const v = remind(a.minutes);
      return { title: tr("Напоминать о новых делах"), subtitle: v == null ? tr("не напоминать") : v === 0 ? tr("в момент начала") : tr("за {0} мин", [v]), icon: "bell" };
    }
    case "add_mood": {
      const sc = Math.min(5, Math.max(1, Math.round(num(a.score) ?? 3)));
      return { title: tr("Настроение: {0}", [[tr("Ужасно"), tr("Так себе"), tr("Нормально"), tr("Хорошо"), tr("Отлично")][sc - 1]]), subtitle: show(a.note, 240), icon: "heart" };
    }
  }
  return { title: show(a.type, 60), subtitle: "", icon: "plus" };
}
