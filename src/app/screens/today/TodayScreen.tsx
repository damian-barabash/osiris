// Главная «Сегодня» — порт app/lib/screens/today/today_screen.dart.
// Телефон — одна колонка, как в приложении; ноутбук — две: слева дата и план дня, справа лента бумажных листов
// (сводка Оси, «Не проспать», деньги, настроение, заметки, друзья).
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { L, plural, tr } from "@/i18n";
import { Appear, Card, Check, Collapse, Cutout, EmptyState, Icon, Osi, P, Pill, RoundButton, SectionTitle, SlideSwitcher, colorOf, sphereColor } from "@/ui";
import { Assistant } from "../../data/assistant";
import { useFriends, type Friend } from "../../data/friends";
import type { Critical, Task } from "../../data/models";
import { dateOnly, day0, sameDate } from "../../data/repeat";
import { store, useStore, type Store } from "../../data/store";
import { fmtDay, fmtDayShort, fmtHours, fmtTime, fmtWeekday, money, moneyMap } from "../../format";
import { nav } from "../../router";
import { AgendaCards } from "../../widgets/AgendaCard";
import { AvatarView, PaperAvatar } from "../../widgets/Avatar";
import { showEventEditor } from "../calendar/eventEditor";
import { showCapture } from "../capture/capture";
import { MoodScale, showMoodSheet } from "../mood/moodSheet";
import { showNoteEditor } from "../notes/noteEditor";
import { showTaskEditor } from "../projects/editors";
import "./today.css";

const DAY = 86400_000;
const hash = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h) & 0xff; };
const daysLeft = (d: Date) => Math.round((day0(d).getTime() - day0(new Date()).getTime()) / DAY);

/** «сегодня» / «завтра» / «через 3 дня» / «25 ноября» — как relDay в приложении. */
function relDay(d: Date): string {
  const n = daysLeft(d);
  if (n === 0) return tr("сегодня");
  if (n === 1) return tr("завтра");
  if (n === 2) return tr("послезавтра");
  if (n === -1) return tr("вчера");
  if (n > 0 && n <= 45) return tr("через {0} {1}", [n, plural(n, tr("день"), tr("дня"), tr("дней"))]);
  return fmtDay(d);
}

function ago(t: Date): string {
  const min = Math.floor((Date.now() - t.getTime()) / 60_000), h = Math.floor(min / 60), d = Math.floor(h / 24);
  if (min < 2) return tr("только что");
  if (min < 60) return tr("{0} мин назад", [min]);
  if (h < 24) return tr("{0} ч назад", [h]);
  if (d === 1) return tr("вчера");
  return tr("{0} дн. назад", [d]);
}

// ------------------------------------------------------------------ часы и ширина

/** Меняется раз в час (и в полночь): приветствие и «сегодня» обновляются сами, без перерисовки каждую секунду. */
function useHourKey() {
  const key = () => { const n = new Date(); return `${dateOnly(n)}T${n.getHours()}`; };
  const [k, setK] = useState(key);
  useEffect(() => { const t = setInterval(() => setK(key()), 30_000); return () => clearInterval(t); }, []);
  return k;
}

