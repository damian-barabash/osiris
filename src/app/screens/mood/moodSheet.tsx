// Опрос настроения и редактор «Что влияет» — порт app/lib/screens/mood/mood_sheet.dart и mood_tags_sheet.dart.
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { tr } from "@/i18n";
import { Button, Card, Collapse, Field, Icon, Osi, Pill, RoundButton, SheetHeader, confirm, openSheet, toast, type OsiMood } from "@/ui";
import { friends } from "../../data/friends";
import { store, useStore } from "../../data/store";
import "./mood.css";

/** Шкала настроения 1–5: цвета, подписи, лицо Оси, список «Что влияет». */
export const MoodScale = {
  colors: { 1: "clay", 2: "blush", 3: "mustard", 4: "sage", 5: "orange" } as Record<number, string>,
  osi: { 1: "sad", 2: "worried", 3: "calm", 4: "happy", 5: "excited" } as Record<number, OsiMood>,
  label: (score: number): string => [tr("Ужасно"), tr("Так себе"), tr("Нормально"), tr("Хорошо"), tr("Отлично")][Math.min(5, Math.max(1, Math.round(score))) - 1],
  /** Стандартные теги (русские ключи, показывать через tr). */
  defaults: ["работа", "клиенты", "деньги", "сон", "спорт", "семья", "друзья", "здоровье", "отдых", "стресс", "творчество", "погода", "еда", "учёба"],
  /** Список «Что влияет» этого пользователя (свой из профиля или стандартный). */
  current: (): string[] => store.profile?.moodTags ?? MoodScale.defaults,
  greeting: (): string => {
    const h = new Date().getHours();
    if (h < 5) return tr("Не спится? Как ты?");
    if (h < 12) return tr("Доброе утро! Как ты сейчас?");
    if (h < 18) return tr("Как проходит день?");
    return tr("Как прошёл день?");
  },
};

const SKIP_KEY = "mood_skipped_at";
const markSkipped = () => { try { localStorage.setItem(SKIP_KEY, new Date().toISOString()); } catch { /* приватный режим */ } };

// ------------------------------------------------------------------ опрос

function MoodSheet({ close }: { close: (saved?: boolean) => void }) {
  const s = useStore();
  const [score, setScore] = useState<number | null>(null);
  const [energy, setEnergy] = useState(3);
  const [tags, setTags] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const list = MoodScale.current();

  const save = async () => {
    if (score == null || busy) return;
    setBusy(true);
    await s.insert("moods", { score, energy, tags, note: note.trim() });
    close(true);
  };

  const editTags = async (add = false) => {
    await showMoodTagsSheet({ add, onRename: (old, now) => setTags((t) => t.map((x) => (x === old ? now : x))) });
    const now = MoodScale.current();
    setTags((t) => t.filter((x) => now.includes(x))); // убранные — снимаются
  };

  return (
    <div className="mood-sheet">
      <div className="mood-hello">
        <Osi size={96} mood={score == null ? "happy" : MoodScale.osi[score]} wave={score == null} />
        <div>
          <h2>{MoodScale.greeting()}</h2>
          <p>{tr("Отметь настроение — я соберу статистику и замечу, что на него влияет.")}</p>
        </div>
      </div>

      <div className="mood-leaves" aria-label={tr("Настроение")}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Card key={n} color={MoodScale.colors[n]} seed={n * 7} lift={score === n ? 6 : 2.5} padding="10px 2px" onClick={() => setScore(n)}
            className={`mood-leaf${score === n ? " on" : score != null ? " off" : ""}`} aria-pressed={score === n}>
            <Osi size={46} mood={MoodScale.osi[n]} animate={score === n} />
            <span>{MoodScale.label(n)}</span>
          </Card>
        ))}
      </div>

      <Collapse open={score != null}>
        <div className="mood-more">
          <div className="mood-line">
            <span className="mood-label">{tr("ЭНЕРГИЯ")}</span>
            <div className="mood-energy" role="radiogroup" aria-label={tr("ЭНЕРГИЯ")}>
              {[1, 2, 3, 4, 5].map((e) => (
                <button key={e} type="button" role="radio" aria-checked={e === energy} aria-label={String(e)} className={e <= energy ? "on" : ""} onClick={() => setEnergy(e)}>
                  <Icon name="bolt" size={26} fill strokeWidth={1.6} />
                </button>
              ))}
            </div>
          </div>
          <div className="mood-line">
            <span className="mood-label">{tr("ЧТО ВЛИЯЕТ")}</span>
            <button type="button" className="mood-link" onClick={() => void editTags()}><Icon name="pencil" size={14} />{tr("Изменить")}</button>
          </div>
          <div className="mood-tags">
            {list.map((t) => <Pill key={t} dense selected={tags.includes(t)} onClick={() => setTags((x) => (x.includes(t) ? x.filter((y) => y !== t) : [...x, t]))}>{tr(t)}</Pill>)}
            <Pill dense icon="add" onClick={() => void editTags(true)}>{tr("Свой")}</Pill>
          </div>
          <Field label={tr("Пара слов (необязательно)")} value={note} onChange={setNote} maxLines={3} />
          <Button expand busy={busy} color={score == null ? null : MoodScale.colors[score]} onClick={() => void save()}>{tr("Сохранить")}</Button>
        </div>
      </Collapse>

      <div className="mood-later"><button type="button" className="mood-link" onClick={() => close(false)}>{tr("Позже")}</button></div>
    </div>
  );
}

