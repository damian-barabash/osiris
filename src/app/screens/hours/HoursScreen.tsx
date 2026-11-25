// Вкладка «Часы» — порт app/lib/screens/hours/hours_screen.dart:
// смены по работам, ставка, сколько заработано, прогноз до конца месяца и рапорт для работодателя.
// На ноутбуке: сводка и работы слева, лента смен и заданий справа.
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { tr } from "@/i18n";
import { Appear, Button, Card, Collapse, CountUp, EmptyState, Icon, Pill, RoundButton, ScreenHeader, SectionTitle, SlideSwitcher, colorOf, onColor } from "@/ui";
import type { Job, WorkExtra, WorkSession } from "../../data/models";
import { addDays, dateOnly, sameDate, weekday } from "../../data/repeat";
import { useStore } from "../../data/store";
import { fmtDay, fmtDayShort, fmtMonthYear, fmtTime, fmtWeekday, fmtWeekdayLetter, money, moneyMap } from "../../format";
import { showJobEditor, showShiftEditor } from "./editors";
import { showReportSheet } from "./reportSheet";
import { fmtClock, fmtHoursText, seedOf } from "./util";
import "./hours.css";

export default function HoursScreen() {
  const s = useStore();
  const [month, setMonth] = useState(true); // месяц или неделя
  const [anchor, setAnchor] = useState(() => new Date());
  const [dir, setDir] = useState(1);
  const [archiveOpen, setArchiveOpen] = useState(false);

  const a = anchor;
  const from = month ? new Date(a.getFullYear(), a.getMonth(), 1) : new Date(a.getFullYear(), a.getMonth(), a.getDate() - (weekday(a) - 1));
  const to = month ? new Date(a.getFullYear(), a.getMonth() + 1, 1) : addDays(from, 7);
  const now = new Date();
  const current = now >= from && now < to;
  const shift = (d: number) => { setDir(d); setAnchor(month ? new Date(a.getFullYear(), a.getMonth() + d, 1) : addDays(a, 7 * d)); };
  const mode = (m: boolean) => { if (m !== month) { setDir(m ? -1 : 1); setMonth(m); } };

  const jobs = s.jobs.filter((j) => !j.archived);
  const archived = s.jobs.filter((j) => j.archived);
  // смены и задания одной лентой по дням, свежие сверху
  const list: [Date, WorkSession | WorkExtra, boolean][] = [
    ...s.sessionsBetween(from, to).map((x): [Date, WorkSession, boolean] => [x.start, x, true]),
    ...s.extrasBetween(from, to).map((x): [Date, WorkExtra, boolean] => [new Date(x.day.getFullYear(), x.day.getMonth(), x.day.getDate(), 23, 59), x, false]),
  ];
  list.sort((p, q) => q[0].getTime() - p[0].getTime());

  const title = month ? fmtMonthYear(from) : `${fmtDayShort(from)} – ${fmtDayShort(addDays(to, -1))}`;
  const key = `${month ? "m" : "w"}${dateOnly(from)}`;
  const hasAny = s.jobs.length > 0;

  return (
    <div className="hrs">
      <ScreenHeader title={tr("Часы")}>
        {jobs.length > 0 && <Button small ghost icon="pdf" onClick={() => void showReportSheet({ from, to })}>{tr("Рапорт")}</Button>}
        <RoundButton icon="add" filled color="orange" label={jobs.length ? tr("Новая запись") : tr("Добавить работу")} onClick={() => void (jobs.length ? showShiftEditor() : showJobEditor())} />
      </ScreenHeader>

      {!hasAny ? (
        <EmptyState title={tr("Сколько я заработаю?")} text={tr("Добавь работу и ставку в час — Оси будет считать часы и зарплату. Работ может быть несколько.")} mood="excited"
          action={tr("Добавить работу")} onAction={() => void showJobEditor()} />
      ) : (
        <>
          <div className="hrs-period">
            <Pill dense selected={month} onClick={() => mode(true)}>{tr("Месяц")}</Pill>
            <Pill dense selected={!month} onClick={() => mode(false)}>{tr("Неделя")}</Pill>
            <span className="hrs-period-gap" />
            <RoundButton icon="left" size={34} label={tr("Назад")} onClick={() => shift(-1)} />
            <SlideSwitcher k={title} dir={dir} className="hrs-period-title">{title}</SlideSwitcher>
            <RoundButton icon="right" size={34} label={tr("Вперёд")} onClick={() => shift(1)} />
          </div>

          <div className="hrs-grid">
            <div className="hrs-left">
              <SlideSwitcher k={key} dir={dir}>
                <Summary from={from} to={to} month={month} current={current} />
              </SlideSwitcher>
              {s.jobs.map((j) => <RunningSlot key={j.id} job={j} />)}

              <SectionTitle trailing={<Pill dense onClick={() => void showJobEditor()}>{tr("+ работа")}</Pill>}>{tr("Работы")}</SectionTitle>
              <div className="hrs-jobs">
                {jobs.map((j, i) => <Appear key={j.id} i={i}><JobCard job={j} from={from} to={to} /></Appear>)}
              </div>
              {archived.length > 0 && (
                <div className="hrs-archive">
                  <Pill dense icon="archive" selected={archiveOpen} badge={archived.length} onClick={() => setArchiveOpen(!archiveOpen)}>{tr("Архив")}</Pill>
                  <Collapse open={archiveOpen}>
                    <div className="hrs-jobs hrs-jobs-archived">
                      {archived.map((j) => <JobCard key={j.id} job={j} from={from} to={to} archived />)}
                    </div>
                  </Collapse>
                </div>
              )}
            </div>

            <div className="hrs-right">
              <SectionTitle trailing={<span className="hrs-total-count">{list.length}</span>}>{month ? tr("Смены и задания за месяц") : tr("Смены и задания за неделю")}</SectionTitle>
              <SlideSwitcher k={key} dir={dir}>
                {list.length === 0 ? (
                  <p className="hrs-hint">{tr("Пока пусто. Нажми круглую кнопку у работы — пойдёт таймер, или «+», чтобы вписать смену или задание за цену.")}</p>
                ) : (
                  <div className="hrs-feed">
                    {list.map(([at, x, isShift], i) => (
                      <Appear key={x.id} i={i}>
                        {(i === 0 || !sameDate(list[i - 1][0], at)) && <div className="hrs-day">{fmtWeekday(at)}, {fmtDay(at)}</div>}
                        {isShift ? <ShiftRow session={x as WorkSession} /> : <ExtraRow extra={x as WorkExtra} />}
                      </Appear>
                    ))}
                  </div>
                )}
              </SlideSwitcher>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/** Сводка: заработано, часы, прогноз до конца месяца и столбики по дням. */
function Summary({ from, to, month, current }: { from: Date; to: Date; month: boolean; current: boolean }) {
  const s = useStore();
  const earned = Object.entries(s.earned(from, to));
  const hours = s.hoursBetween(from, to);
  const extras = s.extrasBetween(from, to);
  const extrasMoney = s.extrasEarned(from, to);
  const days = Math.round((to.getTime() - from.getTime()) / 86_400_000);
  const dayAt = (d: number) => new Date(from.getFullYear(), from.getMonth(), from.getDate() + d);
  const perDay = Array.from({ length: days }, (_, d) => s.hoursBetween(dayAt(d), dayAt(d + 1)));
  const maxH = perDay.reduce((m, v) => (v > m ? v : m), 8);
  const today = new Date();

  // прогноз: темп за прошедшие дни месяца → весь месяц
  let forecast: Record<string, number> | null = null;
  if (month && current) {
    const passed = today.getDate();
    const total = new Date(from.getFullYear(), from.getMonth() + 1, 0).getDate();
    // задания разовые — в темп не входят, просто добавляются к прогнозу
    const byHours = s.earned(from, to, { withExtras: false });
    if (passed >= 3 && Object.values(byHours).some((v) => v >= 1)) {
      forecast = {};
      for (const [c, v] of Object.entries(byHours)) forecast[c] = (v / passed) * total;
      for (const [c, v] of Object.entries(extrasMoney)) forecast[c] = (forecast[c] ?? 0) + v;
    }
  }
  // текст остаётся на время сворачивания блока
  const forecastText = useRef("");
  if (forecast) forecastText.current = tr("Если в том же темпе — к концу месяца ≈ {0}", [Object.entries(forecast).map(([c, v]) => money(v, c)).join(" · ")]);
  const extrasText = useRef("");
  if (extras.length) extrasText.current = tr("в том числе задания ({0}): {1}", [extras.length, moneyMap(extrasMoney)]);

  return (
    <Card color="charcoal" seed={14} className="hrs-summary">
      <div className="hrs-sum-top">
        <div className="hrs-sum-money">
          <div className="hrs-label">{tr("ЗАРАБОТАНО")}</div>
          {earned.length === 0 && <div className="hrs-big">0</div>}
          {earned.map(([c, v]) => <div key={c} className="hrs-big"><CountUp value={v} ms={500} format={(n) => money(n, c)} /></div>)}
        </div>
        <span className="hrs-sum-rule" />
        <div>
          <div className="hrs-label">{tr("ЧАСОВ")}</div>
          <div className="hrs-big hrs-butter"><CountUp value={hours} ms={500} format={fmtHoursText} /></div>
        </div>
      </div>
      <Collapse open={extras.length > 0}><div className="hrs-sum-extras">{extrasText.current}</div></Collapse>
      <Collapse open={!!forecast}><div className="hrs-forecast-wrap"><div className="hrs-forecast"><Icon name="trend" size={14} />{forecastText.current}</div></div></Collapse>
      <div className={`hrs-bars${month ? "" : " week"}`} role="img" aria-label={`${tr("ЧАСОВ")}: ${fmtHoursText(hours)}`}>
        {perDay.map((h, d) => (
          <span key={d} className="hrs-bar-cell" title={`${fmtDay(dayAt(d))} · ${fmtHoursText(h)}`}>
            <i className={`hrs-bar${h === 0 ? " zero" : sameDate(dayAt(d), today) ? " today" : ""}`} style={{ height: h === 0 ? 3 : 4 + (h / maxH) * 40, animationDelay: `${d * 12}ms` } as CSSProperties} />
          </span>
        ))}
      </div>
      {!month && (
        <div className="hrs-bar-letters" aria-hidden>
          {perDay.map((_, d) => <span key={d}>{fmtWeekdayLetter(dayAt(d))}</span>)}
        </div>
      )}
    </Card>
  );
}

/** Таймер идущей смены: каждую секунду перерисовывается только он, а не весь экран. */
function LiveClock({ session, rate, currency }: { session: WorkSession; rate: number; currency: string }) {
  const [, tick] = useState(0);
  useEffect(() => {
    if (!session.running) return;
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [session.running, session.id]);
  const ms = session.workedMs();
  return (
    <div className="hrs-clock">
      <b>{fmtClock(ms)}</b>
      <span>{money((Math.floor(ms / 1000) / 3600) * rate, currency)}</span>
    </div>
  );
}

/** Место под карточку идущей смены у работы: раскрывается при старте и сворачивается после «Стоп». */
function RunningSlot({ job }: { job: Job }) {
  const s = useStore();
  const run = s.running.find((x) => x.jobId === job.id) ?? null;
  const last = useRef<WorkSession | null>(run);
  if (run) last.current = run;
  const x = run ?? last.current;
  return (
    <Collapse open={!!run}>
      {x && (
        <div className="hrs-running-wrap">
          <Card color="orange" seed={seedOf(x.id)} className="hrs-running" onClick={() => void showShiftEditor({ session: x })}>
            <span className="hrs-pulse" aria-hidden />
            <div className="hrs-running-text">
              <div className="hrs-running-title">{tr("Идёт смена · {0}", [job.name])}</div>
              <LiveClock session={x} rate={s.rateOf(x)} currency={job.currency} />
              <div className="hrs-running-since">{tr("с {0}", [fmtTime(x.start)])}</div>
            </div>
            <span className="hrs-stopper" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
              <Button small color="#F6F0E3" icon="stop" disabled={!run} onClick={() => run && void s.stopShift(run)}>{tr("Стоп")}</Button>
            </span>
          </Card>
        </div>
      )}
    </Collapse>
  );
}

/** Карточка работы: ставка, часы и деньги за период, круглая кнопка — начать или закончить смену. */
function JobCard({ job, from, to, archived = false }: { job: Job; from: Date; to: Date; archived?: boolean }) {
  const s = useStore();
  const color = colorOf(job.color, "teal");
  const fg = onColor(color);
  const h = s.hoursBetween(from, to, job.id);
  const e = s.earned(from, to, { jobId: job.id })[job.currency] ?? 0;
  const run = s.running.find((x) => x.jobId === job.id) ?? null;
  return (
    <Card color={color} seed={seedOf(job.id)} className={`hrs-job${archived ? " archived" : ""}`} onClick={() => void showJobEditor(job)}>
      <span className="hrs-job-icon"><Icon name={job.icon} size={21} /></span>
      <div className="hrs-job-text">
        <div className="hrs-job-name">{job.name}</div>
        <div className="hrs-job-rate">{tr("{0}/ч", [money(job.rate, job.currency)])}</div>
        <div className="hrs-job-sum">{fmtHoursText(h)} · <CountUp value={e} ms={500} format={(v) => money(v, job.currency)} /></div>
      </div>
      {!archived && (
        <span className={`hrs-go${run ? " on" : ""}`} onClick={(ev) => ev.stopPropagation()} onKeyDown={(ev) => ev.stopPropagation()}>
          <RoundButton icon={run ? "stop" : "play"} size={52} filled color={run ? "#C8402A" : fg} label={run ? tr("Стоп") : tr("Начать смену")} onClick={() => void (run ? s.stopShift(run) : s.startShift(job))} />
        </span>
      )}
    </Card>
  );
}

function ShiftRow({ session: x }: { session: WorkSession }) {
  const s = useStore();
  const j = s.job(x.jobId);
  const sub = [`${fmtTime(x.start)}–${x.end == null ? tr("сейчас") : fmtTime(x.end)}`, ...(x.breakMinutes > 0 ? [tr("перерыв {0} мин", [x.breakMinutes])] : []), ...(x.note ? [x.note] : [])].join(" · ");
  return (
    <Card lift={2} seed={seedOf(x.id)} padding="11px 14px" className="hrs-row" onClick={() => void showShiftEditor({ session: x })}>
      <span className={`hrs-stripe${x.running ? " live" : ""}`} style={{ background: colorOf(j?.color, "teal") }} />
      <div className="hrs-row-text">
        <div className="hrs-row-title">{j?.name ?? "—"}</div>
        <div className="hrs-row-sub">{sub}</div>
      </div>
      <div className="hrs-row-end">
        <div className="hrs-row-title">{fmtHoursText(x.hours())}</div>
        {j && <div className="hrs-row-sub">{money(x.hours() * s.rateOf(x), j.currency)}</div>}
      </div>
    </Card>
  );
}

/** Задание за цену в ленте: звёздочка, название, сумма. */
function ExtraRow({ extra: x }: { extra: WorkExtra }) {
  const s = useStore();
  const j = s.job(x.jobId);
  const color = colorOf(j?.color, "teal");
  return (
    <Card lift={2} seed={seedOf(x.id)} padding="11px 14px" className="hrs-row" onClick={() => void showShiftEditor({ item: x })}>
      <span className="hrs-star" style={{ "--c": color } as CSSProperties}><Icon name="star" size={16} fill /></span>
      <div className="hrs-row-text">
        <div className="hrs-row-title">{x.title}</div>
        <div className="hrs-row-sub">{[tr("задание"), j?.name ?? "—", ...(x.note ? [x.note] : [])].join(" · ")}</div>
      </div>
      {j && <div className="hrs-row-end"><div className="hrs-row-title">{money(x.amount, j.currency)}</div></div>}
    </Card>
  );
}
