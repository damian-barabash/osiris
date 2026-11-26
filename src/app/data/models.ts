// Модели OSIRIS — порт app/lib/data/models.dart. Время в базе — UTC, в моделях — локальный Date.
// Имена полей те же, что в приложении (startsAt, dueAt …), чтобы экраны переносились один в один.
import { RepeatRule, dateOnly, parseDate } from "./repeat";

export type Row = Record<string, any>;
export type Sphere = "work" | "personal";
export const sphereOf = (v: unknown): Sphere => (v === "personal" ? "personal" : "work");

const dt = (v: unknown) => (v == null ? null : new Date(v as string));
const date = (v: unknown) => (v == null ? null : parseDate(String(v)));
const num = (v: unknown) => (v == null ? 0 : typeof v === "number" ? v : parseFloat(String(v)) || 0);

class Model {
  constructor(public raw: Row) {}
  get id(): string { return this.raw.id; }
}

export class Profile extends Model {
  get name(): string { return this.raw.name ?? ""; }
  get currency(): string { return this.raw.default_currency ?? "PLN"; }
  get moodInterval(): number { return this.raw.mood_interval_hours ?? 4; }
  get about(): string { return this.raw.about ?? ""; }
  /** Третья вкладка меню: проекты или учёт часов. */
  get hoursTab() { return this.raw.work_tab === "hours"; }
  get onboarded() { return this.raw.onboarded_at != null; }
  /** За сколько минут напоминать о новых делах (null — не напоминать). */
  get remindDefault(): number | null { return "remind_default" in this.raw ? this.raw.remind_default : 30; }
  /** Подписка: free | joy | smart. Срок и «навсегда» учитывает Plans.current. */
  get plan(): string { return this.raw.plan ?? "free"; }
  get planUntil() { return dt(this.raw.plan_until); }
  get planLifetime() { return this.raw.plan_lifetime === true; }
  get planChosen() { return !("plan_chosen_at" in this.raw) || this.raw.plan_chosen_at != null; }
  /** Свой список «Что влияет» в опросе настроения (null — стандартный). */
  get moodTags(): string[] | null { return this.raw.mood_tags ?? null; }
  get avatarPath(): string | null { return this.raw.avatar_path ?? null; }
  get friendCode(): string { return this.raw.friend_code ?? ""; }
}

export class Client extends Model {
  get name(): string { return this.raw.name; }
  get company(): string | null { return this.raw.company ?? null; }
  get phone(): string | null { return this.raw.phone ?? null; }
  get email(): string | null { return this.raw.email ?? null; }
  get notes(): string { return this.raw.notes ?? ""; }
  get color(): string { return this.raw.color ?? "clay"; }
  get archived() { return this.raw.archived === true; }
}

export class Project extends Model {
  readonly deadline = date(this.raw.deadline);
  get clientId(): string | null { return this.raw.client_id ?? null; }
  get name(): string { return this.raw.name; }
  get description(): string { return this.raw.description ?? ""; }
  get status(): string { return this.raw.status ?? "active"; }
  get sphere() { return sphereOf(this.raw.sphere); }
  get currency(): string { return this.raw.currency ?? "PLN"; }
  get budget() { return num(this.raw.budget); }
  get color(): string { return this.raw.color ?? "orange"; }
  get icon(): string { return this.raw.icon ?? "briefcase"; }
}

export class Payment extends Model {
  readonly paidOn = date(this.raw.paid_on)!;
  get projectId(): string { return this.raw.project_id; }
  get amount() { return num(this.raw.amount); }
  get note(): string { return this.raw.note ?? ""; }
}

