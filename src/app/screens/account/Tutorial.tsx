// Обучение при первом входе — порт app/lib/screens/account/tutorial.dart: пять листов о том, как пользоваться OSIRIS.
// Показывается один раз (profiles.tutorial_seen_at), повторно открывается из настроек (replay — флаг не трогаем).
// Листается кнопками, стрелками клавиатуры, смахиванием и точками; Esc — пропустить.
import { sb } from "../../sb";
import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { tr } from "@/i18n";
import { Button, Cutout, Icon, Osi, PaperSheet, RoundButton, type CutKind, type OsiMood } from "@/ui";
import { NAMED } from "@/ui/palette";
import type { Profile } from "../../data/models";
import { store } from "../../data/store";
import "./account.css";

/** Обучение ещё не показывали (и поле в профиле точно есть — иначе не знаем и не мешаем). */
export const tutorialNeeded = (p: Profile | null): boolean => !!p && "tutorial_seen_at" in p.raw && p.raw.tutorial_seen_at == null;

type Page = { color: string; mood: OsiMood; icon: string; a: CutKind; b: CutKind; title: string; text: string };

// в вебе «удерживай Оси» не работает — берём вариант текста без долгого нажатия (как в приложении не на iOS)
const pages = (): Page[] => [
  { color: "orange", mood: "happy", icon: "eye", a: "sun", b: "star", title: tr("Это Оси"), text: tr("Твой бумажный помощник. Он следит за датами, делами и деньгами и подсказывает, что важно сегодня.") },
  { color: "butter", mood: "listening", icon: "mic", a: "cloud", b: "spark", title: tr("Просто скажи или напиши"), text: tr("Нажми на Оси внизу экрана и расскажи, что у тебя на уме — текстом или голосом. Оси сам разложит всё по местам.") },
  { color: "sage", mood: "excited", icon: "tick", a: "leaf", b: "ring", title: tr("Ничего без твоего «Применить»"), text: tr("Оси покажет карточки с тем, что собирается добавить или изменить. Подходит — жми «Применить». Лишнее убери крестиком.") },
  { color: "lavender", mood: "calm", icon: "calendar", a: "blob", b: "star", title: tr("День, календарь, работа и цели"), text: tr("Внизу четыре вкладки: Сегодня, Календарь, Проекты или Часы и Цели. Оранжевый плюс добавляет дело вручную.") },
  { color: "blush", mood: "happy", icon: "users", a: "drop", b: "sun", title: tr("Настроение, заметки и друзья"), text: tr("Настроение и заметки живут на главной. Переключатель «Друзья» показывает планы близких, а твой аватар открывает настройки.") },
];

const EXIT_MS = 280;

