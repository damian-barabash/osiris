// Набор интерфейса OSIRIS для веб-версии и админки — те же элементы, что в приложении (app/lib/widgets/ui.dart, paper.dart):
// бумажные листы, пилюли, кнопки, переключатель, галочка, поля. Всё анимировано: ничего не появляется «из ниоткуда».
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { tr } from "@/i18n";
import { Osi, type OsiMood } from "@/brand/Osi";
import { Icon, trackerIcons } from "./icons";
import { COLOR_NAMES, colorOf, onColor } from "./palette";
import "./ui.css";

const cx = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(" ");
const seedCls = (seed = 0) => ["", "s1", "s2", "s3"][Math.abs(seed) % 4];

/** Бумажный лист. color — имя из палитры, #hex или не задан (лист цвета карточки). */
export function Card({ color, seed = 0, lift, padding = 16, onClick, className, style, children, as: Tag = "div", ...rest }: {
  color?: string | null; seed?: number; lift?: number; padding?: number | string; onClick?: (e: React.MouseEvent) => void; className?: string; style?: CSSProperties; children?: ReactNode; as?: "div" | "section" | "article" | "li";
} & Omit<React.HTMLAttributes<HTMLElement>, "color" | "onClick">) {
  const c = color ? colorOf(color) : null;
  const vars = { ...(c ? { "--sheet": c, "--on": onColor(c) } : {}), ...(lift != null ? { "--lift": `${lift}px` } : {}), padding, ...style } as CSSProperties;
  return (
    <Tag className={cx("paper", seedCls(seed), onClick && "tap", className)} style={vars} onClick={onClick} role={onClick ? "button" : undefined} tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e: React.KeyboardEvent) => { if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onClick(e as unknown as React.MouseEvent); } } : undefined} {...rest}>
      {children}
    </Tag>
  );
}

/** Пилюля-переключатель (фильтры, вкладки, варианты). */
export function Pill({ children, selected = false, onClick, icon, color, dense = false, badge, disabled, className, title }: {
  children?: ReactNode; selected?: boolean; onClick?: () => void; icon?: string; color?: string | null; dense?: boolean; badge?: number; disabled?: boolean; className?: string; title?: string;
}) {
  const c = color ? colorOf(color) : null;
  return (
    <button type="button" title={title} disabled={disabled} aria-pressed={selected} onClick={onClick} className={cx("pill", selected && "on", dense && "dense", className)}
      style={c && selected ? ({ "--pill": c, "--pill-on": onColor(c) } as CSSProperties) : undefined}>
      {icon && <Icon name={icon} size={dense ? 14 : 16} />}
      {children}
      {!!badge && <span className="count">{badge}</span>}
    </button>
  );
}

/** Главная кнопка (чернильная) и её варианты: color — имя/hex, ghost — контурная. */
export function Button({ children, onClick, icon, color, ghost = false, busy = false, disabled, expand = false, small = false, type = "button", className, danger = false }: {
  children?: ReactNode; onClick?: () => void; icon?: string; color?: string | null; ghost?: boolean; busy?: boolean; disabled?: boolean; expand?: boolean; small?: boolean; type?: "button" | "submit"; className?: string; danger?: boolean;
}) {
  const c = danger ? "#C8402A" : color ? colorOf(color) : null;
  return (
    <button type={type} disabled={disabled || busy} onClick={onClick} className={cx("btn", ghost && "ghost", expand && "expand", small && "small", busy && "busy", className)}
      style={c ? ({ "--btn": c, "--btn-on": onColor(c) } as CSSProperties) : undefined}>
      {busy ? <span className="spin" aria-hidden /> : icon && <Icon name={icon} size={small ? 15 : 17} />}
      <span>{children}</span>
    </button>
  );
}

/** Круглая кнопка со значком. */
export function RoundButton({ icon, onClick, size = 40, filled = false, color, label, badge, className }: { icon: string; onClick?: () => void; size?: number; filled?: boolean; color?: string | null; label: string; badge?: number; className?: string }) {
  const c = color ? colorOf(color) : null;
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} className={cx("round", filled && "filled", className)}
      style={{ width: size, height: size, ...(c ? ({ "--btn": c, "--btn-on": onColor(c) } as CSSProperties) : {}) }}>
      <Icon name={icon} size={Math.round(size * 0.46)} />
      {!!badge && <span className="count">{badge}</span>}
    </button>
  );
}

/** Бумажный переключатель (PaperSwitch). */
export function Switch({ value, onChange, disabled, label }: { value: boolean; onChange?: (v: boolean) => void; disabled?: boolean; label?: string }) {
  return (
    <button type="button" role="switch" aria-checked={value} aria-label={label} disabled={disabled} className={cx("switch", value && "on")} onClick={() => onChange?.(!value)}>
      <span className="knob" />
    </button>
  );
}

