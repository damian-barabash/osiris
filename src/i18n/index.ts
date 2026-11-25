// Языки веб-версии — как в приложении: ключ перевода = русская строка-шаблон.
// Переводы приложения лежат в gen/{pl,en}.json (scripts/gen-i18n.mjs), новые строки сайта — в web.ts.
import { WEB } from "./web/index";

export type Lang = "ru" | "pl" | "en";
export const LANGS: Lang[] = ["ru", "pl", "en"];
const KEY = "osiris_lang";

let dict: Record<string, string> = {};
const listeners = new Set<() => void>();

export const L = {
  lang: "en" as Lang,
  /** Выбор в настройках: 'system' | 'ru' | 'pl' | 'en'. */
  pref: "system" as "system" | Lang,
  get code() { return L.lang; },
  get locale() { return { ru: "ru-RU", pl: "pl-PL", en: "en-GB" }[L.lang]; },
  get speechLocale() { return { ru: "ru-RU", pl: "pl-PL", en: "en-US" }[L.lang]; },
  subscribe(f: () => void) { listeners.add(f); return () => void listeners.delete(f); },
};

/** Язык браузера: ru/uk/be → ru, pl → pl, остальное → en. */
export function deviceLang(): Lang {
  const list = typeof navigator === "undefined" ? [] : navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const l of list) {
    const c = l.slice(0, 2).toLowerCase();
    if (c === "ru" || c === "uk" || c === "be") return "ru";
    if (c === "pl") return "pl";
    if (c === "en") return "en";
  }
  return "en";
}

async function apply() {
  L.lang = L.pref === "system" ? deviceLang() : L.pref;
  if (L.lang === "ru") dict = {};
  else {
    const app = L.lang === "pl" ? await import("./gen/pl.json") : await import("./gen/en.json");
    const web: Record<string, string> = {};
    for (const [ru, v] of Object.entries(WEB)) web[ru] = v[L.lang === "pl" ? 0 : 1];
    dict = { ...(app.default as Record<string, string>), ...web };
  }
  if (typeof document !== "undefined") document.documentElement.lang = L.lang;
}

export async function loadLang() {
  try {
    const v = localStorage.getItem(KEY);
    L.pref = v === "ru" || v === "pl" || v === "en" ? v : "system";
  } catch { /* приватный режим */ }
  await apply();
}

export async function setLang(v: "system" | Lang) {
  L.pref = v;
  try { v === "system" ? localStorage.removeItem(KEY) : localStorage.setItem(KEY, v); } catch { /* */ }
  await apply();
  listeners.forEach((f) => f());
}

/** Перевод: tr('Сегодня в плане: {0}.', [n]). Нет перевода — показываем русский. */
export function tr(ru: string, args: unknown[] = []): string {
  let s = dict[ru] ?? ru;
  for (let i = 0; i < args.length; i++) s = s.replaceAll(`{${i}}`, String(args[i] ?? ""));
  return s;
}

/** Множественное число по правилам языка (формы переводятся отдельными ключами, как в приложении). */
export function plural(n: number, one: string, few: string, many: string): string {
  if (L.lang === "en") return n === 1 ? one : many;
  const m10 = n % 10, m100 = n % 100;
  if (L.lang === "pl") return n === 1 ? one : m10 >= 2 && m10 <= 4 && !(m100 >= 12 && m100 <= 14) ? few : many;
  if (m10 === 1 && m100 !== 11) return one;
  return m10 >= 2 && m10 <= 4 && !(m100 >= 12 && m100 <= 14) ? few : many;
}
