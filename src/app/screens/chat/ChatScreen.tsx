// Чат с Оси — порт app/lib/screens/chat/chat_screen.dart.
// Телефон — как в приложении; ноутбук — колонка разговора по центру и большой Оси сбоку, который реагирует на происходящее.
import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { tr } from "@/i18n";
import { Button, Card, Collapse, Cutout, Icon, Osi, P, Pill, RoundButton, confirm, toast, type OsiMood } from "@/ui";
import { ActionRunner, Assistant } from "../../data/assistant";
import type { ChatMessage } from "../../data/models";
import { useStore } from "../../data/store";
import { useRoute, nav } from "../../router";
import { sb } from "../../sb";
import { Plans, showPlans } from "../plans/plans";
import { AiConsent } from "../account/consent";
import { reportSheet } from "../account/sheets";
import { takeQueuedQuestion } from "./ask";
import { ActionProposal, BuildingProposal, RichMessage, WaitingDots, cleanReply, keptActions, noEmoji, useAutoGrow, useLive, useLivePhase, useLiveText, useSpeech, type Live } from "./parts";
import "./chat.css";

/** Сколько сообщений рисуем сразу; остальные подгружаются при прокрутке вверх. */
const PAGE = 40;
/** «Давай» на висящее предложение — применяем сразу, без нового запроса к ИИ (список слов — как в приложении). */
const CONFIRM = /^(давай|да|ок|окей|ok|ага|угу|применяй|применить|подтверждаю|делай|го|go|норм|супер)[\s!.,)]*$/i;

const seedOf = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h & 0xff; };

const suggestions = (hours: boolean) => [
  tr("Что важного сегодня?"),
  ...(hours ? [tr("Сколько я заработал в этом месяце?")] : []),
  tr("Кто сколько мне должен?"),
  tr("Что горит на этой неделе?"),
  tr("Как моё настроение за неделю?"),
  tr("Что влияет на моё настроение?"),
  tr("Подведи итоги недели"),
  tr("Какие решающие даты впереди?"),
  tr("С чего начать день?"),
];

