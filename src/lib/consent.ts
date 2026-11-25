// Согласие на cookies / статистику. Хранится в localStorage; без выбора статистика не собирается.
const KEY = "osiris_consent";
export interface Consent { v: 1; analytics: boolean; at: string }
const subs = new Set<() => void>();

export function getConsent(): Consent | null {
  try {
    const c = JSON.parse(localStorage.getItem(KEY) ?? "null");
    return c && c.v === 1 && typeof c.analytics === "boolean" ? c : null;
  } catch { return null; }
}
export function setConsent(analytics: boolean) {
  try { localStorage.setItem(KEY, JSON.stringify({ v: 1, analytics, at: new Date().toISOString() })); } catch { /* приватный режим */ }
  subs.forEach((f) => f());
}
export const onConsent = (f: () => void) => { subs.add(f); return () => void subs.delete(f); };
/** Открыть настройки cookies заново (ссылка в подвале). */
export const openCookieSettings = () => window.dispatchEvent(new Event("osiris:cookies"));
