// Редакторы раздела «Проекты»: клиент, проект, оплата, задача (порт app/lib/screens/projects/editors.dart и task_editor.dart).
import { useState } from "react";
import { tr } from "@/i18n";
import { Button, ChoiceRow, Collapse, ColorChoice, DateTimeRow, Field, IconChoice, Pill, SheetHeader, Switch, confirm, openSheet, projectIcons, sphereColor, toast } from "@/ui";
import { useStore } from "../../data/store";
import type { Client, Payment, Project, Row, Sphere, Task } from "../../data/models";
import { dateOnly, type RepeatRule } from "../../data/repeat";
import { currencies, money } from "../../format";
import { RepeatPicker } from "../../widgets/RepeatPicker";
import { Plans, showPlans } from "../plans/plans";
import "./projects.css";

export const parseMoney = (v: string): number | null => {
  const t = v.replace(/[\s  ]/g, "").replace(",", ".");
  if (!/^-?\d*\.?\d+$|^-?\d+\.$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};
export const moneyField = (v: number) => (v === Math.round(v) ? String(Math.round(v)) : v.toFixed(2));

const nz = (v: string) => v.trim() || null;
const spheres = (): [Sphere, string, string][] => [["work", tr("Работа"), sphereColor("work")], ["personal", tr("Личное"), sphereColor("personal")]];
const remindOptions = (): [number | null, string][] => [[null, tr("Нет")], [0, tr("В момент")], [5, tr("5 мин")], [15, tr("15 мин")], [30, tr("30 мин")], [60, tr("Час")], [1440, tr("За день")]];

// ---------------------------------------------------------------- клиент

export function showClientEditor(client?: Client): Promise<void> {
  return openSheet<void>((close) => <ClientEditor c={client} close={() => close()} />).then(() => {});
}

function ClientEditor({ c, close }: { c?: Client; close: () => void }) {
  const s = useStore();
  const [name, setName] = useState(c?.name ?? "");
  const [company, setCompany] = useState(c?.company ?? "");
  const [phone, setPhone] = useState(c?.phone ?? "");
  const [email, setEmail] = useState(c?.email ?? "");
  const [notes, setNotes] = useState(c?.notes ?? "");
  const [color, setColor] = useState(() => c?.color ?? ["clay", "teal", "lavender", "sage", "navy", "orange"][s.clients.length % 6]);

  const save = () => {
    if (!name.trim()) return toast(tr("Как зовут клиента?"));
    const row: Row = { name: name.trim(), company: nz(company), phone: nz(phone), email: nz(email), notes: notes.trim(), color };
    void (c ? s.update("clients", c.id, row) : s.insert("clients", row));
    close();
  };

  return (
    <>
      <SheetHeader title={c ? tr("Клиент") : tr("Новый клиент")} action={tr("Сохранить")} onAction={save} close={close} />
      <Field label={tr("Имя")} value={name} onChange={setName} autoFocus={!c} onEnter={save} autoComplete="off" />
      <Field label={tr("Компания")} value={company} onChange={setCompany} onEnter={save} autoComplete="off" />
      <Field label={tr("Телефон")} value={phone} onChange={setPhone} type="tel" inputMode="tel" onEnter={save} autoComplete="off" />
      <Field label={tr("Почта")} value={email} onChange={setEmail} type="email" inputMode="email" onEnter={save} autoComplete="off" />
      <Field label={tr("Что важно помнить")} value={notes} onChange={setNotes} maxLines={4} />
      <ColorChoice value={color} onChange={setColor} />
      <Button expand className="pj-save" onClick={save}>{tr("Сохранить")}</Button>
    </>
  );
}

// ---------------------------------------------------------------- проект

export function showProjectEditor({ project, clientId }: { project?: Project; clientId?: string } = {}): Promise<void> {
  if (!project && !Plans.allow("projects")) return Promise.resolve();
  return openSheet<void>((close) => <ProjectEditor p={project} clientId={clientId} close={() => close()} />, { side: true }).then(() => {});
}

function ProjectEditor({ p, clientId: initialClient, close }: { p?: Project; clientId?: string; close: () => void }) {
  const s = useStore();
  const [name, setName] = useState(p?.name ?? "");
  const [desc, setDesc] = useState(p?.description ?? "");
  const [budget, setBudget] = useState(!p || p.budget === 0 ? "" : moneyField(p.budget));
  const [currency, setCurrency] = useState(p?.currency ?? s.profile?.currency ?? "PLN");
  const [clientId, setClientId] = useState<string | null>(p?.clientId ?? initialClient ?? null);
  const [deadline, setDeadline] = useState<Date | null>(p?.deadline ?? null);
  const [status, setStatus] = useState(p?.status ?? "active");
  const [sphere, setSphere] = useState<Sphere>(p?.sphere ?? "work");
  const [color, setColor] = useState(() => p?.color ?? ["orange", "lavender", "sage", "teal", "mustard", "clay"][s.projects.length % 6]);
  const [icon, setIcon] = useState(p?.icon ?? "briefcase");

  const save = () => {
    if (!name.trim()) return toast(tr("Как называется проект?"));
    const row: Row = {
      name: name.trim(), description: desc.trim(), budget: parseMoney(budget) ?? 0, currency, client_id: clientId,
      deadline: deadline ? dateOnly(deadline) : null, status, sphere, color, icon,
    };
    void (p ? s.update("projects", p.id, row) : s.insert("projects", row));
    close();
  };

  const clients = s.clients.filter((c) => !c.archived || c.id === clientId);
  return (
    <>
      <SheetHeader title={p ? tr("Проект") : tr("Новый проект")} action={tr("Сохранить")} onAction={save} close={close} />
      <Field label={tr("Название")} value={name} onChange={setName} autoFocus={!p} onEnter={save} autoComplete="off" />
      {s.clients.length > 0 && (
        <ChoiceRow<string | null> label={tr("Клиент")} value={clientId} onChange={setClientId}
          options={[[null, tr("Без клиента")], ...clients.map((c): [string | null, string, string] => [c.id, c.name, c.color])]} />
      )}
      <Field label={tr("Сколько должны заплатить всего")} value={budget} onChange={setBudget} inputMode="decimal" suffix={currency} onEnter={save} autoComplete="off" />
      <ChoiceRow label={tr("Валюта")} value={currency} onChange={setCurrency} options={currencies.map((c): [string, string] => [c, c])} />
      <DateTimeRow label={tr("Дедлайн")} value={deadline} withTime={false} clearable onChange={setDeadline} />
      <ChoiceRow label={tr("Статус")} value={status} onChange={setStatus} options={[["active", tr("В работе"), "teal"], ["paused", tr("Пауза"), "mustard"], ["done", tr("Завершён"), "sage"]]} />
      <ChoiceRow<Sphere> label={tr("Календарь")} value={sphere} onChange={setSphere} options={spheres()} />
      <Field label={tr("Описание")} value={desc} onChange={setDesc} maxLines={4} />
      <IconChoice value={icon} icons={projectIcons} color={color} onChange={setIcon} locked={Plans.iconLocked} onLocked={() => void showPlans()} />
      <ColorChoice value={color} onChange={setColor} />
      <Button expand className="pj-save" onClick={save}>{tr("Сохранить")}</Button>
    </>
  );
}

// ---------------------------------------------------------------- оплата

export function showPaymentEditor({ projectId, payment }: { projectId: string; payment?: Payment }): Promise<void> {
  return openSheet<void>((close) => <PaymentEditor projectId={projectId} pay={payment} close={() => close()} />).then(() => {});
}

function PaymentEditor({ projectId, pay, close }: { projectId: string; pay?: Payment; close: () => void }) {
  const s = useStore();
  const project = s.project(projectId);
  const [amount, setAmount] = useState(pay ? moneyField(pay.amount) : "");
  const [note, setNote] = useState(pay?.note ?? "");
  const [on, setOn] = useState<Date>(pay?.paidOn ?? new Date());
  const cur = project?.currency ?? s.profile?.currency ?? "PLN";
  const due = project ? s.dueOf(project) : 0;

  const save = () => {
    const a = parseMoney(amount);
    if (a == null || a === 0) return toast(tr("Сколько заплатили?"));
    const row: Row = { project_id: projectId, amount: a, paid_on: dateOnly(on), note: note.trim() };
    void (pay ? s.update("payments", pay.id, row) : s.insert("payments", row));
    close();
  };
  const remove = async () => {
    if (!pay || !(await confirm(tr("Удалить оплату?")))) return;
    void s.delete("payments", pay.id);
    close();
  };

  const quick = !pay && due > 0.009;
  return (
    <>
      <SheetHeader title={pay ? tr("Оплата") : tr("Оплата получена")} sub={project?.name} action={tr("Сохранить")} onAction={save} close={close} />
      <Field label={tr("Сумма на руки")} value={amount} onChange={setAmount} inputMode="decimal" suffix={cur} autoFocus={!pay} onEnter={save} autoComplete="off" />
      {quick && (
        <div className="pj-quick">
          <Pill dense onClick={() => setAmount(moneyField(due))}>{tr("Весь остаток · {0}", [money(due, cur)])}</Pill>
          {due > 1 && <Pill dense onClick={() => setAmount(moneyField(Math.round((due / 2) * 100) / 100))}>{tr("Половина")}</Pill>}
        </div>
      )}
      <DateTimeRow label={tr("Когда")} value={on} withTime={false} onChange={(v) => setOn(v ?? new Date())} />
      <Field label={tr("Комментарий")} hint={tr("наличка, перевод, аванс…")} value={note} onChange={setNote} onEnter={save} autoComplete="off" />
      <Button expand color="sage" icon="coin" className="pj-save" onClick={save}>{tr("Сохранить")}</Button>
      {pay && <button type="button" className="pj-textbtn danger" onClick={() => void remove()}>{tr("Удалить оплату")}</button>}
    </>
  );
}

// ---------------------------------------------------------------- задача

export function showTaskEditor({ task, projectId, day }: { task?: Task; projectId?: string; day?: Date } = {}): Promise<void> {
  return openSheet<void>((close) => <TaskEditor t={task} projectId={projectId} day={day} close={() => close()} />, { side: true }).then(() => {});
}

function TaskEditor({ t, projectId: initialProject, day, close }: { t?: Task; projectId?: string; day?: Date; close: () => void }) {
  const s = useStore();
  const [title, setTitle] = useState(t?.title ?? "");
  const [notes, setNotes] = useState(t?.notes ?? "");
  const [projectId, setProjectId] = useState<string | null>(t?.projectId ?? initialProject ?? null);
  const [due, setDue] = useState<Date | null>(t?.dueAt ?? day ?? null);
  const [withTime, setWithTime] = useState(t ? !t.allDay : false);
  const [important, setImportant] = useState(t?.important ?? false);
  const [sphere, setSphere] = useState<Sphere>(() => t?.sphere ?? s.project(initialProject)?.sphere ?? "work");
  const [repeat, setRepeat] = useState<RepeatRule | null>(t?.repeat ?? null);
  const [remind, setRemind] = useState<number | null>(() => t?.remindMinutes ?? s.profile?.remindDefault ?? null);

  const save = () => {
    if (!title.trim()) return toast(tr("Что нужно сделать?"));
    const at = !due ? null : withTime ? due : new Date(due.getFullYear(), due.getMonth(), due.getDate(), 12);
    const row: Row = {
      title: title.trim(), notes: notes.trim(), project_id: projectId, due_at: at?.toISOString() ?? null, all_day: !withTime,
      priority: important ? "important" : "normal", sphere, repeat: at ? repeat?.toJson() ?? null : null, remind_minutes: withTime ? remind : null,
    };
    void (t ? s.update("tasks", t.id, row) : s.insert("tasks", row));
    close();
  };
  const remove = async () => {
    if (!t || !(await confirm(tr("Удалить задачу?")))) return;
    void s.delete("tasks", t.id);
    close();
  };
  /** «Ко времени»: у срока без времени (полночь или полдень «весь день») подставляем утро. */
  const toggleTime = (v: boolean) => {
    setWithTime(v);
    if (v && due && (t?.allDay ?? true) && due.getMinutes() === 0 && (due.getHours() === 0 || due.getHours() === 12)) setDue(new Date(due.getFullYear(), due.getMonth(), due.getDate(), 9));
  };

  const reminds = remindOptions();
  if (remind != null && !reminds.some(([v]) => v === remind)) reminds.push([remind, tr("{0} мин", [remind])]);
  const projects = s.projects.filter((p) => p.status !== "done" || p.id === projectId);
  const hasDue = !!due;
  return (
    <>
      <SheetHeader title={t ? tr("Задача") : tr("Новая задача")} action={tr("Сохранить")} onAction={save} close={close} />
      <Field label={tr("Что сделать")} value={title} onChange={setTitle} autoFocus={!t} onEnter={save} autoComplete="off" />
      <ChoiceRow label={tr("Важность")} value={important} onChange={setImportant} options={[[false, tr("Обычное")], [true, tr("Важное"), "#C8402A"]]} />
      <DateTimeRow label={tr("Срок")} value={due} withTime={withTime} clearable onChange={setDue} />
      <Collapse open={hasDue}>
        <div inert={!hasDue}>
          <div className="pj-switch">
            <span>{tr("Ко времени")}</span>
            <Switch value={withTime} onChange={toggleTime} label={tr("Ко времени")} />
          </div>
          <Collapse open={withTime}>
            <div inert={!withTime}>
              <ChoiceRow<number | null> label={tr("Напомнить")} value={remind} onChange={setRemind} options={reminds} />
            </div>
          </Collapse>
          <RepeatPicker value={repeat} start={due ?? new Date()} onChange={setRepeat} />
          <p className="pj-hint">{tr("Задача со сроком сразу появится в календаре. Повторяющаяся после галочки переедет на следующий раз.")}</p>
        </div>
      </Collapse>
      <ChoiceRow<Sphere> label={tr("Календарь")} value={sphere} onChange={setSphere} options={spheres()} />
      {s.projects.length > 0 && (
        <ChoiceRow<string | null> label={tr("Проект")} value={projectId} onChange={setProjectId}
          options={[[null, tr("Без проекта")], ...projects.map((p): [string | null, string, string] => [p.id, p.name, p.color])]} />
      )}
      <Field label={tr("Подробности")} value={notes} onChange={setNotes} maxLines={4} />
      <Button expand className="pj-save" onClick={save}>{tr("Сохранить")}</Button>
      {t && <button type="button" className="pj-textbtn danger" onClick={() => void remove()}>{tr("Удалить задачу")}</button>}
    </>
  );
}
