// Цель целиком — порт app/lib/screens/goals/tracker_screen.dart: лист цели с итогом и тело по виду
// (деньги и счётчик — история записей, этапы — лента этапов, привычка — сетка 16 недель).
import { GiftLink } from "./gift";
import { useState } from "react";
import { plural, tr } from "@/i18n";
import { Appear, Button, Card, CountUp, EmptyState, Field, Icon, Progress, RoundButton, ScreenHeader, SectionTitle, SheetHeader, Tag, colorOf, confirm, onColor, openSheet } from "@/ui";
import type { Entry, Stage, Tracker } from "../../data/models";
import { addDays, dateOnly, day0, sameDate, weekday } from "../../data/repeat";
import { store, useStore } from "../../data/store";
import { fmtDay, fmtWeekdayLetter } from "../../format";
import { back, useRoute } from "../../router";
import { daysLeft, fmtAmount, fmtCounting, fmtEntry, forecast, habitStats, noTick, parseMoney, relDay, seedOf, streakLabel, useGrown } from "./goalsLib";
import { showStageEditor, showTrackerEditor } from "./trackerEditor";
import "./goals.css";

export default function TrackerScreen() {
  const s = useStore();
  const id = useRoute().parts[1];
  const t = s.tracker(id);

  if (!t) {
    return (
      <div className="goal">
        <ScreenHeader title={tr("Цели")} back={() => back("/goals")} />
        <EmptyState title={tr("Цель удалена")} mood="sad" action={tr("К целям")} onAction={() => back("/goals")} />
      </div>
    );
  }

  const color = colorOf(t.color, "lavender");
  const fg = onColor(color);
  const remove = async () => {
    if (!(await confirm(tr("Удалить цель со всей историей?")))) return;
    void s.delete("trackers", t.id);
    back("/goals");
  };

  return (
    <div className="goal">
      <ScreenHeader title={tr("Цель")} sub={t.archived ? tr("Архив") : t.sphere === "work" ? tr("Работа") : tr("Личное")} back={() => back("/goals")}>
        <RoundButton icon="pencil" label={tr("Изменить")} onClick={() => void showTrackerEditor({ tracker: t })} />
        <RoundButton icon={t.archived ? "unarchive" : "archive"} label={t.archived ? tr("Вернуть из архива") : tr("В архив")} onClick={() => void s.update("trackers", t.id, { archived: !t.archived })} />
        <RoundButton icon="trash" label={tr("Удалить")} onClick={remove} className="goal-danger" />
      </ScreenHeader>

      <div className="goal-layout">
        <div className="goal-side">
          <Card color={color} seed={3} padding={18} className="goal-hero">
            <div className="goal-hero-head">
              <Icon name={t.icon} size={26} />
              <h2>{t.title}</h2>
            </div>
            {t.deadline && <p className="goal-hero-deadline">{tr("Срок: {0} · {1}", [fmtDay(t.deadline), relDay(t.deadline)])}</p>}
            {t.notes && <p className="goal-hero-notes">{t.notes}</p>}
            <div className="goal-hero-body">
              {(t.kind === "money" || t.kind === "counter") && <AmountHero t={t} fg={fg} />}
              {t.kind === "stages" && <StagesHero t={t} fg={fg} />}
              {t.kind === "habit" && <HabitHero t={t} />}
            </div>
          </Card>
          <GiftLink t={t} />
          {(t.kind === "money" || t.kind === "counter") && (
            <div className="goal-actions">
              {t.kind === "counter" && <Button color={t.color} className="goal-plus-one" onClick={() => void store.insert("tracker_entries", { tracker_id: t.id, amount: 1, note: "", entry_on: dateOnly(new Date()) })}>+1</Button>}
              <Button icon="add" color="sage" expand onClick={() => void showEntrySheet(t, 1)}>{tr("Добавить")}</Button>
              <Button icon="minus" ghost expand onClick={() => void showEntrySheet(t, -1)}>{tr("Снять")}</Button>
            </div>
          )}
          {t.kind === "habit" && <HabitToday t={t} />}
        </div>

        <div className="goal-main">
          {(t.kind === "money" || t.kind === "counter") && <History t={t} />}
          {t.kind === "stages" && <Stages t={t} />}
          {t.kind === "habit" && (
            <>
              <SectionTitle>{tr("Последние 16 недель")}</SectionTitle>
              <HabitGrid t={t} color={color} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- итог на листе цели

function AmountHero({ t, fg }: { t: Tracker; fg: string }) {
  const s = useStore();
  const sum = s.trackerSum(t.id);
  const target = t.target ?? 0;
  const shown = useGrown(sum);
  const ratio = useGrown(target > 0 ? sum / target : 0);
  const fc = forecast(t, sum, s.entriesOf(t.id));
  return (
    <>
      <div className="goal-big"><CountUp value={shown} format={fmtCounting(t, sum)} ms={900} /></div>
      {target > 0 && <p className="goal-hero-line">{tr("из {0} · осталось {1}", [fmtAmount(t, target), fmtAmount(t, Math.max(0, target - sum))])}</p>}
      {target > 0 && <div className="goal-hero-bar"><Progress value={ratio} color={fg} height={14} /></div>}
      {fc && <p className="goal-hero-forecast">{fc.full}</p>}
    </>
  );
}

function StagesHero({ t, fg }: { t: Tracker; fg: string }) {
  const s = useStore();
  const st = s.stagesOf(t.id);
  const done = st.filter((x) => x.status === "done").length;
  const shown = useGrown(done);
  const ratio = useGrown(st.length ? done / st.length : 0);
  return (
    <>
      <div className="goal-big"><CountUp value={shown} /> / {st.length}</div>
      <p className="goal-hero-line">{tr("этапов пройдено")}</p>
      <div className="goal-hero-bar"><Progress value={ratio} color={fg} height={14} /></div>
    </>
  );
}

function HabitHero({ t }: { t: Tracker }) {
  const s = useStore();
  const { streak, week } = habitStats(s.entriesOf(t.id));
  const a = useGrown(streak), b = useGrown(week);
  return (
    <div className="goal-hero-pair">
      <div>
        <div className="goal-big"><CountUp value={a} /></div>
        <p className="goal-hero-line">{streakLabel(streak)}</p>
      </div>
      <div>
        <div className="goal-big"><CountUp value={b} />{t.target != null ? `/${Math.trunc(t.target)}` : ""}</div>
        <p className="goal-hero-line">{tr("за 7 дней")}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- деньги и счётчик

function showEntrySheet(t: Tracker, sign: 1 | -1): Promise<void> {
  return openSheet<void>((close) => <EntrySheet t={t} sign={sign} close={() => close()} />).then(() => undefined);
}

function EntrySheet({ t, sign, close }: { t: Tracker; sign: 1 | -1; close: () => void }) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [bad, setBad] = useState(false);
  const save = () => {
    const v = parseMoney(amount);
    if (v == null || v === 0) return setBad(true);
    // дата ставится сразу: запись появляется в истории до ответа сервера
    void store.insert("tracker_entries", { tracker_id: t.id, amount: Math.abs(v) * sign, note: note.trim(), entry_on: dateOnly(new Date()) });
    close();
  };
  return (
    <>
      <SheetHeader title={sign > 0 ? tr("Добавить") : tr("Снять")} sub={t.title} close={close} />
      <Field label={tr("Сколько")} value={amount} onChange={(v) => { setAmount(v); setBad(false); }} inputMode="decimal" suffix={t.unit ?? undefined} autoFocus onEnter={save} error={bad ? tr("Введи число") : null} />
      <Field label={tr("Комментарий")} value={note} onChange={setNote} onEnter={save} />
      <div className="goals-ed-save">
        <Button expand onClick={save}>{tr("Сохранить")}</Button>
      </div>
    </>
  );
}

function History({ t }: { t: Tracker }) {
  const s = useStore();
  const es = [...s.entriesOf(t.id)].sort((a, b) => b.on.getTime() - a.on.getTime() || String(b.raw.created_at ?? "").localeCompare(String(a.raw.created_at ?? "")));
  const remove = async (e: Entry) => {
    if (await confirm(tr("Удалить запись?"))) void s.delete("tracker_entries", e.id);
  };
  return (
    <>
      <SectionTitle>{tr("История")}</SectionTitle>
      {es.length === 0 && <p className="goal-hint">{tr("Пока ни одной записи.")}</p>}
      <div className="goal-history">
        {es.map((e, i) => (
          <Appear key={e.id} i={i}>
            <div className="goal-entry">
              <span className={"goal-entry-ico " + (e.amount >= 0 ? "up" : "down")}><Icon name={e.amount >= 0 ? "arrow-up-circle" : "arrow-down-circle"} size={30} /></span>
              <div className="goal-entry-text">
                <b>{fmtEntry(t, e.amount)}</b>
                <span>{[fmtDay(e.on), e.note].filter(Boolean).join(" · ")}</span>
              </div>
              <RoundButton icon="trash" size={36} label={tr("Удалить")} onClick={() => void remove(e)} className="goal-entry-del" />
            </div>
          </Appear>
        ))}
      </div>
    </>
  );
}

// ---------------------------------------------------------------- этапы

function Stages({ t }: { t: Tracker }) {
  const s = useStore();
  const st = s.stagesOf(t.id);
  return (
    <>
      <SectionTitle trailing={<RoundButton icon="plus" size={36} label={tr("Новый этап")} onClick={() => void showStageEditor({ trackerId: t.id })} />}>{tr("Этапы")}</SectionTitle>
      <div className="goal-stages">
        {st.map((x, i) => <Appear key={x.id} i={i}><StageRow stage={x} last={i === st.length - 1} /></Appear>)}
      </div>
      <p className="goal-hint">{tr("Тап по кружку — следующий статус. Тап по этапу — дата, заметки, «решающая дата».")}</p>
    </>
  );
}

function StageRow({ stage: st, last }: { stage: Stage; last: boolean }) {
  const done = st.status === "done";
  const active = st.status === "active";
  const left = st.dueOn ? daysLeft(st.dueOn) : null;
  const hot = st.critical && !done && left != null && left >= 0 && left <= 7;
  const next = () => {
    const to = st.status === "todo" ? "active" : st.status === "active" ? "done" : "todo";
    void store.update("tracker_stages", st.id, { status: to, done_at: to === "done" ? new Date().toISOString() : null });
  };
  const when = left == null || done ? "" : tr(" · {0}", [left < 0 ? tr("прошло {0} дн.", [-left]) : left === 0 ? tr("СЕГОДНЯ") : tr("через {0} {1}", [left, plural(left, tr("день"), tr("дня"), tr("дней"))])]);
  const statusName = done ? tr("Готово") : active ? tr("Сейчас") : tr("Впереди");
  return (
    <div className={"goal-stage" + (done ? " done" : "") + (active ? " active" : "") + (st.critical && !done ? " critical" : "")}>
      <div className="goal-stage-rail">
        <button type="button" className="goal-stage-dot" aria-label={`${tr("Статус")}: ${statusName}`} title={`${tr("Статус")}: ${statusName}`} onClick={next}>
          <span className="i-done"><Icon name="tick" size={17} strokeWidth={3} /></span>
          <span className="i-active"><Icon name="play" size={12} fill /></span>
        </button>
        {!last && <span className="goal-stage-line" />}
      </div>
      <Card color={hot ? "#C8402A" : active ? "butter" : null} lift={2} seed={seedOf(st.id)} padding="12px 14px" className="goal-stage-card" onClick={() => void showStageEditor({ trackerId: st.trackerId, stage: st })}>
        <div className="goal-stage-head">
          <b>{st.title}</b>
          {st.critical && !done && <Tag color={hot ? "#F6F0E3" : "#C8402A"} filled={!hot}>{tr("РЕШАЮЩАЯ")}</Tag>}
        </div>
        {st.dueOn && <p className="goal-stage-date">{fmtDay(st.dueOn)}{when}</p>}
        {st.notes && <p className="goal-stage-notes">{st.notes}</p>}
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------- привычка

function toggleDay(trackerId: string, d: Date) {
  const key = dateOnly(d);
  const e = store.entriesOf(trackerId).find((x) => dateOnly(x.on) === key);
  if (e) void store.delete("tracker_entries", e.id);
  else void store.insert("tracker_entries", { tracker_id: trackerId, amount: 1, entry_on: key });
}

function HabitToday({ t }: { t: Tracker }) {
  const s = useStore();
  const today = dateOnly(new Date());
  const done = s.entriesOf(t.id).some((e) => dateOnly(e.on) === today);
  return (
    <div className="goal-actions">
      <Button expand color={done ? "sage" : null} icon={done ? "tick" : undefined} onClick={() => toggleDay(t.id, new Date())}>
        {done ? noTick(tr("Сегодня отмечено ✓")) : tr("Отметить сегодня")}
      </Button>
    </div>
  );
}

function HabitGrid({ t, color }: { t: Tracker; color: string }) {
  const s = useStore();
  const days = new Set(s.entriesOf(t.id).map((e) => dateOnly(e.on)));
  const end = day0(new Date());
  const start = addDays(end, -(7 * 15 + (weekday(end) - 1)));
  return (
    <Card seed={9} className="goal-grid" style={{ ["--habit" as string]: color }}>
      {[0, 1, 2, 3, 4, 5, 6].map((wd) => (
        <div key={wd} className="goal-grid-row">
          <span className="goal-grid-wd">{fmtWeekdayLetter(new Date(2024, 0, 1 + wd))}</span>
          {Array.from({ length: 16 }, (_, w) => {
            const d = addDays(start, w * 7 + wd);
            const future = d > end;
            const on = days.has(dateOnly(d));
            return (
              <button key={w} type="button" disabled={future} aria-pressed={on} aria-label={fmtDay(d)} title={future ? undefined : fmtDay(d)}
                className={"goal-cell" + (on ? " on" : "") + (future ? " future" : "") + (sameDate(d, end) ? " today" : "")}
                style={{ animationDelay: `${w * 18 + wd * 8}ms` }} onClick={() => toggleDay(t.id, d)}>
                <span />
              </button>
            );
          })}
        </div>
      ))}
    </Card>
  );
}
