// Проверка новых сценариев аккаунта в headless Chrome на временных аккаунтах (удаляются по id):
// обучение → согласие на ИИ → удаление аккаунта; ссылка «Забыли пароль?» → новый пароль.
//   npm run build && SVC=<service_role key> ANON=<anon key> node scripts/qc-account.mjs
import { mkdirSync } from "node:fs";
import { serve } from "./serve.mjs";
import { launch } from "./chrome.mjs";
const OUT = "qc-out"; mkdirSync(OUT, { recursive: true });
const SB = "https://wdxxxuxsgqsvqdkvbhye.supabase.co", SVC = process.env.SVC, ANON = process.env.ANON, BASE = "http://localhost:4173";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const problems = []; const note = (w, t) => { problems.push(`${w}: ${t}`); console.log("  ✗", w, "—", t); };
const rest = (path, method = "GET", body) => fetch(`${SB}${path}`, { method, headers: { apikey: SVC, Authorization: `Bearer ${SVC}`, "Content-Type": "application/json", Prefer: "return=representation" }, body: body ? JSON.stringify(body) : undefined }).then(async (r) => { const t = await r.text(); if (!r.ok) throw new Error(`${method} ${path}: ${r.status} ${t.slice(0, 200)}`); return t ? JSON.parse(t) : null; });
const server = await serve("dist", 4173); const browser = await launch(); const made = [];
async function account(name) {
  const email = `qc-acc-${name}-${Date.now()}@example.com`, password = "Qa-" + Math.random().toString(36).slice(2) + "A9!";
  const u = await rest("/auth/v1/admin/users", "POST", { email, password, email_confirm: true, user_metadata: { name: "Тест", has_password: true } });
  made.push(u.id);
  await rest("/rest/v1/rpc/admin_set_plan", "POST", { p_user: u.id, p_plan: "smart", p_days: 30, p_lifetime: false });
  await rest(`/rest/v1/profiles?id=eq.${u.id}`, "PATCH", { onboarded_at: new Date().toISOString(), name: "Тест" });
  return { id: u.id, email, password };
}
async function page(view) {
  const ctx = await browser.createBrowserContext(); const p = await ctx.newPage();
  await p.setViewport(view === "phone" ? { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { width: 1440, height: 900, deviceScaleFactor: 1 });
  p.on("pageerror", (e) => note(view, "ошибка страницы: " + String(e.message).slice(0, 200)));
  await p.evaluateOnNewDocument(() => { localStorage.setItem("osiris_lang", "ru"); localStorage.setItem("mood_skipped_at", new Date().toISOString()); });
  return p;
}
const vis = (p, sel) => p.evaluate((q) => { const e = document.querySelector(q); if (!e) return false; const r = e.getBoundingClientRect(); return r.width > 40 && r.height > 20 && getComputedStyle(e).visibility !== "hidden"; }, sel);
const clickText = (p, sel, text) => p.evaluate((q, t) => { const e = [...document.querySelectorAll(q)].find((x) => (x.textContent ?? "").trim().includes(t)); if (e) e.click(); return !!e; }, sel, text);
try {
  for (const view of ["desk", "phone"]) {
    console.log("Обучение, согласие, удаление —", view);
    const a = await account(view); const p = await page(view);
    await p.goto(BASE + "/app/", { waitUntil: "networkidle0" });
    await p.type('input[name="email"]', a.email); await p.type('input[name="password"]', a.password); await p.keyboard.press("Enter");
    await p.waitForSelector(".tut", { timeout: 20000 }).catch(() => note(view, "обучение не показалось"));
    await sleep(1200); await p.screenshot({ path: `${OUT}/acc-tutorial-${view}.png` });
    const w = await p.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]); if (w[0] > w[1] + 1) note(view, "обучение шире экрана");
    for (let i = 0; i < 4; i++) { await p.keyboard.press("ArrowRight"); await sleep(500); }
    await p.screenshot({ path: `${OUT}/acc-tutorial-last-${view}.png` });
    await p.keyboard.press("Enter");
    await p.waitForSelector(".shell", { timeout: 15000 }).catch(() => note(view, "после обучения каркас не открылся"));
    await p.waitForSelector(".acc-consent", { timeout: 15000 }).catch(() => note(view, "согласие на ИИ не предложено"));
    await sleep(900); await p.screenshot({ path: `${OUT}/acc-consent-${view}.png` });
    if (!(await clickText(p, ".acc-consent button", "Согласен"))) note(view, "нет кнопки согласия");
    await sleep(2500);
    const [prof] = await rest(`/rest/v1/profiles?id=eq.${a.id}&select=ai_consent_at,tutorial_seen_at`);
    if (!prof.ai_consent_at || !prof.tutorial_seen_at) note(view, `флаги в профиле не записались: ${JSON.stringify(prof)}`);
    for (let i = 0; i < 3 && (await p.$(".sheet-layer")); i++) { await p.keyboard.press("Escape"); await sleep(600); }
    await p.evaluate(() => { location.hash = "/settings"; }); await sleep(1500);
    await clickText(p, "button, a", "Аккаунт"); await sleep(1000);
    await p.screenshot({ path: `${OUT}/acc-settings-${view}.png`, fullPage: true });
    const w2 = await p.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]); if (w2[0] > w2[1] + 13) note(view, `настройки шире экрана: ${w2}`);
    if (!(await vis(p, ".set-delete"))) note(view, "нет кнопки «Удалить аккаунт»");
    else {
      await p.evaluate(() => document.querySelector(".set-delete").click()); await sleep(1200);
      await p.screenshot({ path: `${OUT}/acc-delete-${view}.png` });
      const inp = await p.$(".sheet input"); if (!inp) note(view, "в листе удаления нет поля");
      else {
        await inp.type("УДАЛИТЬ"); await sleep(300);
        await clickText(p, ".sheet button", "Удалить навсегда");
        await p.waitForSelector('input[name="email"]', { timeout: 20000 }).catch(() => note(view, "после удаления не вернулись на вход"));
        const gone = await fetch(`${SB}/auth/v1/admin/users/${a.id}`, { headers: { apikey: SVC, Authorization: `Bearer ${SVC}` } });
        if (gone.status !== 404) note(view, `аккаунт не удалён на сервере (${gone.status})`);
      }
    }
    await p.close();
  }
  console.log("Забыли пароль → новый пароль");
  {
    const a = await account("reset"); const p = await page("phone");
    await rest(`/rest/v1/profiles?id=eq.${a.id}`, "PATCH", { tutorial_seen_at: new Date().toISOString(), ai_consent_at: new Date().toISOString() });
    const link = await rest("/auth/v1/admin/generate_link", "POST", { type: "recovery", email: a.email, redirect_to: BASE + "/app/" });
    await p.goto(link.action_link, { waitUntil: "networkidle0" });
    await p.waitForSelector('input[autocomplete="new-password"]', { timeout: 15000 }).catch(() => note("reset", "форма нового пароля не открылась: " + p.url().slice(0, 120)));
    await sleep(600); await p.screenshot({ path: `${OUT}/acc-new-password.png` });
    const fields = await p.$$('input[type="password"]');
    if (fields.length >= 2) {
      const np = "New-" + Math.random().toString(36).slice(2) + "B7!";
      await fields[0].type(np); await fields[1].type(np); await p.keyboard.press("Enter");
      await p.waitForSelector(".shell", { timeout: 15000 }).catch(() => note("reset", "после смены пароля каркас не открылся"));
      const t = await fetch(`${SB}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" }, body: JSON.stringify({ email: a.email, password: np }) });
      if (!t.ok) note("reset", "с новым паролем войти нельзя");
    } else note("reset", "полей пароля меньше двух");
    await p.close();
  }
} finally {
  for (const id of made) await fetch(`${SB}/auth/v1/admin/users/${id}`, { method: "DELETE", headers: { apikey: SVC, Authorization: `Bearer ${SVC}` } }).then((r) => console.log("очистка", id, r.status));
  await browser.close(); server.close();
}
console.log(problems.length ? `\nНайдено проблем: ${problems.length}\n- ${problems.join("\n- ")}` : "\nQC аккаунта: проблем не найдено");
process.exit(0);
