// Маршруты веб-версии в hash: /app/#/calendar, /app/#/client/<id>. Hash не уходит на сервер,
// поэтому GitHub Pages всегда отдаёт один app/index.html, а «назад» в браузере работает как положено.
import { useSyncExternalStore } from "react";

export interface Route { path: string; parts: string[]; query: URLSearchParams }

const parse = (): Route => {
  const raw = (typeof location === "undefined" ? "" : location.hash).replace(/^#/, "") || "/";
  const [p, q = ""] = raw.split("?");
  const path = p.startsWith("/") ? p : "/" + p;
  return { path, parts: path.split("/").filter(Boolean), query: new URLSearchParams(q) };
};

let current = parse();
let dir = 1;
let depth = 0; // сколько переходов сделано внутри приложения (есть ли куда «назад»)
const subs = new Set<() => void>();
if (typeof window !== "undefined") {
  window.addEventListener("hashchange", () => { current = parse(); subs.forEach((f) => f()); });
  window.addEventListener("popstate", () => { dir = -1; });
}

/** Перейти: nav('/calendar'), nav('/client/' + id). replace — без записи в историю. */
export function nav(path: string, { replace = false }: { replace?: boolean } = {}) {
  dir = 1;
  const url = "#" + path;
  if (replace) { history.replaceState(null, "", url); current = parse(); subs.forEach((f) => f()); }
  else { depth++; location.hash = path; }
}
/** Назад; если истории нет (страницу открыли по прямой ссылке) — на fallback. */
export function back(fallback = "/") {
  dir = -1;
  if (depth > 0) { depth--; history.back(); }
  else nav(fallback, { replace: true });
  dir = -1;
}
/** Направление последнего перехода: 1 — вперёд, -1 — назад (для анимации страниц). */
export const navDir = () => dir;

export function useRoute(): Route {
  return useSyncExternalStore((f) => { subs.add(f); return () => void subs.delete(f); }, () => current, () => current);
}
