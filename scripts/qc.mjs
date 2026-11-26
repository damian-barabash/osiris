// Проверка собранного сайта в headless Chrome: лендинг (3 языка, ноутбук и телефон), документы, 404, чат Оси,
// баннер cookies, веб-версия под временным аккаунтом (все разделы), админка. Скриншоты — в qc-out/.
//   npm run build && SVC=<service_role key> [ADMIN_EMAIL=… ADMIN_PASS=…] [ASK=1] node scripts/qc.mjs
// Временный аккаунт создаётся и в конце удаляется по id. ASK=1 — задать Оси один настоящий вопрос (стоит доли цента).
import { mkdirSync, rmSync } from "node:fs";
import { serve } from "./serve.mjs";
import { launch } from "./chrome.mjs";

const OUT = process.env.QC_OUT ?? "qc-out";
const SB = "https://wdxxxuxsgqsvqdkvbhye.supabase.co";
const SVC = process.env.SVC;
const BASE = "http://127.0.0.1:4173";
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const problems = [];
const note = (where, what) => { problems.push(`${where}: ${what}`); console.log("  ✗", where, "—", what); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rest = (path, method = "GET", body) => fetch(`${SB}${path}`, { method, headers: { apikey: SVC, Authorization: `Bearer ${SVC}`, "Content-Type": "application/json", Prefer: "return=representation" }, body: body ? JSON.stringify(body) : undefined }).then(async (r) => { const t = await r.text(); if (!r.ok) throw new Error(`${method} ${path}: ${r.status} ${t.slice(0, 200)}`); return t ? JSON.parse(t) : null; });

const server = await serve("dist", 4173);
const browser = await launch();
const VIEW = { desk: { width: 1440, height: 900, deviceScaleFactor: 1 }, phone: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true } };

async function open(name, url, view, { consent = true, lang } = {}) {
  const page = await browser.newPage();
  await page.setViewport(VIEW[view]);
  await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "light" }]);
  page.on("console", (m) => { if (m.type() === "error" && !/favicon|ERR_|Failed to load resource/.test(m.text())) note(name, "console: " + m.text().slice(0, 200)); });
  page.on("pageerror", (e) => note(name, "ошибка страницы: " + String(e.message).slice(0, 200)));
  page.on("requestfailed", (r) => { if (!/supabase|favicon/.test(r.url())) note(name, "не загрузилось: " + r.url().replace(BASE, "")); });
  await page.evaluateOnNewDocument((c, l) => { if (c) localStorage.setItem("osiris_consent", JSON.stringify({ v: 1, analytics: false, at: "" })); else localStorage.removeItem("osiris_consent"); if (l) { localStorage.setItem("osiris_site_lang", l); localStorage.setItem("osiris_lang", l); } }, consent, lang);
  await page.goto(BASE + url, { waitUntil: "networkidle0", timeout: 45_000 });
  return page;
}
const shot = (page, name, full = false) => page.screenshot({ path: `${OUT}/${name}.png`, fullPage: full });
async function overflow(page, name) {
  const w = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
  if (w[0] > w[1] + 1) {
    const who = await page.evaluate(() => { const vw = document.documentElement.clientWidth; return [...document.querySelectorAll("body *")].filter((e) => e.getBoundingClientRect().right > vw + 1 && !e.closest(".tabbar")).slice(0, 4).map((e) => `${e.tagName.toLowerCase()}.${String(e.className).split(" ").slice(0, 2).join(".")} (${Math.round(e.getBoundingClientRect().right)})`).join("; "); });
    note(name, `горизонтальная прокрутка: ${w[0]} > ${w[1]} — ${who}`);
  }
}
/** Прокрутить страницу до конца, чтобы сработали появления, и вернуться. */
async function reveal(page) {
  await page.evaluate(async () => {
    const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    for (let y = 0; y < document.body.scrollHeight; y += 320) { window.scrollTo({ top: y, behavior: "instant" }); await frame(); await new Promise((r) => setTimeout(r, 60)); }
    window.scrollTo({ top: document.body.scrollHeight, behavior: "instant" }); await frame(); await new Promise((r) => setTimeout(r, 200));
    window.scrollTo({ top: 0, behavior: "instant" });
  });
  await sleep(900);
  const hidden = await page.evaluate(() => document.querySelectorAll(".rv:not([data-in])").length);
  if (hidden) note("reveal", `не появилось блоков: ${hidden}`);
}

