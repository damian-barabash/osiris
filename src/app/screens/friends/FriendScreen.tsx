// Страница друга — порт FriendScreen из app/lib/screens/friends/friends.dart: шапка, «ЗОВЁТ ТЕБЯ», неделя с расписанием
// (только чтение: название, время и место — заметки и описания сервер не отдаёт), настройки дружбы.
import { useCallback, useEffect, useRef, useState } from "react";
import { tr } from "@/i18n";
import { Appear, Card, Collapse, EmptyState, Icon, Osi, RoundButton, Row, ScreenHeader, SlideSwitcher, Switch, confirm, toast } from "@/ui";
import { FriendAgenda, useFriends, type Friend } from "../../data/friends";
import { addDays, day0, sameDate, weekday } from "../../data/repeat";
import { fmtDay, fmtDayShort, fmtWeekday } from "../../format";
import { back, useRoute } from "../../router";
import { AgendaCards } from "../../widgets/AgendaCard";
import { reportSheet } from "../account/sheets";
import { inviteWhen, showInvite } from "./invites";
import { FriendAvatar, FriendMood, friendNow } from "./parts";
import "./friends.css";

const errText = (e: unknown) => String((e as { message?: string })?.message ?? e);

function Settings({ friend: f }: { friend: Friend }) {
  const fr = useFriends();
  const setMood = async (v: boolean) => {
    try { await fr.setMood(f, v); } catch (e) { toast(tr("Ошибка: {0}", [errText(e)]), "error"); }
  };
  const remove = async () => {
    if (!(await confirm(tr("Удалить из друзей: {0}? Вы перестанете видеть планы друг друга.", [f.name])))) return;
    try { await fr.remove(f); back("/friends"); } catch (e) { toast(tr("Ошибка: {0}", [errText(e)]), "error"); }
  };
  const block = async () => {
    if (!(await confirm(tr("Заблокировать: {0}? Дружба удалится, и этот человек больше не сможет тебя пригласить.", [f.name]), { action: tr("Заблокировать") }))) return;
    try { await fr.block(f); back("/friends"); } catch (e) { toast(tr("Ошибка: {0}", [errText(e)]), "error"); }
  };
  return (
    <Card seed={3} className="fr-settings">
      <Row title={tr("Показывать моё настроение")} sub={tr("{0} увидит твою последнюю отметку", [f.name])}>
        <Switch value={f.iShareMood} onChange={(v) => void setMood(v)} label={tr("Показывать моё настроение")} />
      </Row>
      <p>{tr("Вы видите события и задачи друг друга из всех календарей. Заметки и описания — нет.")}</p>
      <div className="fr-danger">
        <button type="button" className="fr-remove" onClick={() => void remove()}><Icon name="user-x" size={16} />{tr("Удалить из друзей")}</button>
        <button type="button" className="fr-remove" onClick={() => void block()}><Icon name="shield" size={16} />{tr("Заблокировать")}</button>
        <button type="button" className="fr-remove soft" onClick={() => void reportSheet({ kind: "user", targetUser: f.id, content: f.name, title: tr("Пожаловаться: {0}", [f.name]) })}><Icon name="flag" size={16} />{tr("Пожаловаться")}</button>
      </div>
    </Card>
  );
}

