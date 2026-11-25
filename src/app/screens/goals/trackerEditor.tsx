// Редактор цели, выбор шаблона и лист этапа — порт app/lib/screens/goals/tracker_editor.dart и TemplatePickerSheet.
import { useRef, useState } from "react";
import { tr } from "@/i18n";
import { Appear, Button, Card, ChoiceRow, Collapse, ColorChoice, DateTimeRow, Field, Icon, IconChoice, P, SheetHeader, confirm, openSheet, toast } from "@/ui";
import type { Sphere, Stage, Tracker, TrackerKind } from "../../data/models";
import { dateOnly } from "../../data/repeat";
import { store } from "../../data/store";
import { currencies } from "../../format";
import { Plans, showPlans } from "../plans/plans";
import { moneyField, parseMoney } from "./goalsLib";
import "./goals.css";

/** Шаблоны трекеров: чтобы не думать с нуля. */
export interface TrackerTemplate {
  name: string;
  hint: string;
  kind: TrackerKind;
  icon: string;
  color: string;
  unit?: string;
  /** [название, решающая дата] */
  stages: [string, boolean][];
  sphere: Sphere;
  /** Заготовка названия («Дело №»). */
  title?: string;
}

const tpl = (name: string, hint: string, kind: TrackerKind, icon: string, color: string, o: Partial<TrackerTemplate> = {}): TrackerTemplate => ({ name, hint, kind, icon, color, stages: [], sphere: "personal", ...o });

/** Функция, а не константа: названия зависят от языка. */
export const trackerTemplates = (): TrackerTemplate[] => [
  tpl(tr("Накопить деньги"), tr("Отпуск, машина, подушка"), "money", "coin", "sage", { unit: "PLN" }),
  tpl(tr("Судебное дело"), tr("Этапы и решающие даты"), "stages", "scale", "navy", {
    title: tr("Дело №"),
    stages: [
      [tr("Подготовка документов"), false],
      [tr("Подача иска / ответа"), true],
      [tr("Предварительное заседание"), true],
      [tr("Основное заседание"), true],
      [tr("Решение суда"), false],
      [tr("Срок на апелляцию"), true],
    ],
  }),
  tpl(tr("Цель по этапам"), tr("Большая цель шаг за шагом"), "stages", "flag", "lavender", {
    stages: [[tr("Шаг 1"), false], [tr("Шаг 2"), false], [tr("Шаг 3"), false]],
  }),
  tpl(tr("Документы / оформление"), tr("Виза, ВНЖ, регистрация фирмы"), "stages", "book", "teal", {
    stages: [
      [tr("Собрать документы"), false],
      [tr("Подать заявление"), true],
      [tr("Ожидание решения"), false],
      [tr("Забрать документ"), true],
    ],
  }),
  tpl(tr("Привычка"), tr("Спорт, чтение, без сахара"), "habit", "run", "orange"),
  tpl(tr("Счётчик"), tr("Книги, километры, клиенты"), "counter", "sun", "mustard", { unit: tr("шт") }),
];

/** Лист «Что будем отслеживать?» → выбранный шаблон. */
export function pickTemplate(): Promise<TrackerTemplate | undefined> {
  return openSheet<TrackerTemplate>((close) => (
    <>
      <SheetHeader title={tr("Что будем отслеживать?")} close={() => close()} />
      <div className="goals-tpl-grid">
        {trackerTemplates().map((t, i) => (
          <Appear key={t.name} i={i}>
            <Card color={t.color} seed={200 + i} onClick={() => close(t)} className="goals-tpl">
              <Icon name={t.icon} size={26} />
              <div className="goals-tpl-text">
                <b>{t.name}</b>
                <span>{t.hint}</span>
              </div>
            </Card>
          </Appear>
        ))}
      </div>
    </>
  ), { wide: true });
}

/** Открыть редактор и вернуть id сохранённой цели (undefined — закрыли). Лимит тарифа здесь не проверяется. */
export function editTracker(o: { tracker?: Tracker; template?: TrackerTemplate } = {}): Promise<string | undefined> {
  return openSheet<string>((close) => <TrackerEditor tracker={o.tracker} template={o.template} close={close} />, { side: true });
}