function useWide() {
  const q = "(min-width: 900px)";
  const [wide, setWide] = useState(() => typeof matchMedia !== "undefined" && matchMedia(q).matches);
  useEffect(() => {
    const m = matchMedia(q);
    const on = () => setWide(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return wide;
}

/** Часы тикают сами по себе — экран вокруг не перерисовывается. */
function Clock() {
  const [t, setT] = useState(() => fmtTime(new Date()));
  useEffect(() => { const id = setInterval(() => setT(fmtTime(new Date())), 5_000); return () => clearInterval(id); }, []);
  return <time className="today-clock">{t}</time>;
}

// ------------------------------------------------------------------ сводка Оси

const BRIEF_TTL = 3 * 3600_000;
const briefKey = () => `brief3_${store.userId}_${L.code}_${dateOnly(new Date())}`;

function readBrief(): string | null {
  try {
    const m = JSON.parse(localStorage.getItem(briefKey()) ?? "null") as { at: string; text: string } | null;
    return m && Date.now() - new Date(m.at).getTime() < BRIEF_TTL && m.text ? m.text : null;
  } catch { return null; }
}
function writeBrief(text: string) {
  try {
    const key = briefKey();
    // вчерашние и чужие сводки не копим
    for (let i = localStorage.length - 1; i >= 0; i--) { const k = localStorage.key(i); if (k && k.startsWith("brief3_") && k !== key) localStorage.removeItem(k); }
    localStorage.setItem(key, JSON.stringify({ at: new Date().toISOString(), text }));
  } catch { /* приватный режим */ }
}

/** Сводка без ИИ — если сервер недоступен. */
function localBrief(): string {
  const s = store;
  const today = s.agenda(new Date());
  const crit = s.upcomingCritical(7).filter((c) => c.critical);
  const due = s.totalDue();
  return [
    today.length === 0 ? tr("• Сегодня в календаре пусто.") : tr("• Сегодня в плане: {0}.", [today.length]),
    ...(s.overdue.length ? [tr("• Просрочено задач: {0}.", [s.overdue.length])] : []),
    ...crit.slice(0, 2).map((c) => `• ${c.title} — ${relDay(c.date)}.`),
    ...(Object.keys(due).length ? [tr("• Тебе должны: {0}.", [moneyMap(due)])] : []),
  ].join("\n");
}

/** text: null — ещё не спрашивали, "" — Оси нечего сказать (карточка прячется). */
function useBrief() {
  const [text, setText] = useState<string | null>(readBrief);
  const [busy, setBusy] = useState(() => readBrief() == null);
  const live = useRef(true);
  const running = useRef(false);

  const load = useCallback(async (force = false) => {
    if (running.current) return;
    if (!force) {
      const cached = readBrief();
      if (cached != null) { setText(cached); setBusy(false); return; }
    }
    running.current = true;
    setBusy(true);
    try {
      const reply = (await Assistant.brief()).trim();
      if (reply) writeBrief(reply);
      if (live.current) setText(reply);
    } catch {
      if (live.current) setText((prev) => prev || localBrief());
    } finally {
      running.current = false;
      if (live.current) setBusy(false);
    }
  }, []);

  useEffect(() => {
    live.current = true;
    void load();
    return () => { live.current = false; };
  }, [load]);

  return { text, busy, reload: () => void load(true) };
}

/** Текст Оси: строки и жирный **…** — разбором в узлы, без HTML. */
function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split("\n").map((line, i) => (
        <p key={i} className={line.trim() ? undefined : "gap"}>
          {line.split(/\*\*(.+?)\*\*/g).map((part, k) => (k % 2 ? <b key={k}>{part}</b> : part))}
        </p>
      ))}
    </>
  );
}

