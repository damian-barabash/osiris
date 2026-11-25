// Повторения событий и задач — порт app/lib/data/repeat.dart (тот же алгоритм, что и на сервере).
//   {"freq":"daily|weekly|monthly|yearly","interval":1,"days":[1,3],"until":"YYYY-MM-DD","count":10}
// days — дни недели для weekly (1 = пн … 7 = вс).
import { tr } from "@/i18n";

export const dateOnly = (d: Date) => `${String(d.getFullYear()).padStart(4, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
/** 'YYYY-MM-DD' → локальная полночь. */
export const parseDate = (s: string) => new Date(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
export const day0 = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, d.getHours(), d.getMinutes());
/** День недели как в Dart: 1 = пн … 7 = вс. */
export const weekday = (d: Date) => ((d.getDay() + 6) % 7) + 1;
export const sameDate = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export type RepeatJson = { freq: string; interval?: number; days?: number[]; until?: string; count?: number };

export class RepeatRule {
  constructor(public freq: "daily" | "weekly" | "monthly" | "yearly", public interval = 1, public days: number[] = [], public until: Date | null = null, public count: number | null = null) {}

  static parse(v: unknown): RepeatRule | null {
    if (!v || typeof v !== "object") return null;
    const o = v as Record<string, unknown>;
    const f = o.freq;
    if (f !== "daily" && f !== "weekly" && f !== "monthly" && f !== "yearly") return null;
    const u = o.until;
    const days = [...new Set(((o.days as unknown[]) ?? []).filter((x): x is number => typeof x === "number").map((x) => Math.trunc(x)).filter((d) => d >= 1 && d <= 7))].sort((a, b) => a - b);
    return new RepeatRule(f, Math.min(99, Math.max(1, Math.trunc(Number(o.interval ?? 1)) || 1)), days, typeof u === "string" && u.length >= 10 ? parseDate(u) : null, o.count == null ? null : Math.trunc(Number(o.count)));
  }

  toJson(): RepeatJson {
    return {
      freq: this.freq,
      ...(this.interval !== 1 ? { interval: this.interval } : {}),
      ...(this.freq === "weekly" && this.days.length ? { days: this.days } : {}),
      ...(this.until ? { until: dateOnly(this.until) } : {}),
      ...(this.count != null ? { count: this.count } : {}),
    };
  }

  copyWith({ until, clearUntil = false }: { until?: Date | null; clearUntil?: boolean }) {
    return new RepeatRule(this.freq, this.interval, this.days, clearUntil ? null : (until ?? this.until), this.count);
  }

  /** Даты повторений (локальная полночь) начиная с base, по порядку. */
  *dates(base: Date, stopAfter?: Date): Generator<Date> {
    const b = day0(base);
    const hardStop = new Date(b.getFullYear() + 30, b.getMonth(), b.getDate());
    const last = [this.until, stopAfter, hardStop].filter((x): x is Date => !!x).reduce((a, c) => (a < c ? a : c));
    let n = 0;
    const ok = (d: Date) => d <= last && (this.count == null || n < this.count);
    const Y = b.getFullYear(), M = b.getMonth(), D = b.getDate();
    if (this.freq === "daily") {
      for (let i = 0; ; i += this.interval) {
        const d = new Date(Y, M, D + i);
        if (!ok(d)) return;
        n++;
        yield d;
      }
    } else if (this.freq === "weekly") {
      const wd = this.days.length ? this.days : [weekday(b)];
      const monday = new Date(Y, M, D - (weekday(b) - 1));
      for (let w = 0; ; w += this.interval) {
        for (const day of wd) {
          const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + w * 7 + day - 1);
          if (d < b) continue;
          if (!ok(d)) return;
          n++;
          yield d;
        }
      }
    } else if (this.freq === "monthly") {
      for (let m = 0; ; m += this.interval) {
        const d = new Date(Y, M + m, D);
        if (d > last) return;
        if (d.getDate() !== D) continue; // 31-е в коротком месяце пропускаем
        if (!ok(d)) return;
        n++;
        yield d;
      }
    } else {
      for (let y = 0; ; y += this.interval) {
        const d = new Date(Y + y, M, D);
        if (d > last) return;
        if (d.getMonth() !== M) continue; // 29 февраля
        if (!ok(d)) return;
        n++;
        yield d;
      }
    }
  }

  /** Первая дата повторения строго после after (для задач: перенести срок вперёд). */
  nextAfter(base: Date, after: Date): Date | null {
    const a = day0(after);
    for (const d of this.dates(base)) if (d > a) return d;
    return null;
  }

  /** «каждый понедельник», «по будням», «каждые 2 недели: пн, ср», «каждый месяц 10-го» … */
  describe(base: Date): string {
    const wd = [tr("пн"), tr("вт"), tr("ср"), tr("чт"), tr("пт"), tr("сб"), tr("вс")];
    const wdEvery = [tr("каждый понедельник"), tr("каждый вторник"), tr("каждую среду"), tr("каждый четверг"), tr("каждую пятницу"), tr("каждую субботу"), tr("каждое воскресенье")];
    const months = monthsGen();
    let s: string;
    if (this.freq === "daily") s = this.interval === 1 ? tr("каждый день") : tr("раз в {0} дн.", [this.interval]);
    else if (this.freq === "weekly") {
      const d = this.days.length ? this.days : [weekday(base)];
      if (this.interval === 1 && d.length === 5 && d.every((x) => x <= 5)) s = tr("по будням");
      else if (this.interval === 1 && d.length === 2 && d.includes(6) && d.includes(7)) s = tr("по выходным");
      else if (this.interval === 1 && d.length === 7) s = tr("каждый день");
      else if (this.interval === 1 && d.length === 1) s = wdEvery[d[0] - 1];
      else s = tr("{0}: {1}", [this.interval === 1 ? tr("каждую неделю") : tr("каждые {0} нед.", [this.interval]), d.map((x) => wd[x - 1]).join(", ")]);
    } else if (this.freq === "monthly") s = tr("{0} {1}-го", [this.interval === 1 ? tr("каждый месяц") : tr("раз в {0} мес.", [this.interval]), base.getDate()]);
    else s = tr("{0} {1} {2}", [this.interval === 1 ? tr("каждый год") : tr("раз в {0} г.", [this.interval]), base.getDate(), months[base.getMonth()]]);
    if (this.until) s += tr(" до {0} {1}", [this.until.getDate(), months[this.until.getMonth()]]);
    if (this.count != null) s += tr(", {0} раз", [this.count]);
    return s;
  }
}

/** Месяцы в родительном падеже («10 января»). */
export const monthsGen = () => [tr("января"), tr("февраля"), tr("марта"), tr("апреля"), tr("мая"), tr("июня"), tr("июля"), tr("августа"), tr("сентября"), tr("октября"), tr("ноября"), tr("декабря")];
