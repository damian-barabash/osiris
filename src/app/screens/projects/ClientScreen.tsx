// Экран клиента (порт app/lib/screens/projects/client_screen.dart): шапка с долгом и контактами, проекты, встречи, заметки.
import { tr } from "@/i18n";
import { Appear, Card, EmptyState, Icon, RoundButton, ScreenHeader, SectionTitle, Tag, colorOf, confirm, onColor } from "@/ui";
import { useStore } from "../../data/store";
import type { AgendaItem, Note } from "../../data/models";
import { fmtDay, fmtRelDay, moneyMap } from "../../format";
import { back, useRoute } from "../../router";
import { AgendaCard } from "../../widgets/AgendaCard";
import { showEventEditor } from "../calendar/eventEditor";
import { showNoteEditor } from "../notes/noteEditor";
import { ProjectTile, seedOf } from "./ClientsScreen";
import { showClientEditor, showProjectEditor } from "./editors";
import "./projects.css";

export default function ClientScreen() {
  const s = useStore();
  const id = useRoute().parts[1] ?? "";
  const c = s.client(id);
  if (!c) return <EmptyState title={tr("Клиент удалён")} mood="sad" action={tr("Назад")} onAction={() => back("/work")} />;

  const projects = s.projectsOf(id).sort((a, b) => (a.status === "done" ? 1 : 0) - (b.status === "done" ? 1 : 0));
  const now = Date.now();
  const events = s.eventsBetween(new Date(now - 86400_000), new Date(now + 90 * 86400_000)).filter((e) => e.clientId === id).slice(0, 12);
  const notes = s.notes.filter((n) => n.clientId === id);
  const due = s.clientDue(id);
  // «Заплатил» — тоже по валютам: суммы в разных валютах не складываются
  const paid: Record<string, number> = {};
  for (const p of projects) { const v = s.paidOf(p.id); if (v > 0) paid[p.currency] = (paid[p.currency] ?? 0) + v; }

  const fg = onColor(colorOf(c.color, "clay"));

  const remove = async () => {
    if (!(await confirm(tr("Удалить клиента вместе со всеми проектами, задачами и оплатами?")))) return;
    void s.delete("clients", c.id);
    back("/work");
  };

  return (
    <div className="pj">
      <ScreenHeader title={tr("Клиент")} back={() => back("/work")}>
        <RoundButton icon="pencil" label={tr("Изменить")} onClick={() => void showClientEditor(c)} />
        <RoundButton icon={c.archived ? "unarchive" : "archive"} label={c.archived ? tr("Вернуть из архива") : tr("В архив")} onClick={() => void s.update("clients", c.id, { archived: !c.archived })} />
        <RoundButton icon="trash" label={tr("Удалить")} onClick={() => void remove()} />
      </ScreenHeader>

      <div className={"pj-hero-wrap" + (c.notes ? "" : " solo")}>
        <Card color={colorOf(c.color, "clay")} seed={5} padding={18} className="pj-hero">
          <div className="pj-hero-top">
            <h2>{c.name}</h2>
            {c.archived && <Tag color={fg}>{tr("В АРХИВЕ")}</Tag>}
          </div>
          {!!c.company && <div className="pj-soft" style={{ fontWeight: 700 }}>{c.company}</div>}
          <div className="pj-stats">
            <div>
              <div className="pj-label">{tr("Должен")}</div>
              <div className="pj-stat-v">{moneyMap(due)}</div>
            </div>
            <div>
              <div className="pj-label">{tr("Заплатил")}</div>
              <div className="pj-stat-v">{moneyMap(paid)}</div>
            </div>
          </div>
          {(!!c.phone || !!c.email) && (
            <div className="pj-contacts">
              {!!c.phone && <a href={"tel:" + c.phone.replace(/[^\d+]/g, "")}><Icon name="call" size={14} />{c.phone}</a>}
              {!!c.email && <a href={"mailto:" + encodeURIComponent(c.email).replace(/%40/g, "@")}><Icon name="mail" size={14} />{c.email}</a>}
            </div>
          )}
        </Card>
        {!!c.notes && <Card color="butter" seed={6} className="pj-memo">{c.notes}</Card>}
      </div>

      <div className="pj-cols even">
        <section>
          <SectionTitle trailing={<Plus label={tr("Новый проект")} onClick={() => void showProjectEditor({ clientId: id })} />}>{tr("Проекты")}</SectionTitle>
          {!projects.length && (
            <Card onClick={() => void showProjectEditor({ clientId: id })} className="pj-add"><Icon name="add" size={20} />{tr("Добавить проект")}</Card>
          )}
          <div className="pj-list">
            {projects.map((p, i) => <Appear key={p.id} i={i}><ProjectTile project={p} /></Appear>)}
          </div>
        </section>

        <section>
          <SectionTitle trailing={<Plus label={tr("Новое событие")} onClick={() => void showEventEditor({ clientId: id })} />}>{tr("Встречи")}</SectionTitle>
          {!events.length && <p className="pj-hint">{tr("Ближайших встреч нет.")}</p>}
          <div className="pj-list">
            {events.map((e, i) => {
              const item: AgendaItem = {
                at: e.startsAt, end: e.endsAt, title: e.title, kind: "event", sphere: e.sphere, allDay: e.allDay, important: e.important,
                subtitle: fmtRelDay(e.startsAt) + (e.location ? ` · ${e.location}` : ""), color: e.color, id: e.id, event: e, repeats: !!e.repeat,
              };
              return <Appear key={e.id + (e.raw._occ ?? "")} i={i}><AgendaCard item={item} /></Appear>;
            })}
          </div>

          {notes.length > 0 && (
            <>
              <SectionTitle>{tr("Заметки")}</SectionTitle>
              <div className="pj-list">
                {notes.map((n, i) => <Appear key={n.id} i={i}><NoteTile note={n} /></Appear>)}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function Plus({ label, onClick }: { label: string; onClick: () => void }) {
  return <button type="button" className="pj-plus" aria-label={label} title={label} onClick={onClick}><Icon name="plus" size={24} /></button>;
}

/** Заметка, привязанная к клиенту; открывается в редакторе заметок. */
function NoteTile({ note }: { note: Note }) {
  return (
    <Card color={note.pinned ? "butter" : undefined} lift={2} seed={seedOf(note.id)} padding="12px 14px" onClick={() => void showNoteEditor({ note })} className="pj-note">
      {!!note.title && <h4>{note.title}</h4>}
      {!!note.body && <p>{note.body}</p>}
      <small>{fmtDay(note.updatedAt)}</small>
    </Card>
  );
}
