// Редактор заметки — порт showNoteEditor / _NoteEditor из app/lib/screens/notes/notes_screen.dart.
// В вебе дополнительно: сфера и привязка к проекту (колонки sphere и project_id в таблице есть).
import { useState } from "react";
import { tr } from "@/i18n";
import { Button, ChoiceRow, Field, Row, SheetHeader, Switch, confirm, openSheet, sphereColor } from "@/ui";
import type { Note, Sphere } from "../../data/models";
import { useStore } from "../../data/store";
import { Plans } from "../plans/plans";

type Opts = { note?: Note; clientId?: string; projectId?: string };

function NoteEditor({ note: n, clientId: presetClient, projectId: presetProject, close }: Opts & { close: () => void }) {
  const s = useStore();
  const preset = s.project(presetProject);
  const [title, setTitle] = useState(n?.title ?? "");
  const [body, setBody] = useState(n?.body ?? "");
  const [pinned, setPinned] = useState(n?.pinned ?? false);
  const [sphere, setSphere] = useState<Sphere>(n?.sphere ?? preset?.sphere ?? (presetClient ? "work" : "personal"));
  const [clientId, setClientId] = useState<string | null>(n?.clientId ?? presetClient ?? preset?.clientId ?? null);
  const [projectId, setProjectId] = useState<string | null>(n?.projectId ?? presetProject ?? null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (busy) return;
    if (!title.trim() && !body.trim()) return close();
    setBusy(true);
    const row = { title: title.trim(), body: body.trim(), pinned, sphere, client_id: clientId, project_id: projectId };
    if (n) await s.update("notes", n.id, row);
    else await s.insert("notes", row);
    close();
  };

  const remove = async () => {
    if (!n || !(await confirm(tr("Удалить заметку?")))) return;
    await s.delete("notes", n.id);
    close();
  };

  // проекты выбранного клиента (или все, если клиент не выбран); уже привязанный проект остаётся в списке всегда
  const clients = s.clients.filter((c) => !c.archived || c.id === clientId);
  const projects = s.projects.filter((p) => p.id === projectId || (p.status !== "done" && (!clientId || p.clientId === clientId)));

  const pickClient = (v: string | null) => {
    setClientId(v);
    if (projectId && v && s.project(projectId)?.clientId !== v) setProjectId(null);
  };
  const pickProject = (v: string | null) => {
    setProjectId(v);
    const p = s.project(v);
    if (p?.clientId) setClientId(p.clientId);
  };

  return (
    <div className="note-editor">
      <SheetHeader title={n ? tr("Заметка") : tr("Новая заметка")} action={tr("Готово")} onAction={() => void save()} busy={busy} close={close} />
      <Field label={tr("Заголовок")} value={title} onChange={setTitle} autoFocus={!n} maxLength={200} />
      <Field label={tr("Текст")} value={body} onChange={setBody} maxLines={10} />
      <Row title={tr("Закрепить")}><Switch value={pinned} onChange={setPinned} label={tr("Закрепить")} /></Row>
      <ChoiceRow<Sphere> label={tr("Сфера")} value={sphere} onChange={setSphere} options={[["work", tr("Работа"), sphereColor("work")], ["personal", tr("Личное"), sphereColor("personal")]]} />
      {clients.length > 0 && (
        <ChoiceRow<string | null> label={tr("Клиент")} value={clientId} onChange={pickClient} options={[[null, tr("Без клиента"), null], ...clients.map((c): [string | null, string, string | null] => [c.id, c.name, c.color])]} />
      )}
      {projects.length > 0 && (
        <ChoiceRow<string | null> label={tr("Проект")} value={projectId} onChange={pickProject} options={[[null, tr("Без проекта"), null], ...projects.map((p): [string | null, string, string | null] => [p.id, p.name, p.color])]} />
      )}
      <div style={{ display: "grid", gap: 10, marginTop: 18 }}>
        <Button expand busy={busy} onClick={() => void save()}>{tr("Сохранить")}</Button>
        {n && <Button ghost expand icon="trash" onClick={() => void remove()}>{tr("Удалить")}</Button>}
      </div>
    </div>
  );
}

/** Заметка: новая (с проверкой лимита бесплатного плана) или существующая. */
export async function showNoteEditor(o: { note?: Note; clientId?: string; projectId?: string } = {}): Promise<void> {
  if (!o.note && !Plans.allow("notes")) return;
  await openSheet<void>((close) => <NoteEditor {...o} close={() => close()} />);
}
