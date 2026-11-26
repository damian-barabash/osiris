// Сборка статического HTML страницы (вызывается из scripts/prerender.mjs после `vite build --ssr`).
import { renderToString } from "react-dom/server";
import { Site, type PageKey } from "./Site";
import { SITE_LANGS, type SiteLang } from "./content";
import { HELP_KEYS } from "./help";
import { LEGAL_KEYS } from "./legal";
import { headFor, urlOf } from "./seo";

export const langs = SITE_LANGS;
export const pages: PageKey[] = ["", ...LEGAL_KEYS, ...HELP_KEYS, "404"];
export const render = (lang: SiteLang, page: PageKey) => ({ html: renderToString(<Site lang={lang} page={page} />), head: headFor(lang, page), url: urlOf(lang, page) });
