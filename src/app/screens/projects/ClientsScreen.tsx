// Проекты: клиенты → проекты → задачи и оплаты (порт app/lib/screens/projects/clients_screen.dart).
// Телефон — как в приложении (вкладки «Клиенты / Задачи»), ноутбук — сетка клиентов и колонка задач рядом.
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { plural, tr } from "@/i18n";
import { Appear, Button, Card, Check, Collapse, CountUp, EmptyState, Icon, ImportantTag, Pill, Progress, RoundButton, ScreenHeader, SectionTitle, SlideSwitcher, Tag, colorOf, onColor, sphereColor } from "@/ui";
import { useStore } from "../../data/store";
import type { Client, Project, Task } from "../../data/models";
import { day0 } from "../../data/repeat";
import { fmtDayShort, fmtRelDay, fmtTime, money } from "../../format";
import { nav } from "../../router";
import { showClientEditor, showProjectEditor, showTaskEditor } from "./editors";
import "./projects.css";

const PAPER_DEEP = "var(--paper-deep)";

/** Число 0..255 из id — какой из «вырезанных» краёв у листа (как id.hashCode & 0xff в приложении). */
export const seedOf = (id: string) => { let h = 0; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xff; return h; };

/** Сумма, которая досчитывается до значения. */
export function Money({ value, cur }: { value: number; cur: string }) {
  return <CountUp value={value} format={(x) => money(Math.abs(x - value) < 0.005 ? value : Math.round(x), cur)} />;
}

export const statusName = (status: string) => (status === "done" ? tr("ЗАВЕРШЁН") : status === "paused" ? tr("ПАУЗА") : tr("В РАБОТЕ"));

/** Ширина ноутбука (≥ 900 px) — как граница в CSS. */
export function useWide() {
  return useSyncExternalStore(
    (f) => { const m = window.matchMedia("(min-width: 900px)"); m.addEventListener("change", f); return () => m.removeEventListener("change", f); },
    () => window.matchMedia("(min-width: 900px)").matches,
    () => true,
  );
}

export default function ClientsScreen() {
  const s = useStore();
  const wide = useWide();
  const [view, setView] = useState(0); // 0 клиенты, 1 задачи
  const [onlyImportant, setOnlyImportant] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  // ---------------------------------------------------------------- клиенты
  const dueSum = (c: Client) => Object.values(s.clientDue(c.id)).reduce((a, b) => a + b, 0);
  const byDue = (a: Client, b: Client) => dueSum(b) - dueSum(a) || a.name.localeCompare(b.name);
  const active = s.clients.filter((c) => !c.archived).sort(byDue);
  const archived = s.clients.filter((c) => c.archived).sort(byDue);
  const orphan = s.projects.filter((p) => p.clientId == null);

  const clients = !s.clients.length && !orphan.length ? (
    <EmptyState title={tr("Пока ни одного клиента")} text={tr("Создай клиента, в нём проект, а в проекте — задачи и оплаты. Или скажи Оси: «Новый клиент Марек, проект сайт за 12 000».")} mood="happy"
      action={tr("Новый клиент")} onAction={() => void showClientEditor()} />
  ) : (
    <>
      <div className="pj-grid">
        {active.map((c, i) => <Appear key={c.id} i={i}><ClientCard client={c} /></Appear>)}
      </div>
      {orphan.length > 0 && (
        <>
          <SectionTitle>{tr("Проекты без клиента")}</SectionTitle>
          <div className="pj-grid">
            {orphan.map((p, i) => <Appear key={p.id} i={i}><ProjectTile project={p} /></Appear>)}
          </div>
        </>
      )}
      {archived.length > 0 && (
        <>
          <Collapse open={showArchived}>
            <div className="pj-grid" style={{ padding: "14px 0 10px" }}>
              {archived.map((c) => <ClientCard key={c.id} client={c} />)}
            </div>
          </Collapse>
          <button type="button" className="pj-textbtn" aria-expanded={showArchived} onClick={() => setShowArchived(!showArchived)}>{showArchived ? tr("Скрыть архив") : tr("Показать архив")}</button>
        </>
      )}
    </>
  );

  // ---------------------------------------------------------------- задачи
  const open = s.tasks.filter((t) => !t.done && (!onlyImportant || t.important)).sort((a, b) => {
    if (a.important !== b.important) return a.important ? -1 : 1;
    if (!a.dueAt && !b.dueAt) return a.title.localeCompare(b.title);
    if (!a.dueAt) return 1;
    if (!b.dueAt) return -1;
    return a.dueAt.getTime() - b.dueAt.getTime();
  });
  const now = Date.now();
  const done = s.tasks.filter((t) => t.done && now - t.doneAt!.getTime() < 7 * 86400_000);

  const tasks = !open.length && !done.length ? (
    <EmptyState title={tr("Задач нет")} text={tr("Можно выдохнуть.")} mood="sleepy" action={tr("Задача")} onAction={() => void showTaskEditor()} />
  ) : (
    <>
      {open.map((t, i) => <Appear key={t.id} i={i}><TaskRow task={t} showProject /></Appear>)}
      {done.length > 0 && (
        <>
          <SectionTitle>{tr("Сделано за неделю")}</SectionTitle>
          {done.map((t, i) => <Appear key={t.id} i={i}><TaskRow task={t} showProject /></Appear>)}
        </>
      )}
    </>
  );

  const important = <Pill dense color="#C8402A" selected={onlyImportant} onClick={() => setOnlyImportant(!onlyImportant)}>{tr("Важные")}</Pill>;

  return (
    <div className="pj">
      <ScreenHeader title={tr("Проекты")}>
        {wide ? (
          <>
            <Button small ghost icon="add" onClick={() => void showProjectEditor()}>{tr("Новый проект")}</Button>
            <Button small icon="add" onClick={() => void showClientEditor()}>{tr("Новый клиент")}</Button>
          </>
        ) : (
          <RoundButton icon="add" filled label={view === 0 ? tr("Новый клиент") : tr("Новая задача")} onClick={() => void (view === 0 ? showClientEditor() : showTaskEditor())} />
        )}
      </ScreenHeader>

      <Summary />

      {wide ? (
        <div className="pj-cols">
          <section>
            <SectionTitle>{tr("Клиенты")}</SectionTitle>
            {clients}
          </section>
          <aside>
            <SectionTitle trailing={
              <span className="pj-trail">
                {important}
                <button type="button" className="pj-plus" aria-label={tr("Новая задача")} title={tr("Новая задача")} onClick={() => void showTaskEditor()}><Icon name="plus" size={24} /></button>
              </span>
            }>{tr("Задачи")}</SectionTitle>
            {tasks}
          </aside>
        </div>
      ) : (
        <>
          <div className="pj-tabs">
            <Pill selected={view === 0} onClick={() => setView(0)}>{tr("Клиенты")}</Pill>
            <Pill selected={view === 1} onClick={() => setView(1)}>{tr("Задачи")}</Pill>
            <span className="grow" />
            <span className={"pj-fade" + (view === 1 ? " on" : "")} aria-hidden={view !== 1}>{important}</span>
          </div>
          <SlideSwitcher k={view} dir={view === 0 ? -1 : 1}>{view === 0 ? clients : tasks}</SlideSwitcher>
        </>
      )}
    </div>
  );
}

