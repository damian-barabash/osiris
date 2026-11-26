// Заголовки, описания, hreflang и структурированные данные для каждой страницы и языка (вставляются при пререндере).
import { SITE_URL } from "@/config";
import { COMPANY, CONTENT, SITE_LANGS, prefix, type SiteLang } from "./content";
import { HELP, HELP_KEYS, type HelpKey } from "./help";
import { LEGAL } from "./legal";
import type { PageKey } from "./Site";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export const urlOf = (lang: SiteLang, page: PageKey) => `${SITE_URL}${prefix(lang)}/${page && page !== "404" ? page + "/" : ""}`;
const OG_LOCALE: Record<SiteLang, string> = { en: "en_GB", pl: "pl_PL", ru: "ru_RU" };

export function headFor(lang: SiteLang, page: PageKey): string {
  const c = CONTENT[lang];
  const legal = !page || page === "404" ? null : (HELP_KEYS as string[]).includes(page) ? HELP[lang][page as HelpKey] : LEGAL[lang][page as Exclude<typeof page, HelpKey>];
  const title = page === "404" ? `${c.notFound.title} — OSIRIS` : legal ? `${legal.title} — OSIRIS` : c.meta.title;
  const desc = legal ? legal.intro : page === "404" ? c.notFound.text : c.meta.description;
  const url = urlOf(lang, page);
  const og = `${SITE_URL}/og-${lang}.png`;
  const out: string[] = [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(desc)}" />`,
  ];
  if (page === "404") out.push(`<meta name="robots" content="noindex" />`);
  else {
    out.push(`<meta name="robots" content="index, follow, max-image-preview:large" />`, `<link rel="canonical" href="${url}" />`);
    for (const l of SITE_LANGS) out.push(`<link rel="alternate" hreflang="${l}" href="${urlOf(l, page)}" />`);
    out.push(`<link rel="alternate" hreflang="x-default" href="${urlOf("en", page)}" />`);
  }
  out.push(
    `<meta property="og:type" content="website" />`, `<meta property="og:site_name" content="OSIRIS" />`, `<meta property="og:title" content="${esc(title)}" />`,
    `<meta property="og:description" content="${esc(desc)}" />`, `<meta property="og:url" content="${url}" />`, `<meta property="og:image" content="${og}" />`,
    `<meta property="og:image:width" content="1200" />`, `<meta property="og:image:height" content="630" />`, `<meta property="og:image:alt" content="${esc(c.meta.ogAlt)}" />`,
    `<meta property="og:locale" content="${OG_LOCALE[lang]}" />`,
    ...SITE_LANGS.filter((l) => l !== lang).map((l) => `<meta property="og:locale:alternate" content="${OG_LOCALE[l]}" />`),
    `<meta name="twitter:card" content="summary_large_image" />`, `<meta name="twitter:title" content="${esc(title)}" />`, `<meta name="twitter:description" content="${esc(desc)}" />`, `<meta name="twitter:image" content="${og}" />`,
  );
  if (page === "") {
    const org = { "@type": "Organization", "@id": `${SITE_URL}/#org`, name: "OSIRIS", url: SITE_URL, logo: `${SITE_URL}/icon-512.png`, email: COMPANY.email,
      founder: { "@type": "Organization", name: COMPANY.studio, url: COMPANY.studioUrl },
      address: { "@type": "PostalAddress", streetAddress: COMPANY.street, postalCode: "02-786", addressLocality: "Warszawa", addressCountry: "PL" } };
    const app = { "@type": "SoftwareApplication", "@id": `${SITE_URL}/#app`, name: "OSIRIS", description: c.meta.description, url, applicationCategory: "ProductivityApplication", operatingSystem: "Web, iOS, Android", inLanguage: ["en", "pl", "ru"],
      image: og, publisher: { "@id": `${SITE_URL}/#org` },
      offers: c.pricing.plans.map((p, i) => ({ "@type": "Offer", name: p.name, price: ["0", "9.99", "29.99"][i], priceCurrency: "PLN", category: i ? "subscription" : "free" })),
      featureList: c.ticker.join(", ") };
    const site = { "@type": "WebSite", "@id": `${SITE_URL}/#site`, url: SITE_URL, name: "OSIRIS", inLanguage: lang, publisher: { "@id": `${SITE_URL}/#org` } };
    const faq = { "@type": "FAQPage", "@id": `${url}#faq`, inLanguage: lang, mainEntity: c.faq.items.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) };
    out.push(`<script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@graph": [org, site, app, faq] }).replace(/</g, "\\u003c")}</script>`);
  }
  return out.join("\n    ");
}