/** Новая цель: лимит тарифа → шаблон → редактор. Возвращает id созданной цели. */
export async function newTracker(): Promise<string | undefined> {
  if (!Plans.allow("trackers")) return undefined;
  const t = await pickTemplate();
  if (!t) return undefined;
  return editTracker({ template: t });
}

/** Редактор цели; без tracker — сначала выбор шаблона. */
export async function showTrackerEditor(o: { tracker?: Tracker } = {}): Promise<void> {
  if (o.tracker) await editTracker({ tracker: o.tracker });
  else await newTracker();
}

let stageSeq = 1;

function TrackerEditor({ tracker: t, template, close }: { tracker?: Tracker; template?: TrackerTemplate; close: (id?: string) => void }) {
  const [title, setTitle] = useState(t?.title ?? template?.title ?? "");
  const [target, setTarget] = useState(t?.target == null ? "" : moneyField(t.target));
  const [unit, setUnit] = useState(t?.unit ?? template?.unit ?? "");
  const [notes, setNotes] = useState(t?.notes ?? "");
  const [kind, setKind] = useState<TrackerKind>(t?.kind ?? template?.kind ?? "stages");
  const [icon, setIcon] = useState(t?.icon ?? template?.icon ?? "star");
  const [color, setColor] = useState(t?.color ?? template?.color ?? "lavender");
  const [sphere, setSphere] = useState<Sphere>(t?.sphere ?? template?.sphere ?? "personal");
  const [deadline, setDeadline] = useState<Date | null>(t?.deadline ?? null);
  const [stages, setStages] = useState(() => (template?.stages ?? []).map(([name, critical]) => ({ k: stageSeq++, name, critical })));
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);

  const save = async () => {
    if (saving.current) return;
    if (!title.trim()) return toast(tr("Как назовём?"));
    saving.current = true;
    setBusy(true);
    const row = {
      title: title.trim(),
      kind,
      icon,
      color,
      sphere,
      target: parseMoney(target),
      unit: unit.trim() ? unit.trim() : null,
      deadline: deadline ? dateOnly(deadline) : null,
      notes: notes.trim(),
    };
    let id: string;
    if (!t) {
      id = await store.insert("trackers", row);
      // сервер мог отказать (лимит тарифа) — тогда строка уже откатилась и этапы создавать не для чего
      if (!store.tracker(id)) { saving.current = false; setBusy(false); return; }
      let pos = 0;
      for (const st of stages) {
        const i = pos++;
        if (!st.name.trim()) continue;
        await store.insert("tracker_stages", { tracker_id: id, title: st.name.trim(), position: i, critical: st.critical, status: i === 0 ? "active" : "todo" });
      }
    } else {
      await store.update("trackers", t.id, row);
      id = t.id;
    }
    close(id);
  };

  const needsTarget = kind === "money" || kind === "counter" || kind === "habit";
  const isNew = !t;

  return (
    <>
      <SheetHeader title={isNew ? (template?.name ?? tr("Новая цель")) : tr("Цель")} action={tr("Сохранить")} onAction={save} busy={busy} close={() => close()} />
      <Field label={tr("Название")} value={title} onChange={setTitle} hint={template?.hint} autoFocus onEnter={save} />
      {isNew && !template && (
        <ChoiceRow<TrackerKind> label={tr("Тип")} value={kind} onChange={setKind}
          options={[["money", tr("Деньги")], ["stages", tr("Этапы")], ["counter", tr("Счётчик")], ["habit", tr("Привычка")]]} />
      )}
      <Collapse open={needsTarget}>
        <Field label={kind === "money" ? tr("Сколько нужно собрать") : kind === "habit" ? tr("Раз в неделю (цель)") : tr("Цель")} value={target} onChange={setTarget} inputMode="decimal"
          suffix={kind === "habit" ? tr("раз") : undefined} />
      </Collapse>
      <Collapse open={kind === "money"}>
        <ChoiceRow<string> label={tr("Валюта")} value={unit || "PLN"} options={currencies.map((c) => [c, c] as [string, string])} onChange={setUnit} />
      </Collapse>
      <Collapse open={kind === "counter"}>
        <Field label={tr("Единица")} value={unit} onChange={setUnit} hint={tr("книг, км, страниц")} />
      </Collapse>
      <DateTimeRow label={kind === "stages" ? tr("Итоговый срок") : tr("Срок")} value={deadline} withTime={false} clearable onChange={setDeadline} />
      {isNew && (
        <Collapse open={kind === "stages"}>
          <div className="goals-ed-stages-head">
            <span>{tr("ЭТАПЫ")}</span>
            <button type="button" onClick={() => setStages((l) => [...l, { k: stageSeq++, name: "", critical: false }])}>{tr("+ этап")}</button>
          </div>
          {stages.map((st, i) => (
            <div key={st.k} className="goals-ed-stage">
              <b>{i + 1}.</b>
              <Field value={st.name} onChange={(v) => setStages((l) => l.map((x) => (x.k === st.k ? { ...x, name: v } : x)))} />
              <button type="button" className={"goals-ed-crit" + (st.critical ? " on" : "")} title={tr("Решающая дата")} aria-label={tr("Решающая дата")} aria-pressed={st.critical}
                onClick={() => setStages((l) => l.map((x) => (x.k === st.k ? { ...x, critical: !x.critical } : x)))}>!</button>
            </div>
          ))}
          <p className="goals-ed-hint">{tr("«!» — решающий этап: Оси напомнит за неделю, за день и утром. Даты этапов поставишь в самой цели.")}</p>
        </Collapse>
      )}
      <ChoiceRow<Sphere> label={tr("Сфера")} value={sphere} onChange={setSphere} options={[["work", tr("Работа"), P.work], ["personal", tr("Личное"), P.personal]]} />
      <IconChoice value={icon} color={color} onChange={setIcon} locked={Plans.iconLocked} onLocked={() => void showPlans()} />
      <ColorChoice value={color} onChange={setColor} />
      <Field label={tr("Заметки")} value={notes} onChange={setNotes} maxLines={4} />
      <div className="goals-ed-save">
        <Button expand busy={busy} onClick={save}>{tr("Сохранить")}</Button>
      </div>
    </>
  );
}

