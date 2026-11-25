// Редакторы раздела «Часы» — порт листов из app/lib/screens/hours/hours_screen.dart:
// работа (ставка, цвет, значок), смена по часам и задание за фиксированную цену.
import { useState, type ReactNode } from "react";
import { tr } from "@/i18n";
import { Button, Card, ChoiceRow, Collapse, ColorChoice, DateTimeRow, Field, IconChoice, Pill, SheetHeader, SlideSwitcher, colorOf, confirm, openSheet, sphereColor, toast } from "@/ui";
import { WorkSession, type Job, type Row, type Sphere, type WorkExtra } from "../../data/models";
import { addDays, dateOnly, day0 } from "../../data/repeat";
import { useStore } from "../../data/store";
import { currencies, fmtDay, money } from "../../format";
import { Plans, showPlans } from "../plans/plans";
import { fmtHoursText, moneyField, parseMoney } from "./util";
import "./hours.css";

// ---------------------------------------------------------------- редактор работы

export async function showJobEditor(job?: Job): Promise<void> {
  if (!job && !Plans.allow("jobs")) return;
  await openSheet((close) => <JobEditor job={job} close={() => close()} />);
}

function JobEditor({ job: j, close }: { job?: Job; close: () => void }) {
  const s = useStore();
  const [name, setName] = useState(j?.name ?? "");
  const [rate, setRate] = useState(!j || j.rate === 0 ? "" : moneyField(j.rate));
  const [currency, setCurrency] = useState(j?.currency ?? s.profile?.currency ?? "PLN");
  const [color, setColor] = useState(() => j?.color ?? ["teal", "sage", "lavender", "apricot", "sky", "plum"][s.jobs.length % 6]);
  const [icon, setIcon] = useState(j?.icon ?? "briefcase");
  const [sphere, setSphere] = useState<Sphere>(j?.sphere ?? "work");
  const [notes, setNotes] = useState(j?.notes ?? "");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const n = name.trim();
    if (!n) return toast(tr("Как называется работа?"));
    const row: Row = { name: n, rate: parseMoney(rate) ?? 0, currency, color, icon, sphere, notes: notes.trim() };
    setBusy(true);
    if (!j) await s.insert("jobs", row);
    else await s.update("jobs", j.id, row);
    close();
  };

  const archive = async () => {
    if (!j) return;
    await s.update("jobs", j.id, { archived: !j.archived });
    close();
  };

  const remove = async () => {
    if (!j) return;
    if (!(await confirm(tr("Удалить «{0}» вместе со всеми сменами?", [j.name])))) return;
    await s.delete("jobs", j.id);
    close();
  };

  return (
    <div className="hrs-editor">
      <SheetHeader title={j ? tr("Работа") : tr("Новая работа")} action={tr("Готово")} onAction={save} busy={busy} close={close} />
      <Field label={tr("Название")} hint={tr("Кафе «Липа», склад, фриланс…")} value={name} onChange={setName} autoFocus={!j} onEnter={save} maxLength={80} />
      <Field label={tr("Ставка в час")} value={rate} onChange={setRate} inputMode="decimal" suffix={currency} onEnter={save} />
      <ChoiceRow label={tr("Валюта")} value={currency} options={currencies.map((c) => [c, c, null])} onChange={setCurrency} />
      <ColorChoice value={color} onChange={setColor} />
      <IconChoice value={icon} color={color} onChange={setIcon} locked={Plans.iconLocked} onLocked={() => void showPlans()} />
      <ChoiceRow<Sphere> label={tr("Сфера")} value={sphere} options={[["work", tr("Работа"), sphereColor("work")], ["personal", tr("Личное"), sphereColor("personal")]]} onChange={setSphere} />
      <Field label={tr("Заметки")} hint={tr("Адрес, график, с кем договаривался…")} value={notes} onChange={setNotes} maxLines={4} />
      {j && <p className="hrs-note">{tr("Новая ставка действует для новых смен — прошлые считаются по старой.")}</p>}
      {j && (
        <div className="hrs-editor-actions">
          <Button ghost expand icon="archive" onClick={archive}>{j.archived ? tr("Вернуть из архива") : tr("В архив")}</Button>
          <Button ghost expand icon="trash" onClick={remove}>{tr("Удалить работу")}</Button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- смена или задание

/** Существующая смена или задание — их редактор. Новая запись — лист с выбором «Смена по часам / Задание за цену». */
export async function showShiftEditor(o: { session?: WorkSession; extra?: boolean; item?: WorkExtra; jobId?: string; day?: Date } = {}): Promise<void> {
  await openSheet((close) => {
    const done = () => close();
    if (o.session) return <ShiftEditor session={o.session} close={done} />;
    if (o.item) return <ExtraEditor extra={o.item} close={done} />;
    return <NewEntry jobId={o.jobId} day={o.day} extra={o.extra ?? false} close={done} />;
  });
}

function NewEntry({ jobId, day, extra: initial, close }: { jobId?: string; day?: Date; extra: boolean; close: () => void }) {
  const [extra, setExtra] = useState(initial);
  const top = (
    <div className="hrs-kind">
      <Pill dense icon="clock" selected={!extra} onClick={() => setExtra(false)}>{tr("Смена по часам")}</Pill>
      <Pill dense icon="star" selected={extra} onClick={() => setExtra(true)}>{tr("Задание за цену")}</Pill>
    </div>
  );
  return extra ? <ExtraEditor key="extra" jobId={jobId} day={day} top={top} close={close} /> : <ShiftEditor key="shift" jobId={jobId} day={day} top={top} close={close} />;
}

/** Работы для выбора: не из архива + та, что уже выбрана. */
function useJobChoice(jobId: string | null) {
  const s = useStore();
  return s.jobs.filter((j) => !j.archived || j.id === jobId).map((j): [string | null, string, string] => [j.id, j.name, colorOf(j.color, "teal")]);
}

function ShiftEditor({ session: x, jobId: initialJob, day, top, close }: { session?: WorkSession; jobId?: string; day?: Date; top?: ReactNode; close: () => void }) {
  const s = useStore();
  const [jobId, setJobId] = useState<string | null>(() => x?.jobId ?? initialJob ?? s.jobs.find((j) => !j.archived)?.id ?? null);
  const [start, setStart] = useState<Date>(() => { if (x) return x.start; const d = day ?? new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 9); });
  const [end, setEnd] = useState<Date | null>(() => (x ? x.end : new Date(start.getTime() + 8 * 3_600_000)));
  const [brk, setBrk] = useState(x?.breakMinutes ?? 0);
  const [note, setNote] = useState(x?.note ?? "");
  const rateFor = (id: string | null) => (x && x.jobId === id ? s.rateOf(x) : s.job(id)?.rate ?? 0);
  const [rate, setRate] = useState(() => { const r = rateFor(jobId); return r === 0 ? "" : moneyField(r); });
  const [rateTouched, setRateTouched] = useState(false);
  const [busy, setBusy] = useState(false);

  const jobs = useJobChoice(jobId);
  const j = s.job(jobId);
  // конец раньше начала — значит, смена через полночь
  const realEnd = end && end <= start ? addDays(end, 1) : end;
  const preview = new WorkSession({ job_id: jobId, started_at: start.toISOString(), ended_at: realEnd?.toISOString() ?? null, break_minutes: brk });
  const rateNum = parseMoney(rate) ?? 0;
  const breaks = [...new Set([0, 15, 30, 45, 60, brk])].sort((a, b) => a - b);

  const pickJob = (id: string | null) => {
    setJobId(id);
    const r = rateFor(id);
    setRate(r === 0 ? "" : moneyField(r));
    setRateTouched(false);
  };
  /** Поменяли день начала — конец переезжает на столько же дней. */
  const pickStart = (v: Date | null) => {
    if (!v) return;
    const shift = Math.round((day0(v).getTime() - day0(start).getTime()) / 86_400_000);
    if (end && shift) setEnd(addDays(end, shift));
    setStart(v);
  };

  const save = async () => {
    if (!jobId) return toast(tr("Сначала добавь работу"));
    const row: Row = { job_id: jobId, started_at: start.toISOString(), ended_at: realEnd?.toISOString() ?? null, break_minutes: brk, note: note.trim() };
    // ставка — на момент смены: у новой или перенесённой на другую работу — ставка работы, если её не поправили вручную
    if (!x || x.jobId !== jobId || rateTouched) row.rate = parseMoney(rate) ?? j?.rate ?? null;
    setBusy(true);
    if (!x) await s.insert("work_sessions", row);
    else await s.update("work_sessions", x.id, row);
    close();
  };

  const remove = async () => {
    if (!x || !(await confirm(tr("Удалить смену?")))) return;
    await s.delete("work_sessions", x.id);
    close();
  };

  return (
    <div className="hrs-editor">
      <SheetHeader title={x ? tr("Изменить смену") : tr("Новая запись")} action={tr("Готово")} onAction={save} busy={busy} close={close} />
      {top}
      <SlideSwitcher k="shift" dir={-1}>
        <ChoiceRow label={tr("Работа")} value={jobId} options={jobs} onChange={pickJob} />
        <DateTimeRow label={tr("Начало")} value={start} onChange={pickStart} />
        <Collapse open={end != null}>
          <DateTimeRow label={tr("Конец")} value={end} onChange={(v) => v && setEnd(v)} />
        </Collapse>
        <Collapse open={end == null}>
          <div className="hrs-ongoing">
            <b>{tr("Конец")}</b>
            <Pill dense icon="stop" onClick={() => setEnd(new Date())}>{tr("Идёт сейчас · закончить")}</Pill>
          </div>
        </Collapse>
        <Collapse open={!!realEnd && !!end && end <= start}>
          <p className="hrs-note">{realEnd ? tr("Смена через полночь — конец {0}", [fmtDay(realEnd)]) : ""}</p>
        </Collapse>
        <ChoiceRow label={tr("Перерыв")} value={brk} options={breaks.map((m) => [m, m === 0 ? tr("нет") : tr("{0} мин", [m]), null])} onChange={setBrk} />
        <Field label={tr("Ставка в час")} value={rate} onChange={(v) => { setRate(v); setRateTouched(true); }} inputMode="decimal" suffix={j?.currency ?? "PLN"} />
        <Field label={tr("Заметка")} hint={tr("Подмена, ночная, сверхурочно…")} value={note} onChange={setNote} onEnter={save} />
        <Card color="butter" seed={88} padding="12px 16px" className="hrs-preview">
          <b>{fmtHoursText(preview.hours())}</b>
          {j && <b>{money(preview.hours() * rateNum, j.currency)}</b>}
        </Card>
        {x && <div className="hrs-editor-actions"><Button ghost expand icon="trash" onClick={remove}>{tr("Удалить смену")}</Button></div>}
      </SlideSwitcher>
    </div>
  );
}

function ExtraEditor({ extra: x, jobId: initialJob, day: initialDay, top, close }: { extra?: WorkExtra; jobId?: string; day?: Date; top?: ReactNode; close: () => void }) {
  const s = useStore();
  const [jobId, setJobId] = useState<string | null>(() => x?.jobId ?? initialJob ?? s.jobs.find((j) => !j.archived)?.id ?? null);
  const [day, setDay] = useState<Date>(() => x?.day ?? initialDay ?? new Date());
  const [title, setTitle] = useState(x?.title ?? "");
  const [amount, setAmount] = useState(!x || x.amount === 0 ? "" : moneyField(x.amount));
  const [note, setNote] = useState(x?.note ?? "");
  const [busy, setBusy] = useState(false);

  const jobs = useJobChoice(jobId);
  const j = s.job(jobId);

  const save = async () => {
    if (!jobId) return toast(tr("Сначала добавь работу"));
    const t = title.trim();
    if (!t) return toast(tr("Что за задание?"));
    const a = parseMoney(amount);
    if (a == null || a <= 0) return toast(tr("Сколько за него платят?"));
    const row: Row = { job_id: jobId, done_on: dateOnly(day), title: t, amount: a, note: note.trim() };
    setBusy(true);
    if (!x) await s.insert("work_extras", row);
    else await s.update("work_extras", x.id, row);
    close();
  };

  const remove = async () => {
    if (!x || !(await confirm(tr("Удалить задание?")))) return;
    await s.delete("work_extras", x.id);
    close();
  };

  return (
    <div className="hrs-editor">
      <SheetHeader title={x ? tr("Задание") : tr("Новая запись")} action={tr("Готово")} onAction={save} busy={busy} close={close} />
      {top}
      <SlideSwitcher k="extra" dir={1}>
        <ChoiceRow label={tr("Работа")} value={jobId} options={jobs} onChange={setJobId} />
        <Field label={tr("Задание")} hint={tr("Разгрузить машину, остаться на инвентаризацию…")} value={title} onChange={setTitle} autoFocus={!x && !top} maxLength={200} />
        <Field label={tr("Цена")} value={amount} onChange={setAmount} inputMode="decimal" suffix={j?.currency ?? "PLN"} onEnter={save} />
        <DateTimeRow label={tr("Когда сделано")} value={day} withTime={false} onChange={(v) => v && setDay(v)} />
        <Field label={tr("Заметка")} hint={tr("Кто попросил, подробности…")} value={note} onChange={setNote} onEnter={save} />
        <p className="hrs-note">{tr("Платят за результат, а не за часы: сумма добавится к заработку и попадёт в рапорт отдельной строкой.")}</p>
        {x && <div className="hrs-editor-actions"><Button ghost expand icon="trash" onClick={remove}>{tr("Удалить задание")}</Button></div>}
      </SlideSwitcher>
    </div>
  );
}
