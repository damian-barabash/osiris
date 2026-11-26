// Настройки — порт app/lib/screens/settings/settings_screen.dart и smart_push_section.dart.
// Те же вкладки, что в приложении; на телефоне — лента пилюль, на ноутбуке — меню слева.
// Не для браузера (см. CLAUDE.md): Face ID, локальные напоминания (notify_*), обновления OTA, виджеты.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { L, setLang, tr, type Lang } from "@/i18n";
import { Button, Card, ChoiceRow, Collapse, Field, Icon, LogoMark, Pill, Row, ScreenHeader, SectionTitle, SheetHeader, SlideSwitcher, Switch, Wordmark, confirm, openSheet, toast } from "@/ui";
import { CONTACT_EMAIL, WEB_VERSION } from "@/config";
import { sb } from "../../sb";
import { store, useStore, type Store } from "../../data/store";
import { currencies } from "../../format";
import { back, nav, useRoute } from "../../router";
import { Theme, type ThemeMode } from "../../theme";
import { PaperAvatar, forgetAvatar } from "../../widgets/Avatar";
import { PlanCards } from "../plans/plans";
import { hasPassword, setPassword, useAuthUser } from "../onboarding/Onboarding";
import { startImport } from "./importSheet";
import "./SettingsScreen.css";

const TABS = [
  ["profile", "person", "Профиль"],
  ["plan", "star", "Подписка"],
  ["look", "paint", "Вид"],
  ["notify", "bell", "Уведомления"],
  ["data", "download", "Данные"],
  ["account", "lock", "Аккаунт"],
] as const;
type TabId = (typeof TABS)[number][0];

const errText = (e: unknown) => String((e as { message?: string })?.message ?? e);
const lsGet = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* приватный режим */ } };

export default function SettingsScreen() {
  const s = useStore();
  const route = useRoute();
  const tab: TabId = TABS.find((t) => t[0] === route.query.get("tab"))?.[0] ?? "profile";
  const index = TABS.findIndex((t) => t[0] === tab);
  const prev = useRef(index);
  const dir = index >= prev.current ? 1 : -1;
  useEffect(() => { prev.current = index; }, [index]);

  // на телефоне выбранная пилюля подъезжает в середину ленты
  const strip = useRef<HTMLElement>(null);
  useEffect(() => {
    strip.current?.querySelector<HTMLElement>('[aria-pressed="true"]')?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [tab]);

  return (
    <div className="set">
      <ScreenHeader title={tr("Настройки")} back={() => back("/")} />
      <div className="set-body">
        <nav ref={strip} className="set-tabs" aria-label={tr("Настройки")}>
          {TABS.map(([id, icon, label]) => (
            <Pill key={id} icon={icon} selected={id === tab} onClick={() => id !== tab && nav(`/settings?tab=${id}`, { replace: true })}>{tr(label)}</Pill>
          ))}
        </nav>
        <SlideSwitcher k={tab} dir={dir} className={`set-pane set-pane-${tab}`}>
          {tab === "profile" ? <ProfileTab s={s} />
            : tab === "plan" ? <PlanCards />
            : tab === "look" ? <LookTab s={s} />
            : tab === "notify" ? <NotifyTab s={s} />
            : tab === "data" ? <DataTab />
            : <AccountTab />}
        </SlideSwitcher>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Профиль

/** Текстовое поле профиля: сохраняется, когда из него вышли или закрыли вкладку настроек (в приложении — при закрытии экрана). */
function useDraft(saved: string, save: (v: string) => void): [string, (v: string) => void, () => void] {
  const [text, setText] = useState(saved);
  const live = useRef({ text, saved, save });
  live.current = { text, saved, save };
  const flush = () => {
    const { text, saved, save } = live.current;
    if (text.trim() !== saved) save(text.trim());
  };
  useEffect(() => flush, []); // eslint-disable-line react-hooks/exhaustive-deps
  return [text, setText, flush];
}

/** Уменьшить фото до max px по большей стороне и сжать в JPEG. */
async function toJpeg(file: File, max = 512): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight, 1));
    const w = Math.max(1, Math.round(img.naturalWidth * k)), h = Math.max(1, Math.round(img.naturalHeight * k));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas");
    ctx.fillStyle = "#fff"; // прозрачный фон PNG в JPEG стал бы чёрным
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    return await new Promise<Blob>((ok, fail) => canvas.toBlob((b) => (b ? ok(b) : fail(new Error("jpeg"))), "image/jpeg", 0.85));
  } finally {
    URL.revokeObjectURL(url);
  }
}