// ------------------------------------------------------------------ лендинг
console.log("Лендинг");
for (const lang of ["en", "pl", "ru"]) {
  const url = lang === "en" ? "/" : `/${lang}/`;
  for (const view of ["desk", "phone"]) {
    const name = `landing-${lang}-${view}`;
    const page = await open(name, url, view, { lang });
    const got = await page.evaluate(() => [document.documentElement.lang, document.title, document.querySelector("h1")?.textContent ?? "", document.querySelectorAll('link[rel="alternate"]').length, !!document.querySelector('script[type="application/ld+json"]')]);
    if (got[0] !== lang) note(name, `lang=${got[0]}`);
    if (got[3] !== 4 || !got[4]) note(name, "нет hreflang или JSON-LD");
    await sleep(1800);
    await shot(page, `${name}-top`);
    await reveal(page);
    await overflow(page, name);
    if (lang === "ru" || view === "desk") await shot(page, name, true);
    await page.close();
  }
}

console.log("Меню на телефоне, язык, баннер cookies, чат");
{
  const page = await open("mobile-menu", "/ru/", "phone", { lang: "ru" });
  const cta = await page.evaluate(() => { const e = document.querySelector(".hd-sheet"); const c = getComputedStyle(e); return c.visibility; });
  if (cta !== "hidden") note("mobile-menu", "закрытое меню видно на странице");
  await page.click(".hd-burger"); await sleep(1100);
  const menu = await page.evaluate(() => { const r = document.querySelector(".hd-sheet").getBoundingClientRect(); return [Math.round(r.height), innerHeight, [...document.querySelectorAll(".hd-sheet nav a")].every((a) => getComputedStyle(a).opacity === "1")]; });
  if (menu[0] < menu[1] - 2 || !menu[2]) note("mobile-menu", `меню не на весь экран или пункты не видны: ${menu}`);
  await shot(page, "mobile-menu");
  await page.click(".hd-burger"); await sleep(800);
  // FAQ: открытый вопрос остаётся на месте вместе с ответом
  await page.evaluate(() => document.querySelector("#faq").scrollIntoView({ behavior: "instant" })); await sleep(900);
  await page.evaluate(() => document.querySelectorAll(".fq-item button")[2].click()); await sleep(800);
  const fq = await page.evaluate(() => { const it = document.querySelectorAll(".fq-item")[2]; return [getComputedStyle(it).opacity, Math.round(it.querySelector(".fq-body").getBoundingClientRect().height), it.classList.contains("open")]; });
  if (fq[0] !== "1" || fq[1] < 30 || !fq[2]) note("faq", `открытый вопрос пропал или ответ не раскрылся: ${fq}`);
  await shot(page, "faq-open-phone");
  await page.close();
  const p2 = await open("cookie", "/ru/", "desk", { consent: false, lang: "ru" });
  await sleep(3200);
  if (!(await p2.$(".ck"))) note("cookie", "баннер не появился");
  else { await p2.evaluate(() => [...document.querySelectorAll(".ck-btns .b")][0].click()); await sleep(700); await shot(p2, "cookie-settings"); await p2.evaluate(() => [...document.querySelectorAll(".ck-btns .b")].at(-1).click()); await sleep(600); if (await p2.$(".ck")) note("cookie", "баннер не закрылся"); }
  // чат: открыть, проверить состояние, показать окно-ограничение
  await p2.waitForSelector(".cw-fab", { timeout: 8000 });
  await p2.click(".cw-fab"); await sleep(1300);
  await shot(p2, "chat-open");
  if (process.env.ASK) {
    await p2.type(".cw-form textarea", "Как работают рапорты PDF?");
    await p2.keyboard.press("Enter");
    await p2.waitForFunction(() => document.querySelectorAll(".cw-msg.osi").length >= 2 && !document.querySelector(".cw-msg.dots") && !document.querySelector(".cw-msg .caret"), { timeout: 40_000 }).catch(() => note("chat", "ответ не пришёл"));
    await sleep(400);
    await shot(p2, "chat-answer");
  }
  await p2.close();
  const p3 = await open("chat-phone", "/pl/", "phone", { lang: "pl" });
  await p3.waitForSelector(".cw-fab", { timeout: 8000 });
  await p3.click(".cw-fab"); await sleep(1200);
  await shot(p3, "chat-phone");
  await p3.close();
}