function BriefCard({ brief }: { brief: ReturnType<typeof useBrief> }) {
  const { text, busy, reload } = brief;
  const [open, setOpen] = useState(false);
  const [full, setFull] = useState(0);
  const body = useRef<HTMLDivElement>(null);
  const CLOSED = 96;

  useLayoutEffect(() => {
    const el = body.current;
    if (!el) return;
    const measure = () => setFull(el.scrollHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [text]);

  const long = full > CLOSED + 8;
  const hidden = !busy && text === "";
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  return (
    <div className="today-fold">
      <Collapse open={!hidden}>
        <div className="today-bleed today-brief-wrap">
          <Card color="butter" seed={31} padding="12px 14px 14px 10px" className="today-brief" onClick={() => nav("/chat")}>
            <Osi size={64} mood={busy ? "thinking" : "happy"} />
            <div className="today-brief-main">
              <div className="today-brief-top">
                <span className="today-cap">{tr("ОСИ ГОВОРИТ")}</span>
                <button type="button" className={`today-brief-refresh${busy ? " busy" : ""}`} disabled={busy} aria-label={tr("Обновить сводку")} title={tr("Обновить сводку")}
                  onClick={(e) => { stop(e); reload(); }} onKeyDown={stop}>
                  <Icon name="refresh" size={16} />
                </button>
              </div>
              {!text ? (
                <p key={busy ? "busy" : "idle"} className="today-brief-wait appear">{busy ? tr("Собираю главное на сегодня…") : tr("Нажми, чтобы спросить Оси.")}</p>
              ) : (
                <>
                  <div className={`today-brief-clip${long && !open ? " faded" : ""}${busy ? " dim" : ""}`} style={{ maxHeight: long ? (open ? full : CLOSED) : undefined }}>
                    <div ref={body} className="today-brief-text appear"><Rich text={text} /></div>
                  </div>
                  <Collapse open={long}>
                    <button type="button" className="today-more" aria-expanded={open} tabIndex={long ? 0 : -1} onClick={(e) => { stop(e); setOpen((v) => !v); }} onKeyDown={stop}>
                      {open ? tr("свернуть") : tr("ещё…")}
                    </button>
                  </Collapse>
                </>
              )}
            </div>
          </Card>
        </div>
      </Collapse>
    </div>
  );
}

// ------------------------------------------------------------------ «+» — что добавить

function AddMenu({ day }: { day: Date }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", down);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("pointerdown", down); document.removeEventListener("keydown", key); };
  }, [open]);

  const items: { icon: string; color: string; title: string; sub: string; run: () => void }[] = [
    { icon: "calendar", color: "teal", title: tr("Событие"), sub: tr("Встреча, звонок, поездка"), run: () => void showEventEditor({ day }) },
    { icon: "check", color: "orange", title: tr("Задача"), sub: tr("Дело со сроком"), run: () => void showTaskEditor({ day }) },
    { icon: "notes", color: "mustard", title: tr("Заметка"), sub: tr("Мысль, идея, список"), run: () => void showNoteEditor() },
    { icon: "spark", color: "lavender", title: tr("Быстрая запись"), sub: tr("Скажи Оси — он разложит сам"), run: () => void showCapture() },
  ];

  return (
    <div ref={ref} className={`today-add${open ? " open" : ""}`}>
      <RoundButton icon="add" filled color="orange" label={tr("Добавить")} onClick={() => setOpen((v) => !v)} />
      <div className="today-add-menu" role="menu" aria-hidden={!open}>
        {items.map((it, i) => (
          <button key={it.icon} type="button" role="menuitem" tabIndex={open ? 0 : -1} className="today-add-item" style={{ transitionDelay: open ? `${40 + i * 45}ms` : "0ms" }}
            onClick={() => { setOpen(false); it.run(); }}>
            <span className="today-add-ico" style={{ background: colorOf(it.color) }}><Icon name={it.icon} size={17} /></span>
            <span className="today-add-text"><b>{it.title}</b><span>{it.sub}</span></span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** «Мой день | Друзья» — переключатель с бегущей подложкой. В вебе «Друзья» — отдельная страница. */
function SectionSwitch({ badge }: { badge: number }) {
  const [v, setV] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const go = () => {
    if (v === 1) return;
    setV(1);
    timer.current = setTimeout(() => nav("/friends"), 240); // подложка успевает доехать
  };
  return (
    <div className="today-switch" data-v={v}>
      <span className="today-switch-thumb" aria-hidden />
      <button type="button" aria-pressed={v === 0} onClick={() => setV(0)}><Icon name="today" size={16} />{tr("Мой день")}</button>
      <button type="button" aria-pressed={v === 1} onClick={go}>
        <Icon name="users" size={16} />{tr("Друзья")}
        {badge > 0 && <span className="count">{badge}</span>}
      </button>
    </div>
  );
}

// ------------------------------------------------------------------ блоки

function DateBlock({ day, s }: { day: Date; s: Store }) {
  const last = s.lastMood;
  const month = fmtDay(day).replace(/[\d.\s]+/, " ").trim();
  return (
    <div className="today-date">
      <div className="today-date-week">{fmtWeekday(day)}</div>
      <div className="today-date-row">
        <div className="today-date-left">
          <div className="today-date-num">{day.getDate()}</div>
          <div className="today-date-month">{month}</div>
        </div>
        <span className="today-date-rule" aria-hidden />
        <button type="button" className="today-date-right" onClick={() => void showMoodSheet()}>
          <Clock />
          <span className="today-date-mood">
            <i style={{ background: last ? colorOf(MoodScale.colors[last.score]) : "var(--line)" }} />
            <span>{last ? MoodScale.label(last.score) || tr("Настроение") : tr("Настроение?")}</span>
          </span>
        </button>
      </div>
      <div className="today-date-line" aria-hidden />
    </div>
  );
}

/** Строка задачи — как TaskRow в приложении. */
function TaskRow({ task, s }: { task: Task; s: Store }) {
  const now = new Date();
  const overdue = !task.done && !!task.dueAt && task.dueAt < (task.allDay ? day0(now) : now);
  const sub = [
    task.dueAt ? (task.allDay ? relDay(task.dueAt) : `${relDay(task.dueAt)}, ${fmtTime(task.dueAt)}`) : "",
    s.project(task.projectId)?.name ?? "",
  ].filter(Boolean).join(" · ");
  return (
    <Card color={task.done ? "var(--paper-deep)" : null} lift={2} seed={hash(task.id)} padding="9px 14px 9px 10px" className="today-task" onClick={() => void showTaskEditor({ task })}>
      <Check value={task.done} color={task.important ? P.danger : null} onChange={() => void s.toggleTask(task)} />
      <div className="today-task-main">
        <div className={`today-task-title${task.done ? " done" : ""}`}>{task.title}</div>
        <div className={`today-task-sub${overdue ? " late" : ""}`}>
          <i style={{ background: sphereColor(task.sphere) }} />
          <span>{sub || (task.sphere === "work" ? tr("Работа") : tr("Личное"))}</span>
        </div>
      </div>
      {task.important && !task.done && <Icon name="star" size={18} fill color={P.danger} />}
    </Card>
  );
}

function CriticalCard({ c, i, s }: { c: Critical; i: number; s: Store }) {
  const left = daysLeft(c.date);
  const color = left <= 1 ? P.danger : left <= 7 ? "orange" : "navy";
  const open = () => {
    if (c.kind === "stage" || c.kind === "tracker") nav("/goal/" + c.id);
    else if (c.kind === "project") nav("/project/" + c.id);
    else { const task = s.tasks.find((t) => t.id === c.id); if (task) void showTaskEditor({ task }); }
  };
  return (
    <Card color={color} seed={50 + i} padding={14} className="today-crit-card" onClick={open}>
      <div className="today-crit-left">
        <b>{left === 0 ? "!" : left}</b>
        <span>{left === 0 ? tr("сегодня") : plural(left, tr("день"), tr("дня"), tr("дней"))}</span>
      </div>
      <div className="today-crit-title">{c.title}</div>
      <div className="today-crit-sub">{c.subtitle} · {fmtDayShort(c.date)}</div>
    </Card>
  );
}

function CriticalBlock({ crit, wide, s }: { crit: Critical[]; wide: boolean; s: Store }) {
  const [more, setMore] = useState(false);
  const list = crit.slice(0, 12);
  if (!list.length) return null;
  if (!wide) {
    return (
      <section>
        <SectionTitle>{tr("Не проспать")}</SectionTitle>
        <div className="today-crit-scroll">
          {list.map((c, i) => <Appear key={c.kind + c.id + i} i={i}><CriticalCard c={c} i={i} s={s} /></Appear>)}
        </div>
      </section>
    );
  }
  const head = list.slice(0, 4), tail = list.slice(4);
  return (
    <section>
      <SectionTitle trailing={tail.length > 0 && <button type="button" className="today-link" aria-expanded={more} onClick={() => setMore((v) => !v)}>{more ? tr("свернуть") : tr("ещё…")}</button>}>{tr("Не проспать")}</SectionTitle>
      <div className="today-crit-grid">
        {head.map((c, i) => <Appear key={c.kind + c.id + i} i={i}><CriticalCard c={c} i={i} s={s} /></Appear>)}
      </div>
      {tail.length > 0 && (
        <div className="today-fold">
          <Collapse open={more}>
            <div className="today-bleed">
              <div className="today-crit-grid tail">
                {tail.map((c, i) => <CriticalCard key={c.kind + c.id + i} c={c} i={i + 4} s={s} />)}
              </div>
            </div>
          </Collapse>
        </div>
      )}
    </section>
  );
}

function MoneyCard({ s }: { s: Store }) {
  if (s.profile?.hoursTab) {
    // учёт часов: заработано за месяц и идущая смена
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1), to = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const earned = Object.entries(s.earned(from, to));
    const run = s.running;
    return (
      <Card color="sage" seed={61} className="today-stat" onClick={() => nav("/work")}>
        <div className="today-cap">{tr("ЗАРАБОТАНО · МЕСЯЦ")}</div>
        <div className="today-stat-big">{earned.length === 0 ? <div>0</div> : earned.map(([cur, v]) => <div key={cur}>{money(v, cur)}</div>)}</div>
        <div className="today-stat-sub strong">{fmtHours(s.hoursBetween(from, to))}</div>
        <div className="today-stat-foot">
          {run.length > 0
            ? <><i className="today-live" /><span>{tr("идёт смена с {0}", [fmtTime(run[0].start)])}</span></>
            : <><Icon name="play" size={12} fill /><span>{tr("Начать смену — на вкладке «Часы»")}</span></>}
        </div>
      </Card>
    );
  }
  const due = Object.entries(s.totalDue());
  const total = (id: string) => Object.values(s.clientDue(id)).reduce((a, b) => a + b, 0);
  const debtors = s.clients.filter((c) => Object.keys(s.clientDue(c.id)).length > 0).sort((a, b) => total(b.id) - total(a.id)).slice(0, 2);
  return (
    <Card color="sage" seed={61} className="today-stat" onClick={() => nav("/work")}>
      <div className="today-cap">{tr("ТЕБЕ ДОЛЖНЫ")}</div>
      <div className="today-stat-big">{due.length === 0 ? <div>{tr("Никто")}</div> : due.map(([cur, v]) => <div key={cur}>{money(v, cur)}</div>)}</div>
      {debtors.length > 0 && (
        <div className="today-debtors">
          {debtors.map((c) => (
            <div key={c.id}>
              <b>{c.name}</b>
              <span>{moneyMap(s.clientDue(c.id))}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function MoodCard({ s }: { s: Store }) {
  const now = new Date();
  const week = s.moods.filter((m) => Math.floor((now.getTime() - m.at.getTime()) / DAY) < 7);
  const avg = week.length ? week.reduce((a, m) => a + m.score, 0) / week.length : null;
  const bar = (back: number) => {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - back);
    const ms = s.moods.filter((m) => sameDate(m.at, day));
    return ms.length ? ms.reduce((a, m) => a + m.score, 0) / ms.length : 0;
  };
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  return (
    <Card color="lavender" seed={62} className="today-stat" onClick={() => void showMoodSheet()}>
      <div className="today-cap">{tr("НАСТРОЕНИЕ · 7 ДНЕЙ")}</div>
      <div className="today-stat-big"><div>{avg == null ? "—" : avg.toFixed(1)}</div></div>
      <div className="today-stat-sub">{avg == null ? tr("нет отметок") : MoodScale.label(Math.round(avg)).toLowerCase()}</div>
      <div className="today-bars" aria-hidden>
        {[6, 5, 4, 3, 2, 1, 0].map((d) => { const v = bar(d); return <i key={d} className={v === 0 ? "none" : undefined} style={{ height: v === 0 ? 3 : 4 + (v / 5) * 24 }} />; })}
      </div>
      <a href="#/mood" className="today-stat-link" onClick={stop} onKeyDown={stop}>{tr("Статистика")}<Icon name="right" size={14} /></a>
    </Card>
  );
}

function NotesCard({ s, wide }: { s: Store; wide: boolean }) {
  const sorted = [...s.notes].sort((a, b) => (a.pinned !== b.pinned ? (a.pinned ? -1 : 1) : b.updatedAt.getTime() - a.updatedAt.getTime()));
  const pinned = sorted.find((n) => n.pinned);
  const n = s.notes.length;
  const name = (x: { title: string; body: string }) => x.title || x.body || tr("Без названия");
  const preview = wide ? sorted.slice(0, 3) : [];
  return (
    <Card seed={70} className="today-notes" onClick={() => nav("/notes")}>
      <div className="today-notes-head">
        <Cutout kind="leaf" size={30} seed={6} color={P.mustard} style={{ transform: "rotate(28deg)" }} />
        <div className="today-notes-main">
          <h3>{tr("Заметки")}</h3>
          <p>
            {!wide && pinned
              ? <><Icon name="pinned" size={12} fill /> {name(pinned)}</>
              : tr("{0} {1}", [n, plural(n, tr("заметка"), tr("заметки"), tr("заметок"))])}
          </p>
        </div>
        <Icon name="right" size={18} color="var(--ink-soft)" />
      </div>
      {preview.length > 0 && (
        <ul className="today-notes-list">
          {preview.map((x) => (
            <li key={x.id}>
              {x.pinned ? <Icon name="pinned" size={12} fill /> : <i />}
              <span>{name(x)}</span>
              <time>{fmtDayShort(x.updatedAt)}</time>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

const FRIEND_COLORS = ["sage", "lavender", "peach", "sky", "butter", "blush"];

function FriendCard({ f, index }: { f: Friend; index: number }) {
  const fr = useFriends();
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    fr.avatarUrl(f).then((u) => { if (live) setUrl(u); }).catch(() => {});
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.id, f.avatarPath]);
  const invites = fr.invitesFrom(f.id).filter((x) => x.status === "pending").length;
  return (
    <Card color={FRIEND_COLORS[index % FRIEND_COLORS.length]} seed={hash(f.id)} padding={12} className="today-friend" onClick={() => nav("/friend/" + f.id)}>
      <span className="today-friend-ava">
        <AvatarView url={url} name={f.name} size={40} color="var(--cream)" />
        {invites > 0 && <span className="count">{invites}</span>}
      </span>
      <div className="today-friend-main">
        <b>{f.name}</b>
        {!f.sharesMood ? <span className="dim">{tr("настроение скрыто")}</span>
          : !f.mood ? <span className="dim">{tr("настроение ещё не отмечено")}</span>
          : <span><i style={{ background: colorOf(MoodScale.colors[f.mood.score]) }} />{[MoodScale.label(f.mood.score), ago(f.mood.at)].filter(Boolean).join(" · ")}</span>}
      </div>
      <Icon name="right" size={16} />
    </Card>
  );
}

function FriendsBlock() {
  const fr = useFriends();
  const list = fr.accepted;
  const inc = fr.list.filter((x) => x.status === "pending" && x.incoming);
  if (!list.length && !inc.length) return null;
  return (
    <section>
      <SectionTitle trailing={<a href="#/friends" className="today-link">{tr("все")}</a>}>{tr("Друзья")}</SectionTitle>
      <div className="today-friends">
        {inc.length > 0 && (
          <Appear>
            <Card color="butter" seed={77} padding="12px 14px" className="today-invite" onClick={() => nav("/friends")}>
              <Icon name="user-plus" size={20} />
              <b>{inc.length === 1 ? tr("{0} зовёт тебя в друзья", [inc[0].name]) : tr("Приглашений в друзья: {0}", [inc.length])}</b>
              <Icon name="right" size={16} />
            </Card>
          </Appear>
        )}
        {list.map((f, i) => <Appear key={f.id} i={i}><FriendCard f={f} index={i} /></Appear>)}
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ экран

export default function TodayScreen() {
  const s = useStore();
  const fr = useFriends();
  const wide = useWide();
  const brief = useBrief();
  const hourKey = useHourKey();
  const [[offset, dir], setDay] = useState<[number, number]>([0, 1]); // -1 — вчера, 0 — сегодня, 1 — завтра

  /** Вчера ↔ сегодня ↔ завтра (свайпом, пилюлями или стрелками). */
  const go = useCallback((to: number) => {
    setDay(([cur, d]) => { const o = Math.max(-1, Math.min(1, to)); return o === cur ? [cur, d] : [o, o > cur ? 1 : -1]; });
  }, []);
  const step = useCallback((by: number) => setDay(([cur, d]) => { const o = Math.max(-1, Math.min(1, cur + by)); return o === cur ? [cur, d] : [o, by]; }), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (document.documentElement.classList.contains("sheet-open")) return;
      step(e.key === "ArrowRight" ? 1 : -1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step]);

  // свайп по экрану на телефоне (горизонтальные ленты внутри не мешают)
  const touch = useRef<{ x: number; y: number; skip: boolean } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    const p = e.touches[0];
    touch.current = { x: p.clientX, y: p.clientY, skip: !!(e.target as HTMLElement).closest?.(".today-crit-scroll, .today-pills") };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const a = touch.current, p = e.changedTouches[0];
    touch.current = null;
    if (!a || a.skip || !p) return;
    const dx = p.clientX - a.x, dy = p.clientY - a.y;
    if (Math.abs(dx) > 64 && Math.abs(dx) > Math.abs(dy) * 1.8) step(dx < 0 ? 1 : -1);
  };

  const now = new Date();
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
  const items = s.agenda(day);
  const crit = s.upcomingCritical(45);
  const overdue = s.overdue.slice(0, 5);
  const h = now.getHours();
  const hello = h < 5 ? tr("Доброй ночи") : h < 12 ? tr("Доброе утро") : h < 18 ? tr("Добрый день") : tr("Добрый вечер");
  const name = (s.profile?.name ?? "").trim();
  const planTitle = offset === -1 ? tr("План на вчера") : offset === 1 ? tr("План на завтра") : tr("План на сегодня");
  const emptyTitle = offset === -1 ? tr("Вчера было свободно") : offset === 1 ? tr("Завтра пока пусто") : tr("Сегодня свободно");

  const briefCard = <BriefCard brief={brief} />;

  const plan: ReactNode = (
    <SlideSwitcher k={`plan${offset}`} dir={dir}>
      <SectionTitle trailing={<span className="today-count">{items.length}</span>}>{planTitle}</SectionTitle>
      {items.length === 0 ? (
        <EmptyState title={emptyTitle} text={offset < 0 ? tr("Ничего не было запланировано.") : tr("Скажи Оси, что запланировать, или добавь сам.")} mood="sleepy" action={tr("Добавить")} onAction={() => void showCapture()} />
      ) : (
        <Appear className="today-plan"><AgendaCards items={items} /></Appear>
      )}
    </SlideSwitcher>
  );

  const late: ReactNode = (
    <div className="today-fold">
      <Collapse open={overdue.length > 0 && offset === 0}>
        <div className="today-bleed">
          <SectionTitle trailing={<span className="today-count late">{s.overdue.length}</span>}>{tr("Просрочено")}</SectionTitle>
          <div className="today-tasks">
            {overdue.map((t, i) => <Appear key={t.id} i={i}><TaskRow task={t} s={s} /></Appear>)}
          </div>
        </div>
      </Collapse>
    </div>
  );

  const rest: ReactNode = (
    <>
      <CriticalBlock crit={crit} wide={wide} s={s} />
      <div className="today-stats">
        <MoneyCard s={s} />
        <MoodCard s={s} />
      </div>
      <NotesCard s={s} wide={wide} />
      <div className="today-fold">
        <Collapse open={offset === 0}>
          <div className="today-bleed"><FriendsBlock /></div>
        </Collapse>
      </div>
    </>
  );

  return (
    <div className="today" data-hour={hourKey} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <header className="today-head">
        <div className="today-hello">
          <h1>{name ? `${hello}, ${name}` : hello}<Icon name="hand" size={20} className="today-wave" /></h1>
          <p>{tr("Хорошего дня!")}</p>
        </div>
        <button type="button" className="today-avatar" aria-label={tr("Настройки")} title={tr("Настройки")} onClick={() => nav("/settings")}><PaperAvatar size={48} /></button>
      </header>

      <div className="today-bar">
        <SectionSwitch badge={fr.badge} />
        <div className="today-days">
          <div className="today-pills">
            {([[-1, tr("Вчера")], [0, tr("Сегодня")], [1, tr("Завтра")]] as [number, string][]).map(([o, label]) => <Pill key={o} dense selected={offset === o} onClick={() => go(o)}>{label}</Pill>)}
            <Pill dense onClick={() => nav("/calendar")}>{tr("Все")}</Pill>
          </div>
          <AddMenu day={day} />
        </div>
      </div>

      <div className="today-grid">
        <div className="today-main">
          <SlideSwitcher k={`date${offset}`} dir={dir}><DateBlock day={day} s={s} /></SlideSwitcher>
          {!wide && briefCard}
          {plan}
          {late}
          {!wide && rest}
        </div>
        {wide && (
          <aside className="today-side">
            {briefCard}
            {rest}
          </aside>
        )}
      </div>
    </div>
  );
}