function ProfileTab({ s }: { s: Store }) {
  const p = s.profile;
  const user = useAuthUser();
  const [name, setName, saveName] = useDraft(p?.name ?? "", (v) => void store.updateProfile({ name: v }));
  const [about, setAbout, saveAbout] = useDraft(p?.about ?? "", (v) => void store.updateProfile({ about: v }));
  const [loading, setLoading] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  const upload = async (f: File) => {
    const uid = store.userId;
    if (!uid) return;
    setLoading(true);
    try {
      const blob = await toJpeg(f);
      const path = `${uid}/avatar.jpg`;
      const { error } = await sb.storage.from("avatars").upload(path, blob, { upsert: true, contentType: "image/jpeg" });
      if (error) throw error;
      forgetAvatar(path);
      await store.updateProfile({ avatar_path: path });
    } catch (e) {
      toast(tr("Не получилось загрузить фото: {0}", [errText(e)]), "error");
    } finally {
      setLoading(false);
    }
  };

  const remove = async () => {
    const path = store.profile?.avatarPath;
    if (!path) return;
    await sb.storage.from("avatars").remove([path]);
    forgetAvatar(path);
    await store.updateProfile({ avatar_path: null });
  };

  // выбор файла открывается прямо из нажатия на вариант: браузеры не дают открыть его «потом»
  const avatarMenu = () => void openSheet<void>((close) => (
    <div className="dialog">
      <h3>{tr("Аватар")}</h3>
      <p>{tr("Фото станет пастельным и зернистым — как всё в OSIRIS.")}</p>
      <div className="dialog-list">
        <button type="button" className="dialog-option" onClick={() => { file.current?.click(); close(); }}><b>{tr("Выбрать из фото")}</b></button>
        {store.profile?.avatarPath && (
          <button type="button" className="dialog-option" style={{ color: "var(--danger)" }} onClick={() => { close(); void remove(); }}><b>{tr("Убрать фото")}</b></button>
        )}
      </div>
      <Button ghost expand onClick={() => close()}>{tr("Отмена")}</Button>
    </div>
  ));

  return (
    <>
      <div className="set-me">
        <button type="button" className={`set-avatar${loading ? " busy" : ""}`} onClick={avatarMenu} aria-label={tr("Аватар")}>
          <PaperAvatar size={110} />
          <span className="set-avatar-badge">{loading ? <span className="spin" aria-hidden /> : <Icon name="camera" size={15} />}</span>
        </button>
        <input ref={file} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void upload(f); }} />
      </div>

      <SectionTitle>{tr("Ты")}</SectionTitle>
      <div onBlur={saveName}>
        <Field label={tr("Как к тебе обращаться")} value={name} onChange={setName} name="name" autoComplete="given-name" maxLength={60} />
      </div>
      <p className="set-hint">{user?.email ?? ""}</p>

      <SectionTitle>{tr("Что Оси знает обо мне")}</SectionTitle>
      <div onBlur={saveAbout}>
        <Field label={tr("Факты о тебе")} hint={tr("Работаю фрилансером, веду сайты и видео. Не люблю встречи до 10:00…")} value={about} onChange={setAbout} maxLines={10} />
      </div>
      <p className="set-hint">{tr("Сюда Оси сам записывает договорённости и то, что ты просил запомнить. Можно править. Это видит только ассистент.")}</p>

      <SectionTitle>{tr("Деньги и настроение")}</SectionTitle>
      <ChoiceRow label={tr("Валюта по умолчанию")} value={p?.currency ?? "PLN"} options={currencies.map((c) => [c, c] as [string, string])} onChange={(v) => void s.updateProfile({ default_currency: v })} />
      <ChoiceRow<number> label={tr("Спрашивать настроение каждые")} value={p?.moodInterval ?? 4}
        options={[[2, tr("2 ч")], [3, tr("3 ч")], [4, tr("4 ч")], [6, tr("6 ч")], [8, tr("8 ч")]]} onChange={(v) => void s.updateProfile({ mood_interval_hours: v })} />
    </>
  );
}

