// Первые шаги нового пользователя — порт app/lib/screens/onboarding_screen.dart:
// имя → пароль (если вошёл через Google) → какая вкладка нужна → первая работа. В конце пишет profiles.onboarded_at.
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { tr } from "@/i18n";
import { Button, Card, ChoiceRow, Collapse, Cutout, Field, Icon, Osi, RoundButton, SlideSwitcher, type OsiMood } from "@/ui";
import { sb } from "../../sb";
import { store } from "../../data/store";
import { currencies } from "../../format";
import "./Onboarding.css";

/** Есть ли у аккаунта пароль (вошедшие через Google его не имеют, пока не зададут). */
export function hasPassword(u: User | null | undefined): boolean {
  if (!u) return false;
  const list = u.app_metadata?.providers;
  const providers: unknown[] = Array.isArray(list) ? list : [u.app_metadata?.provider ?? ""];
  return providers.includes("email") || u.user_metadata?.has_password === true;
}

/** Задать пароль аккаунту. Для Google-аккаунта это второй способ входа: по почте и паролю. */
export async function setPassword(password: string): Promise<void> {
  const { error } = await sb.auth.updateUser({ password, data: { has_password: true } });
  if (error) throw error;
}

/** Текущий пользователь из сохранённой сессии (undefined — ещё читаем). */
export function useAuthUser(): User | null | undefined {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    void sb.auth.getSession().then(({ data }) => { if (live) setUser(data.session?.user ?? null); });
    const { data } = sb.auth.onAuthStateChange((_e, s) => { if (live) setUser(s?.user ?? null); });
    return () => { live = false; data.subscription.unsubscribe(); };
  }, []);
  return user;
}

/** «1 234,50» → число (как parseMoney в приложении). */
const parseMoney = (s: string): number | null => {
  const v = Number(s.replace(/[\s ]/g, "").replace(",", "."));
  return s.trim() && Number.isFinite(v) ? v : null;
};

type Step = "name" | "password" | "tab" | "job";