console.log("Документы и 404");
for (const [name, url] of [["legal-terms-pl", "/pl/terms/"], ["legal-privacy-en", "/privacy/"], ["legal-cookies-ru", "/ru/cookies/"], ["404", "/ru/nothing-here/"]]) {
  const page = await open(name, url, "desk");
  await sleep(600); await reveal(page); await overflow(page, name);
  await shot(page, name, name !== "404");
  await page.close();
}
for (const f of ["/sitemap.xml", "/robots.txt", "/site.webmanifest", "/og-en.png", "/og-pl.png", "/og-ru.png", "/favicon.ico", "/CNAME", "/app/", "/admin/"]) {
  const r = await fetch(BASE + f);
  if (r.status !== 200) note("files", `${f} → ${r.status}`);
}

// ------------------------------------------------------------------ веб-версия
if (SVC) {
  console.log("Веб-версия: временный аккаунт");
  const email = `qc-web-${Date.now()}@example.com`, password = "Qc-" + Math.random().toString(36).slice(2) + "A9!";
  const user = await rest("/auth/v1/admin/users", "POST", { email, password, email_confirm: true, user_metadata: { name: "Анна", has_password: true } });
  const uid = user.id;
  try {
    await rest("/rest/v1/rpc/admin_set_plan", "POST", { p_user: uid, p_plan: "smart", p_days: 30, p_lifetime: false });
    await rest(`/rest/v1/profiles?id=eq.${uid}`, "PATCH", { onboarded_at: new Date().toISOString(), name: "Анна", work_tab: "projects" });
    const at = (d, h, m = 0) => { const x = new Date(); x.setDate(x.getDate() + d); x.setHours(h, m, 0, 0); return x.toISOString(); };
    const day = (d) => at(d, 12).slice(0, 10);
    const u = { user_id: uid };
    const [client] = await rest("/rest/v1/clients", "POST", { ...u, name: "Marina Design", color: "lavender" });
    const [project] = await rest("/rest/v1/projects", "POST", { ...u, client_id: client.id, name: "Брендинг кофейни", budget: 1700, currency: "EUR", status: "active", sphere: "work", color: "teal", icon: "paint", deadline: day(9) });
    await rest("/rest/v1/payments", "POST", { ...u, project_id: project.id, amount: 500, paid_on: day(-2) });
    for (const ev of [
      { ...u, title: "Встреча с Аней", starts_at: at(0, 15), ends_at: at(0, 16), sphere: "work", client_id: client.id, location: "Кофейня на Мокотове" },
      { ...u, title: "Спортзал", starts_at: at(0, 19), ends_at: at(0, 20, 30), sphere: "personal", repeat: { freq: "weekly", days: [2, 4] } },
      { ...u, title: "Созвон с типографией", starts_at: at(0, 15, 30), ends_at: at(0, 16, 15), sphere: "work" },
      { ...u, title: "День рождения мамы", starts_at: at(3, 0), all_day: true, sphere: "personal", priority: "important" },
      { ...u, title: "Стоматолог", starts_at: at(1, 12), ends_at: at(1, 13), sphere: "personal" },
      { ...u, title: "День рождения Маши", starts_at: at(40, 0), all_day: true, sphere: "personal" },
    ]) await rest("/rest/v1/events", "POST", ev);
    for (const t of [
      { ...u, title: "Отправить финальные файлы", project_id: project.id, due_at: at(0, 18), all_day: false, priority: "important", sphere: "work" },
      { ...u, title: "Оплатить ZUS", due_at: at(-1, 9), all_day: true, sphere: "work", repeat: { freq: "monthly" } },
      { ...u, title: "Купить подарок", due_at: at(2, 9), all_day: true, sphere: "personal" },
    ]) await rest("/rest/v1/tasks", "POST", t);
    const [job] = await rest("/rest/v1/jobs", "POST", { ...u, name: "Склад", rate: 32, currency: "PLN", color: "teal", icon: "cube" });
    await rest("/rest/v1/work_sessions", "POST", [-6, -5, -4, -3, -1].map((d) => ({ ...u, job_id: job.id, started_at: at(d, 8), ended_at: at(d, 16, 30), break_minutes: 30, rate: 32 })));
    await rest("/rest/v1/work_extras", "POST", { ...u, job_id: job.id, done_on: day(-3), title: "Разгрузить фуру", amount: 200 });
    const [tr] = await rest("/rest/v1/trackers", "POST", { ...u, title: "Отпуск в Италии", kind: "money", target: 6000, unit: "PLN", color: "sage", icon: "plane", sphere: "personal" });
    await rest("/rest/v1/tracker_entries", "POST", [{ ...u, tracker_id: tr.id, amount: 1500, entry_on: day(-20) }, { ...u, tracker_id: tr.id, amount: 900, entry_on: day(-4) }]);
    await rest("/rest/v1/trackers", "POST", { ...u, title: "Бегать по утрам", kind: "habit", color: "orange", icon: "run", sphere: "personal" });
    await rest("/rest/v1/moods", "POST", [[-5, 3], [-4, 4], [-3, 2], [-2, 4], [-1, 5], [0, 4]].map(([d, s]) => ({ ...u, score: s, energy: 3, tags: s > 3 ? ["спорт", "друзья"] : ["работа", "сон"], created_at: at(d, 10) })));
    await rest("/rest/v1/notes", "POST", [{ ...u, title: "Идеи для логотипа", body: "Чашка с глазом, тёплые цвета, вырезанная бумага.", pinned: true }, { ...u, title: "Список покупок", body: "Молоко, хлеб, кофе", pinned: false }]);

    for (const view of ["desk", "phone"]) {
      const name = `app-${view}`;
      const page = await open(name, "/app/", view, { lang: "ru" });
      // сессия общая для вкладок одного браузера: на втором проходе вход уже выполнен
      if (await page.$('input[name="email"]')) {
        await shot(page, `app-login-${view}`);
        await page.type('input[name="email"]', email);
        await page.type('input[name="password"]', password);
        await page.keyboard.press("Enter");
      } else await page.evaluate(() => { localStorage.removeItem("osiris_theme"); document.documentElement.dataset.theme = "light"; });
      await page.waitForSelector(".shell", { timeout: 25_000 }).catch(() => note(name, "после входа каркас не появился"));
      await sleep(2500);
      // закрыть листы, которые открываются при входе (опрос настроения, «ты это сделал?»)
      for (let i = 0; i < 3 && (await page.$(".sheet-layer")); i++) { await page.keyboard.press("Escape"); await sleep(600); }
      const vis = async (sel) => page.evaluate((q) => { const e = document.querySelector(q); if (!e) return false; const r = e.getBoundingClientRect(), c = getComputedStyle(e); return r.width > 50 && r.height > 50 && c.display !== "none" && c.visibility !== "hidden"; }, sel);
      const tap = async (sel, text) => { const r = await page.evaluate((q, t) => { const e = [...document.querySelectorAll(q)].find((x) => !t || (x.textContent ?? "").includes(t)); if (!e) return null; const b = e.getBoundingClientRect(); return [b.x + b.width / 2, b.y + b.height / 2]; }, sel, text); if (!r) { note(name, `нет элемента ${sel} ${text ?? ""}`); return; } if (view === "phone") await page.touchscreen.tap(r[0], r[1]); else await page.mouse.click(r[0], r[1]); };
      if (view === "desk") {
        // копилка на подарок: предложение, сумма, цель привязана к событию
        await page.evaluate(() => { localStorage.setItem("mood_skipped_at", new Date().toISOString()); }); await page.reload({ waitUntil: "networkidle0" }); await sleep(3600);
        if (!(await vis(".gift-sheet"))) note("gift", "предложение копилки не появилось");
        else {
          await shot(page, "app-gift-offer-desk");
          await tap(".gift-sheet .btn", "Да, копить"); await sleep(700);
          await page.type(".gift-sheet input", "600"); await sleep(400);
          await shot(page, "app-gift-sum-desk");
          await tap(".gift-sheet .btn", "Создать копилку"); await sleep(1800);
          const ok = await page.evaluate(() => location.hash.startsWith("#/goal/") && document.body.innerText.includes("Подарок: Маши") && document.body.innerText.includes("Копилка к событию"));
          if (!ok) note("gift", "копилка не создалась или не привязалась к событию");
          await shot(page, "app-gift-goal-desk", true);
        }
      } else {
        // телефон: добавить задачу и событие с главной, клиента, заметку — окна должны быть видны, записи появляться
        await page.evaluate(() => { location.hash = "/"; }); await sleep(1200);
        for (const [item, title, input] of [["Задача", "Купить молоко", true], ["Событие", "Концерт в четверг", true]]) {
          await tap(".today-add .round"); await sleep(700); await tap(".today-add-item", item); await sleep(1200);
          if (!(await vis(".sheet"))) { note(name, `телефон: окно «${item}» не видно`); continue; }
          await shot(page, item === "Задача" ? "app-add-task-phone" : "app-add-event-phone");
          const right = await page.evaluate(() => Math.round(document.querySelector(".sheet-header .btn")?.getBoundingClientRect().right ?? 0));
          if (right > 392) note(name, `телефон: кнопка сохранения «${item}» за краем экрана (${right})`);
          await page.type(".sheet input", title); await sleep(200); await tap(".sheet-header .btn"); await sleep(1500);
          if (await page.$(".sheet-layer")) { note(name, `телефон: «${item}» не сохранилось`); await page.keyboard.press("Escape"); await sleep(500); }
          else if (!(await page.evaluate((t) => document.body.innerText.includes(t), title))) note(name, `телефон: «${title}» не появилось на экране`);
        }
        await page.evaluate(() => { location.hash = "/calendar"; }); await sleep(1500);
        const plus = await page.evaluate(() => { const b = document.querySelector('.page .screen-actions button, .page header button[aria-label^="Добавить"]') ?? [...document.querySelectorAll(".page button")].find((x) => /^Добавить/.test(x.getAttribute("aria-label") ?? "")); return b ? Math.round(b.getBoundingClientRect().top) : null; });
        if (plus === null || plus < 0) note(name, `телефон: «+» календаря за экраном (${plus})`);
        await page.evaluate(() => { location.hash = "/notes"; }); await sleep(1300);
        await tap('.page button[aria-label="Новая заметка"]'); await sleep(1100);
        if (!(await vis(".sheet"))) note(name, "телефон: окно заметки не видно"); else { await shot(page, "app-add-note-phone"); await page.keyboard.press("Escape"); await sleep(500); }
      }
      for (const [key, hash] of [["today", "/"], ["calendar", "/calendar"], ["projects", "/projects"], ["project", `/project/${project.id}`], ["client", `/client/${client.id}`], ["hours", "/hours"], ["goals", "/goals"], ["goal", `/goal/${tr.id}`], ["chat", "/chat"], ["friends", "/friends"], ["notes", "/notes"], ["mood", "/mood"], ["settings", "/settings"], ["settings-plan", "/settings?tab=plan"]]) {
        await page.evaluate((h) => { location.hash = h; }, hash);
        await sleep(1500);
        for (let i = 0; i < 2 && (await page.$(".sheet-layer")); i++) { await page.keyboard.press("Escape"); await sleep(500); }
        if (await page.evaluate(() => !!document.querySelector(".page .splash") || /Раздел в работе/.test(document.body.innerText))) note(`${name}/${key}`, "экран не отрисовался (заглушка или «не найдено»)");
        await overflow(page, `${name}/${key}`);
        await shot(page, `app-${key}-${view}`, true);
      }
      if (view === "desk") {
        // календарь: все виды; редактор события; рапорт PDF
        await page.evaluate(() => { location.hash = "/calendar"; }); await sleep(1200);
        const tabs = await page.$$eval(".page button", (bs) => bs.map((b) => b.textContent?.trim()));
        for (const label of ["Список", "Месяц", "Год"]) {
          const i = tabs.indexOf(label);
          if (i < 0) { note("calendar", `нет вкладки «${label}»`); continue; }
          await page.evaluate((k) => document.querySelectorAll(".page button")[k].click(), i); await sleep(900);
          await shot(page, `app-calendar-${label}-desk`, true);
        }
        await page.evaluate(() => { location.hash = "/hours"; }); await sleep(1300);
        const rep = await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((x) => /Рапорт/.test(x.textContent ?? "") || /Рапорт/.test(x.getAttribute("aria-label") ?? "")); b?.click(); return !!b; });
        if (!rep) note("hours", "нет кнопки «Рапорт»"); else { await sleep(1200); await shot(page, "app-report-sheet-desk"); await page.keyboard.press("Escape"); await sleep(500); }
        // тёмная тема
        await page.evaluate(() => { localStorage.setItem("osiris_theme", "dark"); document.documentElement.dataset.theme = "dark"; location.hash = "/"; }); await sleep(1300);
        await shot(page, "app-today-dark-desk", true);
        await page.evaluate(() => { location.hash = "/calendar"; }); await sleep(1200);
        await shot(page, "app-calendar-dark-desk", true);
        // свернуть боковое меню
        await page.click(".side-toggle"); await sleep(700);
        await shot(page, "app-collapsed-desk");
      }
      await page.close();
    }
  } catch (e) { note("app", String(e.message ?? e).slice(0, 300)); }
  finally {
    await rest(`/auth/v1/admin/users/${uid}`, "DELETE").catch((e) => note("cleanup", "временный аккаунт не удалён: " + uid + " " + e.message));
    console.log("  временный аккаунт удалён:", uid);
  }
} else console.log("SVC не задан — веб-версия под аккаунтом не проверялась");

// ------------------------------------------------------------------ админка
{
  const page = await open("admin", "/admin/", "desk");
  await sleep(800);
  await shot(page, "admin-login");
  if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASS) {
    console.log("Админка");
    await page.type('input[type="email"]', process.env.ADMIN_EMAIL);
    await page.type('input[type="password"]', process.env.ADMIN_PASS);
    await page.keyboard.press("Enter");
    await page.waitForSelector(".shell.ad", { timeout: 20_000 }).catch(() => note("admin", "вход не удался"));
    for (const k of ["overview", "users", "traffic", "errors", "chat", "versions", "waitlist", "admins"]) {
      await page.evaluate((h) => { location.hash = "/" + h; }, k);
      await sleep(1800);
      await overflow(page, "admin/" + k);
      await shot(page, `admin-${k}`, true);
    }
    await page.setViewport(VIEW.phone); await page.evaluate(() => { location.hash = "/overview"; }); await sleep(1500);
    await shot(page, "admin-overview-phone", true);
    await overflow(page, "admin/phone");
  }
  await page.close();
}

await browser.close();
server.close();
console.log(problems.length ? `\nНайдено проблем: ${problems.length}\n- ${problems.join("\n- ")}` : "\nQC: проблем не найдено");
process.exit(0);
