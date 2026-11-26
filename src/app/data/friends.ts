// Друзья и приглашения в совместные события — порт app/lib/data/friends.dart.
// Чужие данные приходят только через функции базы, которые проверяют дружбу (в Store они не попадают):
// friend_list / friend_agenda / my_event_invites. Заметки и описания событий друга сервер не отдаёт вовсе.
import { useSyncExternalStore } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { tr } from "@/i18n";
import { toast } from "@/ui";
import { sb } from "../sb";
import { avatarUrl as signedAvatar } from "../widgets/Avatar";
import { Event, Task, type AgendaItem, type Row } from "./models";
import { addDays, dateOnly, day0, sameDate } from "./repeat";
import { store } from "./store";

/** Друг или заявка в друзья. id — id пользователя-друга (для маршрута /friend/:id, расписания и приглашений), friendshipId — id дружбы. */
export interface Friend { id: string; friendshipId: string; name: string; avatarPath: string | null; status: "pending" | "accepted"; incoming: boolean; sharesMood: boolean; iShareMood: boolean; mood: { score: number; at: Date } | null }
/** Приглашение в совместное событие. mine — позвал я (иначе зовут меня). */
export interface EventInvite {
  id: string; eventId: string; fromUser: string; toUser: string; status: "pending" | "accepted" | "declined"; copyId: string | null; title: string; startsAt: Date; endsAt: Date | null; allDay: boolean; location: string | null; otherName: string; mine: boolean;
  /** id второй стороны (кто позвал меня или кого позвал я). */
  otherId?: string;
  /** Событие — серия. */
  repeats?: boolean;
}

const nameOf = (v: unknown) => (typeof v === "string" && v.trim() ? v : tr("Без имени"));

const toFriend = (r: Row): Friend => ({
  id: r.friend_id,
  friendshipId: r.id,
  name: nameOf(r.name),
  avatarPath: r.avatar_path ?? null,
  status: r.status === "accepted" ? "accepted" : "pending",
  incoming: r.incoming === true,
  sharesMood: r.they_share_mood === true,
  iShareMood: r.i_share_mood === true,
  mood: r.they_share_mood === true && r.mood_score != null && r.mood_at ? { score: r.mood_score, at: new Date(r.mood_at) } : null,
});

const toInvite = (r: Row): EventInvite => {
  const me = store.userId ?? "", incoming = r.incoming === true;
  return {
    id: r.id, eventId: r.event_id, fromUser: incoming ? r.other_id : me, toUser: incoming ? me : r.other_id,
    status: r.status, copyId: r.copy_id ?? null, title: r.title ?? "", startsAt: new Date(r.starts_at), endsAt: r.ends_at == null ? null : new Date(r.ends_at),
    allDay: r.all_day === true, location: r.location ?? null, otherName: nameOf(r.other_name), mine: !incoming, otherId: r.other_id, repeats: r.repeat != null,
  };
};

/** События и задачи друга за период — только для просмотра. Серии разворачиваются по дням, как у себя. */
export class FriendAgenda {
  readonly events: Event[];
  readonly tasks: Task[];
  private cache = new Map<string, AgendaItem[]>();

  constructor(d: Row = {}) {
    this.events = ((d.events as Row[]) ?? []).map((e) => new Event(e));
    this.tasks = ((d.tasks as Row[]) ?? []).map((t) => new Task(t));
  }

