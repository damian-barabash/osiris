// Календарь — порт app/lib/screens/calendar/calendar_screen.dart и week_view.dart.
// Виды: Неделя (по умолчанию) / Список / Месяц / Год. На телефоне — как в приложении, на ноутбуке используем ширину:
// неделя — 7 колонок, месяц — большая сетка с делами и день справа, год — 4×3.
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { tr } from "@/i18n";
import { Appear, Card, EmptyState, Icon, Pill, RoundButton, SheetHeader, SlideSwitcher, choose, colorOf, onColor, openSheet, sphereColor } from "@/ui";
import type { AgendaItem, Sphere } from "../../data/models";
import { useStore, type Store } from "../../data/store";
import { addDays, dateOnly, day0, sameDate, weekday } from "../../data/repeat";
import { fmtDay, fmtDayShort, fmtMonthShort, fmtMonthStandalone, fmtRelDay, fmtTime, fmtWeekday, fmtWeekdayLetter, fmtWeekdayShort } from "../../format";
import { AgendaCards, agendaColor, agendaPalette, openAgendaItem, overlapsOf } from "../../widgets/AgendaCard";
import { showTaskEditor } from "../projects/editors";
import { showCapture } from "../capture/capture";
import { showEventEditor } from "./eventEditor";
import { MonthSwitcher, PeriodSwitcher, daysIn, leadOf, mondayOf, monthStart, useDesktop, useSwipe, weekdayNames, ymKey } from "./parts";
import "./calendar.css";

type CalMode = "week" | "list" | "month" | "year";
const MODES: CalMode[] = ["week", "list", "month", "year"];
const MONTH_COLORS = ["lavender", "sage", "clay", "charcoal", "navy", "teal", "mustard", "orange", "blush", "clay", "sage", "lavender"];
const CREAM = "#F6F0E3";

/** Вид при открытии: из настроек (cal_start) или последний выбранный (cal_mode). */
function startMode(): CalMode {
  try {
    const start = localStorage.getItem("cal_start") ?? "last";
    const name = start === "last" ? localStorage.getItem("cal_mode") : start;
    return MODES.includes(name as CalMode) ? (name as CalMode) : "week";
  } catch { return "week"; }
}

const dotColor = (it: AgendaItem) => (it.important ? "var(--danger)" : sphereColor(it.sphere));
const itemKey = (it: AgendaItem) => `${it.kind}-${it.id ?? it.title}-${it.at.getTime()}`;
const dayTitle = (d: Date) => `${fmtWeekday(d)}, ${fmtDay(d)}`;
const press = (fn: () => void) => (e: ReactKeyboardEvent) => { if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); fn(); } };

/** «+» у дня: в приложении открывается быстрая запись с этим днём; здесь — выбор, что добавить на день. */
async function addOn(day: Date) {
  const v = await choose(tr("Добавить"), [
    { value: "event", label: tr("Событие") },
    { value: "task", label: tr("Задача") },
    { value: "osi", label: tr("Быстрая запись"), sub: tr("Сказать или написать Оси — он разложит сам") },
  ], dayTitle(day));
  if (v === "event") void showEventEditor({ day });
  else if (v === "task") void showTaskEditor({ day });
  else if (v === "osi") void showCapture();
}

function openDay(day: Date, sphere: Sphere | null) {
  void openSheet((close) => <DaySheet day={day} sphere={sphere} close={() => close()} />, { wide: true });
}