// ---------------------------------------------------------------- Вид

function LookTab({ s }: { s: Store }) {
  const p = s.profile;
  const [, redraw] = useState(0);
  const [calStart, setCalStart] = useState(() => lsGet("cal_start") ?? "last");

  const pickLang = async (v: "system" | Lang) => {
    if (v === L.pref) return;
    await setLang(v);
    // сервер пишет пуши и сводку на этом языке
    if (store.profile?.raw.lang !== L.code) void store.updateProfile({ lang: L.code });
  };

  return (
    <>
      <SectionTitle>{tr("Оформление")}</SectionTitle>
      <ChoiceRow<ThemeMode> label={tr("Тема")} value={Theme.mode} options={[["light", tr("Светлая")], ["dark", tr("Тёмная")], ["system", tr("Как в системе")]]}
        onChange={(v) => { Theme.set(v); redraw((n) => n + 1); }} />

      <SectionTitle>{tr("Язык")}</SectionTitle>
      {/* названия языков не переводятся: каждый написан на себе самом */}
      <ChoiceRow<"system" | Lang> label={tr("Язык приложения")} value={L.pref} options={[["system", tr("Как в браузере")], ["ru", "Русский"], ["pl", "Polski"], ["en", "English"]]} onChange={(v) => void pickLang(v)} />
      <p className="set-hint">{tr("Оси отвечает на том языке, на котором ты ему пишешь.")}</p>

      <SectionTitle>{tr("Календарь")}</SectionTitle>
      <ChoiceRow label={tr("Открывать календарь в виде")} value={calStart}
        options={[["last", tr("Последний")], ["week", tr("Неделя")], ["list", tr("Список")], ["month", tr("Месяц")], ["year", tr("Год")]]}
        onChange={(v) => { lsSet("cal_start", v); setCalStart(v); }} />
      <ChoiceRow<number | null> label={tr("Напоминать о новых делах")} value={p?.remindDefault ?? null}
        options={[[null, tr("Нет")], [0, tr("В момент")], [5, tr("5 мин")], [15, tr("15 мин")], [30, tr("30 мин")], [60, tr("Час")], [1440, tr("За день")]]}
        onChange={(v) => void s.updateProfile({ remind_default: v })} />
      <p className="set-hint">{tr("Напоминания приходят в приложении на телефоне.")}</p>

      <SectionTitle>{tr("Вкладка в меню")}</SectionTitle>
      <div className="set-tabchoice">
        <TabChoice value="projects" icon="briefcase" title={tr("Проекты")} sub={tr("клиенты, бюджеты, оплаты")} on={p?.hoursTab !== true} />
        <TabChoice value="hours" icon="clock" title={tr("Часы")} sub={tr("смены, ставка, зарплата")} on={p?.hoursTab === true} />
      </div>
      <p className="set-hint">{tr("Данные второй вкладки никуда не пропадают — Оси видит и то, и другое.")}</p>
    </>
  );
}

/** Бумажная карточка выбора третьей вкладки: выбранная окрашивается, приподнимается и получает галочку. */
function TabChoice({ value, icon, title, sub, on }: { value: "projects" | "hours"; icon: string; title: string; sub: string; on: boolean }) {
  return (
    <Card color={on ? (value === "hours" ? "orange" : "teal") : null} seed={value === "hours" ? 1 : 2} lift={on ? 4 : 2} padding="12px 12px 12px 14px" aria-pressed={on}
      className={`set-tabcard${on ? " on" : ""}`} onClick={() => { if (!on) void store.updateProfile({ work_tab: value }); }}>
      <div className="set-tabcard-top">
        <Icon name={icon} size={22} />
        <Icon name="check" size={20} className="set-tabcard-tick" />
      </div>
      <b>{title}</b>
      <span>{sub}</span>
    </Card>
  );
}

// ---------------------------------------------------------------- Уведомления

/** Что Оси может присылать сам — ключи как в SmartPushSection.kinds приложения. */
const pushKinds = (): [string, string, string][] => [
  ["morning", tr("Утренняя сводка"), tr("В 8:30 — главное на день")],
  ["critical", tr("Решающие даты и дедлайны"), tr("За 3 дня, за день и в день")],
  ["overdue", tr("«Ты не забыл?»"), tr("В 11:00: сделал или перенести — по задачам, у которых прошёл срок")],
  ["evening", tr("Вечерний итог"), tr("В 20:30: что не закрыто и что завтра")],
  ["debts", tr("Долги клиентов"), tr("По понедельникам: кто давно не платил")],
  ["mood", tr("Забота"), tr("Если несколько дней подряд тяжело")],
];