/** Бумажная галочка (PaperCheck): при отметке растёт оранжевый лист и проявляется галочка «от руки». */
export function Check({ value, onChange, size = 24, color, label }: { value: boolean; onChange?: (v: boolean) => void; size?: number; color?: string | null; label?: string }) {
  return (
    <button type="button" role="checkbox" aria-checked={value} aria-label={label ?? tr("Готово")} className={cx("check", value && "on")} style={{ width: size, height: size, ...(color ? ({ "--check": colorOf(color) } as CSSProperties) : {}) }}
      onClick={(e) => { e.stopPropagation(); onChange?.(!value); }}>
      <svg viewBox="0 0 24 24" aria-hidden><path d="M5.5 12.8 L10.2 17 L18.5 7.4" pathLength={1} /></svg>
    </button>
  );
}

export function Tag({ children, color, icon, filled = false }: { children: ReactNode; color?: string | null; icon?: string; filled?: boolean }) {
  const c = color ? colorOf(color) : null;
  return (
    <span className={cx("tag", filled && "filled")} style={c ? ({ "--tag": c, "--tag-on": onColor(c) } as CSSProperties) : undefined}>
      {icon && <Icon name={icon} size={12} />}
      {children}
    </span>
  );
}
export const ImportantTag = () => <Tag color="#C8402A" filled icon="star">{tr("ВАЖНО")}</Tag>;

export function SectionTitle({ children, trailing }: { children: ReactNode; trailing?: ReactNode }) {
  return (
    <div className="section-title">
      <h2>{children}</h2>
      {trailing}
    </div>
  );
}

/** Поле ввода с подписью. maxLines > 1 — многострочное. */
export function Field({ label, value, onChange, hint, type = "text", maxLines = 1, autoFocus, suffix, inputMode, onEnter, name, autoComplete, maxLength, error }: {
  label?: string; value: string; onChange: (v: string) => void; hint?: string; type?: string; maxLines?: number; autoFocus?: boolean; suffix?: ReactNode; inputMode?: "text" | "decimal" | "numeric" | "email" | "tel";
  onEnter?: () => void; name?: string; autoComplete?: string; maxLength?: number; error?: string | null;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, maxLines * 22 + 30) + "px";
  }, [value, maxLines]);
  return (
    <label className={cx("field", error && "bad")}>
      {label && <span className="field-label">{label}</span>}
      <span className="field-box">
        {maxLines > 1 ? (
          <textarea ref={ref} rows={Math.min(3, maxLines)} value={value} placeholder={hint} autoFocus={autoFocus} maxLength={maxLength} name={name} onChange={(e) => onChange(e.target.value)} />
        ) : (
          <input type={type} value={value} placeholder={hint} autoFocus={autoFocus} inputMode={inputMode} name={name} autoComplete={autoComplete} maxLength={maxLength}
            onChange={(e) => onChange(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") onEnter?.(); }} />
        )}
        {suffix && <span className="field-suffix">{suffix}</span>}
      </span>
      {error && <span className="field-error">{error}</span>}
    </label>
  );
}

/** Ряд пилюль «выбери одно» с подписью (ChoiceRow). options: [значение, подпись, цвет?] */
export function ChoiceRow<V>({ label, value, options, onChange }: { label?: string; value: V; options: [V, string, (string | null)?][]; onChange: (v: V) => void }) {
  return (
    <div className="choice-row">
      {label && <div className="label">{label}</div>}
      <div className="wrap">
        {options.map(([v, name, color]) => <Pill key={String(v)} dense selected={v === value} color={color} onClick={() => onChange(v)}>{name}</Pill>)}
      </div>
    </div>
  );
}

/** Строка настроек: заголовок, пояснение и элемент справа (переключатель, пилюля). */
export function Row({ title, sub, children, onClick, danger = false }: { title: ReactNode; sub?: ReactNode; children?: ReactNode; onClick?: () => void; danger?: boolean }) {
  return (
    <div className={cx("row", onClick && "tap")} onClick={onClick} role={onClick ? "button" : undefined} tabIndex={onClick ? 0 : undefined}>
      <div className="row-text">
        <div className="row-title" style={danger ? { color: "var(--danger)" } : undefined}>{title}</div>
        {sub && <div className="row-sub">{sub}</div>}
      </div>
      {children}
    </div>
  );
}

/** Выбор цвета листа: лента кружков. */
export function ColorChoice({ value, onChange, label }: { value: string; onChange: (v: string) => void; label?: string }) {
  return (
    <div className="choice-row">
      <div className="label">{label ?? tr("ЦВЕТ")}</div>
      <div className="swatches">
        {COLOR_NAMES.map((n) => <button key={n} type="button" aria-label={n} aria-pressed={n === value} className={cx("swatch", n === value && "on")} style={{ background: colorOf(n) }} onClick={() => onChange(n)} />)}
      </div>
    </div>
  );
}

/** Выбор значка: сетка. locked(name) — значок закрыт тарифом (бледный, с замком) → onLocked. */
export function IconChoice({ value, onChange, color, icons = trackerIcons, locked, onLocked }: { value: string; onChange: (v: string) => void; color?: string | null; icons?: string[]; locked?: (name: string) => boolean; onLocked?: () => void }) {
  const c = colorOf(color ?? "orange");
  return (
    <div className="choice-row">
      <div className="label">{tr("ЗНАЧОК")}</div>
      <div className="icon-grid">
        {icons.map((n) => {
          const lock = locked?.(n) ?? false;
          return (
            <button key={n} type="button" aria-label={n} aria-pressed={n === value} className={cx("icon-cell", n === value && "on", lock && "locked")} style={n === value ? { background: c, color: onColor(c) } : undefined}
              onClick={() => (lock ? onLocked?.() : onChange(n))}>
              <Icon name={n} size={19} />
              {lock && <span className="lock"><Icon name="lock" size={9} /></span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Пустое состояние с Оси. */
export function EmptyState({ title, text, mood = "calm", action, onAction }: { title: string; text?: string; mood?: OsiMood; action?: string; onAction?: () => void }) {
  return (
    <div className="empty">
      <Osi size={96} mood={mood} />
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {action && <Button small onClick={onAction}>{action}</Button>}
    </div>
  );
}

/** Бумажная полоса прогресса (0..1), заполняется с анимацией. */
export function Progress({ value, color, height = 12 }: { value: number; color?: string | null; height?: number }) {
  const [grown, setGrown] = useState(false);
  useEffect(() => { const r = requestAnimationFrame(() => setGrown(true)); return () => cancelAnimationFrame(r); }, []);
  value = grown ? value : 0;
  return (
    <div className="progress" style={{ height }} role="progressbar" aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100}>
      <span style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, background: colorOf(color ?? "orange") }} />
    </div>
  );
}

/** Число, которое «досчитывается» до значения. format — как показать. */
export function CountUp({ value, format = (v) => String(Math.round(v)), ms = 700 }: { value: number; format?: (v: number) => string; ms?: number }) {
  const [v, setV] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    const a = from.current, t0 = performance.now();
    if (a === value) return;
    let raf = 0;
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / ms), e = 1 - (1 - k) ** 3;
      setV(a + (value - a) * e);
      if (k < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); from.current = value; };
  }, [value, ms]);
  return <>{format(v)}</>;
}

/** Содержимое въезжает со стороны dir при смене k (дни, недели, месяцы, вкладки). */
export function SlideSwitcher({ k, dir = 1, children, className }: { k: string | number; dir?: number; children: ReactNode; className?: string }) {
  return (
    <div key={k} className={cx("slide-in", className)} style={{ "--from": `${dir >= 0 ? 28 : -28}px` } as CSSProperties}>
      {children}
    </div>
  );
}

/** Появление с подъёмом; i — порядок в списке (задержка лесенкой). */
export function Appear({ children, i = 0, className }: { children: ReactNode; i?: number; className?: string }) {
  return <div className={cx("appear", className)} style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}>{children}</div>;
}

