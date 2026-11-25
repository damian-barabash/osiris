// Общие расчёты раздела «Цели» — те же формулы, что в приложении (goals_screen.dart, tracker_screen.dart, widgets/ui.dart).
import { useEffect, useState } from "react";
import { plural, tr } from "@/i18n";
import type { Entry, Stage, Tracker } from "../../data/models";
import { addDays, dateOnly, day0 } from "../../data/repeat";
import { fmtDay, money } from "../../format";

/** Сколько дней до даты (отрицательное — прошло). */
export const daysLeft = (d: Date) => Math.round((day0(d).getTime() - day0(new Date()).getTime()) / 86400_000);

/** «сегодня» / «завтра» / «через 5 дней» / «25 ноября» — relDay из приложения. */
export function relDay(d: Date): string {
  const n = daysLeft(d);
  if (n === 0) return tr("сегодня");
  if (n === 1) return tr("завтра");
  if (n === 2) return tr("послезавтра");
  if (n === -1) return tr("вчера");
  if (n > 0 && n <= 45) return tr("через {0} {1}", [n, plural(n, tr("день"), tr("дня"), tr("дней"))]);
  return fmtDay(d);
}

export const parseMoney = (s: string): number | null => {
  const t = s.replace(/[\s  ]/g, "").replace(",", ".");
  if (!t || !/^[+-]?(\d+\.?\d*|\.\d+)$/.test(t)) return null;
  return parseFloat(t);
};
export const moneyField = (v: number) => (v === Math.round(v) ? String(Math.round(v)) : v.toFixed(2));

const isWhole = (v: number) => Math.abs(v - Math.round(v)) < 0.005;

/** Сумма цели текстом: деньги — в валюте, счётчик — число и единица. */
export function fmtAmount(t: Tracker, v: number): string {
  if (t.kind === "money") return money(v, t.unit ?? "PLN");
  return `${isWhole(v) ? Math.round(v) : Math.round(v * 10) / 10} ${t.unit ?? ""}`.trim();
}
/** Формат для CountUp: пока число «досчитывается», дробные хвосты не мелькают. */
export const fmtCounting = (t: Tracker, final: number) => (v: number) => fmtAmount(t, isWhole(final) ? Math.round(v) : v);

/** Запись в истории: у счётчика — со знаком. */
export function fmtEntry(t: Tracker, amount: number): string {
  if (t.kind === "money") return money(amount, t.unit ?? "PLN");
  return `${amount > 0 ? "+" : ""}${isWhole(amount) ? Math.round(amount) : amount} ${t.unit ?? ""}`.trim();
}

/** Прогноз по темпу: когда наберётся цель и сколько нужно в месяц, чтобы успеть к сроку. */
export function forecast(t: Tracker, sum: number, entries: Entry[]): { pace: string; full: string } | null {
  const target = t.target ?? 0;
  if (!(target > sum) || entries.length < 2) return null;
  const first = entries.reduce((a, e) => (e.on < a ? e.on : a), entries[0].on);
  const days = Math.max(1, Math.floor((Date.now() - first.getTime()) / 86400_000));
  const perDay = sum / days;
  if (!(perDay > 0)) return null;
  const left = Math.ceil((target - sum) / perDay);
  if (!Number.isFinite(left) || left > 365 * 200) return null;
  const pace = tr("В таком темпе — к {0}", [fmtDay(addDays(new Date(), left))]);
  let full = pace;
  if (t.deadline) {
    const need = (target - sum) / Math.max(1, daysLeft(t.deadline));
    full = tr("{0}. Чтобы успеть к сроку — по {1} в месяц", [pace, fmtAmount(t, need * 30)]);
  }
  return { pace, full };
}

/** Привычка: отмеченные дни, серия подряд и сколько раз за последние 7 дней. */
export function habitStats(entries: Entry[]) {
  const days = new Set(entries.map((e) => dateOnly(e.on)));
  const today = day0(new Date());
  let streak = 0;
  let d = today;
  if (!days.has(dateOnly(d))) d = addDays(d, -1);
  while (days.has(dateOnly(d))) { streak++; d = addDays(d, -1); }
  let week = 0;
  for (let i = 0; i < 7; i++) if (days.has(dateOnly(addDays(today, -i)))) week++;
  return { days, streak, week };
}
export const streakLabel = (n: number) => tr("{0} подряд", [plural(n, tr("день"), tr("дня"), tr("дней"))]);

/** Этапы цели: сколько пройдено, текущий и ближайшая решающая дата. */
export function stageStats(st: Stage[]) {
  const done = st.filter((x) => x.status === "done").length;
  const current = st.find((x) => x.status === "active") ?? st.find((x) => x.status !== "done") ?? null;
  const nextCritical = st.filter((x) => x.status !== "done" && x.critical && x.dueOn && daysLeft(x.dueOn) >= 0).sort((a, b) => a.dueOn!.getTime() - b.dueOn!.getTime())[0] ?? null;
  return { done, current, nextCritical };
}

/** Устойчивое число из id — для формы края листа (seed). */
export const seedOf = (id: string) => { let h = 0; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xff; return h; };

/** Строка приложения с «✓» на конце — без галочки (в вебе её рисует значок). */
export const noTick = (s: string) => s.replace(/\s*✓\s*/g, "").trim();

/** Значение, которое «вырастает» после появления: первый кадр — 0, дальше — настоящее (полосы растут, числа досчитываются). */
export function useGrown(value: number): number {
  const [on, setOn] = useState(false);
  useEffect(() => { const r = requestAnimationFrame(() => setOn(true)); return () => cancelAnimationFrame(r); }, []);
  return on ? value : 0;
}
