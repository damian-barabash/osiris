// Рапорт о работе в PDF — порт app/lib/services/report_pdf.dart на pdf-lib.
// Чёрно-белый лист A4: шапка со знаком OSIRIS, реквизиты, четыре плитки итогов, график со шкалой часов,
// таблица заданий, блок «к оплате», подписи, подвал с номерами страниц.
// pdf-lib и fontkit импортируются ТОЛЬКО здесь: модуль подгружается динамически из листа «Рапорт».
// layoutReportPdf() не трогает DOM (данные + байты шрифтов) — её можно запускать и в Node.
import { PDFDocument, rgb, setCharacterSpacing, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { tr } from "@/i18n";
import type { WorkSession } from "../../data/models";
import { addDays, dateOnly, day0, weekday } from "../../data/repeat";
import { fmtTime, fmtWeekdayShort, money } from "../../format";
import { fmtDotDate, fmtDotDay, hm, type ReportData } from "./reportData";

export type { ReportData } from "./reportData";

type Bytes = Uint8Array | ArrayBuffer;
/** Manrope: обычный (500), жирный (700), самый жирный (800). */
export interface ReportFonts { regular: Bytes; bold: Bytes; heavy: Bytes }

// A4 в пунктах и поля — как в приложении (36 / 32 / 36 / 28)
const W = 595.28, H = 841.89;
const ML = 36, MT = 32, MR = 36, MB = 28;
const CW = W - ML - MR;
const FOOT_H = 24;
const BOTTOM = H - MB - FOOT_H;

const BLACK = rgb(0, 0, 0);
const GREY = rgb(0x6b / 255, 0x6b / 255, 0x6b / 255);
const LINE = rgb(0xbd / 255, 0xbd / 255, 0xbd / 255);
const SHADE = rgb(0xee / 255, 0xee / 255, 0xee / 255);
const FAINT = rgb(0xe0 / 255, 0xe0 / 255, 0xe0 / 255);

/** Высота заглавной буквы Manrope ≈ 0.72 кегля: базовая линия для текста, выровненного по центру строки. */
const CAP = 0.36;

// ---------------------------------------------------------------- знак OSIRIS (геометрия из brand/Logo.tsx, кадр 500×460)
const MARK_UPPER = "M83.1 296.3 Q259.4 392.1 416 232 Q243 38.8 61.6 226.5";
const MARK_LOWER = "M233 222.75 Q324.5 223.5 416 323 Q236 534 50 320 Q141.5 222 233 222.75 Z";
const MARK_RAYS: [number, number, number][] = [[115, 75, -20], [232, 55, 0], [352, 75, 20]];
const MARK_BOX = { x: 22, y: 14, w: 426, h: 432 };

const n2 = (v: number) => +v.toFixed(2);

/** Скруглённый прямоугольник как путь SVG; rot — поворот в градусах вокруг (cx, cy). */
function rrectPath(x: number, y: number, w: number, h: number, r: number, rot = 0, cx = 0, cy = 0): string {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  const a = (rot * Math.PI) / 180, cos = Math.cos(a), sin = Math.sin(a);
  const p = (px: number, py: number) => {
    if (!rot) return `${n2(px)} ${n2(py)}`;
    const dx = px - cx, dy = py - cy;
    return `${n2(cx + dx * cos - dy * sin)} ${n2(cy + dx * sin + dy * cos)}`;
  };
  const x2 = x + w, y2 = y + h;
  return `M${p(x + r, y)} L${p(x2 - r, y)} Q${p(x2, y)} ${p(x2, y + r)} L${p(x2, y2 - r)} Q${p(x2, y2)} ${p(x2 - r, y2)} L${p(x + r, y2)} Q${p(x, y2)} ${p(x, y2 - r)} L${p(x, y + r)} Q${p(x, y)} ${p(x + r, y)} Z`;
}
const MARK_RAY_PATHS = MARK_RAYS.map(([x, y, r]) => rrectPath(x - 14, y - 31, 28, 62, 4, r, x, y));

// ---------------------------------------------------------------- текст
const charsets = new WeakMap<PDFFont, Set<number>>();
/** Убрать то, чего нет в шрифте (эмодзи и т. п.), неразрывные пробелы и переводы строк → обычный пробел. */
function clean(s: string, font: PDFFont): string {
  let set = charsets.get(font);
  if (!set) { set = new Set(font.getCharacterSet()); charsets.set(font, set); }
  let out = "";
  for (const ch of s) {
    const cp = ch.codePointAt(0)!;
    if (cp === 0xa0 || cp === 0x202f || cp === 0x2009 || cp === 0x2007 || cp === 9 || cp === 10 || cp === 13) out += " ";
    else if (set.has(cp)) out += ch;
    else if (cp === 0x2212) out += "-";
  }
  return out.replace(/ {2,}/g, " ").trim();
}

const widthOf = (s: string, size: number, font: PDFFont, spacing = 0) => font.widthOfTextAtSize(s, size) + spacing * Math.max(0, [...s].length - 1);

/** Обрезать с многоточием, чтобы строка влезла в maxW. */
function fit(s: string, maxW: number, size: number, font: PDFFont, spacing = 0): string {
  s = clean(s, font);
  if (widthOf(s, size, font, spacing) <= maxW) return s;
  const ch = [...s];
  while (ch.length > 1 && widthOf(ch.join("").trimEnd() + "…", size, font, spacing) > maxW) ch.pop();
  return ch.join("").trimEnd() + "…";
}

/** Уменьшить кегль (не ниже min), чтобы строка влезла. */
function fitSize(s: string, maxW: number, size: number, font: PDFFont, min = 6): number {
  const w = widthOf(clean(s, font), size, font);
  return w <= maxW ? size : Math.max(min, (size * maxW) / w);
}

/** Перенос по словам; длинное слово режется, последняя строка — с многоточием. */
function wrap(s: string, maxW: number, size: number, font: PDFFont, maxLines = 3): string[] {
  const words = clean(s, font).split(" ").filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  const push = () => { if (cur) lines.push(cur); cur = ""; };
  for (let word of words) {
    const tryLine = cur ? cur + " " + word : word;
    if (widthOf(tryLine, size, font) <= maxW) { cur = tryLine; continue; }
    push();
    while (widthOf(word, size, font) > maxW) {
      const ch = [...word];
      let k = ch.length - 1;
      while (k > 1 && widthOf(ch.slice(0, k).join(""), size, font) > maxW) k--;
      lines.push(ch.slice(0, k).join(""));
      word = ch.slice(k).join("");
    }
    cur = word;
  }
  push();
  if (lines.length > maxLines) {
    const rest = lines.slice(maxLines - 1).join(" ");
    lines.length = maxLines - 1;
    lines.push(fit(rest, maxW, size, font));
  }
  return lines.length ? lines : [""];
}

// ---------------------------------------------------------------- вёрстка
/** Собрать PDF из готовых данных и байтов шрифтов. Без DOM. */
export async function layoutReportPdf(d: ReportData, fonts: ReportFonts, now: Date = new Date()): Promise<Uint8Array> {
  // обычная высота строк; если чуть более плотные строки экономят страницу (месяц на одном листе) — берём плотные
  let doc = await compose(d, fonts, now, 3.2);
  if (doc.getPageCount() > 1) {
    const tight = await compose(d, fonts, now, 2.1);
    if (tight.getPageCount() < doc.getPageCount()) doc = tight;
  }
  return doc.save();
}

async function compose(d: ReportData, fonts: ReportFonts, now: Date, pad: number): Promise<PDFDocument> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const f5 = await doc.embedFont(fonts.regular, { subset: true });
  const f7 = await doc.embedFont(fonts.bold, { subset: true });
  const f8 = await doc.embedFont(fonts.heavy, { subset: true });

  const cur = d.job.currency;
  const rate = d.singleRate;
  const total = d.hoursMoney + d.extrasMoney;
  const jobName = d.job.name;
  const period = d.periodTitle;

  doc.setTitle(`${tr("Рапорт о работе")} · ${jobName} · ${period}`);
  if (d.worker) doc.setAuthor(d.worker);
  doc.setCreator("OSIRIS");
  doc.setProducer("OSIRIS · myosiris.app");
  doc.setCreationDate(now);
  doc.setModificationDate(now);

  let page!: PDFPage;
  let y = 0; // сверху вниз, от верхнего края листа
  let pageNo = 0;

  type TextOpt = { font?: PDFFont; color?: RGB; align?: "left" | "right" | "center"; spacing?: number; maxW?: number };
  /** Строка текста: x — левый край / правый край / центр (по align), base — базовая линия от верха листа. */
  const text = (s: string, x: number, base: number, size: number, { font = f5, color = BLACK, align = "left", spacing = 0, maxW }: TextOpt = {}) => {
    s = maxW != null ? fit(s, maxW, size, font, spacing) : clean(s, font);
    if (!s) return;
    const w = widthOf(s, size, font, spacing);
    const x0 = align === "right" ? x - w : align === "center" ? x - w / 2 : x;
    if (spacing) page.pushOperators(setCharacterSpacing(spacing));
    page.drawText(s, { x: x0, y: H - base, size, font, color });
    if (spacing) page.pushOperators(setCharacterSpacing(0));
  };
  const hline = (x1: number, x2: number, yy: number, thickness: number, color: RGB = BLACK) =>
    page.drawLine({ start: { x: x1, y: H - yy }, end: { x: x2, y: H - yy }, thickness, color });
  const box = (x: number, yy: number, w: number, h: number, color: RGB) => page.drawRectangle({ x, y: H - yy - h, width: w, height: h, color });
  const rbox = (x: number, yy: number, w: number, h: number, r: number, o: { fill?: RGB; stroke?: RGB; width?: number }) =>
    page.drawSvgPath(rrectPath(x, yy, w, h, r), { x: 0, y: H, color: o.fill, borderColor: o.stroke, borderWidth: o.stroke ? o.width ?? 0.8 : 0 });
  /** Знак OSIRIS высотой size, левый верхний угол в (x, top). */
  const mark = (x: number, top: number, size: number, color: RGB = BLACK) => {
    const scale = size / MARK_BOX.h;
    const o = { x: x - MARK_BOX.x * scale, y: H - top + MARK_BOX.y * scale, scale };
    page.drawSvgPath(MARK_LOWER, { ...o, borderColor: color, borderWidth: 25 });
    page.drawSvgPath(MARK_UPPER, { ...o, borderColor: color, borderWidth: 25 });
    for (const p of MARK_RAY_PATHS) page.drawSvgPath(p, { ...o, color, borderWidth: 0 });
  };

  const newPage = () => {
    page = doc.addPage([W, H]);
    pageNo++;
    y = MT;
    if (pageNo > 1) {
      // маленькая шапка на следующих страницах
      mark(ML, y, 12);
      text(`${jobName} · ${period}`, ML + 18, y + 6 + CAP * 7.5, 7.5, { font: f7, color: GREY, maxW: CW - 18 });
      y += 12 + 8;
    }
  };
  /** Нужно h пунктов; не влезает — новая страница (true). */
  const need = (h: number) => {
    if (y + h <= BOTTOM + 0.01) return false;
    newPage();
    return true;
  };

  // --------------------------------------------------------------- дни
  const byDay = new Map<string, WorkSession[]>();
  for (const x of d.sessions) {
    const k = dateOnly(x.start);
    byDay.has(k) ? byDay.get(k)!.push(x) : byDay.set(k, [x]);
  }
  for (const list of byDay.values()) list.sort((a, b) => a.start.getTime() - b.start.getTime());
  const on = (day: Date) => byDay.get(dateOnly(day)) ?? [];
  const days: Date[] = [];
  for (let x = day0(d.from); x < d.to; x = addDays(x, 1)) days.push(x);
  const shownDays = d.allDays ? days : days.filter((x) => on(x).length > 0);

  /** Часы от полуночи дня начала смены (конец после полуночи — больше 24). */
  const hourOf = (x: WorkSession, t: Date) => Math.floor((t.getTime() - day0(x.start).getTime()) / 60_000) / 60;

  // шкала часов: от самого раннего начала до самого позднего конца, не уже 6–20
  let lo = 6, hi = 20;
  for (const x of d.sessions) {
    const s = x.start.getHours() + x.start.getMinutes() / 60;
    const e = hourOf(x, x.end!);
    if (s < lo) lo = Math.floor(s);
    if (e > hi) hi = Math.ceil(e);
  }
  if (hi > 24) hi = 24;
  if (lo % 2 === 1) lo -= 1;
  if (hi % 2 === 1) hi += 1;
  if (hi > 24) hi = 24;
  const span = hi - lo;
  const ticks: number[] = [];
  for (let h = lo; h <= hi; h += 2) ticks.push(h);

  // ширины колонок графика
  const wDate = 38, wDay = 28, wTime = 68, wBreak = 42, wHours = 36, wSum = 58;
  const wLine = CW - wDate - wDay - wTime - wBreak - wHours - (d.showMoney ? wSum : 0) - 8;
  const xDate = ML, xDay = xDate + wDate, xTime = xDay + wDay, xLine = xTime + wTime + 4;
  const xBreak = xLine + wLine + 4, xHours = xBreak + wBreak, xSum = xHours + wHours;
  const xOf = (h: number) => xLine + ((h - lo) / span) * wLine;
  const PX = 3; // поля ячейки по горизонтали
  const LH = 9; // высота строки текста 7.5 pt
  const HEAD_H = 15.5;

  const scheduleHead = () => {
    const base = y + HEAD_H / 2 + CAP * 6.5;
    const o = { font: f8 };
    text(tr("Дата"), xDate + PX, base, 6.5, { ...o, maxW: wDate - PX * 2 });
    text(tr("День"), xDay + PX, base, 6.5, { ...o, maxW: wDay - PX * 2 });
    text(tr("Время"), xTime + PX, base, 6.5, { ...o, maxW: wTime - PX * 2 });
    for (const h of ticks) text(String(h), Math.min(Math.max(xOf(h), xLine + 2), xLine + wLine - 2), y + HEAD_H / 2 + CAP * 6, 6, { font: f7, color: GREY, align: "center" });
    text(tr("Перерыв"), xBreak + wBreak - PX, base, 6.5, { ...o, align: "right", maxW: wBreak - PX * 2 });
    text(tr("Часы"), xHours + wHours - PX, base, 6.5, { ...o, align: "right", maxW: wHours - PX * 2 });
    if (d.showMoney) text(tr("Сумма"), xSum + wSum - PX, base, 6.5, { ...o, align: "right", maxW: wSum - PX * 2 });
    y += HEAD_H;
    hline(ML, ML + CW, y, 0.9);
    y += 0.45;
  };

  const section = (title: string, keep: number) => {
    need(14 + 9 + 5 + keep);
    text(title.toLocaleUpperCase(), ML, y + 14 + 4.5 + CAP * 7.5, 7.5, { font: f8, spacing: 1.2 });
    y += 14 + 9 + 5;
  };

  // =============================================================== страница 1: шапка
  newPage();
  {
    mark(ML, y + 0.5, 30);
    text("OSIRIS", ML + 38, y + 15.5 + CAP * 13, 13, { font: f8, spacing: 3 });
    text(tr("РАПОРТ О РАБОТЕ"), ML + CW, y + 7, 7.5, { font: f8, color: GREY, spacing: 1.4, align: "right" });
    const ps = fitSize(period, CW - 160, 17, f8, 11);
    text(period, ML + CW, y + 27, ps, { font: f8, align: "right" });
    y += 31 + 10;
    box(ML, y, CW, 1.4, BLACK);
    y += 1.4 + 10;

    // реквизиты в две колонки
    const colW = (CW - 16) / 2, nameW = 74;
    const info = (rows: [string, string][], x: number) => {
      let yy = y;
      for (const [name, value] of rows) {
        const lines = wrap(value, colW - nameW, 8.5, f7, 2);
        text(name, x, yy + 5.5 + CAP * 8, 8, { color: GREY, maxW: nameW - 6 });
        lines.forEach((l, i) => text(l, x + nameW, yy + 5.5 + i * 11 + CAP * 8.5, 8.5, { font: f7 }));
        yy += lines.length * 11 + 4;
      }
      return yy;
    };
    const left: [string, string][] = [];
    if (d.worker) left.push([tr("Работник"), d.worker]);
    left.push([tr("Работа"), jobName]);
    if (d.recipient) left.push([tr("Кому"), d.recipient]);
    const right: [string, string][] = [[tr("Период"), `${fmtDotDate(d.from)} – ${fmtDotDate(addDays(d.to, -1))}`]];
    if (d.showMoney) right.push([tr("Ставка"), rate == null ? tr("по ставкам смен") : tr("{0}/ч", [money(rate, cur)])]);
    right.push([tr("Составлен"), fmtDotDate(now)]);
    y = Math.max(info(left, ML), info(right, ML + colW + 16)) + 8;

    // плитки итогов
    const stats: [string, string][] = [[tr("Часов"), hm(d.hours)], [tr("Рабочих дней"), String(d.workDays)], [tr("Заданий"), String(d.extras.length)]];
    if (d.showMoney) stats.push([tr("К оплате"), money(total, cur)]);
    const gap = 6, tw = (CW - gap * (stats.length - 1)) / stats.length, th = 39;
    stats.forEach(([name, value], i) => {
      const x = ML + i * (tw + gap);
      rbox(x, y, tw, th, 4, { stroke: BLACK, width: 0.8 });
      text(name.toLocaleUpperCase(), x + 9, y + 14, 6.5, { font: f8, color: GREY, spacing: 0.8, maxW: tw - 18 });
      const vs = fitSize(value, tw - 18, 13, f8, 8);
      text(value, x + 9, y + 30, vs, { font: f8, maxW: tw - 18 });
    });
    y += th;
  }

  // =============================================================== график работы
  const TOTAL_H = LH + 2 * 3.4;
  const rowH = (n: number) => Math.max(1, n) * LH + 2 * pad;
  section(tr("График работы"), HEAD_H + rowH(1) + (shownDays.length <= 1 ? TOTAL_H : 0));
  scheduleHead();
  shownDays.forEach((day, idx) => {
    const list = on(day);
    const empty = list.length === 0;
    const h = rowH(list.length);
    // последняя строка не отрывается от «Итого»
    if (need(h + (idx === shownDays.length - 1 ? TOTAL_H : 0))) scheduleHead();
    const hours = list.reduce((a, x) => a + x.hours(), 0);
    const sum = list.reduce((a, x) => a + x.hours() * d.rateOf(x), 0);
    const br = list.reduce((a, x) => a + x.breakMinutes, 0);
    const c = empty ? GREY : BLACK;
    if (weekday(day) >= 6) box(ML, y, CW, h, SHADE);
    const mid = y + h / 2, base = mid + CAP * 7.5;
    text(fmtDotDay(day), xDate + PX, base, 7.5, { font: empty ? f5 : f7, color: c });
    const wd = fmtWeekdayShort(day);
    text(wd, xDay + PX, base, fitSize(wd, wDay - PX * 2, 7.5, f5), { color: c });
    if (empty) text("—", xTime + PX, base, 7.5, { color: c });
    else {
      const top = mid - (list.length * LH) / 2;
      list.forEach((x, i) => text(`${fmtTime(x.start)}–${fmtTime(x.end!)}`, xTime + PX, top + i * LH + LH / 2 + CAP * 7.5, 7.5));
    }
    // шкала часов: деления и чёрные полосы смен
    for (const t of ticks) box(xOf(t) - 0.175, mid - 4.5, 0.35, 9, FAINT);
    for (const x of list) {
      const s = Math.min(hi, Math.max(lo, hourOf(x, x.start))), e = Math.min(hi, Math.max(lo, hourOf(x, x.end!)));
      const bw = Math.min(wLine, Math.max(1.5, xOf(e) - xOf(s)));
      rbox(Math.min(xOf(s), xLine + wLine - bw), mid - 3, bw, 6, 1.5, { fill: BLACK });
    }
    if (br > 0) text(tr("{0} мин", [br]), xBreak + wBreak - PX, base, 7.5, { align: "right", color: c, maxW: wBreak - PX * 2 });
    if (!empty) {
      text(hm(hours), xHours + wHours - PX, base, 7.5, { font: f7, align: "right" });
      if (d.showMoney) { const m = money(sum, cur); text(m, xSum + wSum - PX, base, fitSize(m, wSum - PX * 2, 7.5, f5), { align: "right" }); }
    }
    y += h;
    hline(ML, ML + CW, y, 0.4, LINE);
  });
  {
    if (need(TOTAL_H)) scheduleHead();
    hline(ML, ML + CW, y, 0.9);
    const base = y + TOTAL_H / 2 + CAP * 7.5;
    text(tr("Итого"), xDate + PX, base, 7.5, { font: f8, maxW: wDate + wDay - PX * 2 });
    text(tr("{0} дн.", [d.workDays]), xTime + PX, base, 7.5, { font: f7, maxW: wTime - PX * 2 });
    text(hm(d.hours), xHours + wHours - PX, base, 7.5, { font: f8, align: "right" });
    if (d.showMoney) { const m = money(d.hoursMoney, cur); text(m, xSum + wSum - PX, base, fitSize(m, wSum + 20, 7.5, f8), { font: f8, align: "right" }); }
    y += TOTAL_H;
  }

  // =============================================================== дополнительные задания
  if (d.extras.length) {
    const wWhen = 66, wAmt = d.showMoney ? 74 : 0, wTitle = CW - wWhen - wAmt;
    const xTitle = ML + wWhen;
    const extrasHead = () => {
      const base = y + HEAD_H / 2 + CAP * 6.5;
      text(tr("Дата"), ML + PX, base, 6.5, { font: f8 });
      text(tr("Задание"), xTitle + PX, base, 6.5, { font: f8 });
      if (d.showMoney) text(tr("Сумма"), ML + CW - PX, base, 6.5, { font: f8, align: "right" });
      y += HEAD_H;
      hline(ML, ML + CW, y, 0.9);
      y += 0.45;
    };
    const NH = 8.4; // строка заметки 6.8 pt
    const list = [...d.extras].sort((a, b) => a.day.getTime() - b.day.getTime()).map((x) => {
      const title = wrap(x.title, wTitle - PX * 2, 7.5, f7, 3);
      const note = x.note.trim() ? wrap(x.note, wTitle - PX * 2, 6.8, f5, 3) : [];
      return { x, title, note, h: 2 * 3.2 + title.length * LH + note.length * NH };
    });
    section(tr("Дополнительные задания"), HEAD_H + list[0].h + (list.length === 1 && d.showMoney ? TOTAL_H : 0));
    extrasHead();
    list.forEach((r, idx) => {
      if (need(r.h + (idx === list.length - 1 && d.showMoney ? TOTAL_H : 0))) extrasHead();
      const first = y + 3.2 + LH / 2 + CAP * 7.5;
      text(`${fmtDotDay(r.x.day)}  ${fmtWeekdayShort(r.x.day)}`, ML + PX, first, 7.5, { font: f7, maxW: wWhen - PX * 2 });
      r.title.forEach((l, i) => text(l, xTitle + PX, first + i * LH, 7.5, { font: f7 }));
      const noteTop = y + 3.2 + r.title.length * LH;
      r.note.forEach((l, i) => text(l, xTitle + PX, noteTop + i * NH + NH / 2 + CAP * 6.8, 6.8, { color: GREY }));
      if (d.showMoney) text(money(r.x.amount, cur), ML + CW - PX, first, 7.5, { font: f7, align: "right" });
      y += r.h;
      hline(ML, ML + CW, y, 0.4, LINE);
    });
    if (d.showMoney) {
      if (need(TOTAL_H)) extrasHead();
      hline(ML, ML + CW, y, 0.9);
      const base = y + TOTAL_H / 2 + CAP * 7.5;
      text(tr("Итого"), ML + PX, base, 7.5, { font: f8 });
      text(money(d.extrasMoney, cur), ML + CW - PX, base, 7.5, { font: f8, align: "right" });
      y += TOTAL_H;
    }
  }

  // =============================================================== к оплате
  if (d.showMoney) {
    const bw = 250, bx = ML + CW - bw;
    const lines: [string, string][] = [[rate == null ? tr("Часы {0} (по ставкам смен)", [hm(d.hours)]) : tr("Часы {0} × {1}", [hm(d.hours), money(rate, cur)]), money(d.hoursMoney, cur)]];
    if (d.extras.length) lines.push([tr("Задания ({0})", [d.extras.length]), money(d.extrasMoney, cur)]);
    need(12 + lines.length * 15 + 3 + 1.2 + 25);
    y += 12;
    for (const [name, value] of lines) {
      const vw = widthOf(clean(value, f7), 8.5, f7);
      text(name, bx, y + 7.5 + CAP * 8, 8, { color: GREY, maxW: bw - vw - 10 });
      text(value, bx + bw, y + 7.5 + CAP * 8.5, 8.5, { font: f7, align: "right" });
      y += 15;
    }
    y += 3;
    box(bx, y, bw, 1.2, BLACK);
    y += 1.2;
    const tv = money(total, cur), tvs = fitSize(tv, bw - 110, 13, f8, 9);
    text(tr("ИТОГО К ОПЛАТЕ"), bx, y + 12.5 + CAP * 9, 9, { font: f8, maxW: bw - widthOf(clean(tv, f8), tvs, f8) - 10 });
    text(tv, bx + bw, y + 12.5 + CAP * 13, tvs, { font: f8, align: "right" });
    y += 25;
  }

  // =============================================================== подписи
  if (d.signatures) {
    need(22 + 26 + 0.7 + 3 + 10);
    y += 22 + 26;
    const gap = 30, sw = (CW - gap * 2) / 3;
    const who = [d.worker ? tr("Работник: {0}", [d.worker]) : tr("Работник"), tr("Работодатель"), tr("Дата")];
    who.forEach((name, i) => {
      const x = ML + i * (sw + gap);
      box(x, y, sw, 0.7, BLACK);
      text(name, x, y + 0.7 + 3 + 4.5 + CAP * 7.5, 7.5, { color: GREY, maxW: sw });
    });
    y += 0.7 + 3 + 10;
  }

  // =============================================================== подвал на каждой странице
  const pages = doc.getPages();
  const made = tr("Составлено в OSIRIS · {0}", [`${fmtDotDate(now)} ${fmtTime(now)}`]);
  pages.forEach((p, i) => {
    page = p;
    const base = H - MB - 3;
    hline(ML, ML + CW, H - MB - 15, 0.4, FAINT);
    mark(ML, H - MB - 10.5, 10, GREY);
    text(made, ML + 15, base, 6.5, { color: GREY });
    text(tr("стр. {0} из {1}", [i + 1, pages.length]), ML + CW, base, 6.5, { color: GREY, align: "right" });
  });

  return doc;
}

// ---------------------------------------------------------------- браузер: шрифты и сборка
let fontCache: Promise<ReportFonts> | null = null;

async function loadFont(weight: number): Promise<ArrayBuffer> {
  const r = await fetch(`/fonts/Manrope-${weight}.ttf`);
  if (!r.ok) throw new Error(`font ${weight}: HTTP ${r.status}`);
  return r.arrayBuffer();
}

/** Manrope в TTF (pdf-lib не умеет woff2) — нужен для кириллицы и польских букв. Загружается один раз. */
export function loadReportFonts(): Promise<ReportFonts> {
  fontCache ??= Promise.all([loadFont(500), loadFont(700), loadFont(800)])
    .then(([regular, bold, heavy]) => ({ regular, bold, heavy }))
    .catch((e) => { fontCache = null; throw e; });
  return fontCache;
}

export async function buildReportPdf(d: ReportData): Promise<Uint8Array> {
  return layoutReportPdf(d, await loadReportFonts());
}
