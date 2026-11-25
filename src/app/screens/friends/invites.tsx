// Приглашение в совместное событие — порт app/lib/screens/friends/event_invite_sheet.dart.
// Попапы «X зовёт тебя» — по одному, пока есть непоказанные входящие приглашения (каждое — один раз за сессию).
// Закрыть лист — не ответ: приглашение остаётся числом над другом. Скидывает его только «Отменить».
import { useEffect, useState } from "react";
import { tr } from "@/i18n";
import { Button, Card, Cutout, Icon, Osi, openSheet, toast } from "@/ui";
import { friends, useFriends, type EventInvite } from "../../data/friends";
import { store, useStore } from "../../data/store";
import { fmtDay, fmtTime, fmtWeekday } from "../../format";
import { FriendAvatar } from "./parts";
import "./friends.css";

/** Когда событие: «Пятница, 31 октября · 18:00–20:00». */
export function inviteWhen(i: EventInvite): string {
  const day = `${fmtWeekday(i.startsAt)}, ${fmtDay(i.startsAt)}`;
  if (i.allDay) return `${day} · ${tr("весь день")}`;
  return `${day} · ${fmtTime(i.startsAt)}${i.endsAt && i.endsAt > i.startsAt ? `–${fmtTime(i.endsAt)}` : ""}`;
}

/** Что у меня самого в это время (чтобы сразу видеть накладку). */
function clashOf(i: EventInvite): string | null {
  if (i.allDay) return null;
  const end = i.endsAt ?? new Date(i.startsAt.getTime() + 30 * 60_000);
  for (const a of store.agenda(i.startsAt)) {
    if (a.allDay || a.kind !== "event") continue;
    const aEnd = a.end ?? new Date(a.at.getTime() + 30 * 60_000);
    if (a.at < end && aEnd > i.startsAt) return a.title;
  }
  return null;
}

export function InviteSheet({ invite: i, close }: { invite: EventInvite; close: () => void }) {
  const fr = useFriends();
  useStore(); // накладка пересчитывается, если мой календарь изменился
  const [busy, setBusy] = useState<null | "yes" | "no">(null);
  const f = fr.accepted.find((x) => x.id === i.fromUser) ?? null;
  const clash = clashOf(i);
  const alive = fr.invitesToMe.some((x) => x.id === i.id);

  // друг убрал меня из события, пока лист открыт — показывать больше нечего
  useEffect(() => { if (!alive && !busy && fr.invitesLoaded) close(); }, [alive, busy, fr.invitesLoaded, close]);

  const answer = async (accept: boolean) => {
    setBusy(accept ? "yes" : "no");
    const err = await friends.answer(i.id, accept);
    if (err) { setBusy(null); return toast(err, "error"); }
    close();
    if (accept) toast(tr("Добавлено в календарь"));
  };

  const line = (icon: string, text: string) => <li><Icon name={icon} size={16} /><span>{text}</span></li>;

  return (
    <div className="fr-invite">
      <div className="fr-invite-head">
        <FriendAvatar friend={f} name={i.otherName} size={48} />
        <div>
          <h3>{tr("{0} зовёт тебя", [i.otherName])}</h3>
          <p>{tr("Совместное событие")}</p>
        </div>
        <Osi size={54} mood="excited" />
      </div>
      <Card color="butter" seed={i.id.charCodeAt(0)} padding="14px 16px 16px">
        <h2>{i.title}</h2>
        <ul className="fr-invite-lines">
          {line("calendar", inviteWhen(i))}
          {!!i.location?.trim() && line("pin", i.location)}
          {i.repeats && line("repeat", tr("повторяется"))}
        </ul>
      </Card>
      {clash && (
        <div className="fr-clash">
          <Cutout kind="spark" size={18} seed={3} color="#C8402A" flat />
          <span>{tr("У тебя в это время: «{0}»", [clash])}</span>
        </div>
      )}
      <div className="fr-invite-actions">
        <Button icon="tick" expand busy={busy === "yes"} disabled={!!busy} onClick={() => void answer(true)}>{tr("Принять")}</Button>
        <Button ghost expand busy={busy === "no"} disabled={!!busy} onClick={() => void answer(false)}>{tr("Отменить")}</Button>
      </div>
      <p className="fr-invite-hint">{tr("Можно ответить позже: приглашение подождёт на карточке друга.")}</p>
    </div>
  );
}

/** Открыть лист приглашения. */
export const showInvite = (invite: EventInvite): Promise<void> => openSheet<void>((close) => <InviteSheet invite={invite} close={() => close()} />).then(() => {});

let open = false;
/** Данные загружены, человек прошёл знакомство и выбор плана — можно показывать попапы. */
const ready = () => store.loaded && !!store.profile && store.profile.onboarded && store.profile.planChosen;

export const InvitePopups = {
  /** Идёт показ попапов. */
  get busy() { return open; },

  /**
   * Показать непоказанные входящие приглашения по одному. id — показать именно это приглашение, даже если его уже показывали.
   * Возвращает true, если хоть один попап показали.
   */
  async maybeShow(id?: string): Promise<boolean> {
    if (open || !ready()) return false;
    open = true;
    let shown = false;
    try {
      let want = id;
      for (;;) {
        if (!ready()) return shown;
        const list = friends.invitesToMe;
        const next = want != null ? list.find((i) => i.id === want) : list.find((i) => !friends.inviteSeen.has(i.id));
        want = undefined;
        if (!next) return shown;
        friends.inviteSeen.add(next.id);
        shown = true;
        await showInvite(next);
      }
    } finally {
      open = false;
    }
  },

  /** Все неотвеченные приглашения от друга (нажали на число над ним). */
  async showFrom(uid: string): Promise<void> {
    if (open) return;
    open = true;
    try {
      for (const i of friends.invitesFrom(uid)) {
        if (!friends.invitesToMe.some((x) => x.id === i.id)) continue;
        friends.inviteSeen.add(i.id);
        await showInvite(i);
      }
    } finally {
      open = false;
    }
  },

  /** После выхода из аккаунта — показать всё заново. */
  reset(): void { friends.inviteSeen.clear(); },
};
