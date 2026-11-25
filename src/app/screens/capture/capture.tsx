// Быстрая запись — порт app/lib/screens/capture/capture_sheet.dart:
// сказать или написать Оси — он разложит по полочкам; внизу — ручное создание.
import { useEffect, useRef, useState } from "react";
import { tr } from "@/i18n";
import { Button, Card, Collapse, Icon, Osi, Pill, SectionTitle, openSheet, toast, type OsiMood } from "@/ui";
import { Assistant, type AssistantReply } from "../../data/assistant";
import { sameDate } from "../../data/repeat";
import { store } from "../../data/store";
import { fmtDay } from "../../format";
import { showEventEditor } from "../calendar/eventEditor";
import { ActionProposal, BuildingProposal, RichMessage, cleanReply, useAutoGrow, useLive, useLiveText, useSpeech, type Live } from "../chat/parts";
import { showTrackerEditor } from "../goals/trackerEditor";
import { showMoodSheet } from "../mood/moodSheet";
import { showNoteEditor } from "../notes/noteEditor";
import { showPlans } from "../plans/plans";
import { showClientEditor, showProjectEditor, showTaskEditor } from "../projects/editors";
import "../chat/chat.css";

/**
 * Быстрая запись: текст или голос → Оси раскладывает на события, задачи, оплаты.
 * voice — сразу включить микрофон; text — готовый текст, сразу уходит Оси; day — день, на который смотрит пользователь.
 */
export function showCapture(o: { voice?: boolean; text?: string; day?: Date } = {}): Promise<void> {
  return openSheet<void>((close) => <CaptureSheet voice={o.voice ?? false} text={o.text} day={o.day} close={() => close()} />).then(() => undefined);
}

