// Мелкие помощники раздела «Часы» — как в hours_screen.dart и projects/editors.dart.
import { tr } from "@/i18n";

/** «45 мин» / «8 ч» / «7 ч 30 мин» — как fmtHours в приложении (в format.ts лежит табельный вид «7:30»). */
export function fmtHoursText(h: number): string {
  const m = Math.round(h * 60);
  if (m < 60 && m > 0) return tr("{0} мин", [m]);
  return m % 60 === 0 ? tr("{0} ч", [Math.floor(m / 60)]) : tr("{0} ч {1} мин", [Math.floor(m / 60), m % 60]);
}

const p2 = (n: number) => String(n).padStart(2, "0");

/** Таймер идущей смены: «1:05:09». */
export function fmtClock(ms: number): string {
  const sec = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(sec / 3600)}:${p2(Math.floor(sec / 60) % 60)}:${p2(sec % 60)}`;
}

/** «1 234,5» → 1234.5; мусор → null. */
export function parseMoney(s: string): number | null {
  const t = s.replace(/[\s  ]/g, "").replace(",", ".");
  if (!t || !/^-?\d*\.?\d*$/.test(t)) return null;
  const v = parseFloat(t);
  return Number.isFinite(v) ? v : null;
}

export const moneyField = (v: number) => (v === Math.round(v) ? String(Math.round(v)) : v.toFixed(2));

/** Небольшое число из id — «seed» бумажного листа (как id.hashCode & 0xff в приложении). */
export function seedOf(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xff;
  return h;
}