/** «Тебе должны» и «Получено в этом месяце» — по валютам, суммы в разных валютах не складываются. */
function Summary() {
  const s = useStore();
  const due = Object.entries(s.totalDue());
  const got = Object.entries(s.receivedInMonth(new Date()));
  return (
    <Card color="charcoal" seed={12} className="pj-summary">
      <div>
        <div className="pj-label">{tr("ТЕБЕ ДОЛЖНЫ")}</div>
        {!due.length && <div className="pj-big">0</div>}
        {due.map(([cur, v]) => <div key={cur} className="pj-big"><Money value={v} cur={cur} /></div>)}
      </div>
      <span className="sep" />
      <div>
        <div className="pj-label">{tr("ПОЛУЧЕНО В ЭТОМ МЕСЯЦЕ")}</div>
        {!got.length && <div className="pj-big got" style={{ color: colorOf("sage") }}>0</div>}
        {got.map(([cur, v]) => <div key={cur} className="pj-big got" style={{ color: colorOf("sage") }}><Money value={v} cur={cur} /></div>)}
      </div>
    </Card>
  );
}

function ClientCard({ client }: { client: Client }) {
  const s = useStore();
  const projects = s.projectsOf(client.id);
  const active = projects.filter((p) => p.status === "active").length;
  const due = Object.entries(s.clientDue(client.id));
  // до трёх незавершённых проектов прямо на карточке — нажатие ведёт сразу в проект
  const shown = projects.filter((p) => p.status !== "done").slice(0, 3);
  return (
    <Card color={client.archived ? PAPER_DEEP : colorOf(client.color, "clay")} seed={seedOf(client.id)} onClick={() => nav("/client/" + client.id)} className="pj-client">
      <div className="pj-client-top">
        <div>
          <h3>{client.name}</h3>
          {!!client.company && <div className="pj-soft">{client.company}</div>}
        </div>
        {due.length > 0 && (
          <div className="pj-owes">
            <small>{tr("должен")}</small>
            {due.map(([cur, v]) => <span key={cur}><Money value={v} cur={cur} /></span>)}
          </div>
        )}
      </div>
      {shown.length > 0 && (
        <div className="pj-mini">
          {shown.map((p) => {
            const d = s.dueOf(p);
            return (
              <button key={p.id} type="button" onClick={(e) => { e.stopPropagation(); nav("/project/" + p.id); }} onKeyDown={(e) => e.stopPropagation()}>
                <i className="dot" style={{ background: colorOf(p.color) }} />
                <span className="name">{p.name}</span>
                {p.budget > 0 && d > 0.009 && <span className="sum">{money(d, p.currency)}</span>}
              </button>
            );
          })}
        </div>
      )}
      <div className="pj-client-foot">
        <Icon name="folder" size={15} />
        <span>{tr("{0} {1}{2}", [projects.length, plural(projects.length, tr("проект"), tr("проекта"), tr("проектов")), active > 0 ? tr(" · {0} в работе", [active]) : ""])}</span>
        <Icon name="right" size={16} />
      </div>
    </Card>
  );
}

