// Отчёт об ошибке в журнал админки (Edge Function `site`, action error). Без личных данных: текст, стек, адрес страницы.
import { FN, SUPABASE_KEY, WEB_VERSION } from "@/config";

let sent = 0;
const seen = new Set<string>();

export function reportError(e: unknown, where = "") {
  try {
    const err = e as { message?: string; stack?: string };
    const message = String(err?.message ?? e).slice(0, 500);
    const key = where + message;
    if (seen.has(key) || sent >= 8 || /ResizeObserver loop|Script error\.?$/.test(message)) return; // не шумим
    seen.add(key);
    sent++;
    const body = JSON.stringify({ action: "error", source: "web", where, message, stack: String(err?.stack ?? "").slice(0, 3000), url: location.pathname + location.hash.split("?")[0], version: WEB_VERSION });
    void fetch(`${FN}/site`, { method: "POST", headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY }, body, keepalive: true }).catch(() => {});
  } catch { /* отчёт об ошибке не должен ронять страницу */ }
}

export function installErrorReporting() {
  window.addEventListener("error", (ev) => reportError(ev.error ?? ev.message, "window"));
  window.addEventListener("unhandledrejection", (ev) => reportError(ev.reason, "promise"));
}