export default function CalendarScreen() {
  const s = useStore();
  const desktop = useDesktop();
  const [mode, setModeState] = useState<CalMode>(startMode);
  const [sphere, setSphere] = useState<Sphere | null>(null);
  const [month, setMonth] = useState(() => monthStart(new Date()));
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()));
  const [selected, setSelected] = useState(() => day0(new Date()));
  const [dir, setDir] = useState(1); // куда листали — для анимации

  const setMode = (m: CalMode) => {
    if (m === mode) return;
    setModeState(m);
    try { localStorage.setItem("cal_mode", m); } catch { /* приватный режим */ }
  };

  const scrollToDay = (d: Date, smooth = true) => {
    if (desktop) return;
    const el = document.getElementById("cal-day-" + dateOnly(d));
    if (!el) return;
    // при открытии экрана не прячем шапку с видами и «+»: прокручиваем, только если день не виден
    const r = el.getBoundingClientRect();
    if (!smooth && r.top >= 0 && r.top < window.innerHeight * 0.75) return;
    el.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: smooth ? "start" : "center" });
  };

  const shiftWeek = (d: number) => {
    const today = day0(new Date());
    const ws = addDays(weekStart, 7 * d);
    setDir(d);
    setWeekStart(ws);
    setSelected(sameDate(mondayOf(today), ws) ? today : ws);
    if (!desktop) window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const shiftMonth = (d: number) => {
    setDir(Math.sign(d));
    setMonth(new Date(month.getFullYear(), month.getMonth() + d, 1));
    if (mode === "list") window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const shiftYear = (d: number) => { setDir(Math.sign(d)); setMonth(new Date(month.getFullYear() + d, month.getMonth(), 1)); };
  const shift = (d: number) => (mode === "week" ? shiftWeek(d) : mode === "year" ? shiftYear(d) : shiftMonth(d));

  const toToday = () => {
    const today = day0(new Date()), m = monthStart(today);
    if (mode === "week") { if (!sameDate(mondayOf(today), weekStart)) setDir(today < weekStart ? -1 : 1); }
    else if (mode === "year") { if (m.getFullYear() !== month.getFullYear()) setDir(m > month ? 1 : -1); }
    else if (m.getTime() !== month.getTime()) setDir(m > month ? 1 : -1);
    setMonth(m);
    setWeekStart(mondayOf(today));
    setSelected(today);
    if (mode === "week") setTimeout(() => scrollToDay(today), 80);
  };

  // вид недели на телефоне открывается на сегодняшнем дне (после анимации появления)
  useEffect(() => {
    if (mode !== "week" || desktop) return;
    const today = day0(new Date());
    if (!sameDate(mondayOf(today), weekStart) || weekday(today) === 1) return;
    const t = setTimeout(() => scrollToDay(today, false), 340);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, desktop]);

  // стрелки ← / → листают период (если не печатаем и не открыт лист)
  const shiftRef = useRef(shift);
  shiftRef.current = shift;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      if (e.altKey || e.metaKey || e.ctrlKey || e.shiftKey) return;
      if (document.documentElement.classList.contains("sheet-open")) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      e.preventDefault();
      shiftRef.current(e.key === "ArrowRight" ? 1 : -1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const swipe = useSwipe(shift);
  const pick = (d: Date) => setSelected(day0(d));
  const modeNames: [CalMode, string][] = [["week", tr("Неделя")], ["list", tr("Список")], ["month", tr("Месяц")], ["year", tr("Год")]];

  return (
    <div className="cal">
      <div className="cal-bar">
        <div className="cal-modes" role="group" aria-label={tr("Вид календаря")}>
          {modeNames.map(([m, label]) => <Pill key={m} dense icon={desktop ? m : undefined} selected={mode === m} onClick={() => setMode(m)}>{label}</Pill>)}
        </div>
        <div className="cal-sphere" role="group" aria-label={tr("Календарь")}>
          <Pill dense selected={sphere == null} onClick={() => setSphere(null)}>{tr("Всё")}</Pill>
          <Pill dense icon="briefcase" color={sphereColor("work")} selected={sphere === "work"} onClick={() => setSphere("work")}>{tr("Работа")}</Pill>
          <Pill dense icon="home" color={sphereColor("personal")} selected={sphere === "personal"} onClick={() => setSphere("personal")}>{tr("Личное")}</Pill>
        </div>
        <button type="button" className="cal-today" onClick={toToday}>{tr("Сегодня")}</button>
        <RoundButton className="cal-add" icon="add" filled color="orange" label={`${tr("Добавить")}: ${fmtDay(selected)}`} onClick={() => void addOn(selected)} />
      </div>

      <div className="cal-swipe" {...swipe}>
        {/* смена вида — мягкий переход */}
        <Appear key={mode}>
          {mode === "week" && <WeekView s={s} sphere={sphere} desktop={desktop} weekStart={weekStart} selected={selected} dir={dir} onShift={shiftWeek}
            onPick={(d) => { pick(d); scrollToDay(d); }} />}
          {(mode === "list" || mode === "month") && <MonthSwitcher month={month} dir={dir} onShift={shiftMonth} />}
          {mode === "list" && <ListView s={s} sphere={sphere} month={month} dir={dir} onOpen={(d) => { pick(d); openDay(d, sphere); }} />}
          {mode === "month" && <MonthView s={s} sphere={sphere} month={month} dir={dir} selected={selected} onPick={pick} onOpen={(d) => { pick(d); openDay(d, sphere); }} />}
          {mode === "year" && (
            <>
              <PeriodSwitcher title={String(month.getFullYear())} k={month.getFullYear()} dir={dir} prevLabel={tr("Предыдущий год")} nextLabel={tr("Следующий год")} onShift={shiftYear} />
              <YearView s={s} sphere={sphere} year={month.getFullYear()} dir={dir} onMonth={(m) => { setMonth(m); setModeState("month"); }} />
            </>
          )}
        </Appear>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ неделя

function WeekView({ s, sphere, desktop, weekStart, selected, dir, onShift, onPick }: {
  s: Store; sphere: Sphere | null; desktop: boolean; weekStart: Date; selected: Date; dir: number; onShift: (d: number) => void; onPick: (d: Date) => void;
}) {
  const today = day0(new Date());
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const agendas = days.map((d) => s.agenda(d, sphere));
  const range = `${fmtDayShort(days[0])} – ${fmtDayShort(days[6])}`;
  const k = dateOnly(weekStart);
  return (
    <div className="cal-week">
      <div className="cal-strip-wrap">
        <Card seed={91} padding="8px 6px 10px" className="cal-strip">
          <PeriodSwitcher small title={`${fmtMonthStandalone(days[3])} · ${range}`} k={k} dir={dir} prevLabel={tr("Предыдущая неделя")} nextLabel={tr("Следующая неделя")} onShift={onShift} />
          {!desktop && (
            <div className="cal-strip-days">
              {days.map((d, i) => {
                const items = agendas[i];
                const cls = ["cal-sd", sameDate(d, selected) && "sel", sameDate(d, today) && "today", weekday(d) >= 6 && "weekend"].filter(Boolean).join(" ");
                return (
                  <button key={i} type="button" className={cls} aria-pressed={sameDate(d, selected)} aria-label={dayTitle(d)} onClick={() => onPick(d)}>
                    <span className="cal-sd-w">{fmtWeekdayLetter(d)}</span>
                    <span className="cal-sd-n">{d.getDate()}</span>
                    <span className="cal-dots">
                      {items.slice(0, 3).map((it, j) => <i key={j} style={{ background: dotColor(it) }} />)}
                      {overlapsOf(items).size > 0 && <Icon name="stack" size={7} color="var(--danger)" strokeWidth={3} />}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </Card>
      </div>
      <SlideSwitcher k={k} dir={dir}>
        {desktop ? (
          <div className="cal-cols">
            {days.map((d, i) => <WeekColumn key={i} d={d} items={agendas[i]} today={today} selected={sameDate(d, selected)} sphere={sphere} onPick={onPick} />)}
          </div>
        ) : (
          <div className="cal-days">
            {days.map((d, i) => <WeekDay key={i} d={d} items={agendas[i]} today={today} />)}
          </div>
        )}
      </SlideSwitcher>
    </div>
  );
}

/** День недели на телефоне: дела на весь день отдельной лентой, остальное по времени (с пересечениями). */
function WeekDay({ d, items, today }: { d: Date; items: AgendaItem[]; today: Date }) {
  const allDay = items.filter((x) => x.allDay), timed = items.filter((x) => !x.allDay);
  return (
    <section id={"cal-day-" + dateOnly(d)} className={`cal-day${d < today ? " past" : ""}`}>
      <header className="cal-day-head">
        {sameDate(d, today) && <span className="cal-badge">{tr("СЕГОДНЯ")}</span>}
        <h3>{dayTitle(d)}</h3>
        <button type="button" className="cal-plus" aria-label={`${tr("Добавить")}: ${fmtDay(d)}`} onClick={() => void addOn(d)}><Icon name="plus" size={22} /></button>
      </header>
      {items.length === 0 && <div className="cal-free"><span>{tr("свободно")}</span></div>}
      {allDay.length > 0 && (
        <>
          <div className="cal-label">{tr("ВЕСЬ ДЕНЬ")}</div>
          <div className={`cal-chips${timed.length ? " gap" : ""}`}>{allDay.map((it, k) => <AllDayChip key={itemKey(it)} item={it} index={k} />)}</div>
        </>
      )}
      <AgendaCards items={timed} />
    </section>
  );
}

/** Колонка дня на ноутбуке. */
function WeekColumn({ d, items, today, selected, sphere, onPick }: { d: Date; items: AgendaItem[]; today: Date; selected: boolean; sphere: Sphere | null; onPick: (d: Date) => void }) {
  const allDay = items.filter((x) => x.allDay), timed = items.filter((x) => !x.allDay);
  const isToday = sameDate(d, today);
  const cls = ["cal-col", selected && "sel", isToday && "today", d < today && "past", weekday(d) >= 6 && "weekend"].filter(Boolean).join(" ");
  return (
    <section className={cls} aria-label={dayTitle(d)}>
      <header className="cal-col-head">
        <button type="button" className="cal-col-day" aria-pressed={selected} aria-label={dayTitle(d)} title={tr("Двойной клик — весь день")} onClick={() => onPick(d)} onDoubleClick={() => openDay(d, sphere)}>
          <span className="cal-sd-w">{fmtWeekdayShort(d).toUpperCase()}</span>
          <span className="cal-sd-n">{d.getDate()}</span>
        </button>
        <button type="button" className="cal-plus" aria-label={`${tr("Добавить")}: ${fmtDay(d)}`} onClick={() => void addOn(d)}><Icon name="plus" size={20} /></button>
      </header>
      <div className="cal-col-body">
        {items.length === 0 && <div className="cal-free"><span>{tr("свободно")}</span></div>}
        {allDay.length > 0 && <div className={`cal-chips col${timed.length ? " gap" : ""}`}>{allDay.map((it, k) => <AllDayChip key={itemKey(it)} item={it} index={k} />)}</div>}
        <AgendaCards items={timed} compact />
      </div>
    </section>
  );
}

/** Пункт на весь день — маленький бумажный ярлык. */
function AllDayChip({ item, index }: { item: AgendaItem; index: number }) {
  const s = useStore();
  const color = item.kind === "task" ? null : agendaColor(item, index + 3);
  const dark = !!color && onColor(color) === CREAM;
  const task = item.kind === "task" ? s.tasks.find((t) => t.id === item.id) : undefined;
  const icon = item.kind === "task" ? (task?.done ? "check" : "circle") : item.kind === "stage" ? "flag" : item.kind === "deadline" ? "timer" : "sun";
  return (
    <Appear i={index} className="cal-chip-wrap">
      <Card color={color} lift={2} seed={index + item.title.length} padding="8px 12px 8px 10px" className="cal-allday" onClick={item.readOnly ? undefined : () => openAgendaItem(item)}>
        <Icon name={icon} size={14} color={item.important ? (dark ? "var(--butter)" : "var(--danger)") : undefined} />
        <span className={task?.done ? "done" : undefined}>{item.title}</span>
      </Card>
    </Appear>
  );
}

// ------------------------------------------------------------------ список дней

function ListView({ s, sphere, month, dir, onOpen }: { s: Store; sphere: Sphere | null; month: Date; dir: number; onOpen: (d: Date) => void }) {
  const now = new Date();
  const current = month.getFullYear() === now.getFullYear() && month.getMonth() === now.getMonth();
  const start = current ? now.getDate() : 1;
  const count = daysIn(month) - start + 1;
  return (
    <SlideSwitcher k={ymKey(month)} dir={dir}>
      <div className="cal-list">
        {Array.from({ length: count }, (_, i) => {
          const day = new Date(month.getFullYear(), month.getMonth(), start + i);
          return <Appear key={i} i={i}><DayStrip day={day} items={s.agenda(day, sphere)} onOpen={() => onOpen(day)} /></Appear>;
        })}
      </div>
    </SlideSwitcher>
  );
}

/** Карточка дня в списке: дата слева, дела лентой. */
function DayStrip({ day, items, onOpen }: { day: Date; items: AgendaItem[]; onOpen: () => void }) {
  const today = sameDate(day, new Date());
  const empty = items.length === 0;
  const color = empty ? (today ? colorOf("butter") : null) : today ? colorOf("charcoal") : colorOf(agendaPalette[(day.getDate() + day.getMonth() + 1) % agendaPalette.length]);
  const dark = !!color && onColor(color) === CREAM;
  const overlap = overlapsOf(items);
  const timeOf = (it: AgendaItem) => (it.allDay ? (it.kind === "event" ? tr("весь день") : tr("срок")) : it.end && it.end > it.at ? `${fmtTime(it.at)}–${fmtTime(it.end)}${sameDate(it.at, it.end) ? "" : " →"}` : fmtTime(it.at));
  return (
    <Card color={color} seed={day.getDate() * 3 + day.getMonth() + 1} padding="12px 10px 12px 14px" className={`cal-ds${empty ? " empty" : ""}`} onClick={onOpen} aria-label={dayTitle(day)}>
      <div className="cal-ds-date">
        <span className={`cal-ds-w${weekday(day) >= 6 && empty ? " weekend" : ""}`}>{fmtWeekdayShort(day).toUpperCase()}</span>
        <b>{day.getDate()}</b>
        <span className="cal-ds-m">{fmtMonthShort(day)}</span>
      </div>
      <span className="cal-ds-rule" aria-hidden />
      {empty ? (
        <div className="cal-ds-free">{today ? tr("Сегодня свободно") : tr("Свободно")}</div>
      ) : (
        <div className="cal-ds-items" data-noswipe>
          {items.map((it, i) => (
            <button key={itemKey(it)} type="button" className="cal-ds-item" onKeyDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); openAgendaItem(it); }}>
              <span className="cal-ds-time">
                <span>{timeOf(it)}</span>
                {overlap.has(i) && <Icon name="stack" size={12} color={dark ? "var(--butter)" : "var(--danger)"} />}
              </span>
              <span className={`cal-ds-title${it.important ? " imp" : ""}`}>{it.title}</span>
            </button>
          ))}
        </div>
      )}
      <Icon name="plus" size={22} className="cal-ds-plus" />
    </Card>
  );
}

// ------------------------------------------------------------------ месяц

function MonthView({ s, sphere, month, dir, selected, onPick, onOpen }: { s: Store; sphere: Sphere | null; month: Date; dir: number; selected: Date; onPick: (d: Date) => void; onOpen: (d: Date) => void }) {
  const lead = leadOf(month), days = daysIn(month), now = new Date();
  const items = s.agenda(selected, sphere);
  return (
    <div className="cal-month">
      <SlideSwitcher k={ymKey(month)} dir={dir} className="cal-month-main">
        <Card seed={90} padding="12px 10px 10px">
          <div className="cal-wd">{weekdayNames().map((w) => <span key={w}>{w}</span>)}</div>
          <div className="cal-grid">
            {Array.from({ length: lead }, (_, i) => <span key={"l" + i} className="cal-blank" />)}
            {Array.from({ length: days }, (_, i) => {
              const day = new Date(month.getFullYear(), month.getMonth(), i + 1);
              const its = s.agenda(day, sphere);
              const sel = sameDate(day, selected);
              const cls = ["cal-cell", sel && "sel", sameDate(day, now) && "today", weekday(day) >= 6 && "weekend"].filter(Boolean).join(" ");
              return (
                <div key={i} role="button" tabIndex={0} className={cls} aria-pressed={sel} aria-label={`${fmtDay(day)}${its.length ? ` · ${its.length}` : ""}`}
                  onClick={() => onPick(day)} onDoubleClick={() => onOpen(day)} onKeyDown={press(() => (sel ? onOpen(day) : onPick(day)))}>
                  <span className="cal-cell-top">
                    <span className="cal-num">{i + 1}</span>
                    {overlapsOf(its).size > 0 && <Icon name="stack" size={11} color="var(--danger)" className="cal-cell-ov" />}
                  </span>
                  <span className="cal-dots">{its.slice(0, 4).map((it, j) => <i key={j} style={{ background: dotColor(it) }} />)}</span>
                  <span className="cal-cell-items">
                    {its.slice(0, 3).map((it) => (
                      <button key={itemKey(it)} type="button" className={`cal-ev${it.important ? " imp" : ""}`} style={{ "--c": dotColor(it) } as CSSProperties} title={it.title}
                        onClick={(e) => { e.stopPropagation(); onPick(day); openAgendaItem(it); }} onDoubleClick={(e) => e.stopPropagation()}>
                        {!it.allDay && <b>{fmtTime(it.at)}</b>}
                        <span>{it.title}</span>
                      </button>
                    ))}
                    {its.length > 3 && <span className="cal-more">{tr("ещё {0}", [its.length - 3])}</span>}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      </SlideSwitcher>
      <aside className="cal-side">
        <header className="cal-day-head">
          <h3>{dayTitle(selected)}</h3>
          <button type="button" className="cal-plus" aria-label={`${tr("Добавить")}: ${fmtDay(selected)}`} onClick={() => void addOn(selected)}><Icon name="plus" size={26} /></button>
        </header>
        <div key={dateOnly(selected)}>
          {items.length === 0
            ? <Appear><p className="cal-hint">{tr("Пусто. Дважды тапни по дню — откроется весь день.")}</p></Appear>
            : <AgendaCards items={items} />}
        </div>
      </aside>
    </div>
  );
}

// ------------------------------------------------------------------ год

function YearView({ s, sphere, year, dir, onMonth }: { s: Store; sphere: Sphere | null; year: number; dir: number; onMonth: (m: Date) => void }) {
  const now = new Date();
  const letters = Array.from({ length: 7 }, (_, d) => fmtWeekdayLetter(new Date(2024, 0, d + 1))); // 1 января 2024 — понедельник
  return (
    <SlideSwitcher k={year} dir={dir}>
      <div className="cal-year">
        {MONTH_COLORS.map((name, m) => {
          const month = new Date(year, m, 1);
          const lead = leadOf(month), days = daysIn(month);
          return (
            <Appear key={m} i={m}>
              <Card color={name} seed={100 + m} padding="10px 10px 8px" className="cal-ym" aria-label={`${fmtMonthStandalone(month)} ${year}`} onClick={() => onMonth(month)}>
                <div className="cal-ym-name">{fmtMonthStandalone(month)}</div>
                <div className="cal-ym-grid head" aria-hidden>{letters.map((w, i) => <span key={i}>{w}</span>)}</div>
                <div className="cal-ym-grid" aria-hidden>
                  {Array.from({ length: lead }, (_, i) => <span key={"l" + i} />)}
                  {Array.from({ length: days }, (_, i) => {
                    const d = new Date(year, m, i + 1);
                    const busy = s.agenda(d, sphere).length > 0;
                    return <span key={i} className={sameDate(d, now) ? "today" : busy ? "busy" : undefined}>{i + 1}</span>;
                  })}
                </div>
              </Card>
            </Appear>
          );
        })}
      </div>
    </SlideSwitcher>
  );
}

// ------------------------------------------------------------------ лист дня

/** Лист дня: все пункты + добавить. */
function DaySheet({ day, sphere, close }: { day: Date; sphere: Sphere | null; close: () => void }) {
  const s = useStore();
  const items = s.agenda(day, sphere);
  return (
    <div className="cal-daysheet">
      <SheetHeader title={dayTitle(day)} sub={fmtRelDay(day)} action={tr("Добавить")} onAction={() => void addOn(day)} close={close} />
      {items.length === 0 ? <EmptyState title={tr("В этот день пусто")} text={tr("Нажми «Добавить» или скажи Оси.")} /> : <AgendaCards items={items} />}
    </div>
  );
}