  /** Повестка дня друга: весь день — сверху, дальше по времени. */
  on(day: Date): AgendaItem[] {
    const key = dateOnly(day);
    const hit = this.cache.get(key);
    if (hit) return hit;
    const dayStart = day0(day), dayEnd = addDays(dayStart, 1);
    const out: AgendaItem[] = [];
    const add = (e: Event) => out.push({ at: e.startsAt, end: e.endsAt, title: e.title, kind: "event", sphere: e.sphere, allDay: e.allDay, important: e.important, subtitle: e.location, color: e.color, id: e.id, repeats: !!e.repeat, readOnly: true });
    for (const e of this.events) {
      const rule = e.repeat;
      if (!rule) {
        const end = e.endsAt ?? e.startsAt;
        if (sameDate(e.startsAt, day) || (e.startsAt < dayEnd && end > dayStart)) add(e);
        continue;
      }
      if (e.skip.includes(key)) continue;
      const span = e.endsAt == null ? 0 : Math.min(31, Math.max(0, Math.round((day0(e.endsAt).getTime() - day0(e.startsAt).getTime()) / 86400_000)));
      const lo = addDays(dayStart, -span);
      for (const d of rule.dates(e.startsAt, dayStart)) {
        if (d < lo) continue;
        add(e.at(d));
        break;
      }
    }
    for (const t of this.tasks) {
      const d = t.dueAt;
      if (!d || !sameDate(d, day)) continue;
      out.push({ at: d, title: t.title, kind: "task", sphere: t.sphere, allDay: t.allDay, important: t.important, id: t.id, done: t.done, repeats: !!t.repeat, readOnly: true });
    }
    out.sort((a, b) => (a.allDay !== b.allDay ? (a.allDay ? -1 : 1) : a.at.getTime() - b.at.getTime()));
    this.cache.set(key, out);
    return out;
  }

  /** Все дела периода [from, to) по дням, без повторов многодневных событий. */
  between(from: Date, to: Date): AgendaItem[] {
    const out: AgendaItem[] = [], seen = new Set<string>();
    for (let d = day0(from), k = 0; d < to && k < 400; d = addDays(d, 1), k++) {
      for (const x of this.on(d)) {
        const key = `${x.kind}:${x.id}:${x.at.getTime()}`;
        if (!seen.has(key)) { seen.add(key); out.push(x); }
      }
    }
    return out;
  }

  /** Что друг делает сейчас (идущее событие со временем) и что дальше сегодня. */
  current(at: Date = new Date()): { now: AgendaItem | null; next: AgendaItem | null } {
    let now: AgendaItem | null = null, next: AgendaItem | null = null;
    for (const x of this.on(at)) {
      if (x.allDay || x.kind !== "event") continue;
      const end = x.end ?? new Date(x.at.getTime() + 30 * 60_000);
      if (x.at <= at && end > at) now ??= x;
      if (x.at > at) next ??= x;
    }
    return { now, next };
  }
}

// ------------------------------------------------------------------ состояние и подписка

let version = 0;
const subs = new Set<() => void>();
const emit = () => { version++; subs.forEach((f) => f()); };

let channel: RealtimeChannel | null = null;
let tick: ReturnType<typeof setInterval> | null = null;
let gen = 0; // растёт при stop(): ответы прошлого аккаунта отбрасываются
let lastLoad = 0;
const debounce: { friends?: ReturnType<typeof setTimeout>; invites?: ReturnType<typeof setTimeout> } = {};

const visible = () => typeof document === "undefined" || document.visibilityState === "visible";
const onFocus = () => { if (!visible()) return; if (Date.now() - lastLoad > 15_000) void load(); else popups(); };

async function rpc<T = unknown>(fn: string, params?: Row): Promise<T> {
  const { data, error } = await sb.rpc(fn, params);
  if (error) throw error;
  return data as T;
}

/** Пуш второй стороне (сервер сам проверит, кому и что) — друг получит уведомление на телефон. */
async function notifyFriend(id: unknown) {
  if (typeof id !== "string") return;
  try { await sb.functions.invoke("smart-push", { body: { action: "friend_notify", id } }); } catch { /* пуш не обязателен */ }
}
async function notifyInvites(ids: string[]) {
  try { await sb.functions.invoke("smart-push", { body: { action: "event_invite_notify", ids } }); } catch { /* пуш не обязателен */ }
}