/** Лист этапа: новый или существующий. */
export function showStageEditor(o: { trackerId: string; stage?: Stage }): Promise<void> {
  return openSheet<void>((close) => <StageEditor trackerId={o.trackerId} stage={o.stage} close={() => close()} />).then(() => undefined);
}

function StageEditor({ trackerId, stage: st, close }: { trackerId: string; stage?: Stage; close: () => void }) {
  const [title, setTitle] = useState(st?.title ?? "");
  const [notes, setNotes] = useState(st?.notes ?? "");
  const [due, setDue] = useState<Date | null>(st?.dueOn ?? null);
  const [critical, setCritical] = useState(st?.critical ?? false);
  const [status, setStatus] = useState(st?.status ?? "todo");

  const save = () => {
    if (!title.trim()) return;
    const row = {
      title: title.trim(),
      notes: notes.trim(),
      due_on: due ? dateOnly(due) : null,
      critical,
      status,
      done_at: status === "done" ? new Date().toISOString() : null,
    };
    if (!st) void store.insert("tracker_stages", { ...row, tracker_id: trackerId, position: store.stagesOf(trackerId).length });
    else void store.update("tracker_stages", st.id, row);
    close();
  };

  return (
    <>
      <SheetHeader title={st ? tr("Этап") : tr("Новый этап")} action={tr("Сохранить")} onAction={save} close={close} />
      <Field label={tr("Что за этап")} value={title} onChange={setTitle} autoFocus={!st} onEnter={save} />
      <DateTimeRow label={tr("Дата")} value={due} withTime={false} clearable onChange={setDue} />
      <ChoiceRow<boolean> label={tr("Важность даты")} value={critical} onChange={setCritical} options={[[false, tr("Обычная")], [true, tr("Решающая — нельзя пропустить"), P.danger]]} />
      <ChoiceRow<string> label={tr("Статус")} value={status} onChange={setStatus} options={[["todo", tr("Впереди")], ["active", tr("Сейчас"), P.orange], ["done", tr("Готово"), P.sage]]} />
      <Field label={tr("Заметки (номер дела, зал, что взять)")} value={notes} onChange={setNotes} maxLines={4} />
      <div className="goals-ed-save">
        <Button expand onClick={save}>{tr("Сохранить")}</Button>
        {st && (
          <button type="button" className="goals-ed-delete" onClick={async () => {
            if (!(await confirm(tr("Удалить этап?")))) return;
            void store.delete("tracker_stages", st.id);
            close();
          }}>{tr("Удалить этап")}</button>
        )}
      </div>
    </>
  );
}