function NotifyTab({ s }: { s: Store }) {
  const raw = s.profile?.raw.push_settings;
  const set: Record<string, unknown> = { enabled: true, morning: true, evening: true, critical: true, overdue: true, debts: true, mood: true, ...(raw && typeof raw === "object" ? raw : {}) };
  const on = set.enabled === true;
  const toggle = (k: string, v: boolean) => void s.updateProfile({ push_settings: { ...set, [k]: v } });
  return (
    <>
      <Card color="butter" seed={3} lift={3} className="set-phone">
        <Icon name="phone" size={26} />
        <p>{tr("Напоминания и пуши приходят в приложении OSIRIS на телефоне — браузер их не показывает. Здесь можно выбрать, о чём Оси пишет сам: настройка общая для всего аккаунта.")}</p>
      </Card>

      <SectionTitle>{tr("Умные уведомления")}</SectionTitle>
      <p className="set-hint top">{tr("Оси сам следит за важным и пишет, когда нужно: несколько поводов — одним уведомлением, не чаще раза в 45 минут и 5 раз в день, ночью молчит.")}</p>
      <Card seed={1} lift={3} padding="4px 14px">
        <Row title={tr("Умные пуши")} sub={tr("Главный переключатель")}><Switch value={on} onChange={(v) => toggle("enabled", v)} label={tr("Умные пуши")} /></Row>
        <Collapse open={on}>
          <div className="set-rows">
            {pushKinds().map(([k, title, sub]) => (
              <Row key={k} title={title} sub={sub}><Switch value={set[k] !== false} onChange={(v) => toggle(k, v)} disabled={!on} label={title} /></Row>
            ))}
          </div>
        </Collapse>
      </Card>
    </>
  );
}

// ---------------------------------------------------------------- Данные

function DataTab() {
  const file = useRef<HTMLInputElement>(null);
  return (
    <>
      <SectionTitle>{tr("Перенос данных")}</SectionTitle>
      <Card seed={0} onClick={() => file.current?.click()} className="set-import">
        <span className="set-import-ico"><Icon name="download" size={20} /></span>
        <div>
          <b>{tr("Импорт из Structured и других")}</b>
          <span>{tr("Файл экспорта Structured (JSON), календарь .ics или любой JSON с делами")}</span>
        </div>
        <Icon name="right" size={18} />
      </Card>
      <input ref={file} type="file" hidden aria-label={tr("Файл экспорта")} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void startImport(f); }} />
      <p className="set-hint">{tr("В Structured: Настройки → О приложении → Конфиденциальность → «Экспорт данных», сохрани файл и выбери его здесь.")}</p>
    </>
  );
}

// ---------------------------------------------------------------- Аккаунт

/** Адрес страницы сайта на языке интерфейса: /pl/…, /ru/…, английская — без префикса. */
const sitePage = (p: string) => `/${{ ru: "ru/", pl: "pl/", en: "" }[L.lang]}${p}/`;

function LinkRow({ href, title, sub, icon = "external" }: { href: string; title: string; sub?: string; icon?: string }) {
  const out = !href.startsWith("mailto:");
  return (
    <a className="row tap set-link" href={href} target={out ? "_blank" : undefined} rel={out ? "noopener" : undefined}>
      <span className="row-text">
        <span className="row-title">{title}</span>
        {sub && <span className="row-sub">{sub}</span>}
      </span>
      <Icon name={icon} size={17} />
    </a>
  );
}