/** Плитка проекта с оплатами. */
export function ProjectTile({ project }: { project: Project }) {
  const s = useStore();
  const paid = s.paidOf(project.id);
  const due = project.budget - paid;
  const open = s.tasksOf(project.id).filter((t) => !t.done);
  const color = project.status === "done" ? PAPER_DEEP : colorOf(project.color);
  const fg = onColor(color);
  return (
    <Card color={color} seed={seedOf(project.id)} onClick={() => nav("/project/" + project.id)} className="pj-tile">
      <div className="pj-tile-top">
        <span className="pj-ico"><Icon name={project.icon} size={16} /></span>
        <h3>{project.name}</h3>
        <Tag color={fg}>{statusName(project.status)}</Tag>
      </div>
      {project.budget > 0 && (
        <>
          <Progress value={paid / project.budget} color={fg} height={9} />
          <div className="pj-tile-money">
            <span>{tr("{0} из {1}", [money(paid, project.currency), money(project.budget, project.currency)])}</span>
            <b>{due > 0.009 ? tr("ещё {0}", [money(due, project.currency)]) : tr("оплачено ✓")}</b>
          </div>
        </>
      )}
      {(open.length > 0 || project.deadline) && (
        <div className="pj-tile-meta">
          {open.length > 0 && (
            <span>
              <Icon name="check" size={14} />
              {tr("{0} {1}", [open.length, plural(open.length, tr("задача"), tr("задачи"), tr("задач"))])}
              {open.some((t) => t.important) && <>&nbsp;<ImportantTag /></>}
            </span>
          )}
          {project.deadline && <span><Icon name="timer" size={14} />{tr("до {0}", [fmtDayShort(project.deadline)])}</span>}
        </div>
      )}
    </Card>
  );
}

/** Строка задачи: бумажная галочка, заголовок, подпись с точкой сферы, звёздочка «важно». */
export function TaskRow({ task, showProject = false }: { task: Task; showProject?: boolean }) {
  const s = useStore();
  // галочка сначала дорисовывается, строка сворачивается — и только потом задача переезжает в другой список
  const [tick, setTick] = useState<boolean | null>(null);
  const [leaving, setLeaving] = useState(false);
  const pending = useRef<(() => void) | null>(null);
  useEffect(() => () => pending.current?.(), []); // ушли с экрана раньше — отметку всё равно сохранить

  const toggle = () => {
    if (pending.current) return;
    const stays = !task.done && !!task.repeat && !!task.dueAt; // повторяющаяся остаётся открытой, меняется только срок
    setTick(!task.done);
    pending.current = () => {
      pending.current = null;
      void s.toggleTask(task);
      setTick(null);
      setLeaving(false);
    };
    if (!stays) window.setTimeout(() => { if (pending.current) setLeaving(true); }, 300);
    window.setTimeout(() => pending.current?.(), stays ? 380 : 620);
  };

  const done = tick ?? task.done;
  const now = new Date();
  const overdue = !done && !!task.dueAt && task.dueAt < (task.allDay ? day0(now) : now);
  const sub = [
    task.dueAt ? (task.allDay ? fmtRelDay(task.dueAt) : `${fmtRelDay(task.dueAt)}, ${fmtTime(task.dueAt)}`) : "",
    showProject && task.projectId ? s.project(task.projectId)?.name ?? "" : "",
  ].filter(Boolean).join(" · ");

  return (
    <Collapse open={!leaving}>
      <div className="pj-task-wrap">
        <Card color={done ? PAPER_DEEP : undefined} lift={2} seed={seedOf(task.id)} padding="8px 14px 8px 10px" onClick={() => void showTaskEditor({ task })} className={"pj-task" + (done ? " done" : "")}>
          <Check value={done} color={task.important ? "var(--danger)" : undefined} onChange={toggle} />
          <div className="pj-task-text">
            <div className="pj-task-title">{task.title}</div>
            <div className={"pj-task-sub" + (overdue ? " late" : "")}>
              <i style={{ background: sphereColor(task.sphere) }} />
              <span>{sub || (task.sphere === "work" ? tr("Работа") : tr("Личное"))}</span>
            </div>
          </div>
          {task.important && !done && <span className="pj-task-star" title={tr("Важное")}><Icon name="star" size={20} fill /></span>}
        </Card>
      </div>
    </Collapse>
  );
}
