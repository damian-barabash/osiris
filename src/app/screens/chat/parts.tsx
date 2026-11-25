// Общие части чата и быстрой записи: текст Оси, печатная машинка, карточки предложений, «Создаю предложение», голос.
// Порт app/lib/widgets/rich_text.dart, action_proposal.dart, building_proposal.dart.
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { L, tr } from "@/i18n";
import { Button, Card, Collapse, Cutout, Icon, Osi, P, toast } from "@/ui";
import { ActionRunner } from "../../data/assistant";
import type { Row } from "../../data/models";
import { useStore } from "../../data/store";
import "./chat.css";

// ---------------------------------------------------------------------- текст Оси

/** **жирный** → <b>; всё остальное — обычные текстовые узлы. */
function inline(line: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\*\*(.+?)\*\*/g;
  let i = 0, k = 0;
  for (let m = re.exec(line); m; m = re.exec(line)) {
    if (m.index > i) out.push(line.slice(i, m.index));
    out.push(<b key={k++}>{m[1]}</b>);
    i = m.index + m[0].length;
  }
  if (i < line.length) out.push(line.slice(i));
  return out;
}

/** Служебные пометки истории, которые модель изредка повторяет, — не показываем. */
export const cleanReply = (t: string) => t.replace(/\n?\[(к ответу приложено|действий к этому)[^\]]*\]?/g, "");

/** Текст ассистента: поддерживает **жирный**, «• » и «- » списки. cursor — мигающая каретка в конце (идёт печать). */
export const RichMessage = memo(function RichMessage({ text, cursor = false }: { text: string; cursor?: boolean }) {
  // во время печати жирный может быть ещё не закрыт — прячем висящие «**»
  let t = text.trim();
  if ((t.split("**").length - 1) % 2 === 1) {
    const i = t.lastIndexOf("**");
    t = t.slice(0, i) + t.slice(i + 2);
  }
  const lines = t.split("\n");
  const caret = cursor ? <span className="chat-caret" aria-hidden /> : null;
  return (
    <div className="chat-rich">
      {lines.map((raw, n) => {
        const line = raw.trimEnd();
        const last = n === lines.length - 1;
        if (!line.trim()) return <div key={n} className="chat-rich-gap">{last && caret}</div>;
        const bullet = /^\s*([•\-*]|\d+[.)])\s+/.exec(line);
        if (bullet) {
          return (
            <div key={n} className="chat-rich-li">
              <b>{/\d/.test(bullet[1]) ? bullet[1] : "•"}</b>
              <span>{inline(line.slice(bullet[0].length))}{last && caret}</span>
            </div>
          );
        }
        return <p key={n}>{inline(line)}{last && caret}</p>;
      })}
    </div>
  );
});

// ---------------------------------------------------------------------- печатная машинка

/** Живой ответ: incoming — что пришло от модели, shown — что уже «напечатано». Перерисовывает только подписчиков. */
export class Live {
  incoming = "";
  shown = "";
  building = false;
  private v = 0;
  private subs = new Set<() => void>();
  private timer: ReturnType<typeof setInterval> | null = null;

  subscribe = (f: () => void) => { this.subs.add(f); return () => void this.subs.delete(f); };
  snapshot = () => this.v;
  /** wait — ждём первый символ, type — печатает, build — собирает предложение. */
  phase = (): "wait" | "type" | "build" => (this.building ? "build" : this.shown ? "type" : "wait");
  private bump() { this.v++; this.subs.forEach((f) => f()); }

  reset() { this.incoming = ""; this.shown = ""; this.building = false; this.bump(); }
  setBuilding(v: boolean) { if (this.building !== v) { this.building = v; this.bump(); } }

  /** Догоняет пришедший текст ровным темпом, а не рывками по кускам. */
  start() {
    this.stop();
    const still = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.timer = setInterval(() => {
      const lag = this.incoming.length - this.shown.length;
      if (lag <= 0) return;
      let cut = still ? this.incoming.length : this.shown.length + Math.min(12, Math.max(1, Math.ceil(lag / 12)));
      const c = this.incoming.charCodeAt(cut - 1);
      if (c >= 0xd800 && c <= 0xdbff) cut++; // не рвём пару суррогатов
      this.shown = this.incoming.slice(0, cut);
      this.bump();
    }, 16);
  }
  stop() { if (this.timer) clearInterval(this.timer); this.timer = null; }

  /** Дать допечатать (не дольше maxMs: в фоновой вкладке таймеры спят). */
  async settle(maxMs = 6000) {
    const t0 = Date.now();
    while (this.timer && this.shown.length < this.incoming.length && Date.now() - t0 < maxMs) await new Promise((r) => setTimeout(r, 30));
    if (this.shown !== this.incoming) { this.shown = this.incoming; this.bump(); }
  }
}