function AccountTab() {
  const user = useAuthUser();
  const has = hasPassword(user);

  const signOut = async () => {
    if (!(await confirm(tr("Выйти из аккаунта?"), { action: tr("Выйти") }))) return;
    // только это устройство: без scope выход завершал сессии везде, и в приложении на телефоне Оси отвечал «bad auth»
    const { error } = await sb.auth.signOut({ scope: "local" });
    if (error) toast(errText(error), "error");
  };

  return (
    <>
      <SectionTitle>{tr("Безопасность")}</SectionTitle>
      <Card seed={2} lift={3} padding="4px 14px">
        <Row title={tr("Пароль")} sub={<span className={`set-pass${user && !has ? " none" : ""}`}>{!user ? (user === null ? "" : "…") : has ? tr("Вход по почте и паролю") : tr("Пароля нет — вход только через Google")}</span>}>
          <Pill dense disabled={!user} onClick={() => void showPasswordSheet(user?.email ?? "")}>{has ? tr("Сменить") : tr("Задать")}</Pill>
        </Row>
        <Row title={tr("Почта")} sub={user?.email ?? ""} />
      </Card>

      <SectionTitle>{tr("Документы и связь")}</SectionTitle>
      <Card seed={3} lift={3} padding="4px 14px">
        <LinkRow href={sitePage("terms")} title={tr("Условия использования")} />
        <LinkRow href={sitePage("privacy")} title={tr("Политика конфиденциальности")} />
        <LinkRow href={sitePage("cookies")} title={tr("Файлы cookie")} />
        <LinkRow href={`mailto:${CONTACT_EMAIL}`} title={tr("Написать нам")} sub={CONTACT_EMAIL} icon="mail" />
        <Row title={tr("Версия")} sub={tr("Веб-версия сверена с приложением {0}", [WEB_VERSION])}><span className="set-version">{WEB_VERSION}</span></Row>
      </Card>

      <div className="set-out">
        <Button ghost expand icon="logout" onClick={() => void signOut()}>{tr("Выйти")}</Button>
      </div>

      <SectionTitle>{tr("Удаление")}</SectionTitle>
      <Card seed={1} lift={3} padding="4px 14px">
        <Row danger title={tr("Удалить аккаунт")} sub={tr("По запросу на почту — вместе со всеми данными")} onClick={() => void showDeleteAccount(user?.email ?? "")}>
          <Icon name="right" size={17} />
        </Row>
      </Card>

      <div className="set-logo">
        <LogoMark size={54} />
        <Wordmark size={16} />
      </div>
    </>
  );
}

function showPasswordSheet(email: string) {
  return openSheet<void>((close) => <PasswordSheet email={email} close={() => close()} />);
}

function PasswordSheet({ email, close }: { email: string; close: () => void }) {
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const save = async () => {
    if (busy) return;
    if (a.length < 6) return setErr(tr("Пароль — минимум 6 символов"));
    if (a !== b) return setErr(tr("Пароли не совпадают"));
    setBusy(true);
    setErr(null);
    try {
      await setPassword(a);
      close();
      toast(tr("Пароль сохранён — теперь можно входить и по почте"));
    } catch (e) {
      setBusy(false);
      setErr(errText(e));
    }
  };
  return (
    <form onSubmit={(e) => { e.preventDefault(); void save(); }}>
      <SheetHeader title={tr("Пароль")} sub={email} action={tr("Готово")} onAction={() => void save()} busy={busy} close={close} />
      <Field label={tr("Новый пароль")} value={a} onChange={setA} type="password" autoComplete="new-password" autoFocus />
      <Field label={tr("Ещё раз")} value={b} onChange={setB} type="password" autoComplete="new-password" error={err} onEnter={() => void save()} />
    </form>
  );
}

/** Удаление аккаунта — по письму: сервер сам аккаунты не удаляет. */
function showDeleteAccount(email: string) {
  const subject = tr("OSIRIS: удалить аккаунт");
  const body = email ? tr("Прошу удалить мой аккаунт OSIRIS и все его данные. Почта аккаунта: {0}", [email]) : tr("Прошу удалить мой аккаунт OSIRIS и все его данные.");
  const href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  return openSheet<void>((close): ReactNode => (
    <div className="dialog">
      <h3>{tr("Удалить аккаунт")}</h3>
      <p>{tr("Аккаунт удаляется по запросу: напиши на {0} с почты, на которую он зарегистрирован. Вместе с аккаунтом удаляются все дела, заметки, цели и переписка с Оси — вернуть их будет нельзя.", [CONTACT_EMAIL])}</p>
      <div className="dialog-actions">
        <Button ghost onClick={() => close()}>{tr("Отмена")}</Button>
        <Button danger icon="mail" onClick={() => { location.href = href; close(); }}>{tr("Написать письмо")}</Button>
      </div>
    </div>
  ));
}
