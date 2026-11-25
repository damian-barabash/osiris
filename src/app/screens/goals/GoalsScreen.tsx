// Цели — порт app/lib/screens/goals/goals_screen.dart: фильтр сфер, листы целей с прогрессом, архив.
import { useState } from "react";
import { plural, tr } from "@/i18n";
import { Appear, Card, Collapse, CountUp, EmptyState, Icon, Pill, Progress, RoundButton, ScreenHeader, SlideSwitcher, colorOf, onColor } from "@/ui";
import type { Sphere, Tracker } from "../../data/models";
import { addDays, dateOnly, day0 } from "../../data/repeat";
import { useStore } from "../../data/store";
import { fmtDayShort, fmtWeekdayLetter } from "../../format";
import { nav } from "../../router";
import { fmtAmount, fmtCounting, forecast, habitStats, noTick, relDay, seedOf, stageStats, streakLabel, useGrown } from "./goalsLib";
import { newTracker } from "./trackerEditor";
import "./goals.css";

const ORDER: (Sphere | null)[] = [null, "work", "personal"];

export default function GoalsScreen() {
  const s = useStore();
  const [sphere, setSphere] = useState<Sphere | null>(null);
  const [dir, setDir] = useState(1);
  const [archiveOpen, setArchiveOpen] = useState(false);

  const pick = (v: Sphere | null) => { setDir(ORDER.indexOf(v) >= ORDER.indexOf(sphere) ? 1 : -1); setSphere(v); };
  const create = async () => {
    const id = await newTracker();
    if (id) nav("/goal/" + id);
  };

  const list = s.trackers.filter((t) => !t.archived && (sphere == null || t.sphere === sphere));
  const archived = s.trackers.filter((t) => t.archived);

  return (
    <div className="goals">
      <ScreenHeader title={tr("Цели")}>
        <RoundButton icon="add" filled label={tr("Новая цель")} onClick={create} />
      </ScreenHeader>
      <div className="goals-filter">
        <Pill dense selected={sphere == null} onClick={() => pick(null)}>{tr("Всё")}</Pill>
        <Pill dense icon="briefcase" color="teal" selected={sphere === "work"} onClick={() => pick("work")}>{tr("Работа")}</Pill>
        <Pill dense icon="home" color="orange" selected={sphere === "personal"} onClick={() => pick("personal")}>{tr("Личное")}</Pill>
      </div>

      <SlideSwitcher k={sphere ?? "all"} dir={dir}>
        {list.length === 0 ? (
          <EmptyState title={tr("Здесь живут большие штуки")} text={tr("Накопить на машину, вести судебное дело по этапам, держать привычку. Решающие даты Оси не даст проспать.")} mood="excited" action={tr("Новая цель")} onAction={create} />
        ) : (
          <div className="goals-grid">
            {list.map((t, i) => <Appear key={t.id} i={i}><TrackerCard tracker={t} /></Appear>)}
          </div>
        )}
      </SlideSwitcher>

      <Collapse open={archived.length > 0}>
        <button type="button" className={"goals-archive-head" + (archiveOpen ? " open" : "")} aria-expanded={archiveOpen} onClick={() => setArchiveOpen((v) => !v)}>
          <span>{tr("Архив")}</span>
          <i>{archived.length}</i>
          <Icon name="down" size={16} />
        </button>
        <Collapse open={archiveOpen}>
          <div className="goals-archive">
            {archived.map((t) => (
              <button key={t.id} type="button" className="goals-archive-row" tabIndex={archiveOpen ? 0 : -1} onClick={() => nav("/goal/" + t.id)}>
                <Icon name={t.icon} size={20} />
                <span>{t.title}</span>
                <Icon name="right" size={16} />
              </button>
            ))}
          </div>
        </Collapse>
      </Collapse>
    </div>
  );
}

