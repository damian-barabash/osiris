// Значки сайта из favicon.svg и OG-картинки (1200×630) — снимки настоящего героя лендинга на каждом языке.
//   npm run build && node scripts/assets.mjs   (потом ещё раз npm run build, чтобы картинки попали в dist)
import sharp from "sharp";
import { readFileSync, writeFileSync } from "node:fs";
import { serve } from "./serve.mjs";
import { launch } from "./chrome.mjs";

const svg = readFileSync("public/favicon.svg");
const png = (size, pad = 0, bg = null) => {
  let img = sharp(svg, { density: 600 }).resize(size - pad * 2, size - pad * 2);
  if (pad) img = img.extend({ top: pad, bottom: pad, left: pad, right: pad, background: bg ?? "#EEE9DD" });
  return img.png().toBuffer();
};
writeFileSync("public/icon-192.png", await png(192));
writeFileSync("public/icon-512.png", await png(512));
writeFileSync("public/icon-maskable-512.png", await png(512, 56));
writeFileSync("public/apple-touch-icon.png", await png(180, 10));
// favicon.ico: один PNG 32×32 в контейнере ICO
const p32 = await png(32);
const head = Buffer.alloc(22);
head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(1, 4);
head.writeUInt8(32, 6); head.writeUInt8(32, 7); head.writeUInt16LE(1, 10); head.writeUInt16LE(32, 12); head.writeUInt32LE(p32.length, 14); head.writeUInt32LE(22, 18);
writeFileSync("public/favicon.ico", Buffer.concat([head, p32]));

const server = await serve("dist", 4199);
const browser = await launch();
for (const lang of ["en", "pl", "ru"]) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
  await page.evaluateOnNewDocument((l) => { localStorage.setItem("osiris_site_lang", l); localStorage.setItem("osiris_consent", JSON.stringify({ v: 1, analytics: false, at: "" })); }, lang);
  await page.goto(`http://127.0.0.1:4199/${lang === "en" ? "" : lang + "/"}`, { waitUntil: "networkidle0" });
  await page.addStyleTag({ content: `
    .hd, .cw, .ck, .ticker, .hero-cta, .note, .skip { display: none !important; }
    body { overflow: hidden; } * { animation-delay: 0s !important; animation-duration: 0.001s !important; transition: none !important; }
    .hero { width: 1090px !important; min-height: 630px !important; height: 630px; padding: 0 !important; grid-template-columns: 1.08fr 0.92fr !important; }
    .hero h1 { font-size: 70px !important; margin: 22px 0 !important; } .lead { font-size: 21px !important; max-width: 540px !important; }
    .kicker { font-size: 15px !important; } .hero-art { height: 560px !important; }
    .hero-text::after { content: "myosiris.app"; display: block; margin-top: 28px; font-weight: 800; font-size: 22px; color: #E2582B; letter-spacing: 0.5px; }` });
  await new Promise((r) => setTimeout(r, 700));
  await page.screenshot({ path: `public/og-${lang}.png`, clip: { x: 0, y: 0, width: 1200, height: 630 } });
  await page.close();
}
await browser.close();
server.close();
console.log("значки и OG-картинки готовы");
