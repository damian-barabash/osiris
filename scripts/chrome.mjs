import { readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import puppeteer from "puppeteer-core";

/** Самый свежий Chrome из кэша puppeteer. */
export function chromePath() {
  const base = join(homedir(), ".cache/puppeteer/chrome");
  const v = readdirSync(base).filter((d) => d.startsWith("mac")).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).at(-1);
  return join(base, v, readdirSync(join(base, v))[0], "Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing");
}
export const launch = () => puppeteer.launch({ executablePath: process.env.CHROME ?? chromePath(), headless: true, args: ["--no-sandbox", "--hide-scrollbars"] });