export function useLive(): Live {
  const ref = useRef<Live | null>(null);
  ref.current ??= new Live();
  const live = ref.current;
  useEffect(() => () => live.stop(), [live]);
  return live;
}
/** Подписка на живой ответ (каждый символ). */
export function useLiveText(live: Live) {
  useSyncExternalStore(live.subscribe, live.snapshot, live.snapshot);
  return live;
}
/** Подписка только на смену фазы — для маскота, чтобы не перерисовывать его на каждый символ. */
export const useLivePhase = (live: Live) => useSyncExternalStore(live.subscribe, live.phase, live.phase);

// ---------------------------------------------------------------------- ожидание

/** «Оси думает» с бегущими точками и сменой фраз, пока модель читает контекст. */
export function WaitingDots() {
  const [tick, setTick] = useState(0);
  useEffect(() => { const t = setInterval(() => setTick((v) => v + 1), 400); return () => clearInterval(t); }, []);
  const phrases = [tr("Оси думает"), tr("Листаю календарь"), tr("Считаю деньги"), tr("Смотрю на настроение"), tr("Почти готово")];
  const i = Math.min(phrases.length - 1, Math.floor(tick / 8));
  return (
    <span className="chat-dots" role="status">
      <span key={i} className="chat-dots-phrase">{phrases[i]}</span>
      <span className="chat-dots-run" aria-hidden>{".".repeat(tick % 4)}</span>
    </span>
  );
}

