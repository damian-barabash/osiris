// Что попадает в рапорт — порт ReportData из app/lib/services/report_pdf.dart.
// Лежит отдельно от reportPdf.ts, чтобы лист «Рапорт» считал итоги, не подгружая pdf-lib.
import { tr } from "@/i18n";
import type { Job, WorkExtra, WorkSession } from "../../data/models";
import { addDays, dateOnly } from "../../data/repeat";
import { fmtMonthYear } from "../../format";

export interface ReportInput {
  job: Job;
  from: Date;
  /** Не включая (как во всём разделе «Часы»). */
  to: Date;
  /** Только законченные смены. */
  sessions: WorkSession[];
  extras: WorkExtra[];
  rateOf: (x: WorkSession) => number;
  worker?: string;
  recipient?: string;
  showMoney?: boolean;
  signatures?: boolean;
  allDays?: boolean;
}

const p2 = (n: number) => String(n).padStart(2, "0");
/** «5.11.2026» */
export const fmtDotDate = (d: Date) => `${d.getDate()}.${p2(d.getMonth() + 1)}.${d.getFullYear()}`;
/** «05.11» */
export const fmtDotDay = (d: Date) => `${p2(d.getDate())}.${p2(d.getMonth() + 1)}`;
/** «8:30» — часы и минуты, как в табелях. */
export const hm = (h: number) => { const m = Math.round(h * 60); return `${Math.floor(m / 60)}:${p2(m % 60)}`; };

/** Ровно один календарный месяц? */
export const isWholeMonth = (from: Date, to: Date) => from.getDate() === 1 && to.getDate() === 1 && to.getMonth() - from.getMonth() + 12 * (to.getFullYear() - from.getFullYear()) === 1;

export class ReportData {
  job: Job;
  from: Date;
  to: Date;
  sessions: WorkSession[];
  extras: WorkExtra[];
  rateOf: (x: WorkSession) => number;
  worker: string;
  recipient: string;
  showMoney: boolean;
  signatures: boolean;
  allDays: boolean;

  constructor(o: ReportInput) {
    this.job = o.job;
    this.from = o.from;
    this.to = o.to;
    this.sessions = o.sessions.filter((x) => x.end != null);
    this.extras = o.extras;
    this.rateOf = o.rateOf;
    this.worker = o.worker ?? "";
    this.recipient = o.recipient ?? "";
    this.showMoney = o.showMoney ?? true;
    this.signatures = o.signatures ?? true;
    this.allDays = o.allDays ?? true;
  }

  get hours() { return this.sessions.reduce((a, x) => a + x.hours(), 0); }
  get hoursMoney() { return this.sessions.reduce((a, x) => a + x.hours() * this.rateOf(x), 0); }
  get extrasMoney() { return this.extras.reduce((a, x) => a + x.amount, 0); }
  get workDays() { return new Set(this.sessions.map((x) => dateOnly(x.start))).size; }

  /** Одна ставка на весь период — её можно написать в шапке (null — ставки разные). */
  get singleRate(): number | null {
    const r = new Set(this.sessions.map((x) => this.rateOf(x)));
    if (r.size === 0) return this.job.rate;
    return r.size === 1 ? [...r][0] : null;
  }

  get periodTitle(): string {
    if (isWholeMonth(this.from, this.to)) return fmtMonthYear(this.from);
    return `${fmtDotDate(this.from)} – ${fmtDotDate(addDays(this.to, -1))}`;
  }

  get fileName(): string {
    const safe = this.job.name.replace(/[^\p{L}\p{N}]+/gu, "_").replace(/^_|_$/g, "");
    return `${tr("Рапорт")}_${safe}_${dateOnly(this.from)}_${dateOnly(addDays(this.to, -1))}.pdf`;
  }
}