export default function FriendScreen() {
  const fr = useFriends();
  const id = useRoute().parts[1] ?? "";
  const f = fr.list.find((x) => x.id === id || x.friendshipId === id) ?? null;
  const uid = f?.status === "accepted" ? f.id : null;

  const [week, setWeek] = useState(0);
  const dir = useRef(1);
  const [agenda, setAgenda] = useState<{ week: number; data: FriendAgenda } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const req = useRef(0);

  const today = day0(new Date());
  const monday = addDays(today, -(weekday(today) - 1) + 7 * week);
  const mondayKey = monday.getTime();

  const load = useCallback(async () => {
    if (!uid) return;
    const n = ++req.current, from = new Date(mondayKey);
    setLoading(true);
    setError(null);
    try {
      const a = await fr.agendaOf(uid, from, addDays(from, 7));
      if (n === req.current) setAgenda({ week, data: a });
    } catch (e) {
      if (n === req.current) setError(errText(e));
    } finally {
      if (n === req.current) setLoading(false);
    }
  }, [fr, uid, mondayKey, week]);

  useEffect(() => { void load(); }, [load]);
  // расписание друга могло измениться, пока вкладка была в фоне
  useEffect(() => {
    const onFocus = () => { if (document.visibilityState === "visible") void load(); };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);

  if (!f || f.status !== "accepted") {
    return (
      <div className="fr-screen">
        <ScreenHeader title="" back={() => back("/friends")} />
        {fr.loaded
          ? <EmptyState title={tr("Вы больше не друзья")} mood="sad" />
          : <div className="fr-loading"><Osi size={72} mood="thinking" /></div>}
      </div>
    );
  }

  const go = (d: number) => { dir.current = d; setWeek((w) => w + d); };
  const days = Array.from({ length: 7 }, (_, k) => addDays(monday, k));
  const range = `${fmtDayShort(days[0])} – ${fmtDayShort(days[6])}`;
  const label = week === 0 ? tr("Эта неделя") : week === 1 ? tr("Следующая неделя") : week === -1 ? tr("Прошлая неделя") : range;
  const invites = fr.invitesFrom(f.id);
  const shown = agenda?.week === week ? agenda.data : null;

  return (
    <div className="fr-screen">
      <ScreenHeader title={f.name} back={() => back("/friends")} />
      <div className="fr-layout friend">
        <aside className="fr-side">
          <Appear>
            <Card color="butter" seed={1} className="fr-head">
              <FriendAvatar friend={f} size={64} />
              <div>
                <FriendMood friend={f} size={14} />
                <b>{friendNow(f)}</b>
              </div>
            </Card>
          </Appear>

          <Collapse open={invites.length > 0}>
            <div className="fr-calls">
              <div className="fr-sub">{tr("ЗОВЁТ ТЕБЯ")}</div>
              {invites.map((i) => (
                <Card key={i.id} color="orange" seed={i.id.charCodeAt(0)} padding="12px 12px 12px 14px" className="fr-call" onClick={() => void showInvite(i)}>
                  <div>
                    <b>{i.title}</b>
                    <span>{inviteWhen(i)}</span>
                  </div>
                  <em>{tr("Ответить")}<Icon name="right" size={16} /></em>
                </Card>
              ))}
            </div>
          </Collapse>
        </aside>

        <section className="fr-main">
          <div className="fr-week">
            <RoundButton icon="left" label={tr("Прошлая неделя")} onClick={() => go(-1)} />
            <div className="fr-week-title">
              <b>{label}</b>
              <span>{range}</span>
            </div>
            <span className={`fr-spin${loading ? " on" : ""}`} aria-hidden />
            <RoundButton icon="right" label={tr("Следующая неделя")} onClick={() => go(1)} />
          </div>

          <SlideSwitcher k={week} dir={dir.current}>
            {error && !shown ? (
              <EmptyState title={tr("Не получилось загрузить")} text={error} mood="worried" action={tr("Ещё раз")} onAction={() => void load()} />
            ) : !shown ? (
              <div className="fr-loading"><Osi size={72} mood="thinking" /></div>
            ) : (
              <div className="fr-days">
                {days.map((d, k) => {
                  const items = shown.on(d), isToday = sameDate(d, today), past = d < today;
                  return (
                    <Appear key={k} i={k} className={`fr-day${past ? " past" : ""}${isToday ? " today" : ""}`}>
                      <div className="fr-day-head">
                        <b>{fmtWeekday(d)}</b>
                        <span>{fmtDay(d)}</span>
                        {!items.length && <em>{tr("свободно")}</em>}
                      </div>
                      {items.length > 0 && <div className="fr-day-items"><AgendaCards items={items} /></div>}
                    </Appear>
                  );
                })}
              </div>
            )}
          </SlideSwitcher>
        </section>

        <div className="fr-under"><Appear i={2}><Settings friend={f} /></Appear></div>
      </div>
    </div>
  );
}