export default function ChatScreen() {
  const s = useStore();
  const route = useRoute();
  const live = useLive();
  const [input, setInput] = useState("");
  const [pending, setPending] = useState<string | null>(null); // вопрос, на который ждём ответ
  const [error, setError] = useState<string | null>(null);
  const [limit, setLimit] = useState(false);
  const [left, setLeft] = useState<number | null>(null);
  const [cheer, setCheer] = useState(false); // только что применили предложение — Оси радуется
  const [count, setCount] = useState(PAGE);
  const [away, setAway] = useState(false); // пользователь прокрутил вверх

  const busy = useRef(false);
  const alive = useRef(true);
  const listRef = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const grow = useRef<number | null>(null); // высота списка до подгрузки старых сообщений
  const frozen = useRef<Set<string> | null>(null); // пока идёт ответ, новые строки из базы не показываем — их заменяет живой пузырь
  const seen = useRef<Set<string> | null>(null);
  const quiet = useRef(false); // следующая перерисовка — подмена живого пузыря сохранённым, без анимации
  const cheerTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const inputRef = useAutoGrow(input, 132);

  const speech = useSpeech(setInput, () => input);

  const msgs = s.chat;
  seen.current ??= new Set(msgs.map((m) => m.id));
  const visible = frozen.current ? msgs.filter((m) => frozen.current!.has(m.id)) : msgs;
  const shown = visible.slice(-count);
  const older = visible.length - shown.length;

  // ------------------------------------------------------------------ прокрутка
  const toBottom = useCallback((smooth = false) => {
    const el = listRef.current;
    if (!el) return;
    if (smooth) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    else el.scrollTop = el.scrollHeight;
  }, []);
  const follow = useCallback(() => { if (stick.current) toBottom(); }, [toBottom]);

  const onScroll = () => {
    const el = listRef.current;
    if (!el) return;
    const far = el.scrollHeight - el.scrollTop - el.clientHeight;
    stick.current = far < 90;
    setAway(far > 320);
    if (el.scrollTop < 140 && older > 0 && grow.current == null) {
      grow.current = el.scrollHeight;
      setCount((c) => c + PAGE);
    }
  };
  // старые сообщения добавились сверху — оставляем взгляд на том же месте
  useLayoutEffect(() => {
    const el = listRef.current;
    if (el && grow.current != null) el.scrollTop += el.scrollHeight - grow.current;
    grow.current = null;
  }, [count]);

  const lastId = shown.at(-1)?.id;
  useLayoutEffect(() => { follow(); }, [follow, lastId, pending, error, limit, shown.length]);
  useLayoutEffect(() => { toBottom(); }, [toBottom]);
  // высота окна или поля ввода изменилась — низ разговора остаётся на месте
  useEffect(() => {
    const el = listRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => follow());
    ro.observe(el);
    return () => ro.disconnect();
  }, [follow]);

  useEffect(() => {
    for (const m of msgs) seen.current!.add(m.id);
    quiet.current = false;
  });
  useEffect(() => { alive.current = true; return () => { alive.current = false; clearTimeout(cheerTimer.current); }; }, []);

  const celebrate = useCallback(() => {
    setCheer(true);
    clearTimeout(cheerTimer.current);
    cheerTimer.current = setTimeout(() => setCheer(false), 2600);
  }, []);

  // ------------------------------------------------------------------ отправка
  const begin = (text: string) => {
    frozen.current = new Set(s.chat.map((m) => m.id));
    live.reset();
    stick.current = true;
    setError(null);
    setPending(text);
  };
  const finish = () => {
    live.stop();
    frozen.current = null;
    quiet.current = true;
    busy.current = false;
    if (!alive.current) return;
    live.setBuilding(false);
    setPending(null);
  };

  /** «Давай» на висящее предложение — применяем сразу, без нового запроса к ИИ. */
  const confirmPending = async (text: string): Promise<boolean> => {
    if (!CONFIRM.test(text)) return false;
    const last = s.chat.findLast((m) => !m.mine);
    if (!last || !last.actions.length || ActionRunner.status(last.id, last.actionsStatus) !== "pending") return false;
    const items = keptActions(last.id, last.actions);
    if (!items.length) return false;
    // подписи снимаем до применения: после удаления названия уже не найти
    const done = items.map((a) => `• ${ActionRunner.describe(a).title}`).join("\n");
    begin(text);
    live.setBuilding(true);
    try {
      const r = await ActionRunner.apply(last.id, items);
      if (r.status === "applied") {
        const now = Date.now();
        await s.insert("ai_messages", { role: "user", content: text, created_at: new Date(now).toISOString() });
        await s.insert("ai_messages", { role: "assistant", content: tr("Готово ✓ Записал:\n{0}", [done]), created_at: new Date(now + 5).toISOString() });
        celebrate();
      }
    } catch (e) {
      if (alive.current) setError(tr("Не получилось применить: {0}", [String((e as Error)?.message ?? e).slice(0, 200)]));
    } finally {
      finish();
    }
    return true;
  };

  const send = async (preset?: string) => {
    if (speech.listening) speech.stop();
    const text = (preset ?? input).trim();
    if (!text || busy.current) return;
    busy.current = true; // сразу: второй Enter в тот же миг не должен отправить вопрос дважды
    if (preset == null) setInput("");
    if (await confirmPending(text)) return;
    // без согласия на работу ИИ вопрос не уходит: остаётся в поле
    if (!(await AiConsent.ensure())) {
      busy.current = false;
      if (preset == null) setInput(text);
      return;
    }
    if (!s.online) {
      // офлайн-очереди в вебе нет: вопрос остаётся в поле
      busy.current = false;
      if (preset == null) setInput(text);
      toast(tr("Нет связи с сервером. Проверь интернет."), "error");
      return;
    }
    begin(text);
    live.start();
    try {
      const r = await Assistant.chat(text, {
        onDelta: (full) => { live.incoming = full; },
        onStatus: () => live.setBuilding(true),
      });
      live.incoming = r.reply;
      // даём допечатать, потом подменяем на сохранённое сообщение с карточками
      if (alive.current) await live.settle();
      await s.reloadChat();
      if (!alive.current) return;
      const hint = Assistant.leftHint(r);
      if (hint) toast(hint);
      if (r.left != null) setLeft(r.left);
      setLimit(r.limitHit === true);
    } catch (e) {
      if (alive.current) {
        setError(Assistant.errorText(e));
        // ничего не пришло — вопрос возвращается в поле, чтобы не набирать заново
        if (!live.incoming && preset == null) setInput((v) => v || text);
      }
    } finally {
      finish();
    }
  };

  // вопрос с другого экрана уходит сразу; текст из адреса (?q=) только подставляется в поле
  const opened = useRef(false);
  useEffect(() => {
    const t = setTimeout(() => {
      if (opened.current) return;
      opened.current = true;
      const q = takeQueuedQuestion();
      if (q) { void send(q); return; }
      const fromUrl = (route.query.get("q") ?? "").trim().slice(0, 2000);
      if (fromUrl) { setInput(fromUrl); nav("/chat", { replace: true }); }
      if (window.matchMedia("(min-width: 900px)").matches) inputRef.current?.focus({ preventScroll: true });
    }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clear = async () => {
    if (busy.current) return;
    if (!(await confirm(tr("Очистить историю чата? Данные (клиенты, события) останутся."), { action: tr("Очистить") }))) return;
    const { error: err } = await sb.from("ai_messages").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (err) toast(tr("Нет связи с сервером. Проверь интернет."), "error");
    await s.reloadChat();
    setLimit(false);
    setError(null);
  };

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
    e.preventDefault();
    void send();
  };

  const hints = suggestions(s.profile?.hoursTab ?? false);
  const hintPills = hints.map((h) => <Pill key={h} dense disabled={pending != null} onClick={() => void send(h)}>{h}</Pill>);
  const empty = msgs.length === 0 && pending == null;
  const mood: OsiMood = speech.listening ? "listening" : pending != null ? "thinking" : cheer ? "excited" : error ? "worried" : limit ? "sleepy" : "happy";
  const limitWhy = Assistant.limitReason();
  const limitText = limitWhy ?? tr("Сообщения Оси на сегодня закончились. Завтра продолжим.");

  return (
    <div className="chat">
      <section className="chat-main" aria-label={tr("Оси")}>
        <header className="screen-header chat-head">
          <span className="chat-head-osi"><MoodOsi live={live} mood={mood} size={46} /></span>
          <div className="screen-title">
            <h1>{tr("Оси")}</h1>
            <div className="screen-sub">{tr("знает твои даты, клиентов, деньги и настроение")}</div>
          </div>
          <div className="screen-actions">
            {msgs.length > 0 && <RoundButton icon="trash" label={tr("Очистить чат")} onClick={() => void clear()} />}
          </div>
        </header>

        <div className="chat-scroll-wrap">
          <div className="chat-scroll" ref={listRef} onScroll={onScroll} role="log" aria-live="polite" aria-relevant="additions">
            {empty ? (
              <div className="chat-empty">
                <Osi size={112} mood="happy" wave />
                <h2>{noEmoji(tr("Привет! Я Оси 👁"))}</h2>
                <p>{tr("Спрашивай что угодно про свои дела, деньги и настроение. Или скажи, что записать — я всё создам сам, а ты только подтвердишь.")}</p>
              </div>
            ) : (
              <div className="chat-list">
                {older > 0 && (
                  <button type="button" className="chat-older" onClick={() => { grow.current = listRef.current?.scrollHeight ?? null; setCount((c) => c + PAGE); }}>
                    <Icon name="up" size={15} />{tr("Показать раньше")}
                  </button>
                )}
                {shown.map((m) => (
                  <MessageView key={m.id} m={m} fresh={!quiet.current && !seen.current!.has(m.id)} onApplied={celebrate} />
                ))}
                {pending != null && (
                  <>
                    <Bubble mine text={pending} fresh />
                    {/* печать по буквам не озвучиваем: готовый ответ появится в списке целиком */}
                    <div aria-hidden><LiveAnswer live={live} onGrow={follow} /></div>
                  </>
                )}
                <Collapse open={!!error}>
                  <p className="chat-error" role="alert"><Icon name="alert" size={16} />{error}</p>
                </Collapse>
              </div>
            )}
          </div>
          <button type="button" className={"chat-jump" + (away ? " on" : "")} tabIndex={away ? 0 : -1} aria-hidden={!away} aria-label={tr("К новым сообщениям")} title={tr("К новым сообщениям")}
            onClick={() => { stick.current = true; toBottom(true); }}>
            <Icon name="down" size={20} />
          </button>
        </div>

        <Collapse open={limit}>
          <Card color="butter" seed={2} lift={3} padding="12px 14px" className="chat-limit">
            <Osi size={54} mood="sleepy" />
            <p>{limitText}</p>
            {limitWhy && <Button small onClick={() => void showPlans(limitWhy)}>{tr("Посмотреть подписки")}</Button>}
          </Card>
        </Collapse>

        <div className="chat-hints" role="group" aria-label={tr("Спроси, например")}>{hintPills}</div>

        <Card seed={1} lift={3} padding="6px 8px 6px 16px" className={"chat-compose" + (speech.listening ? " rec" : "")}>
          <textarea ref={inputRef} rows={1} value={input} placeholder={speech.listening ? tr("Слушаю…") : tr("Спроси Оси…")} aria-label={tr("Спроси Оси…")} maxLength={4000} enterKeyHint="send"
            onChange={(e) => setInput(e.target.value)} onKeyDown={onKey} />
          <div className="chat-compose-btns">
            {speech.supported && (
              <RoundButton icon={speech.listening ? "stop" : "mic"} filled={speech.listening} color={speech.listening ? P.danger : null} className={speech.listening ? "chat-mic rec" : "chat-mic"}
                label={speech.listening ? tr("Остановить запись") : tr("Голосовой ввод")} onClick={speech.toggle} />
            )}
            <RoundButton icon="arrow-up" filled color="orange" className={"chat-send" + (input.trim() && pending == null ? " ready" : "")} label={tr("Отправить")} onClick={() => void send()} />
          </div>
        </Card>
        <p className="chat-keys">{tr("Enter — отправить, Shift + Enter — новая строка")}</p>
      </section>

      <aside className="chat-side">
        <Card seed={3} lift={5} padding="22px 18px 18px" className="chat-side-card">
          <Cutout kind="star" size={34} color={P.mustard} seed={4} className="chat-side-cut a" />
          <Cutout kind="ring" size={28} color={P.lavender} seed={8} className="chat-side-cut b" />
          <Cutout kind="spark" size={24} color={P.teal} seed={5} className="chat-side-cut c" />
          <div key={mood} className="chat-side-osi"><MoodOsi live={live} mood={mood} size={196} /></div>
          <SideCaption live={live} listening={speech.listening} pending={pending != null} cheer={cheer} error={!!error} limit={limit} limitText={limitText} />
          {left != null && left > 0 && left <= 5 && !limit && <p className="chat-side-left">{tr("Сообщений Оси на сегодня осталось: {0}", [left])}</p>}
        </Card>
        <div className="chat-side-hints" role="group" aria-label={tr("Спроси, например")}>
          <h2>{tr("Спроси, например")}</h2>
          <div>{hintPills}</div>
        </div>
        {Plans.current === "free" && !limit && <p className="chat-side-note">{tr("В бесплатном плане Оси отвечает на одно сообщение в день.")}</p>}
      </aside>
    </div>
  );
}

/** Оси, который знает фазу живого ответа: думает, пока ждём, оживляется, когда печатает. */
function MoodOsi({ live, mood, size }: { live: Live; mood: OsiMood; size: number }) {
  const phase = useLivePhase(live);
  return <Osi size={size} mood={mood === "thinking" && phase === "type" ? "happy" : mood} />;
}

function SideCaption({ live, listening, pending, cheer, error, limit, limitText }: { live: Live; listening: boolean; pending: boolean; cheer: boolean; error: boolean; limit: boolean; limitText: string }) {
  const phase = useLivePhase(live);
  const text = listening ? tr("Слушаю…")
    : pending ? (phase === "build" ? tr("Создаю предложение{0}", ["…"]) : phase === "type" ? tr("Отвечаю…") : tr("Оси думает"))
    : cheer ? tr("Готово — всё записано.")
    : error ? tr("Что-то пошло не так")
    : limit ? limitText
    : tr("знает твои даты, клиентов, деньги и настроение");
  return <p key={text} className="chat-side-cap">{text}</p>;
}

/** Живой ответ: пока ждём — Оси думает; затем печать; затем «Создаю предложение». Перерисовывается только он. */
function LiveAnswer({ live, onGrow }: { live: Live; onGrow: () => void }) {
  useLiveText(live);
  const text = cleanReply(live.shown);
  useLayoutEffect(() => { onGrow(); });
  return (
    <>
      {!text && !live.building ? (
        <div className="chat-typing chat-in">
          <Osi size={44} mood="thinking" />
          <WaitingDots />
        </div>
      ) : text ? (
        <Bubble text={text} typing={!live.building} fresh />
      ) : null}
      {live.building && <BuildingProposal />}
    </>
  );
}

const MessageView = memo(function MessageView({ m, fresh, onApplied }: { m: ChatMessage; fresh: boolean; onApplied: () => void }) {
  if (m.mine) return <Bubble mine text={m.content} fresh={fresh} />;
  return (
    <>
      <Bubble text={m.content} fresh={fresh} onReport={() => void reportSheet({ kind: "osi", content: m.content, title: tr("Пожаловаться на ответ Оси") })} />
      {m.actions.length > 0 && (
        <div className={"chat-prop-wrap" + (fresh ? " chat-in" : "")}>
          <ActionProposal actions={m.actions} status={m.actionsStatus} messageId={m.id} onDone={(st) => { if (st === "applied") onApplied(); }} />
        </div>
      )}
    </>
  );
});

/** Пузырь — бумажный лист: мой — чернильный, Оси — сливочный, с маленьким Оси рядом. */
function Bubble({ text, mine = false, typing = false, fresh = false, onReport }: { text: string; mine?: boolean; typing?: boolean; fresh?: boolean; onReport?: () => void }) {
  return (
    <div className={"chat-row" + (mine ? " mine" : "") + (fresh ? " chat-in" : "")}>
      {!mine && <Osi size={34} mood={typing ? "excited" : "calm"} animate={typing} className="chat-row-osi" />}
      <Card seed={typing ? 3 : seedOf(text)} lift={2} padding="10px 14px" className={"chat-bubble " + (mine ? "mine" : "osi")}>
        {mine ? <p className="chat-mine-text">{text}</p> : <RichMessage text={text} cursor={typing} />}
      </Card>
      {/* флажок: на ноутбуке проявляется при наведении и с клавиатуры, на телефоне виден всегда (приглушённо) */}
      {onReport && <button type="button" className="chat-report" aria-label={tr("Пожаловаться на ответ Оси")} title={tr("Пожаловаться на ответ Оси")} onClick={onReport}><Icon name="flag" size={14} /></button>}
    </div>
  );
}
