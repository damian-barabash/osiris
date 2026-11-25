// Берёт переводы приложения (tool/tr_data.py: строки «ru|pl|en») и кладёт их в src/i18n/gen/{pl,en}.json.
// Веб-версия использует те же русские ключи, что и приложение: tr('Сегодня') → «Dziś» / «Today».
//   node scripts/gen-i18n.mjs [путь к tr_data.py]
import { readFileSync, writeFileSync, existsSync } from "node:fs";
const SRC = process.argv[2] ?? "/Volumes/DIAMONCHIK/Project OSIRIS/tool/tr_data.py";
if (!existsSync(SRC)) { console.log("tr_data.py недоступен — оставляю прежние src/i18n/gen/*.json"); process.exit(0); }
const src = readFileSync(SRC, "utf8");
const body = src.slice(src.indexOf('r"""') + 4, src.lastIndexOf('"""'));
const pl = {}, en = {};
for (const line of body.split("\n")) {
  if (!line.trim()) continue;
  const p = line.split("|");
  if (p.length !== 3) throw new Error("плохая строка: " + line);
  const un = (s) => s.replace(/\\n/g, "\n").replace(/\\\\/g, "\\");
  const k = un(p[0]);
  if (k in pl) continue;
  pl[k] = un(p[1]); en[k] = un(p[2]);
}
writeFileSync("src/i18n/gen/pl.json", JSON.stringify(pl));
writeFileSync("src/i18n/gen/en.json", JSON.stringify(en));
console.log(Object.keys(pl).length, "строк из приложения");
