// «Ты это сделал?» — порт app/lib/screens/checkin_sheet.dart: проверка по задачам, у которых прошёл срок.
// Про каждый срок спрашиваем один раз (запоминаем в браузере), перенос даёт новый срок — спросим снова.
import { useEffect, useRef, useState } from "react";
import { plural, tr } from "@/i18n";
import { Button, Card, Collapse, Cutout, Icon, Osi, P, SheetHeader, colorOf, onColor, openSheet } from "@/ui";
import type { Task } from "../data/models";
import { addDays, day0, sameDate } from "../data/repeat";
import { store } from "../data/store";
import { fmtDay, fmtDayShort, fmtTime, toDateInput } from "../format";
import "./checkin.css";

const KEY = "checkin_asked";
const DAY = 86400_000;
const hash = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h) & 0xff; };

function asked(): Record<string, string> {
  try {
    const m = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    return m && typeof m === "object" ? (m as Record<string, string>) : {};
  } catch { return {}; }
}

/** Задачи, о которых стоит спросить. */
function candidates(): Task[] {
  const s = store;
  if (!s.loaded) return [];
  const now = new Date(), today = day0(now);
  const was = asked();
  return s.tasks.filter((t) => {
    const d = t.dueAt;
    if (t.done || !d) return false;
    // не старше месяца — древние хвосты не вываливаем
    if (d < addDays(today, -30)) return false;
    const due = t.allDay
      ? d < today || (sameDate(d, now) && now.getHours() >= 19) // на весь день — вечером или на следующий день
      : d.getTime() + 15 * 60_000 < now.getTime();
    return due && was[t.id] !== String(t.raw.due_at);
  }).sort((a, b) => a.dueAt!.getTime() - b.dueAt!.getTime());
}

function markAsked(list: Task[]) {
  const m = asked();
  for (const t of list) m[t.id] = String(t.raw.due_at);
  // чистим старьё: оставляем только живые задачи
  const alive = new Set(store.tasks.map((t) => t.id));
  for (const k of Object.keys(m)) if (!alive.has(k)) delete m[k];
  try { localStorage.setItem(KEY, JSON.stringify(m)); } catch { /* приватный режим */ }
}

/** «сегодня» / «вчера» / «25 ноября» — как relDay в приложении (сроки здесь всегда в прошлом или сегодня). */
function relDay(d: Date): string {
  const n = Math.round((day0(d).getTime() - day0(new Date()).getTime()) / DAY);
  return n === 0 ? tr("сегодня") : n === -1 ? tr("вчера") : n === 1 ? tr("завтра") : fmtDay(d);
}

/** Новый срок: тот же час (у задачи со временем), другой день. */
function move(t: Task, day: Date) {
  const d = t.dueAt!;
  const at = t.allDay ? new Date(day.getFullYear(), day.getMonth(), day.getDate()) : new Date(day.getFullYear(), day.getMonth(), day.getDate(), d.getHours(), d.getMinutes());
  return store.update("tasks", t.id, { due_at: at.toISOString() });
}

