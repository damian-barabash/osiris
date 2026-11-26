// Листы, диалоги и тосты. Открываются из любого места кода (как showPaperSheet / confirm / toast в приложении)
// и всегда анимированы: лист выезжает снизу (телефон) или вырастает из центра (ноутбук), а при закрытии уезжает обратно.
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { tr } from "@/i18n";
import { Icon } from "./icons";
import { Button } from "./kit";

type SheetItem = { id: number; render: (close: (v?: unknown) => void) => ReactNode; resolve: (v: unknown) => void; wide: boolean; closing: boolean; dismissable: boolean; side: boolean };
type ToastItem = { id: number; text: string; kind: "info" | "error"; closing: boolean };

let seq = 1;
let sheets: SheetItem[] = [];
let toasts: ToastItem[] = [];
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
const sub = (f: () => void) => { subs.add(f); return () => void subs.delete(f); };
let snap = 0;
const bump = () => { snap++; emit(); };

const EXIT_MS = 260;

/**
 * Открыть лист. render получает close(result). Возвращает Promise с результатом (undefined — закрыли крестиком/фоном).
 * wide — широкий лист на ноутбуке; side — выезжает справа панелью (детали, редакторы с длинной формой).
 */
export function openSheet<T = unknown>(render: (close: (v?: T) => void) => ReactNode, opts: { wide?: boolean; dismissable?: boolean; side?: boolean } = {}): Promise<T | undefined> {
  return new Promise((resolve) => {
    sheets = [...sheets, { id: seq++, render: render as SheetItem["render"], resolve: resolve as (v: unknown) => void, wide: !!opts.wide, closing: false, dismissable: opts.dismissable ?? true, side: !!opts.side }];
    bump();
  });
}

function closeSheet(id: number, v?: unknown) {
  const s = sheets.find((x) => x.id === id);
  if (!s || s.closing) return;
  sheets = sheets.map((x) => (x.id === id ? { ...x, closing: true } : x));
  bump();
  setTimeout(() => {
    sheets = sheets.filter((x) => x.id !== id);
    s.resolve(v);
    bump();
  }, EXIT_MS);
}

/** Закрыть все листы (например, при выходе из аккаунта). */
export function closeAllSheets() { for (const s of sheets) closeSheet(s.id); }

export function toast(text: string, kind: "info" | "error" = "info") {
  const id = seq++;
  toasts = [...toasts.slice(-2), { id, text, kind, closing: false }];
  bump();
  setTimeout(() => { toasts = toasts.map((t) => (t.id === id ? { ...t, closing: true } : t)); bump(); }, 3200);
  setTimeout(() => { toasts = toasts.filter((t) => t.id !== id); bump(); }, 3200 + EXIT_MS);
}

/** Подтверждение: true — согласились. danger — красная кнопка действия. */
export function confirm(title: string, { text, action, cancel, danger = true }: { text?: string; action?: string; cancel?: string; danger?: boolean } = {}): Promise<boolean> {
  return openSheet<boolean>((close) => (
    <div className="dialog">
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      <div className="dialog-actions">
        <Button ghost onClick={() => close(false)}>{cancel ?? tr("Отмена")}</Button>
        <Button danger={danger} onClick={() => close(true)}>{action ?? tr("Удалить")}</Button>
      </div>
    </div>
  )).then((v) => v === true);
}

/** Выбор из нескольких вариантов (например, «Только это / Это и следующие / Вся серия»). */
export function choose<T extends string>(title: string, options: { value: T; label: string; sub?: string; danger?: boolean }[], text?: string): Promise<T | undefined> {
  return openSheet<T>((close) => (
    <div className="dialog">
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      <div className="dialog-list">
        {options.map((o) => (
          <button key={o.value} type="button" className="dialog-option" style={o.danger ? { color: "var(--danger)" } : undefined} onClick={() => close(o.value)}>
            <b>{o.label}</b>
            {o.sub && <span>{o.sub}</span>}
          </button>
        ))}
      </div>
      <Button ghost expand onClick={() => close()}>{tr("Отмена")}</Button>
    </div>
  ));
}

/** Шапка листа: заголовок, подпись, действие справа («Готово») и крестик. */
export function SheetHeader({ title, sub, action, onAction, busy, close }: { title: ReactNode; sub?: ReactNode; action?: string; onAction?: () => void; busy?: boolean; close: () => void }) {
  return (
    <header className="sheet-header">
      <div className="sheet-title">
        <h2>{title}</h2>
        {sub && <div className="sheet-sub">{sub}</div>}
      </div>
      {action && <Button small busy={busy} onClick={onAction}>{action}</Button>}
      <button type="button" className="sheet-x" aria-label={tr("Закрыть")} onClick={close}><Icon name="close" size={18} /></button>
    </header>
  );
}

function SheetView({ s, top }: { s: SheetItem; top: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState(0);
  const start = useRef<number | null>(null);

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const el = ref.current;
    // фокус внутрь листа — после начала анимации, чтобы клавиатура на телефоне не дёргала выезд
    const t = setTimeout(() => { if (el && !el.contains(document.activeElement)) (el.querySelector<HTMLElement>("[autofocus], input, textarea, button") ?? el).focus({ preventScroll: true }); }, 120);
    return () => { clearTimeout(t); prev?.focus?.({ preventScroll: true }); };
  }, []);

  useEffect(() => {
    if (!top) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && s.dismissable) closeSheet(s.id);
      if (e.key !== "Tab" || !ref.current) return;
      const f = [...ref.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), textarea, select, [tabindex]:not([tabindex="-1"])')].filter((x) => x.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [top, s.id, s.dismissable]);

  // смахивание вниз за «ручку» на телефоне
  const onDown = (e: React.PointerEvent) => { start.current = e.clientY; (e.target as HTMLElement).setPointerCapture(e.pointerId); };
  const onMove = (e: React.PointerEvent) => { if (start.current != null) setDrag(Math.max(0, e.clientY - start.current)); };
  const onUp = () => { if (drag > 110 && s.dismissable) closeSheet(s.id); setDrag(0); start.current = null; };

  return (
    <div className={`sheet-layer${s.closing ? " closing" : ""}${s.side ? " as-panel" : ""}`}>
      <div className="sheet-backdrop" onClick={() => s.dismissable && closeSheet(s.id)} />
      <div ref={ref} role="dialog" aria-modal="true" tabIndex={-1} className={`sheet${s.wide ? " wide" : ""}`} style={drag ? { transform: `translateY(${drag}px)`, transition: "none" } : undefined}>
        <div className="sheet-grip" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}><span /></div>
        <div className="sheet-body">{s.render((v) => closeSheet(s.id, v))}</div>
      </div>
    </div>
  );
}

/** Ставится один раз в корне приложения. */
export function Overlays() {
  useSyncExternalStore(sub, () => snap, () => snap);
  useEffect(() => {
    document.documentElement.classList.toggle("sheet-open", sheets.length > 0);
  });
  if (typeof document === "undefined") return null;
  return createPortal(
    <>
      {sheets.map((s, i) => <SheetView key={s.id} s={s} top={i === sheets.length - 1} />)}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind}${t.closing ? " closing" : ""}`}>
            {t.kind === "error" && <Icon name="alert" size={16} />}
            {t.text}
          </div>
        ))}
      </div>
    </>,
    document.body,
  );
}
