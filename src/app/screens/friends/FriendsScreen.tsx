// Друзья — порт FriendsPanel из app/lib/screens/friends/friends.dart: свой код, «добавить по коду», друзья и приглашения.
// На ноутбуке код и поле ввода стоят слева, списки — справа.
import { useEffect, useRef, useState } from "react";
import { tr } from "@/i18n";
import { Appear, Button, Card, EmptyState, Field, Icon, Osi, Pill, RoundButton, ScreenHeader, SlideSwitcher, confirm, toast } from "@/ui";
import { useFriends, type Friend } from "../../data/friends";
import { back, useRoute } from "../../router";
import { FriendCard } from "./FriendCard";
import { FriendAvatar, showFriendConsent } from "./parts";
import "./friends.css";

const errText = (e: unknown) => String((e as { message?: string })?.message ?? e);

function MyCode({ code }: { code: string | null }) {
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
  const copy = async () => {
    if (!code) return;
    try { await navigator.clipboard.writeText(code); toast(tr("Код скопирован")); }
    catch { toast(tr("Не получилось скопировать"), "error"); }
  };
  const share = async () => {
    if (!code) return;
    try { await navigator.share({ text: tr("Мой код друга в OSIRIS: {0}", [code]) }); } catch { /* закрыли окно «Поделиться» */ }
  };
  return (
    <Card color="lavender" seed={1} className="fr-code">
      <div className="fr-code-text">
        <span className="fr-code-label">{tr("ТВОЙ КОД")}</span>
        <b aria-label={code ?? undefined}>{code ? `${code.slice(0, 3)} ${code.slice(3)}` : "— — —"}</b>
        <span className="fr-code-hint">{tr("Дай его другу — он введёт код у себя")}</span>
      </div>
      {code && (
        <div className="fr-code-actions">
          <RoundButton icon="copy" label={tr("Скопировать")} onClick={() => void copy()} />
          {canShare && <RoundButton icon="share" label={tr("Поделиться")} onClick={() => void share()} />}
        </div>
      )}
    </Card>
  );
}

function RequestCard({ friend: f, onAccepted }: { friend: Friend; onAccepted: () => void }) {
  const fr = useFriends();
  const [busy, setBusy] = useState(false);
  const accept = async () => {
    const share = await showFriendConsent(f.name);
    if (share == null) return;
    setBusy(true);
    try {
      await fr.accept(f, share);
      onAccepted();
      toast(tr("{0} теперь в друзьях", [f.name]));
    } catch (e) {
      toast(tr("Ошибка: {0}", [errText(e)]), "error");
      setBusy(false);
    }
  };
  const decline = async () => {
    if (!(await confirm(tr("Отклонить приглашение — {0}?", [f.name]), { action: tr("Отклонить") }))) return;
    try { await fr.remove(f); } catch (e) { toast(tr("Ошибка: {0}", [errText(e)]), "error"); }
  };
  return (
    <Card color="butter" seed={f.friendshipId.charCodeAt(0)} className="fr-req">
      <div className="fr-req-head">
        <FriendAvatar name={f.name} size={46} />
        <div>
          <b>{f.name}</b>
          <span>{tr("зовёт тебя в друзья")}</span>
        </div>
      </div>
      <div className="fr-req-actions">
        <Button color="orange" expand busy={busy} onClick={() => void accept()}>{tr("Принять")}</Button>
        <Button ghost expand disabled={busy} onClick={() => void decline()}>{tr("Отклонить")}</Button>
      </div>
    </Card>
  );
}

function SentCard({ friend: f }: { friend: Friend }) {
  const fr = useFriends();
  const cancel = async () => {
    if (!(await confirm(tr("Отменить приглашение — {0}?", [f.name]), { action: tr("Отменить"), cancel: tr("Назад") }))) return;
    try { await fr.remove(f); } catch (e) { toast(tr("Ошибка: {0}", [errText(e)]), "error"); }
  };
  return (
    <Card seed={f.friendshipId.charCodeAt(1)} padding="10px 10px 10px 12px" className="fr-sent">
      <FriendAvatar name={f.name} size={40} />
      <div>
        <b>{f.name}</b>
        <span>{tr("ждём ответа")}</span>
      </div>
      <Button small ghost danger onClick={() => void cancel()}>{tr("Отменить")}</Button>
    </Card>
  );
}