export class Task extends Model {
  readonly dueAt = dt(this.raw.due_at);
  readonly doneAt = dt(this.raw.done_at);
  readonly repeat = RepeatRule.parse(this.raw.repeat);
  get projectId(): string | null { return this.raw.project_id ?? null; }
  get title(): string { return this.raw.title; }
  get notes(): string { return this.raw.notes ?? ""; }
  get important() { return this.raw.priority === "important"; }
  get sphere() { return sphereOf(this.raw.sphere); }
  get allDay() { return this.raw.all_day !== false; }
  get done() { return this.raw.done_at != null; }
  /** Своё «за сколько минут напомнить» (null — как в настройках). */
  get remindMinutes(): number | null { return this.raw.remind_minutes ?? null; }
}

export class Event extends Model {
  readonly startsAt = dt(this.raw.starts_at)!;
  readonly endsAt = dt(this.raw.ends_at);
  readonly repeat = RepeatRule.parse(this.raw.repeat);
  /** Начало серии (у экземпляра — начало первого повторения). */
  readonly seriesStart = dt(this.raw._series_start ?? this.raw.starts_at)!;
  get title(): string { return this.raw.title; }
  get notes(): string { return this.raw.notes ?? ""; }
  get location(): string | null { return this.raw.location ?? null; }
  get allDay() { return this.raw.all_day === true; }
  get sphere() { return sphereOf(this.raw.sphere); }
  get important() { return this.raw.priority === "important"; }
  get clientId(): string | null { return this.raw.client_id ?? null; }
  get projectId(): string | null { return this.raw.project_id ?? null; }
  get color(): string | null { return this.raw.color ?? null; }
  get remindMinutes(): number | null { return this.raw.remind_minutes ?? null; }
  /** Моя копия совместного события: id оригинала у друга, который позвал. */
  get sharedFrom(): string | null { return this.raw.shared_from ?? null; }
  /** Пропущенные даты серии («удалить только это»). */
  get skip(): string[] { return ((this.raw.repeat_skip as unknown[]) ?? []).map(String); }
  /** Для повторения — дата этого экземпляра (иначе null). */
  get occurrence(): Date | null { return this.raw._occ == null ? null : parseDate(this.raw._occ); }

  /** Экземпляр серии на дату day: те же часы, длительность сохраняется. */
  at(day: Date): Event {
    const s = this.seriesStart;
    const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), s.getHours(), s.getMinutes());
    const end = this.endsAt == null ? null : new Date(start.getTime() + (this.endsAt.getTime() - this.startsAt.getTime()));
    return new Event({ ...this.raw, starts_at: start.toISOString(), ends_at: end?.toISOString() ?? null, _occ: dateOnly(day), _series_start: this.raw._series_start ?? this.raw.starts_at });
  }
}

export class Mood extends Model {
  readonly at = dt(this.raw.created_at)!;
  get score(): number { return this.raw.score; }
  get energy(): number | null { return this.raw.energy ?? null; }
  get tags(): string[] { return this.raw.tags ?? []; }
  get note(): string { return this.raw.note ?? ""; }
}

export type TrackerKind = "money" | "stages" | "counter" | "habit";

export class Tracker extends Model {
  readonly deadline = date(this.raw.deadline);
  get title(): string { return this.raw.title; }
  get kind(): TrackerKind { return this.raw.kind ?? "money"; }
  get icon(): string { return this.raw.icon ?? "star"; }
  get color(): string { return this.raw.color ?? "lavender"; }
  get sphere() { return sphereOf(this.raw.sphere); }
  get target(): number | null { return this.raw.target == null ? null : num(this.raw.target); }
  get unit(): string | null { return this.raw.unit ?? null; }
  get notes(): string { return this.raw.notes ?? ""; }
  get archived() { return this.raw.archived === true; }
  /** Событие, к которому привязана копилка на подарок. */
  get eventId(): string | null { return this.raw.event_id ?? null; }
}

export class Stage extends Model {
  readonly dueOn = date(this.raw.due_on);
  get trackerId(): string { return this.raw.tracker_id; }
  get title(): string { return this.raw.title; }
  get position(): number { return this.raw.position ?? 0; }
  get status(): string { return this.raw.status ?? "todo"; }
  get critical() { return this.raw.critical === true; }
  get notes(): string { return this.raw.notes ?? ""; }
}

