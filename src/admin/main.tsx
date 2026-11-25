// Админка OSIRIS (/admin/). Свои учётные записи (таблица admins), не связанные с пользователями приложения.
// Все данные идут через Edge Function `admin`; токен сессии живёт в sessionStorage до закрытия вкладки.
import "@/styles/base.css";
import "@/ui/ui.css";
import "../app/app.css";
import "./admin.css";
import { StrictMode, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { FN, SUPABASE_KEY, WEB_VERSION } from "@/config";
import { installErrorReporting } from "@/lib/report";
import { Appear, Button, Card, Collapse, CountUp, EmptyState, Field, Icon, Logo, LogoMark, Osi, Overlays, Pill, Row, SectionTitle, SheetHeader, Switch, Tag, Wordmark, confirm, openSheet, toast } from "@/ui";

// страница не должна работать внутри чужого фрейма (кликджекинг): заголовок frame-ancestors на GitHub Pages задать нельзя
if (window.top !== window.self) { document.documentElement.innerHTML = ""; throw new Error("framed"); }
installErrorReporting();
const TOKEN = "osiris_admin";
type J = Record<string, any>;

class AuthError extends Error {}
async function api<T = J>(action: string, body: J = {}): Promise<T> {
  const token = sessionStorage.getItem(TOKEN) ?? "";
  const r = await fetch(`${FN}/admin`, { method: "POST", headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY, ...(token ? { "x-admin-token": token } : {}) }, body: JSON.stringify({ action, ...body }) });
  const d = await r.json().catch(() => ({}));
  if (r.status === 401 && action !== "login") { sessionStorage.removeItem(TOKEN); throw new AuthError("auth"); }
  if (!r.ok) throw new Error(d.error ?? `HTTP ${r.status}`);
  return d as T;
}
const ERR: Record<string, string> = { credentials: "Неверная почта или пароль", rate: "Слишком много попыток. Подожди 15 минут.", weak_password: "Пароль — минимум 10 символов", exists: "Такой админ уже есть", self: "Себя отключить нельзя", last: "Нельзя отключить последнего админа", confirm: "Почта для подтверждения не совпала", email: "Проверь адрес почты", server: "Ошибка сервера — см. раздел «Ошибки»" };
const say = (e: unknown) => toast(ERR[(e as Error).message] ?? String((e as Error).message), "error");