/** Есть входящие приглашения, которые ещё не показывали, — открыть попап (модуль листа подгружается по требованию). */
let popupTimer: ReturnType<typeof setTimeout> | undefined;
function popups() {
  clearTimeout(popupTimer);
  if (!visible() || !friends.invitesToMe.some((i) => !friends.inviteSeen.has(i.id))) return;
  // открыт другой лист (редактор, опрос) — не перебиваем, покажем, когда он закроется
  if (document.querySelector(".sheet-layer")) { popupTimer = setTimeout(popups, 1500); return; }
  void import("../screens/friends/invites").then((m) => m.InvitePopups.maybeShow()).catch(() => {});
}

async function loadInvites() {
  const g = gen;
  try {
    const r = await rpc<Row[]>("my_event_invites");
    if (g !== gen) return;
    friends.invites = (r ?? []).map(toInvite);
    friends.invitesLoaded = true;
    emit();
    popups();
  } catch { /* останутся прежние */ }
}

async function load() {
  const g = gen;
  lastLoad = Date.now();
  void loadInvites();
  try {
    const r = await rpc<Row[]>("friend_list");
    if (g !== gen) return;
    friends.list = (r ?? []).map(toFriend);
    friends.loaded = true;
    friends.error = null;
    emit();
    const from = day0(new Date()), acc = friends.accepted;
    await Promise.all(acc.map((f) => agendaOf(f.id, from, addDays(from, 1)).then((a) => { if (g === gen) friends.today[f.id] = a; }).catch(() => {})));
    if (g !== gen) return;
    for (const k of Object.keys(friends.today)) if (!acc.some((f) => f.id === k)) delete friends.today[k];
  } catch (e) {
    if (g !== gen) return;
    friends.error = String((e as { message?: string })?.message ?? e);
  }
  emit();
}

async function agendaOf(friendId: string, from: Date, to: Date): Promise<FriendAgenda> {
  return new FriendAgenda(await rpc<Row>("friend_agenda", { friend: friendId, from_ts: from.toISOString(), to_ts: to.toISOString() }));
}

const codeError = (e: unknown, name: string | null): string | null => {
  switch (e) {
    case null: case undefined: return null;
    case "not_found": return tr("Такого кода нет. Проверь цифры.");
    case "self": return tr("Это твой собственный код");
    case "already": return tr("{0} уже у тебя в друзьях.", [name ?? ""]);
    case "pending": return tr("Приглашение уже отправлено: {0}.", [name ?? ""]);
    default: return String(e);
  }
};