/** Блок, который плавно раскрывается и сворачивается по высоте. */
/** bleed — не обрезать тени листов внутри (поля компенсируются отрицательными отступами). */
export function Collapse({ open, children, bleed = false }: { open: boolean; children: ReactNode; bleed?: boolean }) {
  return (
    <div className={cx("collapse", open && "open", bleed && "bleed")} aria-hidden={!open} inert={!open}>
      <div>{children}</div>
    </div>
  );
}

/** Шапка экрана: назад, заголовок, действия справа. */
export function ScreenHeader({ title, sub, back, children }: { title: ReactNode; sub?: ReactNode; back?: () => void; children?: ReactNode }) {
  return (
    <header className="screen-header">
      {back && <RoundButton icon="back" label={tr("Назад")} onClick={back} />}
      <div className="screen-title">
        <h1>{title}</h1>
        {sub && <div className="screen-sub">{sub}</div>}
      </div>
      <div className="screen-actions">{children}</div>
    </header>
  );
}

/** Оранжевый кружок с числом. */
export const CountBadge = ({ n }: { n: number }) => (n > 0 ? <span className="count">{n}</span> : null);

/** Дата (и время) нативными полями в бумажной рамке. */
export function DateTimeRow({ label, value, onChange, withTime = true, clearable = false }: { label: string; value: Date | null; onChange: (v: Date | null) => void; withTime?: boolean; clearable?: boolean }) {
  const p2 = (n: number) => String(n).padStart(2, "0");
  const d = value ? `${value.getFullYear()}-${p2(value.getMonth() + 1)}-${p2(value.getDate())}` : "";
  const t = value ? `${p2(value.getHours())}:${p2(value.getMinutes())}` : "";
  const set = (dd: string, tt: string) => onChange(dd ? new Date(`${dd}T${withTime ? tt || "09:00" : "00:00"}`) : null);
  return (
    <div className="choice-row">
      <div className="label">{label}</div>
      <div className="wrap">
        <input className="date-input" type="date" value={d} onChange={(e) => set(e.target.value, t)} aria-label={label} />
        {withTime && <input className="date-input" type="time" value={t} disabled={!value} onChange={(e) => set(d, e.target.value)} aria-label={tr("Время")} />}
        {clearable && value && <Pill dense icon="close" onClick={() => onChange(null)}>{tr("Без даты")}</Pill>}
      </div>
    </div>
  );
}
