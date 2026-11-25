// Импорт дел из других приложений — порт app/lib/services/importer.dart (тот же разбор и те же id строк,
// поэтому повторный импорт файла на другом устройстве обновляет дела, а не задваивает их).
// Файл намеренно без зависимостей от React и i18n: его же запускает проверка в Node.
import { NAMED } from "../../../ui/palette";

export type ImportRepeat = { freq: string; interval: number; days?: number[]; until?: string; count?: number | null };

/** Одно дело из чужого приложения, уже в понятиях OSIRIS. */
export interface ImportItem {
  sourceId: string;
  title: string;
  /** Местное время. */
  start: Date;
  end: Date | null;
  allDay: boolean;
  done: boolean;
  doneAt: Date | null;
  notes: string;
  /** Имя листа из палитры. */
  color: string | null;
  /** Правило OSIRIS: {"freq","interval","days","until"}. */
  repeat: ImportRepeat | null;
  /** Даты серии, которые убраны. */
  skip: string[];
  /** Напоминание за N минут (только событиям). */
  remind: number | null;
  /** «Подъём» / «Сон» из Structured. */
  routine: boolean;
  /** Задача (с галочкой), а не событие календаря. */
  task: boolean;
}

export interface ImportPlan {
  /** «Structured», «Календарь (.ics)», «JSON». */
  source: string;
  items: ImportItem[];
  /** Сколько записей не удалось понять. */
  ignored: number;
}

