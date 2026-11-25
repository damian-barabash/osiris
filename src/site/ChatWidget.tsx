// Чат с Оси в правом нижнем углу лендинга. Гость может задать 2 вопроса с одного адреса (считает сервер),
// дальше — окно «создай аккаунт / посмотри тарифы». Грузится отдельным чанком после отрисовки страницы.
// Безопасность: ответы выводятся только как текст (никакого HTML), ввод ограничен по длине, лимиты и проверки — на сервере.
import { useCallback, useEffect, useRef, useState } from "react";
import { Osi, type OsiMood } from "@/brand/Osi";
import { siteCall, track } from "@/lib/track";
import { CONTENT, type SiteLang } from "./content";
import { Ic, appUrl, pageUrl } from "./Chrome";
import "./chat.css";

interface Msg { me: boolean; text: string }
const STORE = "osiris_guest_chat";
const MAX = 400;

function load(): Msg[] {
  try {
    const v = JSON.parse(sessionStorage.getItem(STORE) ?? "[]");
    return Array.isArray(v) ? v.filter((m) => m && typeof m.text === "string" && typeof m.me === "boolean").slice(-8) : [];
  } catch { return []; }
}

export default function ChatWidget({ lang }: { lang: SiteLang }) {
  const c = CONTENT[lang].chat;
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>(load);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [left, setLeft] = useState<number | null>(null);
  const [typing, setTyping] = useState<string | null>(null); // ответ, который сейчас «печатается»
  const [wall, setWall] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [peek, setPeek] = useState(false);
  const list = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const timer = useRef(0);

  const show = useCallback(() => {
    setClosing(false);
    setOpen(true);
    setPeek(false);
    track("chat_open");
    void siteCall<{ left?: number }>({ action: "chat_state" }).then(([st, d]) => { if (st === 200 && typeof d.left === "number") setLeft(d.left); }).catch(() => {});
  }, []);
  const hide = useCallback(() => {
    setClosing(true);
    setTimeout(() => { setOpen(false); setClosing(false); setWall(false); }, 280);
  }, []);

  useEffect(() => {
    window.addEventListener("osiris:chat", show);
    const t = setTimeout(() => setPeek(true), 6000); // через несколько секунд Оси «выглядывает» с подсказкой
    return () => { window.removeEventListener("osiris:chat", show); clearTimeout(t); cancelAnimationFrame(timer.current); };
  }, [show]);

  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") (wall ? setWall(false) : hide()); };
    document.addEventListener("keydown", key);
    const f = setTimeout(() => input.current?.focus({ preventScroll: true }), 380);
    return () => { document.removeEventListener("keydown", key); clearTimeout(f); };
  }, [open, wall, hide]);

  useEffect(() => { list.current?.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" }); }, [msgs, typing, busy, open]);
  useEffect(() => { try { sessionStorage.setItem(STORE, JSON.stringify(msgs.slice(-8))); } catch { /* */ } }, [msgs]);

  /** «Печать» ответа: текст появляется ровным темпом, в конце становится обычным сообщением. */
  const typeOut = (full: string) => {
    const t0 = performance.now(), cps = Math.max(45, full.length / 3.2);
    const tick = (now: number) => {
      const n = Math.min(full.length, Math.floor(((now - t0) / 1000) * cps));
      setTyping(full.slice(0, n));
      if (n < full.length) timer.current = requestAnimationFrame(tick);
      else { setTyping(null); setMsgs((m) => [...m, { me: false, text: full }]); }
    };
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) setMsgs((m) => [...m, { me: false, text: full }]);
    else timer.current = requestAnimationFrame(tick);
  };

  const send = async (q?: string) => {
    const t = (q ?? text).replace(/\s+/g, " ").trim().slice(0, MAX);
    if (!t || busy || typing !== null) return;
    if (left !== null && left <= 0) { setWall(true); track("chat_limit"); return; }
    setNote(null);
    setText("");
    setMsgs((m) => [...m, { me: true, text: t }]);
    setBusy(true);
    track("chat_ask");
    try {
      const [st, d] = await siteCall<{ reply?: string; left?: number; error?: string }>({ action: "chat", text: t, lang });
      setBusy(false);
      if (st === 200 && typeof d.reply === "string") {
        if (typeof d.left === "number") setLeft(d.left);
        typeOut(d.reply);
      } else if (d.error === "limit") { setLeft(0); setMsgs((m) => m.slice(0, -1)); setText(t); setWall(true); track("chat_limit"); }
      else { setMsgs((m) => m.slice(0, -1)); setText(t); setNote(d.error === "rate" ? c.rate : d.error === "busy" || d.error === "off" ? c.busy : c.error); }
    } catch {
      setBusy(false);
      setMsgs((m) => m.slice(0, -1));
      setText(t);
      setNote(c.error);
    }
  };

  const mood: OsiMood = wall ? "worried" : busy ? "thinking" : typing !== null ? "happy" : text ? "listening" : "happy";
  const out = left !== null && left <= 0;

  return (
    <div className={`cw${open ? " open" : ""}${closing ? " closing" : ""}`}>
      {!open && (
        <>
          {peek && msgs.length === 0 && <button type="button" className="cw-peek" onClick={show}>{CONTENT[lang].hero.bubble}</button>}
          <button type="button" className="cw-fab" aria-label={c.open} onClick={show}>
            <Osi size={62} mood="happy" wave={peek} />
            <span>{c.open}</span>
          </button>
        </>
      )}
      {open && (
        <section className="cw-panel" role="dialog" aria-label={c.title} aria-modal="false">
          <header className="cw-head">
            <Osi size={58} mood={mood} />
            <div><b>{c.title}</b><small>{c.sub}</small></div>
            {left !== null && <span className={`cw-left${out ? " out" : ""}`}>{out ? "0" : c.left(left)}</span>}
            <button type="button" className="cw-x" aria-label={c.close} onClick={hide}><Ic n="close" size={18} /></button>
          </header>
          <div className="cw-list" ref={list} aria-live="polite">
            <div className="cw-msg osi">{c.hello}</div>
            {msgs.map((m, i) => <div key={i} className={`cw-msg ${m.me ? "me" : "osi"}`}>{m.text}</div>)}
            {busy && <div className="cw-msg osi dots" aria-label={c.typing}><i /><i /><i /></div>}
            {typing !== null && <div className="cw-msg osi">{typing}<i className="caret" /></div>}
            {msgs.length === 0 && !busy && (
              <div className="cw-sugg">
                {c.suggestions.map((s, i) => <button key={s} type="button" style={{ animationDelay: `${0.25 + i * 0.09}s` }} onClick={() => void send(s)}>{s}</button>)}
              </div>
            )}
            {note && <div className="cw-note" role="alert">{note}</div>}
          </div>
          <form className="cw-form" onSubmit={(e) => { e.preventDefault(); void send(); }}>
            <textarea ref={input} rows={1} value={text} maxLength={MAX} placeholder={c.placeholder} aria-label={c.placeholder} enterKeyHint="send"
              onChange={(e) => setText(e.target.value)} onFocus={() => { if (out) setWall(true); }}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }} />
            <button type="submit" aria-label={c.send} disabled={busy || typing !== null || !text.trim()}><Ic n="send" size={18} /></button>
          </form>
          <p className="cw-disc">{c.disclaimer} <a href={pageUrl(lang, "privacy")}>{CONTENT[lang].footer.privacy}</a></p>
          {wall && (
            <div className="cw-wall" role="alertdialog" aria-label={c.wall.title}>
              <div className="cw-wall-card">
                <Osi size={110} mood="excited" wave />
                <h3>{c.wall.title}</h3>
                <p>{c.wall.text}</p>
                <a className="b orange" href={appUrl("signup")} onClick={() => track("cta_signup")}>{c.wall.signup}</a>
                <a className="b ghost" href={`${pageUrl(lang, "")}#pricing`} onClick={hide}>{c.wall.plans}</a>
                <a className="cw-link" href={appUrl()} onClick={() => track("cta_login")}>{c.wall.login}</a>
                <button type="button" className="cw-link" onClick={() => setWall(false)}>{c.wall.later}</button>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