/** «Оси собирает предложение»: крутится вырезанная звёздочка, бегут точки, пульсируют заготовки карточек. */
export function BuildingProposal({ compact = false }: { compact?: boolean }) {
  const [n, setN] = useState(1);
  useEffect(() => { const t = setInterval(() => setN((v) => (v % 3) + 1), 530); return () => clearInterval(t); }, []);
  return (
    <div className={"chat-build" + (compact ? " compact" : "")} role="status">
      <div className="chat-build-head">
        <Cutout kind="star" size={26} color={P.orange} seed={7} className="chat-build-star" />
        <b>{tr("Создаю предложение{0}", [".".repeat(n)])}</b>
        {!compact && <Osi size={36} mood="thinking" />}
      </div>
      {[0, 1].map((i) => (
        <Card key={i} seed={300 + i} lift={2} padding="12px" className="chat-skel" style={{ animationDelay: `${i * -0.4}s` }}>
          <span className="chat-skel-dot" />
          <span className="chat-skel-lines">
            <i style={{ width: `${55 + 15 * i}%`, height: 11 }} />
            <i style={{ width: `${35 + 10 * i}%`, height: 8 }} />
          </span>
        </Card>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------- предложение Оси

/** Карточки, убранные крестиком (по сообщению): «давай» в чате применяет то же, что осталось на экране. */
const removedBy = new Map<string, ReadonlySet<number>>();
/** Действия сообщения без убранных крестиком. */
export function keptActions(messageId: string, actions: Row[]): Row[] {
  const gone = removedBy.get(messageId);
  return ActionRunner.clean(actions).filter((_, i) => !gone?.has(i));
}

/**
 * Предложенные Оси действия: можно убрать лишнее и применить остальное.
 * messageId — сообщение, в которое пишется статус (applied / dismissed); он же защищает от повторного применения.
 */
export function ActionProposal({ actions, status = "pending", messageId, onDone }: {
  actions: Row[]; status?: string; messageId?: string | null; onDone?: (status: "applied" | "dismissed", count: number) => void;
}) {
  useStore(); // подписи карточек зависят от данных («найдено: 12», названия проектов)
  // показываем ровно то, что будет выполнено: известные типы, не больше предела
  const items = useMemo(() => ActionRunner.clean(actions), [actions]);
  const [removed, setRemoved] = useState<ReadonlySet<number>>(() => (messageId && removedBy.get(messageId)) || new Set());
  const remove = (i: number) => setRemoved((r) => {
    const next = new Set(r).add(i);
    if (messageId) removedBy.set(messageId, next);
    return next;
  });
  const [local, setLocal] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  // подписи замирают в момент решения: после удаления «найдено: 12» не должно превращаться в «найдено: 0»
  const frozen = useRef<Map<Row, ReturnType<typeof ActionRunner.describe>> | null>(null);

  const st = local ?? ActionRunner.status(messageId, status);
  const done = st !== "pending";
  const kept = items.filter((_, i) => !removed.has(i));
  const freeze = () => { frozen.current = new Map(items.map((a) => [a, ActionRunner.describe(a)])); };

  const apply = async () => {
    // второй тап, пока идёт применение (приглашение друзей ждёт сеть), создавал дубль
    if (lock.current || busy || done || !kept.length) return;
    lock.current = true;
    setBusy(true);
    freeze();
    try {
      const r = await ActionRunner.apply(messageId, kept);
      if (r.status === "busy") return;
      setLocal(r.status);
      onDone?.(r.status, r.done);
    } catch (e) {
      // часть действий выполнена, статус уже записан — повторять нельзя
      setLocal("applied");
      toast(tr("Не всё получилось: {0}", [String((e as Error)?.message ?? e).slice(0, 200)]), "error");
      onDone?.("applied", 0);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  const dismiss = () => {
    if (lock.current || done) return;
    freeze();
    setLocal("dismissed");
    void ActionRunner.dismiss(messageId, actions);
    onDone?.("dismissed", 0);
  };

  if (!items.length) return null;
  return (
    <div className={`chat-prop ${st}`}>
      {items.map((a, i) => {
        const d = (done && frozen.current?.get(a)) || ActionRunner.describe(a);
        const gone = removed.has(i);
        const count = ActionRunner.matchCount(a);
        return (
          <Collapse key={i} open={!gone}>
            <Card seed={300 + i} lift={2} padding="10px 8px 10px 12px" className={"chat-act" + (ActionRunner.destructive(a) ? " danger" : "")}>
              <span className="chat-act-ico"><Icon name={d.icon} size={17} /></span>
              <span className="chat-act-text">
                <b>{d.title}</b>
                {d.subtitle && <small>{d.subtitle}</small>}
              </span>
              {!done && count != null && <span className="chat-act-count" title={tr("найдено: {0}", [count])}>{count}</span>}
              {!done && kept.length > 1 && !gone && (
                <button type="button" className="chat-act-x" disabled={busy} aria-label={tr("Убрать из предложения")} title={tr("Убрать из предложения")} onClick={() => remove(i)}>
                  <Icon name="close" size={16} />
                </button>
              )}
              {st === "applied" && <span className="chat-act-ok"><Icon name="check" size={20} /></span>}
            </Card>
          </Collapse>
        );
      })}
      <div className="chat-prop-foot">
        {!done ? (
          <div key="go" className="chat-prop-actions">
            <Button color="orange" icon="tick" expand busy={busy} disabled={!kept.length} onClick={() => void apply()}>{tr("Применить")}</Button>
            <button type="button" className="chat-prop-no" disabled={busy} onClick={dismiss}>{tr("Не надо")}</button>
          </div>
        ) : (
          <p key="done" className="chat-prop-done">{st === "applied" ? tr("Готово — всё записано.") : tr("Отменено.")}</p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------- голос (Web Speech API)

interface Recognition {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  start(): void; stop(): void; abort(): void;
}
function recognitionCtor(): (new () => Recognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Диктовка: onText получает весь текст (то, что было в поле, + распознанное). supported = false → кнопку микрофона не показываем. */
export function useSpeech(onText: (text: string) => void, current: () => string) {
  const [listening, setListening] = useState(false);
  const rec = useRef<Recognition | null>(null);
  const cb = useRef(onText);
  cb.current = onText;
  const cur = useRef(current);
  cur.current = current;
  const supported = useMemo(() => !!recognitionCtor(), []);

  const stop = useCallback(() => {
    const r = rec.current;
    rec.current = null;
    setListening(false);
    try { r?.stop(); } catch { /* уже остановлено */ }
  }, []);

  const start = useCallback(() => {
    const C = recognitionCtor();
    if (!C || rec.current) return;
    const prefix = cur.current().trim();
    const r = new C();
    r.lang = L.speechLocale;
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (e) => {
      let t = "";
      for (let i = 0; i < e.results.length; i++) t += e.results[i][0]?.transcript ?? "";
      t = t.trim();
      if (rec.current === r) cb.current(prefix && t ? `${prefix} ${t}` : prefix || t);
    };
    r.onend = () => { if (rec.current === r) { rec.current = null; setListening(false); } };
    r.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed" || e.error === "audio-capture") toast(tr("Нет доступа к микрофону"), "error");
    };
    try {
      r.start();
      rec.current = r;
      setListening(true);
    } catch {
      toast(tr("Нет доступа к микрофону"), "error");
    }
  }, []);

  useEffect(() => () => {
    const r = rec.current;
    rec.current = null;
    if (r) { r.onend = null; r.onresult = null; try { r.abort(); } catch { /* */ } }
  }, []);

  return { supported, listening, start, stop, toggle: () => (rec.current ? stop() : start()) };
}

// ---------------------------------------------------------------------- поле, которое растёт

/** Высота textarea по содержимому, не выше maxPx. */
export function useAutoGrow(value: string, maxPx: number) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, maxPx) + "px";
    el.style.overflowY = el.scrollHeight > maxPx ? "auto" : "hidden";
  }, [value, maxPx]);
  return ref;
}

/** В строках приложения остались старые эмодзи; в вебе их не показываем (ключ перевода при этом тот же). */
export const noEmoji = (s: string) => s.replace(/\s*(?:👁|⏳|📌)️?/gu, "").trim();
