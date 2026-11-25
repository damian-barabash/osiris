// Форматы — как в приложении (app/lib/widgets/ui.dart): деньги, даты, время.
import { L, tr } from "@/i18n";
import { addDays, day0, sameDate } from "./data/repeat";

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const df = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(L.locale, o);

export function money(v: number, cur: string): string {
  const whole = Math.abs(v - Math.round(v)) < 0.005;
  const s = new Intl.NumberFormat(L.locale, { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 }).format(v);
  const sym = ({ PLN: "zł", EUR: "€", USD: "$", UAH: "₴", GBP: "£" } as Record<string, string>)[cur] ?? cur;
  return `${s} ${sym}`;
}
export const moneyMap = (m: Record<string, number>) => { const e = Object.entries(m); return e.length ? e.map(([c, v]) => money(v, c)).join(" + ") : "0"; };
export const currencies = ["PLN", "EUR", "USD", "UAH", "GBP"];

const p2 = (n: number) => String(n).padStart(2, "0");
export const fmtTime = (d: Date) => `${p2(d.getHours())}:${p2(d.getMinutes())}`;
/** «25 ноября» */
export const fmtDay = (d: Date) => df({ day: "numeric", month: "long" }).format(d);
/** «25 нояб» */
export const fmtDayShort = (d: Date) => df({ day: "numeric", month: "short" }).format(d).replace(/\./g, "");
/** «25 ноября 2026» */
export const fmtDayYear = (d: Date) => df({ day: "numeric", month: "long", year: "numeric" }).format(d);
/** «Среда» */
export const fmtWeekday = (d: Date) => cap(df({ weekday: "long" }).format(d));
/** «ср» */
export const fmtWeekdayShort = (d: Date) => df({ weekday: "short" }).format(d).replace(/\./g, "");
/** Одна буква дня недели (из Intl, не из списка: по-английски «П» — это и M, и F). */
export const fmtWeekdayLetter = (d: Date) => df({ weekday: "narrow" }).format(d).toUpperCase();
/** «Ноябрь» (именительный) */
export const fmtMonth = (d: Date) => cap(new Intl.DateTimeFormat(L.locale, { month: "long" }).formatToParts(new Date(d.getFullYear(), d.getMonth(), 1)).find((p) => p.type === "month")!.value);
export const fmtMonthStandalone = (d: Date) => cap(new Date(d.getFullYear(), d.getMonth(), 1).toLocaleDateString(L.locale, { month: "long" }));
export const fmtMonthYear = (d: Date) => `${fmtMonthStandalone(d)} ${d.getFullYear()}`;
export const fmtMonthShort = (d: Date) => df({ month: "short" }).format(d).replace(/\./g, "").toUpperCase();
export const fmtDateTime = (d: Date) => `${fmtDay(d)}, ${fmtTime(d)}`;
/** «Сегодня» / «Завтра» / «Вчера» / «25 ноября» */
export function fmtRelDay(d: Date): string {
  const t = day0(new Date());
  if (sameDate(d, t)) return tr("Сегодня");
  if (sameDate(d, addDays(t, 1))) return tr("Завтра");
  if (sameDate(d, addDays(t, -1))) return tr("Вчера");
  return fmtDay(d);
}
/** Часы дробью → «7:30». */
export const fmtHours = (h: number) => { const m = Math.round(h * 60); return `${Math.floor(m / 60)}:${p2(m % 60)}`; };
/** Значение для <input type="date"> и обратно. */
export const toDateInput = (d: Date | null) => (d ? `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}` : "");
export const toTimeInput = (d: Date | null) => (d ? fmtTime(d) : "");
export const fromInputs = (date: string, time = "00:00") => (date ? new Date(`${date}T${time || "00:00"}`) : null);
