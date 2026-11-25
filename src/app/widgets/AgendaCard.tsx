// Карточки дел на день — порт app/lib/widgets/agenda_card.dart и overlap.dart:
// цветной бумажный лист (заголовок крупно, время справа, место снизу), пересечения по времени — со сдвигом и наклейкой.
import type { CSSProperties, ReactNode } from "react";
import { tr } from "@/i18n";
import { Appear, Card, Check, Icon, ImportantTag, colorOf, onColor } from "@/ui";
import type { AgendaItem } from "../data/models";
import { store, useStore } from "../data/store";
import { friends, useFriends } from "../data/friends";
import { sameDate } from "../data/repeat";
import { fmtTime } from "../format";
import { nav } from "../router";
import { showEventEditor } from "../screens/calendar/eventEditor";
import { showTaskEditor } from "../screens/projects/editors";
import "./AgendaCard.css";

export const agendaPalette = ["clay", "orange", "lavender", "sage", "teal", "charcoal", "mustard", "navy"];

/** Цвет листа: свой цвет дела, у задачи — лист цвета карточки (null), иначе по порядку из палитры. */
export function agendaColor(item: AgendaItem, index: number): string | null {
  if (item.color) return colorOf(item.color);
  if (item.kind === "task") return null;
  return colorOf(agendaPalette[Math.abs(index) % agendaPalette.length]);
}

const hash = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h & 0xff; };
export const sphereName = (s: "work" | "personal") => (s === "work" ? tr("Работа") : tr("Личное"));
export const sphereIcon = (s: "work" | "personal") => (s === "work" ? "briefcase" : "home");

/** Открыть дело: событие → редактор события, задача → редактор задачи, этап → цель, дедлайн → проект. */
export function openAgendaItem(item: AgendaItem): void {
  if (item.readOnly) return;
  switch (item.kind) {
    case "event": {
      const e = item.event ?? store.events.find((x) => x.id === item.id);
      if (e) void showEventEditor({ event: e });
      break;
    }
    case "task": {
      const t = store.tasks.find((x) => x.id === item.id);
      if (t) void showTaskEditor({ task: t });
      break;
    }
    case "stage": if (item.id) nav("/goal/" + item.id); break;
    case "deadline": if (item.id) nav("/project/" + item.id); break;
  }
}

/** Совместное событие: моя копия от друга или я кого-то позвал (идёт / ждём ответа). */
export const isSharedEvent = (item: AgendaItem) => item.event?.sharedFrom != null || (!!item.id && friends.guestsOf(item.id).some((i) => i.status !== "declined"));

/** Подпись времени на карточке. */
export function agendaTime(item: AgendaItem): string {
  if (item.allDay) return item.kind === "stage" ? tr("этап") : item.kind === "deadline" ? tr("дедлайн") : item.kind === "task" ? tr("за день") : tr("весь день");
  if (item.end && sameDate(item.at, item.end)) return `${fmtTime(item.at)}–${fmtTime(item.end)}`;
  return fmtTime(item.at);
}

const KIND_ICON: Record<AgendaItem["kind"], string> = { task: "check", stage: "flag", deadline: "timer", event: "pin" };

/** Карточка дела на день (событие, задача, этап, дедлайн) — как AgendaCard в приложении. Нажатие открывает дело. */
export function AgendaCard({ item, compact = false, index }: { item: AgendaItem; compact?: boolean; index?: number }): ReactNode {
  const s = useStore();
  useFriends();
  const seed = hash(item.id ?? item.title);
  const color = agendaColor(item, index ?? seed);
  const readOnly = !!item.readOnly;
  const task = item.kind === "task" && !readOnly ? s.tasks.find((t) => t.id === item.id) ?? null : null;
  const done = task?.done ?? !!item.done;
  const time = agendaTime(item);
  const shared = item.kind === "event" && !readOnly && !!item.id && isSharedEvent(item);
  const cls = ["ag-card", item.kind, compact && "compact", readOnly && "ro"].filter(Boolean).join(" ");
  return (
    <Card color={color} seed={seed} padding={compact ? "10px 11px 10px" : "14px 16px"} className={cls} onClick={readOnly ? undefined : () => openAgendaItem(item)}>
      {compact && <div className="ag-time">{time}</div>}
      <div className="ag-top">
        {task && (
          // клавиши галочки не должны открывать саму карточку
          <span className="ag-check" onKeyDown={(e) => e.stopPropagation()}>
            <Check value={task.done} size={compact ? 20 : 24} color={task.important ? "#C8402A" : null} label={tr("Готово")} onChange={() => void s.toggleTask(task)} />
          </span>
        )}
        {!task && readOnly && item.kind === "task" && <Icon name={done ? "check-square" : "square"} size={compact ? 16 : 20} />}
        <div className={`ag-title${done ? " done" : ""}`}>{item.title}</div>
        {!compact && <div className="ag-time">{time}</div>}
      </div>
      <div className="ag-meta">
        <Icon name={KIND_ICON[item.kind]} size={compact ? 13 : 15} />
        <span className="ag-sub">{item.subtitle ? item.subtitle : sphereName(item.sphere)}</span>
        {shared && <span className="ag-dim" role="img" aria-label={tr("Совместное событие")} title={tr("Совместное событие")}><Icon name="users" size={compact ? 13 : 15} /></span>}
        {item.repeats && <span className="ag-dim" role="img" aria-label={tr("Повтор")} title={tr("Повтор")}><Icon name="repeat" size={compact ? 12 : 14} /></span>}
        {item.important && (compact ? <span className="ag-star" role="img" aria-label={tr("ВАЖНО")}><Icon name="star" size={12} fill /></span> : <ImportantTag />)}
        <span className="ag-dim"><Icon name={sphereIcon(item.sphere)} size={compact ? 13 : 15} /></span>
      </div>
    </Card>
  );
}

