// Каркас веб-версии (порт app/lib/screens/shell.dart): на ноутбуке — боковое меню, которое сворачивается,
// на телефоне — нижняя панель вкладок с Оси по центру, как в приложении. Экраны грузятся по требованию.
import { Suspense, lazy, useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { tr } from "@/i18n";
import { Button, Icon, LogoMark, Osi, Wordmark, toast } from "@/ui";
import { useStore } from "../data/store";
import { useFriends } from "../data/friends";
import { nav, navDir, useRoute } from "../router";
import { PaperAvatar } from "../widgets/Avatar";
import { Plans, PlanChoiceScreen } from "../screens/plans/plans";
import Onboarding from "../screens/onboarding/Onboarding";
import { maybeShowCheckin } from "../screens/checkin";
import { maybeAskMood } from "../screens/mood/moodSheet";
import { showCapture } from "../screens/capture/capture";

const S = {
  today: lazy(() => import("../screens/today/TodayScreen")),
  calendar: lazy(() => import("../screens/calendar/CalendarScreen")),
  clients: lazy(() => import("../screens/projects/ClientsScreen")),
  client: lazy(() => import("../screens/projects/ClientScreen")),
  project: lazy(() => import("../screens/projects/ProjectScreen")),
  hours: lazy(() => import("../screens/hours/HoursScreen")),
  goals: lazy(() => import("../screens/goals/GoalsScreen")),
  goal: lazy(() => import("../screens/goals/TrackerScreen")),
  chat: lazy(() => import("../screens/chat/ChatScreen")),
  friends: lazy(() => import("../screens/friends/FriendsScreen")),
  friend: lazy(() => import("../screens/friends/FriendScreen")),
  notes: lazy(() => import("../screens/notes/NotesScreen")),
  mood: lazy(() => import("../screens/mood/MoodStatsScreen")),
  settings: lazy(() => import("../screens/settings/SettingsScreen")),
} satisfies Record<string, ComponentType>;

/** Первый сегмент пути → экран. `/work` — третья вкладка: «Проекты» или «Часы» по настройке профиля. */
function screenFor(seg: string, hours: boolean): keyof typeof S | null {
  if (seg === "" || seg === "today") return "today";
  if (seg === "work") return hours ? "hours" : "clients";
  if (seg === "projects") return "clients";
  return seg in S ? (seg as keyof typeof S) : null;
}

const COLLAPSE_KEY = "osiris_nav_collapsed";

export function Shell() {
  const s = useStore();
  const f = useFriends();
  const route = useRoute();
  const [collapsed, setCollapsed] = useState(() => { try { return localStorage.getItem(COLLAPSE_KEY) === "1"; } catch { return false; } });
  const entered = useRef(false);
  const p = s.profile;
  const hours = p?.hoursTab ?? false;
  const seg = route.parts[0] ?? "";
  const name = screenFor(seg, hours);

  useEffect(() => { s.onPlanBlocked = Plans.onServerBlock; return () => { s.onPlanBlocked = null; }; }, [s]);

  // тосты из хранилища: «Готово ✓ Следующий раз — …», ошибки сервера
  useEffect(() => {
    if (s.notice) { toast(s.notice); s.clearNotice(); }
    else if (s.error && s.loaded) { toast(s.error, "error"); s.clearNotice(); }
  }, [s, s.notice, s.error, s.loaded]);

  const ready = s.loaded && !!p;
  const gate = !ready ? null : !p.onboarded ? "onboarding" : !p.planChosen ? "plan" : null;

  // при входе: сначала «Ты это сделал?», потом опрос настроения — два листа подряд не показываем
  useEffect(() => {
    if (!ready || gate || entered.current) return;
    entered.current = true;
    const t = setTimeout(async () => { if (!(await maybeShowCheckin())) await maybeAskMood(); }, 900);
    return () => clearTimeout(t);
  }, [ready, gate]);

  useEffect(() => { document.title = "OSIRIS"; window.scrollTo(0, 0); }, [route.path]);

  const items = useMemo(() => [
    { path: "/", key: "today", icon: "today", label: tr("Сегодня") },
    { path: "/calendar", key: "calendar", icon: "calendar", label: tr("Календарь") },
    { path: "/work", key: "work", icon: hours ? "clock" : "briefcase", label: hours ? tr("Часы") : tr("Проекты") },
    { path: "/goals", key: "goals", icon: "star", label: tr("Цели") },
  ], [hours]);
  const more = useMemo(() => [
    { path: "/chat", key: "chat", icon: "chat", label: tr("Оси") },
    { path: "/friends", key: "friends", icon: "users", label: tr("Друзья"), badge: f.badge },
    { path: "/notes", key: "notes", icon: "notes", label: tr("Заметки") },
    { path: "/mood", key: "mood", icon: "smile", label: tr("Настроение") },
  ], [f.badge]);
  const activeKey = name === "today" ? "today" : name === "clients" || name === "hours" || name === "client" || name === "project" ? "work" : name === "goal" ? "goals" : name === "friend" ? "friends" : name ?? "";

  if (!ready) {
    return (
      <div className="splash">
        <Osi size={120} mood={s.online ? "thinking" : "worried"} />
        <p>{s.online ? tr("Загружаю…") : tr("Нет связи с сервером. Проверь интернет.")}</p>
        {!s.online && <Button small onClick={() => void s.loadAll()}>{tr("Повторить")}</Button>}
      </div>
    );
  }
  if (gate === "onboarding") return <div className="gate appear"><Onboarding onDone={() => void s.reloadProfile()} /></div>;
  if (gate === "plan") return <div className="gate appear"><PlanChoiceScreen onDone={() => void s.reloadProfile()} /></div>;

  const Screen = name ? S[name] : null;
  const toggle = () => setCollapsed((v) => { try { localStorage.setItem(COLLAPSE_KEY, v ? "0" : "1"); } catch { /* */ } return !v; });
  const link = (it: { path: string; key: string; icon: string; label: string; badge?: number }) => (
    <a key={it.key} href={"#" + it.path} className={`nav-item${activeKey === it.key ? " on" : ""}`} aria-current={activeKey === it.key ? "page" : undefined} title={collapsed ? it.label : undefined}>
      <span className="nav-ico"><Icon name={it.icon} size={20} fill={activeKey === it.key} />{!!it.badge && <span className="count">{it.badge}</span>}</span>
      <span className="nav-label">{it.label}</span>
    </a>
  );

  return (
    <div className={`shell${collapsed ? " collapsed" : ""}`}>
      <aside className="side" aria-label={tr("Меню")}>
        <div className="side-top">
          <a href="#/" className="side-logo" aria-label="OSIRIS"><LogoMark size={34} /><Wordmark size={17} className="nav-label" /></a>
          <button type="button" className="side-toggle" onClick={toggle} aria-label={collapsed ? tr("Развернуть меню") : tr("Свернуть меню")} aria-expanded={!collapsed}>
            <Icon name={collapsed ? "panel-open" : "panel-close"} size={18} />
          </button>
        </div>
        <button type="button" className="osi-cta" onClick={() => void showCapture()} title={tr("Быстрая запись")}>
          <Osi size={44} mood="happy" />
          <span className="nav-label"><b>{tr("Быстрая запись")}</b><small>{tr("Скажи или напиши — Оси разложит")}</small></span>
        </button>
        <nav className="side-nav">
          {items.map(link)}
          <span className="nav-sep" />
          {more.map(link)}
        </nav>
        <a href="#/settings" className={`side-me${activeKey === "settings" ? " on" : ""}`} title={tr("Настройки")}>
          <PaperAvatar size={38} />
          <span className="nav-label"><b>{p.name || tr("Профиль")}</b><small>{tr("Настройки")}</small></span>
          <Icon name="settings" size={17} className="nav-label" />
        </a>
      </aside>

      <main className="content" id="main">
        {!s.online && <div className="offline appear" role="status"><Icon name="alert" size={15} />{tr("Нет связи с сервером. Проверь интернет.")}<button type="button" onClick={() => void s.loadAll()}>{tr("Повторить")}</button></div>}
        <div key={route.path} className="page" style={{ ["--from" as string]: `${navDir() >= 0 ? 22 : -22}px` }}>
          <Suspense fallback={<div className="page-loading"><Osi size={84} mood="thinking" /></div>}>
            {Screen ? <Screen /> : <NotFound />}
          </Suspense>
        </div>
      </main>

      <nav className="tabbar" aria-label={tr("Меню")}>
        <span className="tab-glow" style={{ ["--i" as string]: Math.max(0, ["today", "calendar", "", "work", "goals"].indexOf(activeKey)), opacity: ["today", "calendar", "work", "goals"].includes(activeKey) ? 1 : 0 }} />
        {items.slice(0, 2).map((it) => <TabLink key={it.key} it={it} on={activeKey === it.key} />)}
        <button type="button" className="tab-osi" aria-label={tr("Оси")} onClick={() => nav("/chat")} onContextMenu={(e) => { e.preventDefault(); void showCapture({ voice: true }); }}>
          <Osi size={52} mood={activeKey === "chat" ? "excited" : "happy"} />
        </button>
        {items.slice(2).map((it) => <TabLink key={it.key} it={it} on={activeKey === it.key} />)}
      </nav>
    </div>
  );
}

function TabLink({ it, on }: { it: { path: string; icon: string; label: string }; on: boolean }) {
  return (
    <a href={"#" + it.path} className={`tab${on ? " on" : ""}`} aria-current={on ? "page" : undefined}>
      <Icon name={it.icon} size={21} fill={on} />
      <span>{it.label}</span>
    </a>
  );
}

function NotFound() {
  return (
    <div className="splash">
      <Osi size={110} mood="worried" />
      <p>{tr("Страница не найдена")}</p>
      <Button small onClick={() => nav("/", { replace: true })}>{tr("На главную")}</Button>
    </div>
  );
}