const fmtDate = (s?: string | null) => (s ? new Date(s).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");
const fmtDay = (s: string) => new Date(s).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
const usd = (n: number) => `$${Number(n ?? 0).toFixed(Number(n) < 1 ? 4 : 2)}`;
const num = (n: number) => Math.round(n ?? 0).toLocaleString("ru-RU");
const PLAN: Record<string, [string, string]> = { free: ["Бесплатно", "slate"], joy: ["Маленькие радости", "orange"], smart: ["Умница", "navy"] };

/** Загрузка данных раздела: значение, перезагрузка, ошибка авторизации уходит наверх. */
function useLoad<T>(action: string, body: J, deps: unknown[], onAuth: () => void): [T | null, () => void, boolean] {
  const [data, setData] = useState<T | null>(null);
  const [busy, setBusy] = useState(true);
  const load = useCallback(() => {
    setBusy(true);
    api<T>(action, body).then(setData).catch((e) => (e instanceof AuthError ? onAuth() : say(e))).finally(() => setBusy(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(load, [load]);
  return [data, load, busy];
}

// ------------------------------------------------------------------ графики
function Bars({ data, color = "var(--orange)", height = 120, label }: { data: { d: string; v: number }[]; color?: string; height?: number; label?: (v: number) => string }) {
  const max = Math.max(1, ...data.map((x) => x.v));
  return (
    <div className="ad-bars" style={{ height }}>
      {data.map((x, i) => (
        <div key={x.d} className="ad-bar" title={`${fmtDay(x.d)}: ${label ? label(x.v) : num(x.v)}`}>
          <i style={{ height: `${(x.v / max) * 100}%`, background: color, animationDelay: `${i * 12}ms` }} />
        </div>
      ))}
      <span className="ad-axis"><small>{data[0] && fmtDay(data[0].d)}</small><small>макс. {label ? label(max) : num(max)}</small><small>{data.at(-1) && fmtDay(data.at(-1)!.d)}</small></span>
    </div>
  );
}
function Share({ rows, k, color = "teal" }: { rows: J[]; k: string; color?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.visitors ?? r.views ?? 0));
  if (!rows.length) return <p className="ad-none">Пока нет данных</p>;
  return (
    <div className="ad-share">
      {rows.map((r, i) => (
        <div key={i}><span title={String(r[k])}>{String(r[k] ?? "—")}</span><em><i style={{ width: `${((r.visitors ?? r.views) / max) * 100}%`, background: `var(--${color})`, animationDelay: `${i * 30}ms` }} /></em><b>{num(r.visitors ?? r.views)}</b></div>
      ))}
    </div>
  );
}
const Tile = ({ label, value, sub, color, fmt }: { label: string; value: number; sub?: string; color?: string; fmt?: (v: number) => string }) => (
  <Card color={color} className="ad-tile"><small>{label}</small><b><CountUp value={value} format={fmt ?? num} /></b>{sub && <span>{sub}</span>}</Card>
);

// ------------------------------------------------------------------ разделы
function Overview({ onAuth, go }: { onAuth: () => void; go: (k: string) => void }) {
  const [d, reload] = useLoad<J>("stats", {}, [], onAuth);
  useEffect(() => { const t = setInterval(reload, 60_000); return () => clearInterval(t); }, [reload]);
  if (!d) return <Loading />;
  const s = d.stats, c = s.content;
  return (
    <>
      {s.errors_open > 0 && <Appear><Card color="#C8402A" className="ad-alert" onClick={() => go("errors")}><Icon name="alert" size={22} /><div><b>Открытых ошибок: {s.errors_open}</b><small>За сутки сработало {num(s.errors_24h)} раз. Нажми, чтобы посмотреть.</small></div><Icon name="right" /></Card></Appear>}
      <div className="ad-tiles">
        <Tile label="Пользователей" value={s.users} sub={`+${s.users_7d} за 7 дней · +${s.users_30d} за 30`} color="orange" />
        <Tile label="Активны за 7 дней" value={s.active_7d} sub={`${s.active_ai_7d} писали Оси`} />
        <Tile label="Посетителей сегодня" value={s.visitors_today} sub={`${num(s.views_today)} просмотров · ${num(s.views_7d)} за 7 дней`} color="teal" />
        <Tile label="Расход ИИ за 30 дней" value={Number(s.ai_cost_30d)} fmt={usd} sub={`сегодня ${usd(s.ai_cost_today)} · 7 дней ${usd(s.ai_cost_7d)}`} color="navy" />
        <Tile label="Сообщений Оси сегодня" value={s.ai_msgs_today} sub={`${num(s.ai_msgs_30d)} за 30 дней`} />
        <Tile label="Гостевой чат сегодня" value={s.guest_today} sub={`${s.guest_30d} за 30 дней · помечено ${s.guest_flagged_30d} · ${usd(s.guest_cost_30d)}`} color="butter" />
        <Tile label="Лист ожидания" value={s.waitlist} sub="почты для письма о выходе" color="lavender" />
        <Tile label="Версия приложения" value={d.ota?.build ?? 0} fmt={(v) => `${d.ota?.version ?? "—"} (${Math.round(v)})`} sub={`сайт ${WEB_VERSION}`} />
      </div>
      <div className="ad-two">
        <Card><SectionTitle>Регистрации за 30 дней</SectionTitle><Bars data={s.signups_by_day.map((x: J) => ({ d: x.d, v: x.n }))} /></Card>
        <Card><SectionTitle>Расход ИИ по дням</SectionTitle><Bars color="var(--navy)" data={s.ai_by_day.map((x: J) => ({ d: x.d, v: Number(x.cost) }))} label={usd} /></Card>
      </div>
      <div className="ad-two">
        <Card>
          <SectionTitle>Подписки</SectionTitle>
          <div className="ad-plans">{Object.entries(PLAN).map(([k, [name, col]]) => <div key={k}><Tag color={col} filled>{name}</Tag><b>{s.plans[k] ?? 0}</b></div>)}</div>
        </Card>
        <Card>
          <SectionTitle>Что создали пользователи</SectionTitle>
          <div className="ad-content">{([["События", c.events], ["Задачи", c.tasks], ["Проекты", c.projects], ["Клиенты", c.clients], ["Цели", c.trackers], ["Отметки настроения", c.moods], ["Заметки", c.notes], ["Смены", c.work_sessions], ["Дружбы", c.friendships]] as [string, number][]).map(([k, v]) => <div key={k}><small>{k}</small><b>{num(v)}</b></div>)}</div>
        </Card>
      </div>
    </>
  );
}

function Users({ onAuth }: { onAuth: () => void }) {
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [d, reload] = useLoad<J>("users", { search }, [search], onAuth);
  useEffect(() => { const t = setTimeout(() => setSearch(q.trim()), 350); return () => clearTimeout(t); }, [q]);
  const act = async (action: string, body: J, ok: string) => { try { await api(action, body); toast(ok); reload(); } catch (e) { e instanceof AuthError ? onAuth() : say(e); } };
  const plan = (u: J) => openSheet((close) => (
    <>
      <SheetHeader title="Тариф" sub={u.email} close={() => close()} />
      <p className="ad-hint">Выдаётся вручную, без оплаты. «Навсегда» нельзя изменить из приложения.</p>
      {([["free", "Бесплатно", null, false], ["joy", "Маленькие радости · 30 дней", 30, false], ["smart", "Умница · 30 дней", 30, false], ["smart", "Умница · год", 365, false], ["smart", "Умница · навсегда", null, true]] as [string, string, number | null, boolean][]).map(([p, label, days, life]) => (
        <Row key={label} title={label} onClick={() => { close(); void act("user_plan", { id: u.id, plan: p, days, lifetime: life }, "Тариф изменён"); }}><Icon name="right" /></Row>
      ))}
    </>
  ));
  const remove = (u: J) => openSheet((close) => <DeleteUser u={u} close={close} done={() => { reload(); }} onAuth={onAuth} />);
  return (
    <>
      <Field value={q} onChange={setQ} hint="Поиск по почте или имени" />
      {!d ? <Loading /> : (
        <>
          <p className="ad-count">Всего: {d.users.total}</p>
          <div className="ad-list">
            {d.users.rows.map((u: J, i: number) => {
              const banned = u.banned_until && Date.parse(u.banned_until) > Date.now();
              return (
                <Appear key={u.id} i={i}>
                  <Card className="ad-user" seed={i}>
                    <button type="button" className="ad-user-top" aria-expanded={open === u.id} onClick={() => setOpen(open === u.id ? null : u.id)}>
                      <span className="avatar" style={{ width: 40, height: 40, background: "var(--lavender)", fontSize: 17 }}>{(u.name || u.email || "?")[0].toUpperCase()}</span>
                      <div><b>{u.name || "Без имени"}</b><small>{u.email}</small></div>
                      <Tag color={PLAN[u.plan_now]?.[1]} filled>{PLAN[u.plan_now]?.[0] ?? u.plan_now}{u.plan_lifetime ? " · навсегда" : ""}</Tag>
                      {banned && <Tag color="#C8402A" filled>заблокирован</Tag>}
                      <Icon name={open === u.id ? "up" : "down"} />
                    </button>
                    <Collapse open={open === u.id}>
                      <div className="ad-user-grid">
                        {([["Зарегистрирован", fmtDate(u.created_at)], ["Последний вход", fmtDate(u.last_sign_in_at)], ["Вход", u.providers ?? "—"], ["Язык", u.lang ?? "—"], ["Часовой пояс", u.timezone ?? "—"], ["Устройств", u.devices], ["Событий", num(u.events)], ["Задач", num(u.tasks)], ["Оси за 30 дней", `${u.ai_msgs_30d} сообщ. · ${usd(u.ai_cost_30d)}`], ["Тариф до", u.plan_lifetime ? "навсегда" : u.plan_until ? fmtDate(u.plan_until) : "—"]] as [string, ReactNode][]).map(([k, v]) => <div key={k}><small>{k}</small><b>{v}</b></div>)}
                      </div>
                      <div className="ad-actions">
                        <Button small ghost icon="star" onClick={() => plan(u)}>Тариф</Button>
                        <Button small ghost icon={banned ? "eye" : "eye-off"} onClick={async () => { if (banned || await confirm(`Заблокировать ${u.email}?`, { text: "Пользователь не сможет войти, данные сохранятся.", action: "Заблокировать" })) void act("user_ban", { id: u.id, ban: !banned }, banned ? "Разблокирован" : "Заблокирован"); }}>{banned ? "Разблокировать" : "Заблокировать"}</Button>
                        <Button small danger icon="trash" onClick={() => remove(u)}>Удалить</Button>
                      </div>
                    </Collapse>
                  </Card>
                </Appear>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
function DeleteUser({ u, close, done, onAuth }: { u: J; close: () => void; done: () => void; onAuth: () => void }) {
  const [v, setV] = useState("");
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    try { await api("user_delete", { id: u.id, email: u.email, confirm: v.trim() }); toast("Аккаунт удалён"); close(); done(); } catch (e) { e instanceof AuthError ? onAuth() : say(e); }
    setBusy(false);
  };
  return (
    <>
      <SheetHeader title="Удалить аккаунт" sub={u.email} close={close} />
      <p className="ad-hint">Удалятся сам аккаунт и все его данные: события, задачи, клиенты, чат с Оси. Это нельзя отменить. Чтобы подтвердить, введи почту пользователя.</p>
      <Field value={v} onChange={setV} hint={u.email} autoFocus />
      <Button danger expand busy={busy} disabled={v.trim().toLowerCase() !== String(u.email).toLowerCase()} onClick={go}>Удалить навсегда</Button>
    </>
  );
}

function Traffic({ onAuth }: { onAuth: () => void }) {
  const [days, setDays] = useState(30);
  const [d] = useLoad<J>("traffic", { days }, [days], onAuth);
  const t = d?.traffic, f = t?.funnel;
  const steps: [string, number][] = f ? [["Посетители лендинга", f.visitors], ["Открыли чат Оси", f.chat_open], ["Задали вопрос", f.chat_ask], ["Нажали «Войти / Регистрация»", f.cta], ["Открыли веб-версию", f.app_open], ["Зарегистрировались", f.signups]] : [];
  return (
    <>
      <div className="ad-pills">{[7, 30, 90, 365].map((n) => <Pill key={n} dense selected={days === n} onClick={() => setDays(n)}>{n === 365 ? "Год" : `${n} дней`}</Pill>)}</div>
      {!t ? <Loading /> : (
        <div key={days} className="slide-in">
          <p className="ad-hint">Считаются только посетители, которые согласились на статистику в баннере cookies. Без cookies: посетитель — суточный хэш, IP не хранится.</p>
          <div className="ad-tiles">
            <Tile label="Просмотров" value={t.totals.views} color="teal" />
            <Tile label="Посетителей" value={t.totals.visitors} />
            <Tile label="За последний час" value={t.last_hour} sub="событий" color="butter" />
            <Tile label="В лист ожидания" value={f.waitlist} color="lavender" />
          </div>
          <Card><SectionTitle>Просмотры по дням</SectionTitle><Bars color="var(--teal)" height={150} data={t.by_day.map((x: J) => ({ d: x.d, v: x.views }))} /></Card>
          <Card>
            <SectionTitle>Воронка</SectionTitle>
            <div className="ad-funnel">{steps.map(([k, v], i) => <div key={k}><span>{k}</span><em><i style={{ width: `${Math.max(2, (v / Math.max(1, steps[0][1], ...steps.map((s) => s[1]))) * 100)}%`, animationDelay: `${i * 60}ms` }} /></em><b>{num(v)}</b></div>)}</div>
          </Card>
          <div className="ad-two">
            <Card><SectionTitle>Страницы</SectionTitle><Share rows={t.pages} k="path" /></Card>
            <Card><SectionTitle>Источники</SectionTitle><Share rows={t.refs} k="ref" color="orange" /></Card>
            <Card><SectionTitle>Регионы (по часовому поясу)</SectionTitle><Share rows={t.countries} k="country" color="sage" /></Card>
            <Card><SectionTitle>Устройства и браузеры</SectionTitle><Share rows={t.devices} k="device" color="lavender" /><Share rows={t.browsers} k="browser" color="mustard" /></Card>
            <Card><SectionTitle>Языки</SectionTitle><Share rows={t.langs} k="lang" color="clay" /></Card>
            <Card><SectionTitle>Рекламные метки (UTM)</SectionTitle><Share rows={t.utm.map((u: J) => ({ ...u, name: [u.utm_source, u.utm_medium, u.utm_campaign].filter(Boolean).join(" / ") }))} k="name" color="navy" /></Card>
          </div>
          <Card>
            <SectionTitle>Подозрительная активность за сутки</SectionTitle>
            {t.suspicious.length ? t.suspicious.map((x: J) => <Row key={x.visitor} title={`${x.hits} событий · ${x.browser ?? "?"} · ${x.country ?? "?"}`} sub={`${fmtDate(x.first_at)} — ${fmtDate(x.last_at)} · посетитель ${String(x.visitor).slice(0, 8)}`}><Tag color="#C8402A" filled>много запросов</Tag></Row>) : <p className="ad-none">Никто не делал больше 150 запросов за сутки. Запросы к чату и формам ограничены сервером автоматически.</p>}
          </Card>
        </div>
      )}
    </>
  );
}

function Errors({ onAuth, changed }: { onAuth: () => void; changed: () => void }) {
  const [all, setAll] = useState(false);
  const [open, setOpen] = useState<number | null>(null);
  const [d, reload] = useLoad<J>("errors", { open: !all }, [all], onAuth);
  const resolve = async (body: J) => { try { await api("error_resolve", body); reload(); changed(); } catch (e) { e instanceof AuthError ? onAuth() : say(e); } };
  return (
    <>
      <div className="ad-pills">
        <Pill dense selected={!all} onClick={() => setAll(false)}>Открытые</Pill>
        <Pill dense selected={all} onClick={() => setAll(true)}>Все</Pill>
        {!!d?.errors.some((e: J) => !e.resolved_at) && <Button small ghost icon="tick" onClick={async () => { if (await confirm("Закрыть все открытые ошибки?", { action: "Закрыть все", danger: false })) void resolve({ all: true }); }}>Закрыть все</Button>}
      </div>
      {!d ? <Loading /> : !d.errors.length ? <EmptyState title="Ошибок нет" text="Когда на сайте, в веб-версии или в функциях что-то сломается, это появится здесь." mood="happy" /> : (
        <div className="ad-list">
          {d.errors.map((e: J, i: number) => (
            <Appear key={e.id} i={i}>
              <Card className="ad-err" seed={i}>
                <button type="button" className="ad-err-top" aria-expanded={open === e.id} onClick={() => setOpen(open === e.id ? null : e.id)}>
                  <Tag color={e.resolved_at ? "sage" : "#C8402A"} filled>{e.source}</Tag>
                  <b>{e.message}</b>
                  <span className="count" style={e.resolved_at ? { background: "var(--ink-soft)" } : undefined}>{e.count}</span>
                </button>
                <small className="ad-err-meta">{e.place || "—"} · {e.url || "—"} · версия {e.version || "—"} · впервые {fmtDate(e.first_at)} · последний раз {fmtDate(e.last_at)}</small>
                <Collapse open={open === e.id}>
                  <pre className="ad-stack">{e.stack || "Стек не передан"}{"\n\n"}{e.ua}</pre>
                  {!e.resolved_at && <Button small icon="tick" onClick={() => void resolve({ id: e.id })}>Исправлено — закрыть</Button>}
                </Collapse>
              </Card>
            </Appear>
          ))}
        </div>
      )}
    </>
  );
}

function GuestChat({ onAuth }: { onAuth: () => void }) {
  const [flagged, setFlagged] = useState(false);
  const [d, reload] = useLoad<J>("guest_chat", { flagged }, [flagged], onAuth);
  const [st, reloadSt] = useLoad<J>("stats", {}, [], onAuth);
  const call = async (action: string, body: J, ok: string) => { try { await api(action, body); toast(ok); reload(); reloadSt(); } catch (e) { e instanceof AuthError ? onAuth() : say(e); } };
  const set = st?.settings ?? {};
  const blocked = new Set((d?.blocks ?? []).map((b: J) => b.ip_hash));
  const NumSet = ({ k, label, sub }: { k: string; label: string; sub: string }) => (
    <Row title={label} sub={sub}>
      <div className="ad-step"><button type="button" aria-label="Меньше" onClick={() => void call("settings_set", { key: k, value: Number(set[k]) - (k === "guest_daily_cap" ? 50 : 1) }, "Сохранено")}><Icon name="minus" size={15} /></button><b>{set[k]}</b><button type="button" aria-label="Больше" onClick={() => void call("settings_set", { key: k, value: Number(set[k]) + (k === "guest_daily_cap" ? 50 : 1) }, "Сохранено")}><Icon name="add" size={15} /></button></div>
    </Row>
  );
  return (
    <>
      <Card>
        <SectionTitle>Настройки чата на сайте</SectionTitle>
        {st ? (
          <>
            <Row title="Чат Оси включён" sub="Если выключить, кнопка на сайте будет отвечать, что Оси занят"><Switch value={set.guest_chat_enabled !== false} onChange={(v) => void call("settings_set", { key: "guest_chat_enabled", value: v }, v ? "Чат включён" : "Чат выключен")} /></Row>
            <NumSet k="guest_limit" label="Вопросов с одного адреса" sub="После этого гость видит окно «создай аккаунт»" />
            <NumSet k="guest_window_days" label="Окно, дней" sub="Через сколько дней вопросы возвращаются" />
            <NumSet k="guest_daily_cap" label="Потолок вопросов в сутки на весь сайт" sub="Защита бюджета от накрутки" />
            <Row title="Статистика посещений" sub="Сбор просмотров с согласия посетителя"><Switch value={set.tracking_enabled !== false} onChange={(v) => void call("settings_set", { key: "tracking_enabled", value: v }, "Сохранено")} /></Row>
          </>
        ) : <Loading />}
      </Card>
      {!!d?.blocks.length && (
        <Card>
          <SectionTitle>Заблокированные адреса</SectionTitle>
          {d.blocks.map((b: J) => <Row key={b.ip_hash} title={`Адрес ${b.ip_hash.slice(0, 10)}…`} sub={`${b.reason || "без причины"} · ${b.until ? "до " + fmtDate(b.until) : "бессрочно"}`}><Button small ghost onClick={() => void call("ip_unblock", { ip_hash: b.ip_hash }, "Разблокирован")}>Снять</Button></Row>)}
        </Card>
      )}
      <div className="ad-pills"><Pill dense selected={!flagged} onClick={() => setFlagged(false)}>Все вопросы</Pill><Pill dense selected={flagged} onClick={() => setFlagged(true)}>Только помеченные</Pill></div>
      {!d ? <Loading /> : !d.chats.length ? <EmptyState title="Вопросов пока нет" mood="calm" /> : (
        <div className="ad-list">
          {d.chats.map((m: J, i: number) => (
            <Appear key={m.id} i={i}>
              <Card className="ad-chat" seed={i}>
                <div className="ad-chat-top"><small>{fmtDate(m.at)} · {m.lang} · адрес {m.ip_hash.slice(0, 8)} · {usd(m.cost_usd)}</small>{m.flagged && <Tag color="#C8402A" filled>{({ injection: "инъекция", leak: "утечка", refusal: "отказ модели", empty: "пусто" } as J)[m.flagged] ?? m.flagged}</Tag>}{blocked.has(m.ip_hash) && <Tag color="charcoal" filled>заблокирован</Tag>}</div>
                <p className="ad-q">{m.question}</p>
                <p className="ad-a">{m.answer}</p>
                <div className="ad-actions">
                  {!blocked.has(m.ip_hash) && <Button small ghost icon="lock" onClick={async () => { if (await confirm("Заблокировать этот адрес?", { text: "С него больше нельзя будет писать Оси и оставлять почту.", action: "Заблокировать" })) void call("ip_block", { ip_hash: m.ip_hash, reason: m.flagged ?? "вручную" }, "Адрес заблокирован"); }}>Заблокировать адрес</Button>}
                  <Button small ghost icon="refresh" onClick={() => void call("guest_reset", { ip_hash: m.ip_hash }, "Вопросы возвращены")}>Вернуть вопросы</Button>
                </div>
              </Card>
            </Appear>
          ))}
        </div>
      )}
    </>
  );
}

function Versions({ onAuth }: { onAuth: () => void }) {
  const [d, reload] = useLoad<J>("releases", {}, [], onAuth);
  const [ai] = useLoad<J>("ai", { days: 30 }, [], onAuth);
  const add = () => openSheet((close) => <AddRelease close={close} done={reload} onAuth={onAuth} />);
  if (!d) return <Loading />;
  return (
    <>
      <div className="ad-tiles">
        <Card color="orange" className="ad-tile"><small>Приложение (iOS, по ссылке)</small><b>{d.ota?.version ?? "—"}</b><span>сборка {d.ota?.build ?? "—"}</span></Card>
        <Card className="ad-tile"><small>Сайт и веб-версия</small><b>{WEB_VERSION}</b><span>сверена с приложением этой версии</span></Card>
      </div>
      {d.ota?.version && d.ota.version !== WEB_VERSION && <Card color="#C8402A" className="ad-alert"><Icon name="alert" size={22} /><div><b>Сайт отстаёт от приложения</b><small>Приложение {d.ota.version}, сайт {WEB_VERSION}. Правило: обновили приложение — обновили и сайт.</small></div></Card>}
      {d.ota?.notes?.length ? <Card><SectionTitle>Что нового в текущей сборке</SectionTitle><ul className="ad-notes">{d.ota.notes.map((n: string, i: number) => <li key={i}>{n}</li>)}</ul></Card> : null}
      <SectionTitle trailing={<Button small icon="add" onClick={add}>Записать выпуск</Button>}>История выпусков</SectionTitle>
      <div className="ad-list">
        {d.releases.map((r: J, i: number) => (
          <Appear key={r.id} i={i}><Card className="ad-rel" seed={i}><div><Tag color={r.platform === "web" ? "teal" : "orange"} filled>{r.platform}</Tag><b>{r.version}{r.build ? ` (${r.build})` : ""}</b><small>{fmtDate(r.released_at)}</small></div><ul className="ad-notes">{(r.notes ?? []).map((n: string, k: number) => <li key={k}>{n}</li>)}</ul></Card></Appear>
        ))}
      </div>
      {ai && (
        <Card>
          <SectionTitle>Расход ИИ за 30 дней по видам запросов</SectionTitle>
          {ai.ai.by_kind.map((k: J) => <Row key={k.kind + k.model} title={`${({ chat: "Чат", capture: "Быстрая запись", brief: "Сводка дня", escalate: "Перепроверка", push: "Тексты пушей" } as J)[k.kind] ?? k.kind} · ${k.model.replace("claude-", "")}`} sub={`${num(k.calls)} вызовов · вход ${num(k.tokens_in)} · выход ${num(k.tokens_out)} токенов`}><b>{usd(k.cost)}</b></Row>)}
          <SectionTitle>Кто тратит больше всех</SectionTitle>
          {ai.ai.top_users.map((u: J) => <Row key={u.user_id} title={u.email} sub={`${u.msgs} сообщений`}><b>{usd(u.cost)}</b></Row>)}
        </Card>
      )}
    </>
  );
}
function AddRelease({ close, done, onAuth }: { close: () => void; done: () => void; onAuth: () => void }) {
  const [platform, setPlatform] = useState("web");
  const [version, setVersion] = useState(WEB_VERSION);
  const [build, setBuild] = useState("");
  const [notes, setNotes] = useState("");
  const save = async () => {
    try { await api("release_add", { platform, version: version.trim(), build: build ? Number(build) : null, notes: notes.split("\n").map((x) => x.trim()).filter(Boolean) }); toast("Выпуск записан"); close(); done(); } catch (e) { e instanceof AuthError ? onAuth() : say(e); }
  };
  return (
    <>
      <SheetHeader title="Записать выпуск" action="Сохранить" onAction={save} close={close} />
      <div className="ad-pills">{["web", "ios", "android"].map((p) => <Pill key={p} dense selected={platform === p} onClick={() => setPlatform(p)}>{p}</Pill>)}</div>
      <Field label="Версия" value={version} onChange={setVersion} hint="1.11.0" />
      <Field label="Сборка (если есть)" value={build} onChange={setBuild} inputMode="numeric" />
      <Field label="Что нового — по пункту на строку" value={notes} onChange={setNotes} maxLines={6} />
    </>
  );
}

function Waitlist({ onAuth }: { onAuth: () => void }) {
  const [d, reload] = useLoad<J>("waitlist", {}, [], onAuth);
  if (!d) return <Loading />;
  const csv = () => {
    const rows = [["email", "lang", "platform", "at"], ...d.waitlist.map((w: J) => [w.email, w.lang ?? "", w.platform ?? "", w.at])];
    const blob = new Blob(["﻿" + rows.map((r) => r.map((c: string) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `osiris-waitlist-${new Date().toISOString().slice(0, 10)}.csv` });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  return !d.waitlist.length ? <EmptyState title="Пока никого" text="Почты из формы «Сообщить мне» на лендинге появятся здесь." mood="calm" /> : (
    <>
      <SectionTitle trailing={<Button small ghost icon="download" onClick={csv}>Скачать CSV</Button>}>В листе ожидания: {d.waitlist.length}</SectionTitle>
      <Card>{d.waitlist.map((w: J) => <Row key={w.id} title={w.email} sub={`${fmtDate(w.at)} · язык ${w.lang ?? "—"} · ${w.platform ?? "—"}`}><Button small ghost icon="trash" onClick={async () => { if (await confirm(`Убрать ${w.email}?`)) { try { await api("waitlist_delete", { id: w.id }); reload(); } catch (e) { e instanceof AuthError ? onAuth() : say(e); } } }}>Убрать</Button></Row>)}</Card>
    </>
  );
}

function Admins({ onAuth, me }: { onAuth: () => void; me: J }) {
  const [d, reload] = useLoad<J>("admins", {}, [], onAuth);
  const add = () => openSheet((close) => <AdminForm close={close} done={reload} onAuth={onAuth} />);
  const pass = (a?: J) => openSheet((close) => <PassForm target={a} close={close} onAuth={onAuth} />);
  if (!d) return <Loading />;
  const LOG: J = { login: "вход", login_failed: "неудачный вход", user_plan: "смена тарифа", user_ban: "блокировка", user_unban: "разблокировка", user_delete: "удаление аккаунта", error_resolve: "ошибка закрыта", ip_block: "блокировка адреса", ip_unblock: "адрес разблокирован", guest_reset: "вопросы возвращены", settings_set: "настройка", release_add: "выпуск записан", admin_add: "новый админ", admin_disable: "админ отключён", admin_enable: "админ включён", admin_password: "смена пароля", waitlist_delete: "удаление из листа" };
  return (
    <>
      <SectionTitle trailing={<Button small icon="user-plus" onClick={add}>Добавить админа</Button>}>Администраторы</SectionTitle>
      <Card>
        {d.admins.map((a: J) => (
          <Row key={a.id} title={<>{a.name || a.email} {a.id === me.id && <Tag color="teal" filled>это ты</Tag>} {a.disabled && <Tag color="#C8402A" filled>отключён</Tag>}</>} sub={`${a.email} · последний вход ${fmtDate(a.last_login_at)}`}>
            <Button small ghost icon="lock" onClick={() => pass(a.id === me.id ? undefined : a)}>Пароль</Button>
            {a.id !== me.id && <Button small ghost onClick={async () => { if (a.disabled || await confirm(`Отключить ${a.email}?`, { text: "Он не сможет войти в админку. Можно включить обратно.", action: "Отключить" })) { try { await api("admin_disable", { id: a.id, disabled: !a.disabled }); reload(); } catch (e) { e instanceof AuthError ? onAuth() : say(e); } } }}>{a.disabled ? "Включить" : "Отключить"}</Button>}
          </Row>
        ))}
      </Card>
      <SectionTitle>Журнал действий</SectionTitle>
      <Card className="ad-log">
        {d.log.map((l: J) => <div key={l.id}><small>{fmtDate(l.at)}</small><b>{LOG[l.action] ?? l.action}</b><span>{l.admins?.email ?? "—"}</span><code>{l.detail ? JSON.stringify(l.detail) : ""}</code></div>)}
      </Card>
    </>
  );
}
function AdminForm({ close, done, onAuth }: { close: () => void; done: () => void; onAuth: () => void }) {
  const [email, setEmail] = useState(""), [name, setName] = useState(""), [pass, setPass] = useState("");
  const save = async () => { try { await api("admin_add", { email, name, pass }); toast("Админ добавлен"); close(); done(); } catch (e) { e instanceof AuthError ? onAuth() : say(e); } };
  return (
    <>
      <SheetHeader title="Новый администратор" action="Добавить" onAction={save} close={close} />
      <p className="ad-hint">Учётная запись админки отдельная: это не аккаунт приложения. Передай пароль лично — письмо не отправляется.</p>
      <Field label="Почта" value={email} onChange={setEmail} type="email" autoComplete="off" autoFocus />
      <Field label="Имя" value={name} onChange={setName} />
      <Field label="Пароль (от 10 символов)" value={pass} onChange={setPass} type="password" autoComplete="new-password" />
    </>
  );
}
function PassForm({ target, close, onAuth }: { target?: J; close: () => void; onAuth: () => void }) {
  const [cur, setCur] = useState(""), [pass, setPass] = useState("");
  const save = async () => {
    try { const r = await api("admin_password", { id: target?.id, current: cur, pass }); toast("Пароль изменён"); close(); if (r.relogin) onAuth(); } catch (e) { e instanceof AuthError ? onAuth() : say(e); }
  };
  return (
    <>
      <SheetHeader title={target ? `Пароль для ${target.email}` : "Мой пароль"} action="Сохранить" onAction={save} close={close} />
      <Field label="Твой текущий пароль" value={cur} onChange={setCur} type="password" autoComplete="current-password" autoFocus />
      <Field label="Новый пароль (от 10 символов)" value={pass} onChange={setPass} type="password" autoComplete="new-password" />
      <p className="ad-hint">После смены пароля все сессии этой учётной записи закрываются.</p>
    </>
  );
}

const Loading = () => <div className="page-loading"><Osi size={84} mood="thinking" /></div>;

// ------------------------------------------------------------------ вход и каркас
function Login({ onIn }: { onIn: (a: J) => void }) {
  const [email, setEmail] = useState(""), [pass, setPass] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const go = async () => {
    setErr(null);
    setBusy(true);
    try {
      const r = await api<J>("login", { email: email.trim(), pass });
      sessionStorage.setItem(TOKEN, r.token);
      onIn(r.admin);
    } catch (e) { setErr(ERR[(e as Error).message] ?? "Не получилось войти"); }
    setBusy(false);
  };
  return (
    <main className="auth">
      <div className="auth-art" aria-hidden><Osi size={200} mood={busy ? "thinking" : err ? "worried" : "calm"} /></div>
      <Card className="auth-card" padding={28} seed={3} lift={6}>
        <Logo size={34} />
        <h1>Админка</h1>
        <form onSubmit={(e) => { e.preventDefault(); void go(); }}>
          <Field label="Почта" value={email} onChange={setEmail} type="email" autoComplete="username" autoFocus />
          <Field label="Пароль" value={pass} onChange={setPass} type="password" autoComplete="current-password" error={err} />
          <Button type="submit" expand busy={busy} color="orange">Войти</Button>
        </form>
        <p className="auth-legal">Учётные записи админки отдельные от аккаунтов приложения.</p>
      </Card>
    </main>
  );
}

const NAV: [string, string, string][] = [["overview", "chart", "Обзор"], ["users", "users", "Пользователи"], ["traffic", "trend", "Трафик"], ["errors", "alert", "Ошибки"], ["chat", "chat", "Чат Оси"], ["versions", "rocket", "Версии"], ["waitlist", "mail", "Лист ожидания"], ["admins", "shield", "Админы"]];

function Admin() {
  const [me, setMe] = useState<J | null | undefined>(undefined);
  const [tab, setTab] = useState(() => location.hash.slice(2) || "overview");
  const [collapsed, setCollapsed] = useState(false);
  const [errors, setErrors] = useState(0);
  const last = useRef<number | null>(null);
  const out = useCallback(() => { sessionStorage.removeItem(TOKEN); setMe(null); }, []);

  useEffect(() => {
    if (!sessionStorage.getItem(TOKEN)) return setMe(null);
    api<J>("me").then((r) => setMe(r.admin)).catch(() => setMe(null));
  }, []);
  useEffect(() => {
    const on = () => setTab(location.hash.slice(2) || "overview");
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);

  // оповещение об ошибках: раз в минуту сверяем число открытых; выросло — тост и число в заголовке вкладки
  const poll = useCallback(() => {
    api<J>("stats").then((r) => {
      const n = r.stats.errors_open as number;
      if (last.current !== null && n > last.current) toast(`Новая ошибка на сайте (открытых: ${n})`, "error");
      last.current = n;
      setErrors(n);
      document.title = `${n ? `(${n}) ` : ""}OSIRIS · Админка`;
    }).catch((e) => { if (e instanceof AuthError) out(); });
  }, [out]);
  useEffect(() => {
    if (!me) return;
    poll();
    const t = setInterval(poll, 60_000);
    return () => clearInterval(t);
  }, [me, poll]);

  if (me === undefined) return <div className="splash"><Osi size={110} mood="thinking" /></div>;
  if (!me) return <Login onIn={setMe} />;
  const go = (k: string) => { location.hash = "/" + k; };
  const title = NAV.find((n) => n[0] === tab)?.[2] ?? "Обзор";
  const logout = () => { void api("logout").catch(() => {}); out(); };

  return (
    <div className={`shell ad${collapsed ? " collapsed" : ""}`}>
      <aside className="side" aria-label="Меню">
        <div className="side-top">
          <a href="#/overview" className="side-logo" aria-label="OSIRIS"><LogoMark size={34} /><Wordmark size={17} className="nav-label" /></a>
          <button type="button" className="side-toggle" aria-expanded={!collapsed} aria-label={collapsed ? "Развернуть меню" : "Свернуть меню"} onClick={() => setCollapsed((v) => !v)}><Icon name={collapsed ? "panel-open" : "panel-close"} size={18} /></button>
        </div>
        <nav className="side-nav">
          {NAV.map(([k, icon, label]) => (
            <a key={k} href={`#/${k}`} className={`nav-item${tab === k ? " on" : ""}`} aria-current={tab === k ? "page" : undefined} title={collapsed ? label : undefined}>
              <span className="nav-ico"><Icon name={icon} size={20} />{k === "errors" && errors > 0 && <span className="count">{errors}</span>}</span>
              <span className="nav-label">{label}</span>
            </a>
          ))}
        </nav>
        <button type="button" className="side-me" onClick={logout} title="Выйти">
          <span className="avatar" style={{ width: 38, height: 38, background: "var(--butter)", fontSize: 16 }}>{(me.name || me.email)[0].toUpperCase()}</span>
          <span className="nav-label"><b>{me.name || me.email}</b><small>Выйти</small></span>
          <Icon name="logout" size={17} className="nav-label" />
        </button>
      </aside>
      <main className="content">
        <nav className="ad-mobnav" aria-label="Разделы">
          {NAV.map(([k, icon, label]) => <Pill key={k} dense icon={icon} selected={tab === k} badge={k === "errors" ? errors : undefined} onClick={() => go(k)}>{label}</Pill>)}
          <Pill dense icon="logout" onClick={logout}>Выйти</Pill>
        </nav>
        <div key={tab} className="page">
          <header className="screen-header"><div className="screen-title"><h1>{title}</h1></div></header>
          {tab === "users" ? <Users onAuth={out} /> : tab === "traffic" ? <Traffic onAuth={out} /> : tab === "errors" ? <Errors onAuth={out} changed={poll} /> : tab === "chat" ? <GuestChat onAuth={out} /> : tab === "versions" ? <Versions onAuth={out} /> : tab === "waitlist" ? <Waitlist onAuth={out} /> : tab === "admins" ? <Admins onAuth={out} me={me} /> : <Overview onAuth={out} go={go} />}
        </div>
      </main>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<StrictMode><Admin /><Overlays /></StrictMode>);
