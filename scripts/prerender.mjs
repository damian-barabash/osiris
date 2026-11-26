// После сборки: статический HTML для каждой страницы и языка, sitemap.xml, robots.txt, 404.html.
//   dist/index.html (en) · dist/pl/index.html · dist/ru/index.html · dist/<lang>/<terms|privacy|cookies|support|delete-account>/index.html
import { mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

const DIST = "dist";
const { render, langs, pages } = await import(pathToFileURL(join(process.cwd(), "dist-ssr/entry-server.js")).href);
const template = readFileSync(join(DIST, "index.html"), "utf8");
if (!template.includes("<!--app-->") || !template.includes("<!--head-->")) throw new Error("в dist/index.html нет меток <!--head--> / <!--app-->");

const urls = [];
let n = 0;
for (const lang of langs) {
  for (const page of pages) {
    const { html, head, url } = render(lang, page);
    const out = template
      .replace('<html lang="en"', `<html lang="${lang}"`)
      .replace("<!--head-->", head)
      .replace('data-page=""', `data-page="${page}"`)
      .replace("<!--app-->", html);
    const pre = lang === "en" ? "" : lang;
    const file = page === "404" ? join(DIST, pre, "404.html") : join(DIST, pre, page, "index.html");
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, out);
    n++;
    if (page !== "404") urls.push({ url, lang, page });
  }
}

const today = new Date().toISOString().slice(0, 10);
const alt = (page) => urls.filter((u) => u.page === page).map((u) => `    <xhtml:link rel="alternate" hreflang="${u.lang}" href="${u.url}"/>`).join("\n");
writeFileSync(join(DIST, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.map((u) => `  <url>\n    <loc>${u.url}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${u.page ? "yearly" : "weekly"}</changefreq>\n    <priority>${u.page ? "0.3" : u.lang === "en" ? "1.0" : "0.9"}</priority>\n${alt(u.page)}\n  </url>`).join("\n")}
</urlset>
`);
writeFileSync(join(DIST, "robots.txt"), `User-agent: *\nAllow: /\nDisallow: /app/\nDisallow: /admin/\n\nSitemap: https://myosiris.app/sitemap.xml\n`);
rmSync("dist-ssr", { recursive: true, force: true });
console.log(`пререндер: ${n} страниц, sitemap: ${urls.length} адресов`);
