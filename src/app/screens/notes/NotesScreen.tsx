// Заметки — порт app/lib/screens/notes/notes_screen.dart. Закреплённые сверху, поиск, фильтр по сфере;
// на ноутбуке листы раскладываются колонками разной высоты, как записки на столе.
import { useState } from "react";
import { tr } from "@/i18n";
import { Appear, Card, EmptyState, Icon, Pill, RoundButton, ScreenHeader, Tag, confirm, sphereColor } from "@/ui";
import type { Note, Sphere } from "../../data/models";
import { useStore, type Store } from "../../data/store";
import { fmtDayShort } from "../../format";
import { back, nav } from "../../router";
import { showNoteEditor } from "./noteEditor";
import "./notes.css";

const hash = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h) & 0xff; };

function NoteTile({ note: n, s }: { note: Note; s: Store }) {
  const client = s.client(n.clientId);
  const project = s.project(n.projectId);
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  const go = (path: string) => (e: React.MouseEvent) => { e.stopPropagation(); nav(path); };
  const remove = async () => { if (await confirm(tr("Удалить заметку?"))) await s.delete("notes", n.id); };
  return (
    <Card color={n.pinned ? "butter" : null} seed={hash(n.id)} className={`note-tile${n.pinned ? " pinned" : ""}`} onClick={() => void showNoteEditor({ note: n })}>
      <div className="note-top">
        <i className="note-dot" style={{ background: sphereColor(n.sphere) }} title={n.sphere === "work" ? tr("Работа") : tr("Личное")} />
        <h3>{n.title || tr("Без названия")}</h3>
        <time>{fmtDayShort(n.updatedAt)}</time>
      </div>
      {n.body && <p className="note-body">{n.body}</p>}
      {(client || project) && (
        <div className="note-links">
          {client && <button type="button" className="note-link" onClick={go("/client/" + client.id)} onKeyDown={stop}><Tag color={client.color} icon="person">{client.name}</Tag></button>}
          {project && <button type="button" className="note-link" onClick={go("/project/" + project.id)} onKeyDown={stop}><Tag color={project.color} icon={project.icon}>{project.name}</Tag></button>}
        </div>
      )}
      <div className="note-actions" onClick={stop} onKeyDown={stop}>
        <button type="button" className={`note-act${n.pinned ? " on" : ""}`} aria-pressed={n.pinned} aria-label={n.pinned ? tr("Открепить") : tr("Закрепить")} title={n.pinned ? tr("Открепить") : tr("Закрепить")}
          onClick={() => void s.update("notes", n.id, { pinned: !n.pinned })}>
          <Icon name="pinned" size={15} fill={n.pinned} />
        </button>
        <button type="button" className="note-act danger" aria-label={tr("Удалить")} title={tr("Удалить")} onClick={() => void remove()}>
          <Icon name="trash" size={15} />
        </button>
      </div>
    </Card>
  );
}

export default function NotesScreen() {
  const s = useStore();
  const [q, setQ] = useState("");
  const [sphere, setSphere] = useState<Sphere | null>(null);

  const query = q.trim().toLowerCase();
  const notes = s.notes
    .filter((n) => (!sphere || n.sphere === sphere) && (!query || n.title.toLowerCase().includes(query) || n.body.toLowerCase().includes(query)))
    .sort((a, b) => (a.pinned !== b.pinned ? (a.pinned ? -1 : 1) : b.updatedAt.getTime() - a.updatedAt.getTime()));
  const filtered = !!query || !!sphere;

  return (
    <div className="notes">
      <ScreenHeader title={tr("Заметки")} back={() => back("/")}>
        <RoundButton icon="add" filled color="orange" label={tr("Новая заметка")} onClick={() => void showNoteEditor()} />
      </ScreenHeader>

      <div className="notes-bar">
        <label className="notes-search">
          <Icon name="search" size={18} />
          <input type="search" value={q} placeholder={tr("Поиск")} aria-label={tr("Поиск")} onChange={(e) => setQ(e.target.value)} />
          <button type="button" className={`notes-clear${q ? " on" : ""}`} aria-label={tr("Закрыть")} tabIndex={q ? 0 : -1} onClick={() => setQ("")}><Icon name="close" size={15} /></button>
        </label>
        <div className="notes-filter">
          <Pill dense selected={sphere === null} onClick={() => setSphere(null)}>{tr("Все")}</Pill>
          <Pill dense selected={sphere === "work"} color={sphereColor("work")} onClick={() => setSphere("work")}>{tr("Работа")}</Pill>
          <Pill dense selected={sphere === "personal"} color={sphereColor("personal")} onClick={() => setSphere("personal")}>{tr("Личное")}</Pill>
        </div>
      </div>

      {notes.length === 0 ? (
        filtered && s.notes.length > 0
          ? <EmptyState key="none" title={tr("Ничего не найдено")} text={tr("Попробуй другое слово или сними фильтр.")} mood="thinking" />
          : <EmptyState key="empty" title={tr("Заметок нет")} text={tr("Мысли, идеи, пароли от Wi-Fi клиента — сюда. Или просто скажи Оси «запиши…».")} mood="calm" action={tr("Добавить")} onAction={() => void showNoteEditor()} />
      ) : (
        <div key={sphere ?? "all"} className="notes-grid">
          {notes.map((n, i) => <Appear key={n.id} i={i} className="notes-cell"><NoteTile note={n} s={s} /></Appear>)}
        </div>
      )}
    </div>
  );
}