/** Ошибка разбора с понятным текстом (русский ключ перевода). */
export class ImportError extends Error {}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const objs = (v: unknown): Obj[] => (Array.isArray(v) ? v.filter(isObj) : []);
const num = (v: unknown, d = 0) => (typeof v === "number" && Number.isFinite(v) ? v : d);
/** Как интерполяция строк в Dart: null → «null» (от этого зависят id строк). */
const str = (v: unknown) => (v == null ? "null" : String(v));
const p2 = (n: number) => String(n).padStart(2, "0");
const dateOnly = (d: Date) => `${String(d.getFullYear()).padStart(4, "0")}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
const day0 = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addMinutes = (d: Date, m: number) => new Date(d.getTime() + m * 60_000);
const byStart = (a: ImportItem, b: ImportItem) => a.start.getTime() - b.start.getTime();

const item = (x: Partial<ImportItem> & Pick<ImportItem, "sourceId" | "title" | "start">): ImportItem => ({
  end: null, allDay: false, done: false, doneAt: null, notes: "", color: null, repeat: null, skip: [], remind: null, routine: false, task: false, ...x,
});

/** Прошедшее: закончилось раньше сегодняшнего дня и не повторяется дальше. */
export function isPast(x: ImportItem, today: Date): boolean {
  if (x.repeat) {
    const until = x.repeat.until;
    return until != null && until < dateOnly(today);
  }
  return (x.end ?? x.start).getTime() < today.getTime();
}

/**
 * Разбор файла импорта. Формат определяется сам:
 * • экспорт Structured (JSON: tasks / recurrings / occurrences);
 * • календарь .ics (Google, Apple, Outlook);
 * • любой другой JSON — «умный» режим: ищем списки объектов с названием и датой.
 */
export function parseImport(text: string): ImportPlan {
  const t = text.trimStart();
  if (t.startsWith("BEGIN:VCALENDAR") || t.includes("BEGIN:VEVENT")) return ics(text);
  const data: unknown = JSON.parse(text);
  if (isObj(data) && Array.isArray(data.tasks) && (Array.isArray(data.recurrings) || Array.isArray(data.occurrences))) return structured(data);
  return generic(data);
}

/**
 * Стабильный id строки в OSIRIS из id источника и пользователя (UUID версии 5 — «по имени», SHA-1):
 * тот же расчёт, что Importer.rowId в приложении.
 */
export async function rowId(userId: string, sourceId: string): Promise<string> {
  const h = new Uint8Array(await crypto.subtle.digest("SHA-1", new TextEncoder().encode(`osiris-import|${userId}|${sourceId}`)));
  const b = h.slice(0, 16);
  b[6] = (b[6] & 0x0f) | 0x50; // версия 5 (по имени)
  b[8] = (b[8] & 0x3f) | 0x80;
  const s = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}

// ------------------------------------------------------------------ даты

/** Даты Structured — секунды от 1 января 2001 (как в Apple). */
const apple = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? new Date(Date.UTC(2001, 0, 1) + Math.round(v * 1000)) : null);

/** DateTime.tryParse из Dart: ISO-8601 с необязательными разделителями, временем и часовым поясом. */
function dartDate(s: string): Date | null {
  const m = /^([+-]?\d{4,6})-?(\d\d)-?(\d\d)(?:[ T](\d\d)(?::?(\d\d)(?::?(\d\d)(?:[.,](\d+))?)?)?( ?[zZ]| ?([-+])(\d\d)(?::?(\d\d))?)?)?$/.exec(s);
  if (!m) return null;
  const y = +m[1], mo = +m[2], d = +m[3], h = +(m[4] ?? 0), mi = +(m[5] ?? 0), sec = +(m[6] ?? 0);
  const ms = m[7] ? Math.round(+`0.${m[7]}` * 1000) : 0;
  let out: Date;
  if (m[8]) {
    let t = Date.UTC(y, mo - 1, d, h, mi, sec, ms);
    if (m[9]) t -= (m[9] === "-" ? -1 : 1) * (+m[10] * 60 + +(m[11] ?? 0)) * 60_000;
    out = new Date(t);
  } else out = new Date(y, mo - 1, d, h, mi, sec, ms);
  return Number.isNaN(out.getTime()) ? null : out;
}

/** «YYYY-MM-DD…» → местная полночь. */
const dayOf = (v: unknown) => (typeof v === "string" && v.length >= 10 ? dartDate(v.slice(0, 10)) : null);

// ------------------------------------------------------------------ цвета

/** Палитра Structured → наши листы. */
const STRUCTURED_COLORS: Record<string, string> = { classic: "coral", twilight: "lavender", night: "navy", day: "sky", sunshine: "butter", forest: "forest", dawn: "peach", midnight: "slate", nature: "sage" };

/** Порядок листов как в P.named приложения (важен только при равном расстоянии). */
const PALETTE_ORDER = ["clay", "orange", "lavender", "sage", "charcoal", "teal", "mustard", "navy", "blush", "butter", "mint", "peach", "lilac", "sky", "rose", "sand", "pistachio", "powder", "apricot", "seafoam", "cream",
  "coral", "plum", "olive", "cocoa", "slate", "cherry", "forest"].filter((n) => n in NAMED);

const rgb = (hex: string): [number, number, number] => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };

/** Ближайший по цвету лист палитры. */
export function nearestColor(hex: string): string {
  const c = rgb(hex);
  let best = "orange", bestD = Infinity;
  for (const name of PALETTE_ORDER) {
    const o = rgb(NAMED[name]);
    const d = (o[0] - c[0]) ** 2 + (o[1] - c[1]) ** 2 + (o[2] - c[2]) ** 2;
    if (d < bestD) { bestD = d; best = name; }
  }
  return best;
}

function colorName(v: unknown): string | null {
  if (typeof v !== "string") return null;
  if (v in STRUCTURED_COLORS) return STRUCTURED_COLORS[v];
  if (v.startsWith("#") && v.length === 7) return /^#[0-9a-fA-F]{6}$/.test(v) ? nearestColor(v) : null;
  return v in NAMED ? v : null;
}

// ------------------------------------------------------------------ Structured

// Отметки подзадач — текст заметки (данные), тот же, что пишет приложение.
const subtasks = (list: unknown) => objs(list).map((s) => `${s.completed_at != null ? "☑" : "☐"} ${s.title ?? ""}`).join("\n");
const joinNotes = (note: unknown, subs: unknown) => [`${note ?? ""}`.trim(), subtasks(subs)].filter((x) => x.length > 0).join("\n\n");

function structured(d: Obj): ImportPlan {
  const settings = isObj(d.settings) ? d.settings : {};
  // напоминание по умолчанию в Structured: «-5» — за 5 минут, «start» — в начале
  const defaults = (Array.isArray(settings.timed_default_alerts) ? settings.timed_default_alerts : []).map((e) => str(e));
  const mins = defaults.filter((e) => /^[+-]?\d+$/.test(e)).map((e) => parseInt(e, 10)).filter((x) => x < 0).map((x) => -x);
  const defRemind = mins.length ? Math.min(...mins) : defaults.includes("start") ? 0 : null;
  const remindOf = (t: Obj): number | null => {
    const alerts = Array.isArray(t.alerts) ? t.alerts : [];
    if (!alerts.length) return defRemind;
    const a = alerts[0];
    if (isObj(a) && a.type === "none") return null;
    if (isObj(a) && typeof a.offset === "number") return Math.round(Math.abs(a.offset) / 60);
    return defRemind;
  };

  const items: ImportItem[] = [];
  let ignored = 0;
  // дни, когда разовое дело заменило повтор (перенесли или изменили один раз)
  const skips = new Map<string, string[]>();
  for (const o of objs(d.occurrences)) {
    if (o._deleted === true) continue;
    if (o.is_detached === true && typeof o.recurring === "string" && typeof o.day === "string") {
      const list = skips.get(o.recurring) ?? [];
      list.push(o.day.slice(0, 10));
      skips.set(o.recurring, list);
    }
  }

  for (const t of objs(d.tasks)) {
    if (t._deleted === true || t.is_hidden === true) continue;
    const day = dayOf(t.day);
    const title = `${t.title ?? ""}`.trim();
    if (!day || !title) { ignored++; continue; }
    const allDay = t.is_all_day === true;
    const minutes = Math.round(num(t.start_time) * 60); // 25.5 → следующий день, 01:30
    const start = allDay ? day : addMinutes(day, minutes);
    const dur = Math.trunc(num(t.duration));
    const type = Math.trunc(num(t.type));
    items.push(item({
      sourceId: `structured:${str(t.id)}`,
      title,
      start,
      end: allDay || dur <= 0 ? null : addMinutes(start, dur),
      allDay,
      done: t.completed_at != null,
      doneAt: apple(t.completed_at),
      notes: joinNotes(t.note, t.subtasks),
      color: colorName(t.color),
      remind: allDay ? null : remindOf(t),
      routine: type === 31 || type === 32,
      // на весь день или без длительности — это дело с галочкой, остальное — блок в календаре
      task: allDay || dur <= 0,
    }));
  }

  const wd = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
  for (const r of objs(d.recurrings)) {
    if (r._deleted === true) continue;
    const title = `${r.title ?? ""}`.trim();
    let base = dayOf(r.start_day);
    if (!title || !base) { ignored++; continue; }
    // «с 1970 года» = «с самого начала»: начинаем с даты создания
    if (base.getFullYear() < 2000) base = apple(r.created_at) ?? new Date();
    base = day0(base);
    const days = wd.flatMap((k, i) => (r[k] === true ? [i + 1] : []));
    const interval = Math.min(99, Math.max(1, Math.trunc(num(r.interval, 1))));
    const kind = Math.trunc(num(r.recurring_type, 1));
    const rule: ImportRepeat = {
      freq: kind === 2 ? "weekly" : kind === 3 ? "monthly" : kind === 4 ? "yearly" : days.length === 7 || days.length === 0 ? "daily" : "weekly",
      interval,
      ...(days.length > 0 && days.length < 7 ? { days } : {}),
      ...(dayOf(r.end_day) ? { until: (r.end_day as string).slice(0, 10) } : {}),
    };
    const allDay = r.is_all_day === true;
    const minutes = Math.round(num(r.start_time) * 60);
    const start = allDay ? base : addMinutes(base, minutes);
    const dur = Math.trunc(num(r.duration));
    const type = Math.trunc(num(r.type));
    items.push(item({
      sourceId: `structured:r:${str(r.id)}`,
      title,
      start,
      end: allDay || dur <= 1 ? null : addMinutes(start, dur),
      allDay,
      notes: joinNotes(r.note, r.subtasks),
      color: colorName(r.color),
      repeat: rule,
      skip: (typeof r.id === "string" ? skips.get(r.id) : null) ?? [],
      remind: allDay ? null : remindOf(r),
      routine: type === 31 || type === 32,
    }));
  }
  items.sort(byStart);
  return { source: "Structured", items, ignored };
}

// ------------------------------------------------------------------ .ics

function ics(text: string): ImportPlan {
  // строки-продолжения начинаются с пробела
  const lines = text.replaceAll("\r\n", "\n").replaceAll("\n ", "").replaceAll("\n\t", "").split("\n");
  const items: ImportItem[] = [];
  let ignored = 0;
  let ev: Map<string, string> | null = null;
  const params = new Map<string, string>();
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line === "BEGIN:VEVENT") { ev = new Map(); params.clear(); continue; }
    if (line === "END:VEVENT") {
      const e = ev;
      ev = null;
      if (!e) continue;
      const it = icsItem(e, params);
      if (it) items.push(it); else ignored++;
      continue;
    }
    if (!ev) continue;
    // как в приложении: строки вложенных блоков (VALARM) тоже попадают в событие — от этого зависят id
    const colon = line.indexOf(":");
    if (colon < 0) continue;
    const head = line.slice(0, colon);
    const name = head.split(";")[0].toUpperCase();
    ev.set(name, line.slice(colon + 1));
    if (head.includes(";")) params.set(name, head);
  }
  items.sort(byStart);
  return { source: "Календарь (.ics)", items, ignored };
}

const icsText = (v?: string) => (v ?? "").replaceAll("\\n", "\n").replaceAll("\\N", "\n").replaceAll("\\,", ",").replaceAll("\\;", ";").replaceAll("\\\\", "\\").trim();

function icsDate(v?: string): Date | null {
  if (v == null || v.length < 8) return null;
  const int = (s: string) => (/^[+-]?\d+$/.test(s) ? parseInt(s, 10) : NaN);
  const y = int(v.slice(0, 4)), m = int(v.slice(4, 6)), d = int(v.slice(6, 8));
  if (Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) return null;
  if (v.length < 15) return new Date(y, m - 1, d);
  const h = int(v.slice(9, 11)), mi = int(v.slice(11, 13)), s = int(v.slice(13, 15));
  if (Number.isNaN(h) || Number.isNaN(mi) || Number.isNaN(s)) return null;
  return v.endsWith("Z") ? new Date(Date.UTC(y, m - 1, d, h, mi, s)) : new Date(y, m - 1, d, h, mi, s);
}

function icsItem(e: Map<string, string>, params: Map<string, string>): ImportItem | null {
  const title = icsText(e.get("SUMMARY"));
  const start = icsDate(e.get("DTSTART"));
  if (!title || !start) return null;
  const allDay = (params.get("DTSTART") ?? "").includes("VALUE=DATE") || (e.get("DTSTART")?.length ?? 0) === 8;
  let end = icsDate(e.get("DTEND"));
  if (allDay && end) end = new Date(end.getTime() - 86400_000); // в .ics конец «весь день» — следующий день
  let repeat: ImportRepeat | null = null;
  const rr = e.get("RRULE");
  if (rr != null) {
    const p: Record<string, string> = {};
    for (const kv of rr.split(";")) if (kv.includes("=")) p[kv.split("=")[0]] = kv.split("=")[1];
    const map: Record<string, number> = { MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6, SU: 7 };
    const days = (p.BYDAY ?? "").split(",").map((x) => map[x.replace(/[-+0-9]/g, "")]).filter((x): x is number => typeof x === "number");
    const until = icsDate(p.UNTIL);
    const interval = /^[+-]?\d+$/.test(p.INTERVAL ?? "1") ? parseInt(p.INTERVAL ?? "1", 10) : 1;
    repeat = {
      freq: (p.FREQ ?? "WEEKLY").toLowerCase(),
      interval,
      ...(days.length ? { days } : {}),
      ...(until ? { until: dateOnly(until) } : {}),
      ...(p.COUNT != null ? { count: /^[+-]?\d+$/.test(p.COUNT) ? parseInt(p.COUNT, 10) : null } : {}),
    };
    if (!["daily", "weekly", "monthly", "yearly"].includes(repeat.freq)) repeat = null;
  }
  const skip = (e.get("EXDATE") ?? "").split(",").map((x) => icsDate(x)).filter((x): x is Date => !!x).map(dateOnly);
  return item({
    sourceId: `ics:${e.get("UID") ?? `${title}${str(e.get("DTSTART"))}`}${e.get("RECURRENCE-ID") ?? ""}`,
    title,
    start,
    end: end && end > start ? end : null,
    allDay,
    notes: icsText(e.get("DESCRIPTION")),
    repeat,
    skip,
    remind: allDay ? null : 15,
  });
}

// ------------------------------------------------------------------ любой JSON

const TITLE_KEYS = ["title", "name", "summary", "subject", "text", "content", "task", "label"];
const START_KEYS = ["start", "starts_at", "start_time", "startTime", "start_date", "startDate", "begin", "from", "date", "day", "due", "due_at", "dueDate", "due_date", "when", "scheduled", "datetime", "time"];
const END_KEYS = ["end", "ends_at", "end_time", "endTime", "end_date", "endDate", "to", "until"];
const DUR_KEYS = ["duration", "duration_minutes", "durationMinutes", "length", "minutes"];
const DONE_KEYS = ["completed", "done", "is_completed", "isCompleted", "completed_at", "completedAt", "checked"];
const NOTE_KEYS = ["note", "notes", "description", "details", "body", "comment"];

/** Дата из чего угодно: ISO-строка, «YYYY-MM-DD», секунды или миллисекунды Unix. */
function anyDate(v: unknown, day?: Date | null): Date | null {
  if (typeof v === "string") {
    const iso = dartDate(v);
    if (iso) return iso;
    const hm = /^(\d{1,2}):(\d{2})/.exec(v);
    if (hm && day) return new Date(day.getFullYear(), day.getMonth(), day.getDate(), +hm[1], +hm[2]);
    return null;
  }
  if (typeof v === "number") {
    if (v > 1e11) return new Date(Math.trunc(v));
    if (v > 1e9) return new Date(Math.trunc(v * 1000));
    if (v > 5e8) return apple(v); // похоже на отсчёт от 2001 (Apple)
    if (day && v >= 0 && v < 48) return addMinutes(day, Math.round(v * 60)); // часы дня
  }
  return null;
}

function pick(m: Obj, keys: string[]): unknown {
  for (const k of keys) if (Object.hasOwn(m, k) && m[k] != null && m[k] !== "") return m[k];
  const lower = new Map<string, string>();
  for (const k of Object.keys(m)) lower.set(k.toLowerCase(), k);
  for (const k of keys) {
    const real = lower.get(k.toLowerCase());
    if (real != null && m[real] != null) return m[real];
  }
  return null;
}

function generic(data: unknown): ImportPlan {
  // ищем все списки объектов, где есть и название, и дата — это и есть дела
  const lists: Obj[][] = [];
  const walk = (x: unknown, depth: number) => {
    if (depth > 6) return;
    if (Array.isArray(x)) {
      const maps = x.filter(isObj);
      if (maps.length && maps.filter((m) => typeof pick(m, TITLE_KEYS) === "string" && pick(m, START_KEYS) != null).length >= maps.length * 0.5) { lists.push(maps); return; }
      for (const y of x) walk(y, depth + 1);
    } else if (isObj(x)) {
      for (const y of Object.values(x)) walk(y, depth + 1);
    }
  };
  walk(data, 0);

  const items: ImportItem[] = [];
  let ignored = 0, n = 0;
  const startKeys = START_KEYS.filter((k) => k !== "day" && k !== "date");
  for (const list of lists) {
    for (const m of list) {
      n++;
      const title = `${pick(m, TITLE_KEYS) ?? ""}`.trim();
      const dayRaw = m.day ?? m.date;
      const day = typeof dayRaw === "string" ? dartDate(dayRaw.length >= 10 ? dayRaw.slice(0, 10) : dayRaw) : null;
      const startRaw = pick(m, startKeys) ?? dayRaw;
      let start = anyDate(startRaw, day);
      if (!title || !start) { ignored++; continue; }
      const allDayFlag = pick(m, ["is_all_day", "isAllDay", "all_day", "allDay"]);
      const allDay = allDayFlag === true || (allDayFlag == null && typeof startRaw === "string" && startRaw.length === 10);
      if (allDay) start = day0(start);
      let end = anyDate(pick(m, END_KEYS), day ?? start);
      const dur = pick(m, DUR_KEYS);
      if (!end && typeof dur === "number" && dur > 0 && !allDay) end = addMinutes(start, dur > 1000 ? Math.round(dur / 60) : Math.trunc(dur));
      const doneRaw = pick(m, DONE_KEYS);
      items.push(item({
        sourceId: `json:${m.id ?? m.uuid ?? `${title}|${str(startRaw)}`}`,
        title,
        start,
        end: end && end > start ? end : null,
        allDay,
        done: doneRaw === true || typeof doneRaw === "number" || (typeof doneRaw === "string" && doneRaw.length > 0 && doneRaw !== "false"),
        notes: `${pick(m, NOTE_KEYS) ?? ""}`.trim(),
        color: colorName(pick(m, ["color", "colour"])),
        remind: allDay ? null : 15,
        task: allDay || !end,
      }));
    }
  }
  if (n === 0) throw new ImportError("В файле не нашлось дел с названием и датой");
  items.sort(byStart);
  return { source: "JSON", items, ignored };
}

// ------------------------------------------------------------------ строки для базы

type DbRow = Record<string, unknown> & { id: string };

/** Строки для базы из дел импорта (одинаковый набор ключей у всех строк пачки — так требует сервер). */
export async function buildImportRows(items: ImportItem[], uid: string): Promise<{ events: DbRow[]; tasks: DbRow[] }> {
  const events: DbRow[] = [], tasks: DbRow[] = [];
  const nowUtc = new Date().toISOString();
  for (const x of items) {
    const id = await rowId(uid, x.sourceId);
    if (x.task && !x.repeat) {
      tasks.push({
        id,
        title: x.title,
        notes: x.notes,
        priority: "normal",
        sphere: "personal",
        due_at: (x.allDay ? day0(x.start) : x.start).toISOString(),
        all_day: x.allDay,
        done_at: x.done ? (x.doneAt?.toISOString() ?? nowUtc) : null,
        repeat: null,
      });
    } else {
      events.push({
        id,
        title: x.title,
        notes: x.notes,
        location: null,
        starts_at: x.start.toISOString(),
        ends_at: x.end?.toISOString() ?? null,
        all_day: x.allDay,
        sphere: "personal",
        priority: "normal",
        color: x.color,
        remind_minutes: x.remind,
        repeat: x.repeat,
        repeat_skip: x.skip,
      });
    }
  }
  return { events, tasks };
}
