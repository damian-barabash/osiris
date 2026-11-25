// Экран проекта (порт app/lib/screens/projects/project_screen.dart): бюджет и оплаты, дедлайн, задачи, статус.
import { useState } from "react";
import { tr } from "@/i18n";
import { Appear, Button, Card, Collapse, Cutout, EmptyState, Icon, Pill, Progress, RoundButton, ScreenHeader, SectionTitle, Tag, colorOf, confirm, onColor } from "@/ui";
import { useStore } from "../../data/store";
import { fmtDay, fmtRelDay, money } from "../../format";
import { back, nav, useRoute } from "../../router";
import { showEventEditor } from "../calendar/eventEditor";
import { Money, TaskRow, statusName } from "./ClientsScreen";
import { showPaymentEditor, showProjectEditor, showTaskEditor } from "./editors";
import "./projects.css";

export default function ProjectScreen() {
  const s = useStore();
  const id = useRoute().parts[1] ?? "";
  const [showDone, setShowDone] = useState(false);
  const p = s.project(id);
  if (!p) return <EmptyState title={tr("Проект удалён")} mood="sad" action={tr("Назад")} onAction={() => back("/work")} />;

  const client = s.client(p.clientId);
  const home = client ? "/client/" + client.id : "/work";
  const paid = s.paidOf(id);
  const due = p.budget - paid;
  const pays = s.paymentsOf(id).sort((a, b) => b.paidOn.getTime() - a.paidOn.getTime());
  const far = new Date(2100, 0, 1).getTime();
  const all = s.tasksOf(id).sort((a, b) => (a.important !== b.important ? (a.important ? -1 : 1) : (a.dueAt?.getTime() ?? far) - (b.dueAt?.getTime() ?? far)));
  const open = all.filter((t) => !t.done), done = all.filter((t) => t.done);
  const color = colorOf(p.color);
  const fg = onColor(color);
  const statuses: [string, string, string][] = [["active", tr("В работе"), "teal"], ["paused", tr("Пауза"), "mustard"], ["done", tr("Завершён"), "sage"]];

  const remove = async () => {
    if (!(await confirm(tr("Удалить проект с задачами и оплатами?")))) return;
    void s.delete("projects", p.id);
    back(home);
  };

  return (
    <div className="pj">
      <ScreenHeader back={() => back(home)} title={client
        ? <button type="button" className="pj-crumb" onClick={() => nav("/client/" + client.id)}>{client.name}</button>
        : tr("Проект")}>
        <RoundButton icon="pencil" label={tr("Изменить")} onClick={() => void showProjectEditor({ project: p })} />
        <RoundButton icon={p.status === "done" ? "refresh" : "tick"} label={p.status === "done" ? tr("Вернуть в работу") : tr("Завершить")} onClick={() => void s.update("projects", p.id, { status: p.status === "done" ? "active" : "done" })} />
        <RoundButton icon="trash" label={tr("Удалить")} onClick={() => void remove()} />
      </ScreenHeader>

      <Card color={color} seed={8} padding={18} className="pj-hero">
        <div className="pj-hero-top">
          <Icon name={p.icon} size={26} />
          <h2>{p.name}</h2>
          <Tag color={fg}>{statusName(p.status)}</Tag>
        </div>
        {!!p.description && <div className="pj-hero-desc">{p.description}</div>}
        {p.budget > 0 && <Progress value={paid / p.budget} color={fg} height={12} />}
        <div className="pj-stats">
          <div>
            <div className="pj-label">{tr("Бюджет")}</div>
            <div className="pj-stat-v">{p.budget === 0 ? "—" : <Money value={p.budget} cur={p.currency} />}</div>
          </div>
          <div>
            <div className="pj-label">{tr("Оплачено")}</div>
            <div className="pj-stat-v"><Money value={paid} cur={p.currency} /></div>
          </div>
          <div>
            <div className="pj-label">{tr("Остаток")}</div>
            <div className="pj-stat-v">{p.budget === 0 ? "—" : due <= 0.009 ? <>0 <Icon name="tick" size={17} strokeWidth={3} /></> : <Money value={due} cur={p.currency} />}</div>
          </div>
        </div>
        {p.deadline && (
          <div className="pj-deadline"><Icon name="timer" size={15} />{tr("Дедлайн {0} · {1}", [fmtDay(p.deadline), fmtRelDay(p.deadline)])}</div>
        )}
      </Card>

      <div className="pj-status">
        {statuses.map(([v, name, c]) => <Pill key={v} dense color={c} selected={p.status === v} onClick={() => { if (p.status !== v) void s.update("projects", p.id, { status: v }); }}>{name}</Pill>)}
      </div>

      <div className="pj-actions">
        <Button color="sage" icon="coin" onClick={() => void showPaymentEditor({ projectId: id })}>{tr("Оплата")}</Button>
        <Button icon="add" onClick={() => void showTaskEditor({ projectId: id })}>{tr("Задача")}</Button>
        <RoundButton icon="calendar" size={50} filled label={tr("Новое событие")} onClick={() => void showEventEditor({ clientId: p.clientId ?? undefined, projectId: id })} />
      </div>

      <div className="pj-cols even">
        <section>
          <SectionTitle trailing={<span className="pj-count">{open.length}</span>}>{tr("Задачи")}</SectionTitle>
          {!all.length && <p className="pj-hint">{tr("Задач пока нет.")}</p>}
          {open.map((t, i) => <Appear key={t.id} i={i}><TaskRow task={t} /></Appear>)}
          <Collapse open={done.length > 0}>
            <button type="button" className={"pj-toggle" + (showDone ? " open" : "")} aria-expanded={showDone} disabled={!done.length} onClick={() => setShowDone(!showDone)}>
              <Icon name="down" size={15} />
              {tr("Сделано")} · {done.length}
            </button>
          </Collapse>
          <Collapse open={showDone && done.length > 0}>
            {done.map((t) => <TaskRow key={t.id} task={t} />)}
          </Collapse>
        </section>

        <section>
          <SectionTitle>{tr("Оплаты")}</SectionTitle>
          {!pays.length && <p className="pj-hint">{tr("Оплат пока не было.")}</p>}
          <div className="pj-list" style={{ gap: 8 }}>
            {pays.map((pay, i) => (
              <Appear key={pay.id} i={i}>
                <Card lift={2} seed={i + 20} padding="12px 14px" onClick={() => void showPaymentEditor({ projectId: id, payment: pay })} className="pj-pay">
                  <span className="pj-pay-ico">
                    <Cutout kind="blob" size={38} color={colorOf("sage")} seed={9} flat />
                    <Icon name="arrow-down" size={17} />
                  </span>
                  <div>
                    <b>{money(pay.amount, p.currency)}</b>
                    <small>{[fmtDay(pay.paidOn), pay.note].filter(Boolean).join(" · ")}</small>
                  </div>
                </Card>
              </Appear>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
