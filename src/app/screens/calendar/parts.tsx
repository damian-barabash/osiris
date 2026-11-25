// Общие части календаря: переключатель периода, свайп, расчёт сетки месяца.
import { useRef, useSyncExternalStore, type ReactNode, type TouchEvent } from "react";
import { tr } from "@/i18n";
import { Icon, SlideSwitcher } from "@/ui";
import { weekday } from "../../data/repeat";
import { fmtMonthShort, fmtMonthStandalone } from "../../format";
import "./calendar.css";

export const weekdayNames = () => [tr("Пн"), tr("Вт"), tr("Ср"), tr("Чт"), tr("Пт"), tr("Сб"), tr("Вс")];
export const monthStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
export const mondayOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - (weekday(d) - 1));
export const daysIn = (m: Date) => new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
/** Сколько пустых клеток перед 1-м числом (неделя с понедельника). */
export const leadOf = (m: Date) => weekday(monthStart(m)) - 1;
export const ymKey = (m: Date) => m.getFullYear() * 12 + m.getMonth();
/** «НОЯБРЬ» или «НОЯБРЬ 2027», если год не текущий. */
export const monthTitle = (m: Date) => `${fmtMonthStandalone(m).toUpperCase()}${m.getFullYear() !== new Date().getFullYear() ? ` ${m.getFullYear()}` : ""}`;

/** Ноутбук (≥ 900 px) или телефон. */
export function useDesktop(): boolean {
  const q = "(min-width: 900px)";
  return useSyncExternalStore(
    (cb) => { const m = window.matchMedia(q); m.addEventListener("change", cb); return () => m.removeEventListener("change", cb); },
    () => window.matchMedia(q).matches,
    () => true,
  );
}

/**
 * Горизонтальный свайп (HSwipe в приложении): dir = 1 — вперёд (палец влево), -1 — назад.
 * Вертикальная прокрутка не мешает; внутри [data-noswipe] (горизонтальные ленты) свайп не срабатывает.
 */
export function useSwipe(onSwipe: (dir: number) => void) {
  const p = useRef<{ x: number; y: number; skip: boolean } | null>(null);
  return {
    onTouchStart: (e: TouchEvent) => {
      const t = e.touches[0];
      p.current = { x: t.clientX, y: t.clientY, skip: e.touches.length > 1 || !!(e.target as HTMLElement).closest?.("[data-noswipe]") };
    },
    onTouchEnd: (e: TouchEvent) => {
      const a = p.current;
      p.current = null;
      if (!a || a.skip) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - a.x, dy = t.clientY - a.y;
      if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.6) return;
      onSwipe(dx < 0 ? 1 : -1);
    },
  };
}

/** Переключатель периода: левая и правая половины целиком — кнопки «назад» / «вперёд». */
export function PeriodSwitcher({ title, k, dir, prev, next, prevLabel, nextLabel, onShift, small = false }: {
  title: ReactNode; k: string | number; dir: number; prev?: string; next?: string; prevLabel: string; nextLabel: string; onShift: (d: number) => void; small?: boolean;
}) {
  return (
    <div className={`cal-sw${small ? " small" : ""}`}>
      <button type="button" className="cal-sw-side prev" aria-label={prevLabel} title={prevLabel} onClick={() => onShift(-1)}>
        {prev && <span>{prev}</span>}
        <Icon name="left" size={small ? 20 : 22} />
      </button>
      <div className="cal-sw-title" aria-live="polite">
        <SlideSwitcher k={k} dir={dir}>{title}</SlideSwitcher>
      </div>
      <button type="button" className="cal-sw-side next" aria-label={nextLabel} title={nextLabel} onClick={() => onShift(1)}>
        <Icon name="right" size={small ? 20 : 22} />
        {next && <span>{next}</span>}
      </button>
    </div>
  );
}

/** Переключатель месяцев: «ОКТ ‹ НОЯБРЬ › ДЕК». */
export function MonthSwitcher({ month, dir, onShift, small }: { month: Date; dir: number; onShift: (d: number) => void; small?: boolean }) {
  const m = (d: number) => fmtMonthShort(new Date(month.getFullYear(), month.getMonth() + d, 1));
  return <PeriodSwitcher title={monthTitle(month)} k={ymKey(month)} dir={dir} prev={m(-1)} next={m(1)} prevLabel={tr("Предыдущий месяц")} nextLabel={tr("Следующий месяц")} onShift={onShift} small={small} />;
}
