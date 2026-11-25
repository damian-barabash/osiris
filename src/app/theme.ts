// Тема: светлая, тёмная или как в системе (как ThemeCtl в приложении). Хранится в браузере.
const KEY = "osiris_theme";
export type ThemeMode = "system" | "light" | "dark";
const mq = typeof matchMedia === "undefined" ? null : matchMedia("(prefers-color-scheme: dark)");

export const Theme = {
  mode: "system" as ThemeMode,
  get dark() { return Theme.mode === "dark" || (Theme.mode === "system" && !!mq?.matches); },
  init() {
    try { const v = localStorage.getItem(KEY); if (v === "light" || v === "dark") Theme.mode = v; } catch { /* */ }
    mq?.addEventListener("change", apply);
    apply();
  },
  set(m: ThemeMode) {
    Theme.mode = m;
    try { m === "system" ? localStorage.removeItem(KEY) : localStorage.setItem(KEY, m); } catch { /* */ }
    apply();
  },
};
function apply() {
  const d = Theme.dark;
  document.documentElement.dataset.theme = d ? "dark" : "light";
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", d ? "#1c1b18" : "#eee9dd");
}