function Sheet({ tasks, close }: { tasks: Task[]; close: () => void }) {
  const [left, setLeft] = useState(tasks);
  const [done, setDone] = useState<Record<string, string>>({}); // id → что сделали (для подписи)
  const [gone, setGone] = useState<Record<string, true>>({}); // карточка сворачивается
  const [picking, setPicking] = useState<string | null>(null);
  const today = day0(new Date());
  const [picked, setPicked] = useState(() => toDateInput(addDays(today, 2)));
  const live = useRef(true);
  const count = useRef(tasks.length);
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);

  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const resolve = async (t: Task, how: string, action: () => Promise<unknown>) => {
    if (done[t.id]) return;
    setPicking(null);
    setDone((m) => ({ ...m, [t.id]: how }));
    void action();
    await wait(750);
    if (!live.current) return;
    setGone((m) => ({ ...m, [t.id]: true }));
    await wait(360);
    if (!live.current) return;
    setLeft((l) => l.filter((x) => x.id !== t.id));
    if (--count.current <= 0) { await wait(200); if (live.current) close(); }
  };

  const applyPicked = (t: Task) => {
    if (!picked) return;
    const day = new Date(`${picked}T00:00`);
    if (isNaN(day.getTime()) || day < today) return;
    void resolve(t, tr("→ {0}", [fmtDayShort(day)]), () => move(t, day));
  };

  const waiting = left.filter((t) => !done[t.id]).length;
  const btn = (label: string, icon: string, color: string, onClick: () => void, on = false) => {
    const c = colorOf(color);
    return (
      <button type="button" className={`checkin-btn${on ? " on" : ""}`} style={{ background: c, color: onColor(c), boxShadow: `0 2px 0 color-mix(in srgb, ${c} 85%, #000)` }} onClick={onClick}>
        <Icon name={icon} size={15} /><span>{label}</span>
      </button>
    );
  };

  return (
    <div className="checkin">
      <SheetHeader title={tr("Ты это сделал?")} sub={tr("Срок прошёл — отметь или перенеси")} close={close} />
      <div className="checkin-osi">
        <Osi size={58} mood={waiting === 0 ? "happy" : "thinking"} />
        <p>{waiting <= 1 ? tr("Одна задача ждёт ответа.") : tr("{0} {1} ждут ответа.", [waiting, plural(waiting, tr("задача"), tr("задачи"), tr("задач"))])}</p>
      </div>

      <div className="checkin-list">
        {left.map((t) => {
          const d = t.dueAt!;
          const how = done[t.id];
          return (
            <Collapse key={t.id} open={!gone[t.id]}>
              <div className="checkin-cell">
                <Card color={how ? "sage" : null} lift={2} seed={hash(t.id)} padding="12px 12px 12px 14px" className={`checkin-card${how ? " done" : ""}`}>
                  <div className="checkin-title">
                    {how ? <Icon name="check" size={20} /> : t.important && <Cutout kind="spark" size={14} color={P.danger} flat />}
                    <h3>{t.title}</h3>
                    {how && <b key="how" className="appear">{how}</b>}
                  </div>
                  <Collapse open={!how}>
                    <p className="checkin-due">{t.allDay ? tr("срок: {0}", [relDay(d)]) : tr("срок: {0}, {1}", [relDay(d), fmtTime(d)])}</p>
                    <div className="checkin-btns">
                      {btn(tr("Сделал"), "tick", "sage", () => void resolve(t, tr("✓ готово"), () => store.toggleTask(t)))}
                      {btn(tr("Завтра"), "arrow-right", "butter", () => void resolve(t, tr("→ завтра"), () => move(t, addDays(today, 1))))}
                      {btn(tr("Дата"), "calendar", "lavender", () => setPicking((p) => (p === t.id ? null : t.id)), picking === t.id)}
                    </div>
                    <Collapse open={picking === t.id}>
                      <div className="checkin-pick">
                        <input className="date-input" type="date" value={picked} min={toDateInput(today)} aria-label={tr("Дата")} tabIndex={picking === t.id ? 0 : -1}
                          onChange={(e) => setPicked(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") applyPicked(t); }} />
                        <Button small disabled={!picked || picking !== t.id} onClick={() => applyPicked(t)}>{tr("Перенести")}</Button>
                      </div>
                    </Collapse>
                  </Collapse>
                </Card>
              </div>
            </Collapse>
          );
        })}
      </div>

      <button type="button" className="checkin-later" onClick={close}>{tr("Позже")}</button>
    </div>
  );
}

/** «Ты это сделал?» — лист по просроченным задачам (Сделал / Завтра / Дата / Позже), про каждый срок спрашивает один раз. true — лист был показан. */
export async function maybeShowCheckin(): Promise<boolean> {
  const list = candidates();
  if (list.length === 0) return false;
  markAsked(list);
  await openSheet<void>((close) => <Sheet tasks={list} close={() => close()} />);
  return true;
}