/** Опрос настроения: true — отметку сохранили. */
export const askMood = (): Promise<boolean> => openSheet<boolean>((close) => <MoodSheet close={close} />).then((v) => v === true);

/** Опрос настроения (лист). */
export function showMoodSheet(): Promise<void> { return askMood().then(() => {}); }

let asking = false;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const sheetOpen = () => typeof document !== "undefined" && !!document.querySelector(".sheet-layer");

/** Показать опрос, если с последней отметки (или с «Позже») прошло больше интервала из профиля. */
export async function maybeAskMood(): Promise<void> {
  if (asking || !store.loaded || !store.profile) return;
  asking = true;
  try {
    // сначала приглашения друзей: если есть непоказанные — настроение спросим в следующий раз (как в приложении)
    for (let k = 0; k < 15 && !friends.invitesLoaded; k++) await sleep(100);
    if (friends.invitesToMe.some((i) => !friends.inviteSeen.has(i.id)) || sheetOpen()) return;
    const interval = (store.profile?.moodInterval ?? 4) * 3_600_000;
    let skipped: Date | null = null;
    try { const v = localStorage.getItem(SKIP_KEY); if (v && !Number.isNaN(Date.parse(v))) skipped = new Date(v); } catch { /* приватный режим */ }
    const last = [store.lastMood?.at, skipped].filter((x): x is Date => !!x).reduce<Date | null>((a, b) => (!a || b > a ? b : a), null);
    if (last && Date.now() - last.getTime() < interval) return;
    if (!(await askMood())) markSkipped();
  } finally {
    asking = false;
  }
}

// ------------------------------------------------------------------ редактор «Что влияет»

const MAX_LEN = 24, MAX_TAGS = 60;
const listEq = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

function RenameDialog({ value, close }: { value: string; close: (v?: string) => void }) {
  const [v, setV] = useState(value);
  return (
    <div className="dialog">
      <h3>{tr("Переименовать")}</h3>
      <Field value={v} onChange={setV} autoFocus maxLength={MAX_LEN} onEnter={() => close(v)} />
      <div className="dialog-actions">
        <Button ghost onClick={() => close()}>{tr("Отмена")}</Button>
        <Button onClick={() => close(v)}>{tr("Сохранить")}</Button>
      </div>
    </div>
  );
}