export function TutorialScreen({ replay = false, onDone }: { replay?: boolean; onDone?: () => void }) {
  const list = pages();
  const [i, setI] = useState(0);
  const [dir, setDir] = useState(1);
  const [closing, setClosing] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const touch = useRef<[number, number] | null>(null);
  const last = i === list.length - 1;
  const page = list[i];

  const finish = () => {
    if (closing) return;
    setClosing(true);
    setTimeout(() => {
      if (!replay) {
        void store.updateProfile({ tutorial_seen_at: new Date().toISOString() });
        // приветственное письмо — сервер отправит его один раз
        void sb.functions.invoke("account", { body: { action: "welcome" } }).catch(() => undefined);
      }
      onDone?.();
    }, EXIT_MS);
  };
  const go = (to: number) => {
    if (closing || to === i || to < 0 || to >= list.length) return;
    setDir(to > i ? 1 : -1);
    setI(to);
  };
  const next = () => (last ? finish() : go(i + 1));
  const live = useRef({ next, go, finish, i });
  live.current = { next, go, finish, i };

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    root.current?.querySelector<HTMLElement>(".tut-next")?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (document.querySelector(".sheet-layer") || e.altKey || e.ctrlKey || e.metaKey) return; // поверх открыт лист — клавиши его
      const el = root.current, t = e.target as HTMLElement | null;
      const { next, go, finish, i } = live.current;
      if (e.key === "ArrowRight") { e.preventDefault(); go(i + 1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); go(i - 1); }
      else if (e.key === "Escape") { e.preventDefault(); finish(); }
      else if (e.key === "Enter" && !(t && el?.contains(t) && t.closest("button, a"))) { e.preventDefault(); next(); } // на кнопке Enter сработает сам
      else if (e.key === "Tab" && el) {
        // фокус не уходит под обучение
        const f = [...el.querySelectorAll<HTMLElement>("button:not([disabled])")];
        if (!f.length) return;
        const first = f[0], end = f[f.length - 1], cur = document.activeElement;
        if (!el.contains(cur)) { e.preventDefault(); first.focus(); }
        else if (e.shiftKey && cur === first) { e.preventDefault(); end.focus(); }
        else if (!e.shiftKey && cur === end) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); prev?.focus?.({ preventScroll: true }); };
  }, []);

  const onTouchEnd = (e: React.TouchEvent) => {
    const s = touch.current, t = e.changedTouches[0];
    touch.current = null;
    if (!s || !t) return;
    const dx = t.clientX - s[0], dy = t.clientY - s[1];
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.4) go(i + (dx < 0 ? 1 : -1));
  };

  return (
    <div ref={root} className={`tut${closing ? " closing" : ""}`} role="dialog" aria-modal="true" aria-labelledby="tut-title">
      <header className="tut-top">
        <span className="tut-count">{i + 1} / {list.length}</span>
        <button type="button" className="tut-skip" onClick={finish}>{replay ? tr("Закрыть") : tr("Пропустить")}</button>
      </header>

      <div className="tut-stage" onTouchStart={(e) => { const t = e.touches[0]; touch.current = t ? [t.clientX, t.clientY] : null; }} onTouchEnd={onTouchEnd}>
        <div key={i} className="tut-page" style={{ "--dir": dir } as CSSProperties}>
          <div className="tut-art" aria-hidden>
            <PaperSheet w={230} h={230} r={44} color={NAMED[page.color]} seed={30 + i} lift={6} className="tut-sheet" />
            <Cutout kind={page.a} size={58} color="#F7F3EA" seed={5 + i} className="tut-cut a" />
            <Cutout kind={page.b} size={50} color={NAMED.mustard} seed={11 + i} className="tut-cut b" />
            <Osi size={170} mood={page.mood} wave={i === 0} className="tut-osi" />
            <PaperSheet w={56} h={56} r={28} color="#F7F3EA" seed={60 + i} lift={3} className="tut-badge"><Icon name={page.icon} size={26} color="#1F1D1A" /></PaperSheet>
          </div>
          <div className="tut-text" aria-live="polite">
            <h1 id="tut-title">{page.title}</h1>
            <p>{page.text}</p>
          </div>
        </div>
      </div>

      <footer className="tut-foot">
        <div className="tut-dots">
          {list.map((p, k) => (
            <button key={k} type="button" className={k === i ? "on" : undefined} aria-label={`${k + 1} / ${list.length}: ${p.title}`} aria-current={k === i ? "step" : undefined} onClick={() => go(k)}><span /></button>
          ))}
        </div>
        <div className="tut-nav">
          <RoundButton icon="left" size={48} filled label={tr("Назад")} onClick={() => go(i - 1)} className={`tut-back${i === 0 ? " off" : ""}`} />
          <Button expand color="orange" className="tut-next" onClick={next}>{last ? tr("Начать") : tr("Дальше")}</Button>
        </div>
      </footer>
    </div>
  );
}

// ------------------------------------------------------------------ повтор из настроек

let replayOpen = false;
const subs = new Set<() => void>();
const setReplay = (v: boolean) => { replayOpen = v; subs.forEach((f) => f()); };

/** Показать обучение ещё раз (Настройки → Аккаунт → Помощь). Отметку в профиле не трогает. */
export const replayTutorial = () => setReplay(true);

/** Ставится один раз в каркасе: рисует повтор обучения поверх экрана. */
export function TutorialHost() {
  const open = useSyncExternalStore((f) => { subs.add(f); return () => void subs.delete(f); }, () => replayOpen, () => false);
  useEffect(() => () => { replayOpen = false; }, []);
  return open ? <TutorialScreen replay onDone={() => setReplay(false)} /> : null;
}
