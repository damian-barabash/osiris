// Общие части раздела «Друзья» — порт подписей и согласия из app/lib/screens/friends/friends.dart.
import { useEffect, useState, type ReactNode } from "react";
import { tr } from "@/i18n";
import { Button, Card, Icon, Osi, SheetHeader, SlideSwitcher, colorOf, openSheet } from "@/ui";
import { friends, type Friend } from "../../data/friends";
import { fmtTime } from "../../format";
import { AvatarView } from "../../widgets/Avatar";
import { MoodScale } from "../mood/moodSheet";
import "./friends.css";

/** «только что» / «5 мин назад» / «3 ч назад» / «вчера» / «4 дн. назад». */
export function ago(t: Date): string {
  const min = Math.floor((Date.now() - t.getTime()) / 60_000), h = Math.floor(min / 60), d = Math.floor(h / 24);
  if (min < 2) return tr("только что");
  if (min < 60) return tr("{0} мин назад", [min]);
  if (h < 24) return tr("{0} ч назад", [h]);
  if (d === 1) return tr("вчера");
  return tr("{0} дн. назад", [d]);
}

/** «Сейчас: Гончарство до 18:00» / «Дальше: Йога в 19:00» / «Сегодня: …» / «Сегодня больше ничего не запланировано». */
export function friendNow(f: Friend): string {
  const a = friends.today[f.id];
  if (!a) return "…";
  const c = a.current();
  if (c.now) return c.now.end ? tr("Сейчас: {0} до {1}", [c.now.title, fmtTime(c.now.end)]) : tr("Сейчас: {0}", [c.now.title]);
  if (c.next) return tr("Дальше: {0} в {1}", [c.next.title, fmtTime(c.next.at)]);
  const allDay = a.on(new Date()).find((x) => x.allDay && x.kind === "event");
  if (allDay) return tr("Сегодня: {0}", [allDay.title]);
  return tr("Сегодня больше ничего не запланировано");
}

/** Кружок и подпись настроения друга — только если он сам согласился им делиться. */
export function FriendMood({ friend: f, size = 13 }: { friend: Friend; size?: number }): ReactNode {
  if (!f.sharesMood) return <span className="fr-mood dim" style={{ fontSize: size }}>{tr("настроение скрыто")}</span>;
  if (!f.mood) return <span className="fr-mood dim" style={{ fontSize: size }}>{tr("настроение ещё не отмечено")}</span>;
  return (
    <span className="fr-mood" style={{ fontSize: size }}>
      <i style={{ width: size - 1, height: size - 1, background: colorOf(MoodScale.colors[f.mood.score] ?? "mustard") }} />
      <span>{MoodScale.label(f.mood.score)} · {ago(f.mood.at)}</span>
    </span>
  );
}

/** Аватар друга: фото из хранилища (после принятия дружбы) или инициал. */
export function FriendAvatar({ friend, name, size = 44 }: { friend?: Friend | null; name?: string; size?: number }) {
  const [url, setUrl] = useState<string | null>(null);
  const path = friend?.status === "accepted" ? friend.avatarPath : null;
  useEffect(() => {
    let live = true;
    if (!friend || !path) { setUrl(null); return; }
    void friends.avatarUrl(friend).then((u) => { if (live) setUrl(u); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);
  return <AvatarView url={url} name={name ?? friend?.name ?? ""} size={size} color="var(--cream)" />;
}

// ------------------------------------------------------------------ согласие

function Consent({ name, close }: { name: string; close: (v?: boolean) => void }) {
  const [step, setStep] = useState(0);
  const line = (icon: string, text: string) => (
    <li><Icon name={icon} size={17} /><span>{text}</span></li>
  );
  return (
    <SlideSwitcher k={step} dir={1}>
      {step === 0 ? (
        <div className="fr-consent">
          <SheetHeader title={tr("Ты и {0}", [name])} sub={tr("Шаг 1 из 2")} close={() => close()} />
          <div className="fr-consent-osi"><Osi size={96} mood="excited" /></div>
          <Card color="butter" seed={21}>
            <h3>{tr("Вы будете видеть планы друг друга")}</h3>
            <ul className="fr-consent-list">
              {line("calendar", tr("{0} увидит все твои события и задачи — из «Работы» и из «Личного»: название, время и место.", [name]))}
              {line("eye", tr("Это взаимно: ты тоже будешь видеть все планы друга."))}
              {line("lock", tr("Заметки, описания событий, деньги, клиенты и чат с Оси остаются только твоими."))}
              {line("user-x", tr("Удалить из друзей можно в любой момент — доступ сразу закроется."))}
            </ul>
          </Card>
          <div className="fr-consent-actions">
            <Button color="orange" expand onClick={() => setStep(1)}>{tr("Понятно, дальше")}</Button>
            <Button ghost expand onClick={() => close()}>{tr("Отмена")}</Button>
          </div>
        </div>
      ) : (
        <div className="fr-consent">
          <SheetHeader title={tr("Настроение")} sub={tr("Шаг 2 из 2")} close={() => close()} />
          <div className="fr-consent-osi"><Osi size={96} mood="listening" /></div>
          <h3 className="fr-consent-q">{tr("Делиться с другом настроением?")}</h3>
          <p className="fr-consent-text">{tr("{0} увидит последнюю отметку («Хорошо», «Так себе»…) — без заметок. Решение можно поменять потом на странице друга.", [name])}</p>
          <div className="fr-consent-actions">
            <Button color="orange" icon="heart" expand onClick={() => close(true)}>{tr("Показывать")}</Button>
            <Button ghost expand onClick={() => close(false)}>{tr("Не показывать")}</Button>
          </div>
        </div>
      )}
    </SlideSwitcher>
  );
}

/**
 * Два шага перед дружбой: что будет видно другу и показывать ли ему настроение.
 * Возвращает выбор «показывать настроение» или undefined, если передумали.
 */
export const showFriendConsent = (name: string): Promise<boolean | undefined> => openSheet<boolean>((close) => <Consent name={name} close={close} />);