export class Entry extends Model {
  readonly on = date(this.raw.entry_on)!;
  get trackerId(): string { return this.raw.tracker_id; }
  get amount() { return num(this.raw.amount); }
  get note(): string { return this.raw.note ?? ""; }
}

export class Note extends Model {
  readonly updatedAt = dt(this.raw.updated_at ?? this.raw.created_at)!;
  get title(): string { return this.raw.title ?? ""; }
  get body(): string { return this.raw.body ?? ""; }
  get pinned() { return this.raw.pinned === true; }
  get sphere() { return sphereOf(this.raw.sphere); }
  get clientId(): string | null { return this.raw.client_id ?? null; }
  get projectId(): string | null { return this.raw.project_id ?? null; }
}

export class ChatMessage extends Model {
  readonly at = dt(this.raw.created_at)!;
  get mine() { return this.raw.role === "user"; }
  get content(): string { return this.raw.content ?? ""; }
  get actions(): Row[] { return this.raw.actions?.items ?? []; }
  get actionsStatus(): string { return this.raw.actions?.status ?? "pending"; }
}

/** Работа (место работы) со ставкой в час. */
export class Job extends Model {
  get name(): string { return this.raw.name ?? ""; }
  get rate() { return num(this.raw.rate); }
  get currency(): string { return this.raw.currency ?? "PLN"; }
  get color(): string { return this.raw.color ?? "teal"; }
  get icon(): string { return this.raw.icon ?? "briefcase"; }
  get sphere() { return sphereOf(this.raw.sphere); }
  get notes(): string { return this.raw.notes ?? ""; }
  get archived() { return this.raw.archived === true; }
}

/** Смена: начало, конец (null — идёт сейчас), перерыв. Ставка — на момент смены. */
export class WorkSession extends Model {
  readonly start = dt(this.raw.started_at)!;
  readonly end = dt(this.raw.ended_at);
  get jobId(): string { return this.raw.job_id; }
  get running() { return this.raw.ended_at == null; }
  get breakMinutes(): number { return Math.trunc(Number(this.raw.break_minutes ?? 0)); }
  get rate(): number | null { return this.raw.rate == null ? null : num(this.raw.rate); }
  get note(): string { return this.raw.note ?? ""; }
  /** Отработано в миллисекундах (без перерыва). У идущей смены — по текущий момент. */
  workedMs(now: Date = new Date()) { return Math.max(0, (this.end ?? now).getTime() - this.start.getTime() - this.breakMinutes * 60_000); }
  hours(now: Date = new Date()) { return this.workedMs(now) / 3_600_000; }
}

/** Задание за фиксированную цену (сверхурочно попросили сделать). В часы не входит. */
export class WorkExtra extends Model {
  readonly day = parseDate(this.raw.done_on ?? dateOnly(new Date()));
  get jobId(): string { return this.raw.job_id; }
  get title(): string { return this.raw.title ?? ""; }
  get amount() { return num(this.raw.amount); }
  get note(): string { return this.raw.note ?? ""; }
}

/** Элемент повестки дня: событие, задача со сроком или решающий этап. */
export interface AgendaItem {
  at: Date;
  end?: Date | null;
  title: string;
  kind: "event" | "task" | "stage" | "deadline";
  sphere: Sphere;
  allDay: boolean;
  important: boolean;
  subtitle?: string | null;
  color?: string | null;
  id?: string;
  /** Для событий — сам экземпляр (у повторений — с датой этого раза). */
  event?: Event;
  repeats: boolean;
  /** Задача выполнена (для чужих задач — у своих смотрим Store). */
  done?: boolean;
  /** Дело друга: только смотреть. */
  readOnly?: boolean;
}

export interface Critical { date: Date; title: string; subtitle: string; kind: "stage" | "tracker" | "project" | "task"; id: string; critical: boolean }