export default function FriendsScreen() {
  const fr = useFriends();
  const route = useRoute();
  const [tab, setTab] = useState(route.query.get("tab") === "requests" ? 1 : 0); // 0 — друзья, 1 — приглашения
  const dir = useRef(1);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { void fr.refresh(); }, [fr]);

  const go = (t: number) => { dir.current = t > tab ? 1 : -1; setTab(t); };

  const invite = async () => {
    const c = code.replace(/\D/g, "");
    if (c.length !== 6) return toast(tr("Код — это 6 цифр"));
    (document.activeElement as HTMLElement | null)?.blur?.();
    setBusy(true);
    try {
      const who = await fr.lookup(c);
      if (who.error) return toast(who.error, "error");
      const share = await showFriendConsent(who.name ?? "");
      if (share == null) return;
      const r = await fr.invite(c, share);
      if (r.error) return toast(r.error, "error");
      setCode("");
      toast(r.accepted ? tr("{0} теперь в друзьях", [r.name ?? ""]) : tr("Приглашение отправлено: {0}", [r.name ?? ""]));
      go(r.accepted ? 0 : 1);
    } catch (e) {
      toast(tr("Ошибка: {0}", [errText(e)]), "error");
    } finally {
      setBusy(false);
    }
  };

  const list = fr.accepted, inc = fr.incoming, out = fr.outgoing, req = inc.length;

  return (
    <div className="fr-screen">
      <ScreenHeader title={tr("Друзья")} back={() => back("/")} />
      <div className="fr-layout">
        <aside className="fr-side">
          <Appear><MyCode code={fr.myCode} /></Appear>
          <Appear i={1}>
            <Card seed={2} padding="14px 14px 14px 16px" className="fr-add">
              <div className="fr-add-title"><Icon name="user-plus" size={18} />{tr("Добавить по коду")}</div>
              <div className="fr-add-row">
                <Field value={code} onChange={(v) => setCode(v.replace(/\D/g, "").slice(0, 6))} hint={tr("Код друга")} inputMode="numeric" maxLength={6} autoComplete="off" name="friend-code" onEnter={() => void invite()} />
                <Button color="orange" busy={busy} onClick={() => void invite()}>{tr("Позвать")}</Button>
              </div>
            </Card>
          </Appear>
        </aside>

        <section className="fr-main">
          <div className="fr-tabs">
            <Pill selected={tab === 0} onClick={() => go(0)}>{tr("Друзья")}</Pill>
            <Pill selected={tab === 1} color={req > 0 ? "orange" : null} onClick={() => go(1)}>{req > 0 ? tr("Приглашения · {0}", [req]) : tr("Приглашения")}</Pill>
          </div>
          <SlideSwitcher k={tab} dir={dir.current}>
            {tab === 0 ? (
              !fr.loaded ? (
                fr.error
                  ? <EmptyState title={tr("Не получилось загрузить")} text={fr.error} mood="worried" action={tr("Ещё раз")} onAction={() => void fr.refresh()} />
                  : <div className="fr-loading"><Osi size={72} mood="thinking" /></div>
              ) : !list.length ? (
                <EmptyState title={tr("Пока никого")} text={tr("Поделись своим кодом или введи код друга — после принятия вы увидите планы друг друга.")} mood="calm" />
              ) : (
                <div className="fr-list">
                  {list.map((f, i) => <Appear key={f.friendshipId} i={i}><FriendCard friend={f} index={i} /></Appear>)}
                </div>
              )
            ) : !inc.length && !out.length ? (
              <EmptyState title={tr("Приглашений нет")} text={tr("Здесь появятся приглашения от друзей и те, что отправил ты.")} mood="sleepy" />
            ) : (
              <div className="fr-reqs">
                {inc.length > 0 && <div className="fr-list">{inc.map((f, i) => <Appear key={f.friendshipId} i={i}><RequestCard friend={f} onAccepted={() => go(0)} /></Appear>)}</div>}
                {out.length > 0 && <div className="fr-sub">{tr("ОТПРАВЛЕННЫЕ")}</div>}
                {out.length > 0 && <div className="fr-list">{out.map((f, i) => <Appear key={f.friendshipId} i={inc.length + i}><SentCard friend={f} /></Appear>)}</div>}
              </div>
            )}
          </SlideSwitcher>
        </section>
      </div>
    </div>
  );
}