// ------------------------------------------------------------------ пересечения (overlap.dart)

/** Пересечение пункта дня с более ранним: глубина (1 — лежит на первом, 2 — на втором), с чем и на каких часах. */
export interface Overlap { depth: number; other: AgendaItem; from: Date; to: Date }

/** Интервал пункта: у события — до конца (без конца — полчаса), у задачи со временем — точка. */
function span(it: AgendaItem): [number, number] {
  const a = it.at.getTime();
  if (it.end && it.end.getTime() > a) return [a, it.end.getTime()];
  return [a, it.kind === "event" ? a + 30 * 60_000 : a];
}

function hits([s1, e1]: [number, number], [s2, e2]: [number, number]) {
  // точка (задача) внутри интервала, два интервала с общим куском или одно и то же время
  if (s1 === s2) return true;
  if (e1 === s1) return s1 >= s2 && s1 < e2;
  if (e2 === s2) return s2 >= s1 && s2 < e1;
  return s1 < e2 && s2 < e1;
}

/** Для каждого пункта со временем — пересекается ли он с более ранними (ключ — индекс в списке). Пункты на весь день не участвуют. */
export function overlapsOf(items: AgendaItem[]): Map<number, Overlap> {
  const out = new Map<number, Overlap>();
  const timed: number[] = [];
  items.forEach((it, i) => { if (!it.allDay) timed.push(i); });
  const depth = new Map<number, number>();
  for (let k = 0; k < timed.length; k++) {
    const i = timed[k];
    const a = span(items[i]);
    let withI: number | null = null;
    let d = 0;
    for (let m = 0; m < k; m++) {
      const j = timed[m];
      if (!hits(a, span(items[j]))) continue;
      withI ??= j; // с самым ранним из пересекающихся
      d = Math.max(d, (depth.get(j) ?? 0) + 1);
    }
    depth.set(i, Math.min(2, Math.max(0, d)));
    if (withI != null) {
      const b = span(items[withI]);
      const from = Math.max(a[0], b[0]);
      const to = Math.min(a[1], b[1]);
      out.set(i, { depth: Math.min(2, Math.max(1, depth.get(i)!)), other: items[withI], from: new Date(from), to: new Date(to < from ? from : to) });
    }
  }
  return out;
}

/** Рамка карточки, которая пересекается с предыдущей: сдвиг вправо, скобка-соединитель и наклейка «пересекается с … 14:00–14:30». */
function OverlapFrame({ overlap: o, compact, children }: { overlap?: Overlap; compact: boolean; children: ReactNode }) {
  if (!o) return <>{children}</>;
  const indent = (compact ? 10 : 26) * o.depth;
  const range = o.to.getTime() - o.from.getTime() < 60_000 ? fmtTime(o.from) : `${fmtTime(o.from)}–${fmtTime(o.to)}`;
  const text = tr("пересекается с «{0}» · {1}", [o.other.title, range]);
  return (
    <div className={`ag-overlap${compact ? " compact" : ""}`} style={{ "--indent": `${indent}px` } as CSSProperties}>
      <span className="ag-bracket" aria-hidden />
      <div className="ag-sticker" title={text}>
        <Icon name="stack" size={11} />
        <span>{text}</span>
      </div>
      {children}
    </div>
  );
}

/** Список карточек дня с учётом пересечений по времени (сдвиг вправо + наклейка «пересекается с …»). */
export function AgendaCards({ items, compact = false, gap = 10 }: { items: AgendaItem[]; compact?: boolean; gap?: number }): ReactNode {
  const ov = overlapsOf(items);
  return (
    <div className="ag-list">
      {items.map((it, i) => (
        // следующая карточка ляжет на эту — зазор забирает она сама
        <div key={`${it.kind}-${it.id ?? it.title}-${it.at.getTime()}`} style={{ marginBottom: i === items.length - 1 || ov.has(i + 1) ? 0 : compact ? Math.min(gap, 8) : gap }}>
          <Appear i={i}>
            <OverlapFrame overlap={ov.get(i)} compact={compact}>
              <AgendaCard item={it} index={i} compact={compact} />
            </OverlapFrame>
          </Appear>
        </div>
      ))}
    </div>
  );
}