function CaptureSheet({ voice, text: preset, day, close }: { voice: boolean; text?: string; day?: Date; close: () => void }) {
  const live = useLive();
  const [text, setText] = useState(preset?.trim() ?? "");
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState<AssistantReply | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sending = useRef(false);
  const alive = useRef(true);
  const inputRef = useAutoGrow(text, 140);
  const speech = useSpeech((t) => { setText(t); setReply(null); }, () => text);

  const send = async () => {
    if (speech.listening) speech.stop();
    let q = text.trim();
    if (!q || sending.current) return;
    if (day && !sameDate(day, new Date())) q = tr("{0}\n(контекст: я сейчас смотрю на {1} {2})", [q, fmtDay(day), day.getFullYear()]);
    if (!store.online) {
      // офлайн-очереди в вебе нет: запись остаётся в поле
      setError(tr("Нет связи с сервером. Проверь интернет."));
      return;
    }
    sending.current = true;
    setBusy(true);
    setError(null);
    setReply(null);
    live.reset();
    live.start();
    try {
      const r = await Assistant.capture(q, {
        onDelta: (full) => { live.incoming = full; },
        onStatus: () => live.setBuilding(true),
      });
      live.incoming = r.reply;
      if (!alive.current) return;
      await live.settle(2500);
      if (!alive.current) return;
      setReply(r);
      const hint = Assistant.leftHint(r);
      if (hint) toast(hint);
    } catch (e) {
      if (alive.current) setError(Assistant.errorText(e));
    } finally {
      live.stop();
      sending.current = false;
      if (alive.current) { live.setBuilding(false); setBusy(false); }
    }
  };

  // готовый текст уходит сразу, иначе по просьбе включается микрофон
  const opened = useRef(false);
  useEffect(() => {
    alive.current = true;
    const t = setTimeout(() => {
      if (opened.current) return;
      opened.current = true;
      if (preset?.trim()) void send();
      else if (voice && speech.supported) speech.start();
    }, 0);
    return () => { clearTimeout(t); alive.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // в листе Enter — новая строка (запись бывает длинной); отправка — Ctrl/⌘ + Enter
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); }
  };

  /** Лист закрывается, редактор открывается следом. */
  const quick = (icon: string, label: string, open: () => unknown) => (
    <Pill key={label} icon={icon} onClick={() => { close(); void open(); }}>{label}</Pill>
  );

  const mood: OsiMood = busy ? "thinking" : speech.listening ? "listening" : error ? "worried" : reply ? "excited" : "happy";
  const title = speech.listening ? tr("Слушаю…") : busy ? tr("Раскладываю по полочкам…") : tr("Что записать?");
  const limitWhy = reply?.limitHit ? Assistant.limitReason() : null;

  return (
    <>
      <header className="cap-head">
        <Osi size={84} mood={mood} />
        <div className="cap-head-text">
          <h2><span key={title}>{title}</span></h2>
          <p>{tr("Например: «21 августа в 13:00 встреча с Мареком из Autohaus» или «новый клиент Анна, проект логотип за 3000, аванс 1000».")}</p>
        </div>
        <button type="button" className="sheet-x" aria-label={tr("Закрыть")} onClick={close}><Icon name="close" size={18} /></button>
      </header>

      <Card seed={0} padding="6px 8px 6px 14px" className={"cap-box" + (speech.listening ? " rec" : "")}>
        <textarea ref={inputRef} rows={2} value={text} autoFocus={!voice && !preset} placeholder={tr("Скажи или напиши…")} aria-label={tr("Скажи или напиши…")} maxLength={4000}
          onChange={(e) => setText(e.target.value)} onKeyDown={onKey} />
        {speech.supported && (
          <button type="button" className={"cap-mic" + (speech.listening ? " rec" : "")} aria-label={speech.listening ? tr("Остановить запись") : tr("Голосовой ввод")} title={speech.listening ? tr("Остановить запись") : tr("Голосовой ввод")}
            onClick={() => { if (!speech.listening) setReply(null); speech.toggle(); }}>
            <Icon name={speech.listening ? "stop" : "mic"} size={22} fill />
          </button>
        )}
      </Card>

      {reply == null ? (
        <div key="ask" className="cap-step">
          <LiveReply live={live} show={busy} />
          <Button color="orange" icon="spark" expand busy={busy} disabled={!text.trim()} onClick={() => void send()}>{tr("Отдать Оси")}</Button>
        </div>
      ) : (
        <div key="reply" className="cap-step">
          <Card seed={1} className="cap-reply"><RichMessage text={cleanReply(reply.reply)} /></Card>
          {reply.actions.length > 0 ? (
            <ActionProposal actions={reply.actions} messageId={reply.messageId}
              onDone={(st) => {
                if (st !== "applied") return;
                toast(tr("Записано ✓"));
                close();
              }} />
          ) : (
            <Button ghost expand onClick={() => { setReply(null); inputRef.current?.focus(); }}>{tr("Уточнить")}</Button>
          )}
          {limitWhy && <div className="cap-limit"><Button small onClick={() => void showPlans(limitWhy)}>{tr("Посмотреть подписки")}</Button></div>}
        </div>
      )}
      <Collapse open={!!error}>
        <p className="cap-error" role="alert"><Icon name="alert" size={16} />{error}</p>
      </Collapse>

      <SectionTitle>{tr("Или вручную")}</SectionTitle>
      <div className="cap-quick">
        {quick("calendar", tr("Событие"), () => showEventEditor({ day }))}
        {quick("check", tr("Задача"), () => showTaskEditor({ day }))}
        {quick("person", tr("Клиент"), () => showClientEditor())}
        {quick("folder", tr("Проект"), () => showProjectEditor())}
        {quick("star", tr("Цель"), () => showTrackerEditor())}
        {quick("note", tr("Заметка"), () => showNoteEditor())}
        {quick("smile", tr("Настроение"), () => showMoodSheet())}
      </div>
    </>
  );
}

/** Текст, который Оси печатает прямо сейчас, и «Создаю предложение». */
function LiveReply({ live, show }: { live: Live; show: boolean }) {
  useLiveText(live);
  const text = cleanReply(live.shown);
  if (!show) return null;
  return (
    <>
      {text && <Card seed={1} className="cap-reply"><RichMessage text={text} cursor={!live.building} /></Card>}
      {live.building && <BuildingProposal compact />}
    </>
  );
}
