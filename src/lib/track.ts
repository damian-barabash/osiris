// Своя статистика посещений (Edge Function `site`, action track): без cookies и сторонних сервисов,
// только после согласия в баннере. Посетитель — суточный хэш на сервере, IP не хранится.
import { FN, SUPABASE_KEY } from "@/config";
import { getConsent } from "./consent";

export type TrackKind = "view" | "cta_signup" | "cta_login" | "chat_open" | "chat_ask" | "chat_limit" | "waitlist" | "app_open" | "signup" | "store_click" | "lang_switch";

export function track(kind: TrackKind, path = location.pathname) {
  try {
    if (!getConsent()?.analytics || navigator.webdriver) return;
    const q = new URLSearchParams(location.search);
    const body = JSON.stringify({
      action: "track", kind, path, ref: kind === "view" ? document.referrer : "", lang: document.documentElement.lang,
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
      utm_source: q.get("utm_source") ?? undefined, utm_medium: q.get("utm_medium") ?? undefined, utm_campaign: q.get("utm_campaign") ?? undefined,
    });
    void fetch(`${FN}/site`, { method: "POST", headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY }, body, keepalive: true }).catch(() => {});
  } catch { /* статистика не должна мешать странице */ }
}

/** Запрос к публичной функции сайта. Возвращает [статус, тело]. */
export async function siteCall<T = Record<string, unknown>>(body: Record<string, unknown>): Promise<[number, T]> {
  const r = await fetch(`${FN}/site`, { method: "POST", headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY }, body: JSON.stringify(body) });
  let data = {} as T;
  try { data = await r.json(); } catch { /* пустой ответ */ }
  return [r.status, data];
}