/** Карточка цели с прогрессом. */
export function TrackerCard({ tracker: t }: { tracker: Tracker }) {
  const s = useStore();
  const fg = onColor(colorOf(t.color, "lavender"));
  return (
    <Card color={colorOf(t.color, "lavender")} seed={seedOf(t.id)} onClick={() => nav("/goal/" + t.id)} className="goals-card">
      <div className="goals-card-head">
        <span className="goals-card-icon"><Icon name={t.icon} size={19} /></span>
        <h3>{t.title}</h3>
        {t.deadline && <span className="goals-card-deadline">{tr("до {0}", [fmtDayShort(t.deadline)])}</span>}
      </div>
      {(t.kind === "money" || t.kind === "counter") && <AmountBody t={t} sum={s.trackerSum(t.id)} fg={fg} />}
      {t.kind === "stages" && <StagesBody t={t} />}
      {t.kind === "habit" && <HabitBody t={t} />}
    </Card>
  );
}

function AmountBody({ t, sum, fg }: { t: Tracker; sum: number; fg: string }) {
  const s = useStore();
  const target = t.target ?? 0;
  const shown = useGrown(sum);
  const ratio = useGrown(target > 0 ? sum / target : 0);
  const pace = t.kind === "money" ? forecast(t, sum, s.entriesOf(t.id))?.pace : null;
  return (
    <>
      <div className="goals-card-sum">
        <b><CountUp value={shown} format={fmtCounting(t, sum)} /></b>
        {target > 0 && <span>{tr("из {0}", [fmtAmount(t, target)])}</span>}
        {target > 0 && <em><CountUp value={Math.min(999, Math.max(0, Math.round(ratio * 100)))} />%</em>}
      </div>
      {target > 0 && <Progress value={ratio} color={fg} height={12} />}
      {pace && <p className="goals-card-note"><Icon name="trend" size={14} />{pace}</p>}
    </>
  );
}

function StagesBody({ t }: { t: Tracker }) {
  const s = useStore();
  const st = s.stagesOf(t.id);
  const { done, current, nextCritical } = stageStats(st);
  const allDone = !current && st.length > 0;
  return (
    <>
      {st.length > 0 && (
        <div className="goals-card-steps">
          {st.map((x) => <span key={x.id} className={x.status + (x.critical ? " critical" : "")} />)}
        </div>
      )}
      <p className="goals-card-now">
        {allDone && <Icon name="tick" size={16} />}
        {current ? tr("Сейчас: {0}", [current.title]) : st.length === 0 ? tr("Добавь этапы") : noTick(tr("Все этапы пройдены ✓"))}
      </p>
      <p className="goals-card-sub">{tr("{0} из {1} {2}", [done, st.length, plural(st.length, tr("этапа"), tr("этапов"), tr("этапов"))])}</p>
      {nextCritical && (
        <div className="goals-card-critical">
          <Icon name="flag" size={14} fill />
          <span>{nextCritical.title} — {relDay(nextCritical.dueOn!)} ({fmtDayShort(nextCritical.dueOn!)})</span>
        </div>
      )}
    </>
  );
}

function HabitBody({ t }: { t: Tracker }) {
  const s = useStore();
  const { days, streak, week } = habitStats(s.entriesOf(t.id));
  const today = day0(new Date());
  const shown = useGrown(streak);
  return (
    <>
      <div className="goals-card-week">
        {[6, 5, 4, 3, 2, 1, 0].map((d, i) => {
          const day = addDays(today, -d);
          return (
            <div key={d} className="goals-card-day">
              <span className={days.has(dateOnly(day)) ? "on" : ""} style={{ animationDelay: `${i * 45}ms` }} />
              <i>{fmtWeekdayLetter(day)}</i>
            </div>
          );
        })}
      </div>
      <p className="goals-card-sub goals-card-streak">
        <b><CountUp value={shown} /></b> {streakLabel(streak)}
        <span>{week}{t.target != null ? `/${Math.trunc(t.target)}` : ""} {tr("за 7 дней")}</span>
      </p>
    </>
  );
}