export default function Onboarding({ onDone }: { onDone: () => void }): ReactNode {
  const user = useAuthUser();
  // нужен ли шаг с паролем, решаем один раз: после сохранения пароля шаг не должен исчезнуть из-под ног
  const needPassword = useRef<boolean | null>(null);
  if (needPassword.current == null && user !== undefined) needPassword.current = !hasPassword(user);

  const [name, setName] = useState(() => store.profile?.name ?? "");
  const [pass, setPass] = useState("");
  const [pass2, setPass2] = useState("");
  const [job, setJob] = useState("");
  const [rate, setRate] = useState("");
  const [currency, setCurrency] = useState(() => store.profile?.currency ?? "PLN");
  const [tab, setTab] = useState<"projects" | "hours">("projects");
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastError = useRef("");
  if (error) lastError.current = error;

  // имя из Google, если в профиле его ещё нет
  const named = useRef(false);
  useEffect(() => {
    if (named.current || !user) return;
    named.current = true;
    const m = user.user_metadata ?? {};
    setName((v) => v || String(m.name ?? m.full_name ?? "").split(" ")[0]);
  }, [user]);

  if (user === undefined) return <div className="splash"><Osi size={120} mood="thinking" /></div>;

  const steps: Step[] = ["name", ...(needPassword.current ? ["password" as const] : []), "tab", ...(tab === "hours" ? ["job" as const] : [])];
  const cur = steps[Math.min(step, steps.length - 1)];
  const last = step >= steps.length - 1;

  const finish = async () => {
    setBusy(true);
    const s = store;
    if (tab === "hours" && job.trim()) {
      await s.insert("jobs", { name: job.trim(), rate: parseMoney(rate) ?? 0, currency, color: "teal", icon: "briefcase" });
    }
    // сразу после знакомства настроение не спрашиваем
    try { localStorage.setItem("mood_skipped_at", new Date().toISOString()); } catch { /* приватный режим */ }
    await s.updateProfile({ name: name.trim(), work_tab: tab, default_currency: currency, onboarded_at: new Date().toISOString() });
    onDone();
    setBusy(false); // если запись не прошла (нет сети), экран остаётся — кнопка снова доступна
  };

  const next = async () => {
    if (busy) return;
    setError(null);
    if (cur === "name") {
      if (!name.trim()) return setError(tr("Как к тебе обращаться?"));
    } else if (cur === "password") {
      if (pass.length < 6) return setError(tr("Пароль — минимум 6 символов"));
      if (pass !== pass2) return setError(tr("Пароли не совпадают"));
      setBusy(true);
      try {
        await setPassword(pass);
      } catch (e) {
        setBusy(false);
        return setError(tr("Не получилось сохранить пароль: {0}", [String((e as { message?: string })?.message ?? e)]));
      }
      setBusy(false);
    } else if (cur === "job") {
      if (!job.trim()) return setError(tr("Как называется работа?"));
    }
    if (!last) {
      setDir(1);
      setStep(step + 1);
      return;
    }
    await finish();
  };

  const prev = () => { setError(null); setDir(-1); setStep(Math.max(0, step - 1)); };

  let page: ReactNode;
  if (cur === "name") {
    page = (
      <Frame mood="happy" wave title={tr("Привет! Я Оси")} text={tr("Я буду следить за твоими делами, датами и деньгами. Как к тебе обращаться?")}>
        <Field label={tr("Имя")} value={name} onChange={setName} autoFocus autoComplete="given-name" name="name" maxLength={60} onEnter={() => void next()} />
      </Frame>
    );
  } else if (cur === "password") {
    page = (
      <Frame mood="worried" title={tr("Придумай пароль")} text={tr("Ты вошёл через Google. Задай пароль, чтобы не потерять аккаунт: войти можно будет и по почте {0}.", [user?.email ?? ""])}>
        <Field label={tr("Пароль")} value={pass} onChange={setPass} type="password" autoComplete="new-password" autoFocus />
        <Field label={tr("Ещё раз")} value={pass2} onChange={setPass2} type="password" autoComplete="new-password" onEnter={() => void next()} />
      </Frame>
    );
  } else if (cur === "tab") {
    page = (
      <Frame mood="thinking" title={tr("Что будем считать?")} text={tr("Выбери третью вкладку в меню. Поменять можно в любой момент в настройках.")}>
        <div className="onb-choices">
          <Choice on={tab === "projects"} icon="briefcase" color="teal" seed={1} title={tr("Проекты и клиенты")} sub={tr("Бюджеты, оплаты, кто сколько должен. Для фриланса и своего дела.")} onPick={() => setTab("projects")} />
          <Choice on={tab === "hours"} icon="clock" color="orange" seed={2} title={tr("Учёт часов")} sub={tr("Смены, ставка в час и зарплата. Можно несколько работ.")} onPick={() => setTab("hours")} />
        </div>
      </Frame>
    );
  } else {
    page = (
      <Frame mood="excited" title={tr("Первая работа")} text={tr("Где работаешь и сколько платят в час? Вторую работу добавишь потом на вкладке «Часы».")}>
        <Field label={tr("Название")} hint={tr("Кафе «Липа», склад, фриланс…")} value={job} onChange={setJob} autoFocus maxLength={80} />
        <Field label={tr("Ставка в час")} value={rate} onChange={setRate} inputMode="decimal" suffix={currency} onEnter={() => void next()} />
        <ChoiceRow label={tr("Валюта")} value={currency} options={currencies.map((c) => [c, c] as [string, string])} onChange={setCurrency} />
      </Frame>
    );
  }

  return (
    <main className="onb">
      <div className="onb-top">
        <span className={`onb-back${step > 0 ? " on" : ""}`}><RoundButton icon="back" label={tr("Назад")} onClick={step > 0 && !busy ? prev : undefined} /></span>
        {/* точки шагов */}
        <div className="onb-dots" aria-hidden>
          {steps.map((k, i) => <span key={k} className={i === step ? "now" : i < step ? "done" : ""} />)}
        </div>
      </div>
      <SlideSwitcher k={cur} dir={dir} className="onb-page">{page}</SlideSwitcher>
      <Collapse open={error != null}><p className="onb-error" role="alert">{lastError.current}</p></Collapse>
      <div className="onb-next">
        <Button expand color="orange" busy={busy} onClick={() => void next()}>{last ? tr("Поехали") : tr("Дальше")}</Button>
      </div>
    </main>
  );
}

function Frame({ mood, wave = false, title, text, children }: { mood: OsiMood; wave?: boolean; title: string; text: string; children: ReactNode }) {
  return (
    <>
      <div className="onb-art" aria-hidden>
        <Cutout kind="star" size={40} seed={4} color="#F1E5A0" className="a" />
        <Cutout kind="ring" size={32} seed={8} color="#9C9FDD" className="b" />
        <Cutout kind="leaf" size={30} seed={5} color="#A7C98C" className="c" />
        <Osi size={140} mood={mood} wave={wave} />
      </div>
      <h1>{title}</h1>
      <p className="onb-text">{text}</p>
      <div className="onb-form">{children}</div>
    </>
  );
}

/** Бумажная карточка выбора вкладки: выбранная окрашивается, приподнимается и получает галочку. */
function Choice({ on, icon, color, seed, title, sub, onPick }: { on: boolean; icon: string; color: string; seed: number; title: string; sub: string; onPick: () => void }) {
  return (
    <Card color={on ? color : null} seed={seed} lift={on ? 5 : 2} onClick={onPick} className={`onb-choice${on ? " on" : ""}`} aria-pressed={on}>
      <Icon name={icon} size={30} />
      <div>
        <b>{title}</b>
        <span>{sub}</span>
      </div>
      <Icon name="check" size={24} className="onb-tick" />
    </Card>
  );
}