function MoodTagsSheet({ close, add, onRename }: { close: () => void; add: boolean; onRename?: (old: string, now: string) => void }) {
  const s = useStore();
  const [list, setList] = useState<string[]>(() => [...MoodScale.current()]);
  const [text, setText] = useState("");
  const [drag, setDrag] = useState<{ from: number; to: number; dy: number; h: number } | null>(null);
  const origin = useRef({ y: 0, scroll: 0, el: null as HTMLElement | null });
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => { if (add) root.current?.querySelector<HTMLInputElement>(".mood-add input")?.focus({ preventScroll: true }); }, [add]);

  const save = (next: string[]) => {
    setList(next);
    // совпадает со стандартным — храним null, чтобы новые стандартные теги приходили сами
    void s.updateProfile({ mood_tags: listEq(next, MoodScale.defaults) ? null : next });
  };

  /** Чистит ввод; null — пусто или такой уже есть (по названию на экране, без регистра). */
  const clean = (raw: string, except?: string): string | null => {
    let t = raw.trim().replace(/\s+/g, " ");
    if (!t) return null;
    if (t.length > MAX_LEN) t = t.slice(0, MAX_LEN).trim();
    const k = t.toLowerCase();
    if (list.some((x) => x !== except && (x.toLowerCase() === k || tr(x).toLowerCase() === k))) {
      toast(tr("«{0}» уже есть", [t]));
      return null;
    }
    return t;
  };

  const addTag = () => {
    if (list.length >= MAX_TAGS) return toast(tr("Не больше {0} тегов", [MAX_TAGS]));
    const t = clean(text);
    if (!t) return;
    setText("");
    save([...list, t]);
  };

  const rename = async (old: string) => {
    const r = await openSheet<string>((c) => <RenameDialog value={tr(old)} close={c} />);
    if (r == null || r.trim() === tr(old)) return;
    const t = clean(r, old);
    if (!t) return;
    save(list.map((x) => (x === old ? t : x)));
    onRename?.(old, t);
    // старые отметки тоже переименовываются, чтобы статистика не делилась на два тега
    const patches: Record<string, { tags: string[] }> = {};
    for (const m of store.moods) if (m.tags.includes(old)) patches[m.id] = { tags: m.tags.map((x) => (x === old ? t : x)) };
    if (Object.keys(patches).length) await store.updateMany("moods", patches);
  };

  const remove = async (t: string) => {
    if (await confirm(tr("Убрать «{0}»? В старых отметках он останется.", [tr(t)]), { action: tr("Убрать") })) save(list.filter((x) => x !== t));
  };

  const reset = async () => {
    if (await confirm(tr("Вернуть стандартный список? Свои теги пропадут из списка, старые отметки не изменятся."), { action: tr("Вернуть"), danger: false })) save([...MoodScale.defaults]);
  };

  const move = (a: number, b: number) => {
    if (b < 0 || b >= list.length || a === b) return;
    const next = [...list];
    next.splice(b, 0, next.splice(a, 1)[0]);
    save(next);
  };

  // перетаскивание за «ручку»: строка едет за пальцем, соседи расступаются
  const onDown = (i: number) => (e: React.PointerEvent<HTMLButtonElement>) => {
    const row = e.currentTarget.closest<HTMLElement>(".mood-tag-row");
    if (!row) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const scroller = row.closest<HTMLElement>(".sheet-body");
    origin.current = { y: e.clientY, scroll: scroller?.scrollTop ?? 0, el: scroller };
    setDrag({ from: i, to: i, dy: 0, h: row.offsetHeight + 8 });
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag) return;
    const o = origin.current;
    if (o.el) {
      const r = o.el.getBoundingClientRect();
      if (e.clientY < r.top + 70) o.el.scrollBy(0, -10);
      else if (e.clientY > r.bottom - 110) o.el.scrollBy(0, 10);
    }
    const dy = e.clientY - o.y + ((o.el?.scrollTop ?? 0) - o.scroll);
    setDrag({ ...drag, dy, to: Math.min(list.length - 1, Math.max(0, drag.from + Math.round(dy / drag.h))) });
  };
  const onUp = () => {
    if (!drag) return;
    const { from, to } = drag;
    setDrag(null);
    move(from, to);
  };

  const shift = (i: number): CSSProperties | undefined => {
    if (!drag) return undefined;
    if (i === drag.from) return { transform: `translateY(${drag.dy}px) rotate(-0.6deg)` };
    if (drag.from < i && i <= drag.to) return { transform: `translateY(${-drag.h}px)` };
    if (drag.to <= i && i < drag.from) return { transform: `translateY(${drag.h}px)` };
    return undefined;
  };

  return (
    <div ref={root}>
      <SheetHeader title={tr("Что влияет")} sub={tr("Нажми, чтобы переименовать. Держи и тяни, чтобы поменять порядок.")} close={close} />
      <ul className={`mood-tag-list${drag ? " dragging" : ""}`}>
        {list.map((t, i) => (
          <li key={t} className={`mood-tag-row${drag?.from === i ? " drag" : ""}`} style={shift(i)}>
            <button type="button" className="mood-grip" aria-label={tr("Поменять порядок: {0}", [tr(t)])} onPointerDown={onDown(i)} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
              onKeyDown={(e) => { if (e.key === "ArrowUp") { e.preventDefault(); move(i, i - 1); } else if (e.key === "ArrowDown") { e.preventDefault(); move(i, i + 1); } }}>
              <Icon name="grip" size={18} />
            </button>
            <button type="button" className="mood-tag-name" onClick={() => void rename(t)}>{tr(t)}</button>
            <RoundButton icon="pencil" size={36} label={tr("Переименовать")} onClick={() => void rename(t)} />
            <RoundButton icon="trash" size={36} color="clay" label={tr("Убрать")} className="mood-tag-del" onClick={() => void remove(t)} />
          </li>
        ))}
      </ul>
      <div className="mood-add">
        <Field label={tr("Новый тег")} hint={tr("например, кофе")} value={text} onChange={setText} maxLength={MAX_LEN} onEnter={addTag} />
        <RoundButton icon="add" filled size={48} label={tr("Добавить")} onClick={addTag} />
      </div>
      <Collapse open={!listEq(list, MoodScale.defaults)}>
        <div className="mood-later"><button type="button" className="mood-link" onClick={() => void reset()}>{tr("Вернуть стандартные")}</button></div>
      </Collapse>
    </div>
  );
}

/** Редактор «Что влияет»: добавить, переименовать, убрать, поменять порядок, вернуть стандартные. onRename(старое, новое) — чтобы открытый опрос не потерял отмеченный тег. */
export function showMoodTagsSheet({ add = false, onRename }: { add?: boolean; onRename?: (old: string, now: string) => void } = {}): Promise<void> {
  return openSheet<void>((close) => <MoodTagsSheet close={() => close()} add={add} onRename={onRename} />).then(() => {});
}