/** Друзья и приглашения в события (RPC friend_*, event_invite_*; realtime friendships + event_invites). */
export const friends = {
  list: [] as Friend[],
  invites: [] as EventInvite[],
  loaded: false,
  /** Приглашения в события уже прочитаны с сервера хотя бы раз. */
  invitesLoaded: false,
  error: null as string | null,
  /** Сегодняшние расписания друзей (по id друга) — для «сейчас: … / дальше: …». */
  today: {} as Record<string, FriendAgenda>,
  /** Приглашения, попап которых уже показывали в этой сессии. */
  inviteSeen: new Set<string>(),

  get accepted(): Friend[] { return friends.list.filter((f) => f.status === "accepted"); },
  /** Заявки в друзья ко мне. */
  get incoming(): Friend[] { return friends.list.filter((f) => f.status !== "accepted" && f.incoming); },
  /** Заявки, которые отправил я. */
  get outgoing(): Friend[] { return friends.list.filter((f) => f.status !== "accepted" && !f.incoming); },
  /** Входящие заявки в друзья + приглашения в события, на которые ещё не ответили. */
  get badge(): number { return friends.incoming.length + friends.invitesToMe.length; },
  get invitesToMe(): EventInvite[] { return friends.invites.filter((i) => !i.mine && i.status === "pending"); },
  invitesFrom: (uid: string): EventInvite[] => friends.invitesToMe.filter((i) => i.fromUser === uid),
  /** Кого я позвал в своё событие. */
  guestsOf: (eventId: string): EventInvite[] => friends.invites.filter((i) => i.mine && i.eventId === eventId),
  /** Кто позвал меня (по id моей копии события). */
  sharedBy: (copyId: string): EventInvite | null => friends.invites.find((i) => !i.mine && i.copyId === copyId) ?? null,
  /** Друг по id пользователя. */
  byId: (uid: string): Friend | null => friends.list.find((f) => f.id === uid) ?? null,
  /** Мой код для приглашения. */
  get myCode(): string | null { return store.profile?.friendCode || null; },

  subscribe: (f: () => void) => { subs.add(f); return () => void subs.delete(f); },
  snapshot: () => version,

  start: async (): Promise<void> => {
    if (!channel) {
      const soon = (k: "friends" | "invites", run: () => void) => { clearTimeout(debounce[k]); debounce[k] = setTimeout(run, 250); };
      channel = sb.channel("osiris-friends")
        .on("postgres_changes", { event: "*", schema: "public", table: "friendships" }, () => soon("friends", () => void load()))
        .on("postgres_changes", { event: "*", schema: "public", table: "event_invites" }, () => soon("invites", () => void loadInvites()))
        .subscribe();
    }
    if (!tick) {
      tick = setInterval(() => { if (visible()) void load(); }, 5 * 60_000);
      window.addEventListener("focus", onFocus);
      document.addEventListener("visibilitychange", onFocus);
    }
    await load();
  },

  stop: (): void => {
    gen++;
    if (channel) void sb.removeChannel(channel);
    channel = null;
    if (tick) clearInterval(tick);
    tick = null;
    clearTimeout(debounce.friends);
    clearTimeout(debounce.invites);
    clearTimeout(popupTimer);
    if (typeof window !== "undefined") {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    }
    friends.list = [];
    friends.invites = [];
    friends.today = {};
    friends.inviteSeen.clear();
    friends.loaded = false;
    friends.invitesLoaded = false;
    friends.error = null;
    emit();
  },

  refresh: (): Promise<void> => load(),
  refreshInvites: (): Promise<void> => loadInvites(),

  // ---------------------------------------------------------------- дружба

  /** Имя владельца кода (или текст ошибки) — до приглашения. */
  lookup: async (code: string): Promise<{ error: string | null; name: string | null }> => {
    const r = await rpc<Row>("friend_lookup", { code });
    return { error: codeError(r.error, null), name: r.name ?? null };
  },

  /** Пригласить по коду. shareMood — показывать ли другу моё настроение. */
  invite: async (code: string, shareMood: boolean): Promise<{ error: string | null; name: string | null; accepted: boolean }> => {
    const r = await rpc<Row>("friend_invite", { code, share_mood: shareMood });
    const name: string | null = r.name ?? null;
    const error = codeError(r.error, name);
    if (!error) void notifyFriend(r.id);
    await load();
    return { error, name, accepted: r.status === "accepted" };
  },

  /** Принять заявку в друзья. */
  accept: async (f: Friend, shareMood: boolean): Promise<void> => {
    await rpc("friend_accept", { fid: f.friendshipId, share_mood: shareMood });
    void notifyFriend(f.friendshipId);
    await load();
  },

  /** Удалить из друзей / отклонить заявку / отменить свою. */
  remove: async (f: Friend): Promise<void> => {
    await rpc("friend_remove", { fid: f.friendshipId });
    friends.list = friends.list.filter((x) => x.friendshipId !== f.friendshipId);
    delete friends.today[f.id];
    emit();
    await load();
  },

  /** Заблокировать: дружба и приглашения удаляются, новые приглашения от этого человека не проходят. */
  block: async (f: Friend): Promise<void> => {
    await rpc("friend_block", { p_user: f.id });
    friends.list = friends.list.filter((x) => x.friendshipId !== f.friendshipId);
    delete friends.today[f.id];
    emit();
    await load();
  },
  unblock: async (userId: string): Promise<void> => { await rpc("friend_unblock", { p_user: userId }); },
  /** Кого я заблокировал. */
  blocks: async (): Promise<{ user_id: string; name: string | null; created_at: string }[]> => {
    const r = await rpc<unknown>("my_blocks");
    return Array.isArray(r) ? r.filter((x) => x && typeof x.user_id === "string") : [];
  },

  /** Показывать ли другу моё настроение. */
  setMood: async (f: Friend, share: boolean): Promise<void> => {
    friends.list = friends.list.map((x) => (x.friendshipId === f.friendshipId ? { ...x, iShareMood: share } : x));
    emit();
    try { await rpc("friend_set_mood", { fid: f.friendshipId, share }); }
    finally { await load(); }
  },

  // ---------------------------------------------------------------- совместные события

  /** Позвать друзей в своё событие. Возвращает текст ошибки или null. */
  invite2event: async (eventId: string, friendIds: string[]): Promise<string | null> => {
    const list = [...new Set(friendIds)];
    if (!list.length) return null;
    try {
      const r = await rpc<Row>("event_invite", { p_event: eventId, p_friends: list });
      if (r.error != null) return r.error === "shared" ? tr("Это событие тебе прислал друг — позвать других может только он.") : tr("Событие ещё не сохранилось на сервере. Попробуй, когда будет сеть.");
      const ids = ((r.ids as string[]) ?? []).filter((x) => typeof x === "string");
      if (ids.length) void notifyInvites(ids);
      await loadInvites();
      return null;
    } catch {
      return tr("Не получилось позвать: нет сети?");
    }
  },
  /** Позвать друзей в своё событие (ids друзей). Событие должно быть уже сохранено (`await s.insert(…)`). Ошибка — тостом. */
  inviteToEvent: async (eventId: string, friendIds: string[]): Promise<void> => {
    const err = await friends.invite2event(eventId, friendIds);
    if (err) toast(err, "error");
  },

  /** Ответ на приглашение: принять (появится в календаре) или отменить. Возвращает текст ошибки или null. */
  answer: async (inviteId: string, accept: boolean): Promise<string | null> => {
    try {
      const r = await rpc<Row>("event_invite_answer", { p_id: inviteId, p_accept: accept });
      if (r.error != null) { void loadInvites(); return tr("Приглашение уже не действует."); }
      if (accept) {
        void notifyInvites([inviteId]);
        void store.refresh("events");
      }
      await loadInvites();
      return null;
    } catch {
      return tr("Не получилось ответить: нет сети?");
    }
  },
  answerInvite: async (inviteId: string, accept: boolean): Promise<void> => {
    const err = await friends.answer(inviteId, accept);
    if (err) toast(err, "error");
  },

  /** Создатель убирает друга из события. */
  cancelInvite: async (inviteId: string): Promise<void> => {
    friends.invites = friends.invites.filter((x) => x.id !== inviteId);
    emit();
    try { await rpc("event_invite_cancel", { p_id: inviteId }); } catch { /* вернётся при перечитывании */ }
    await loadInvites();
  },

  // ---------------------------------------------------------------- расписание и фото

  /** Расписание друга за период — с разбором по дням (`.on(day)`, `.current()`). */
  agendaOf,
  /** Повестка друга за период [from, to) — только чтение, серии развёрнуты по дням. */
  agenda: async (friendId: string, from: Date, to: Date): Promise<AgendaItem[]> => (await agendaOf(friendId, from, to)).between(from, to),
  /** Фото друга (только после принятия — раньше хранилище его не отдаст). */
  avatarUrl: (f: Friend): Promise<string | null> => (f.status === "accepted" && f.avatarPath ? signedAvatar(f.avatarPath).catch(() => null) : Promise.resolve(null)),
};

/** Подписка компонента на друзей: перерисовывается при любом изменении. */
export function useFriends(): typeof friends {
  useSyncExternalStore(friends.subscribe, friends.snapshot, friends.snapshot);
  return friends;
}
