// Документы сайта: соглашение, конфиденциальность, cookies. Тексты — в legal.{pl,en,ru}.ts; польская версия главная.
import en from "./legal.en";
import pl from "./legal.pl";
import ru from "./legal.ru";
import type { SiteLang } from "./content";

export type LegalBlock = string | string[] | { table: string[][] };
export interface LegalDoc { title: string; intro: string; sections: { h: string; body: LegalBlock[] }[] }
export interface LegalSet { updated: string; note?: string; terms: LegalDoc; privacy: LegalDoc; cookies: LegalDoc }
export type LegalKey = "terms" | "privacy" | "cookies";
export const LEGAL_KEYS: LegalKey[] = ["terms", "privacy", "cookies"];
export const LEGAL: Record<SiteLang, LegalSet> = { en, pl, ru };
