// Вход и регистрация — как экран входа приложения (app/lib/screens/login_screen.dart): почта + пароль, Google.
import { useState } from "react";
import { tr } from "@/i18n";
import { GOOGLE_WEB } from "@/config";
import { Button, Card, Cutout, Field, Logo, Osi, Pill, toast } from "@/ui";
import { sb } from "../sb";

const appUrl = () => `${location.origin}/app/`;
const pagePath = (p: string) => `/${{ ru: "ru/", pl: "pl/", en: "" }[document.documentElement.lang as "ru" | "pl" | "en"] ?? ""}${p}`;

/** Понятный текст ошибки Supabase Auth. */
function authError(e: { message?: string; code?: string }): string {
  const m = (e.message ?? "").toLowerCase(), c = e.code ?? "";
  if (c === "invalid_credentials" || m.includes("invalid login")) return tr("Неверная почта или пароль");
  if (c === "user_already_exists" || m.includes("already registered")) return tr("Такая почта уже зарегистрирована — войди");
  if (c === "weak_password" || m.includes("at least 6")) return tr("Пароль — минимум 6 символов");
  if (c === "over_request_rate_limit" || c === "over_email_send_rate_limit" || m.includes("rate limit")) return tr("Слишком много попыток. Подожди минуту.");
  if (m.includes("failed to fetch") || m.includes("network")) return tr("Нет связи с сервером. Проверь интернет.");
  if (c === "validation_failed" || m.includes("invalid format") || m.includes("valid email")) return tr("Проверь адрес почты");
  return e.message || tr("Что-то пошло не так");
}

export function Login() {
  const [signup, setSignup] = useState(() => new URLSearchParams(location.search).get("mode") === "signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [busy, setBusy] = useState<"" | "form" | "google">("");
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (busy) return;
    setErr(null);
    const mail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mail)) return setErr(tr("Проверь адрес почты"));
    if (pass.length < 6) return setErr(tr("Пароль — минимум 6 символов"));
    if (signup && !name.trim()) return setErr(tr("Как к тебе обращаться?"));
    setBusy("form");
    const { error } = signup
      ? await sb.auth.signUp({ email: mail, password: pass, options: { data: { name: name.trim().slice(0, 60), has_password: true } } })
      : await sb.auth.signInWithPassword({ email: mail, password: pass });
    setBusy("");
    if (error) setErr(authError(error));
  };

  const google = async () => {
    setErr(null);
    setBusy("google");
    const { error } = await sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: appUrl(), queryParams: { prompt: "select_account" } } });
    if (error) { setBusy(""); setErr(authError(error)); }
  };

  const reset = async () => {
    const mail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mail)) return setErr(tr("Введи почту, чтобы сбросить пароль"));
    const { error } = await sb.auth.resetPasswordForEmail(mail, { redirectTo: appUrl() });
    if (error) setErr(authError(error));
    else toast(tr("Письмо для сброса пароля отправлено на {0}", [mail]));
  };

  const terms = <a href={pagePath("terms/")} target="_blank" rel="noopener">{tr("условия использования")}</a>;
  const privacy = <a href={pagePath("privacy/")} target="_blank" rel="noopener">{tr("политику конфиденциальности")}</a>;
  const [a, b, c] = tr("Продолжая, ты принимаешь {0} и {1}.").split(/\{[01]\}/);

  return (
    <main className="auth">
      <a className="auth-back" href="/">← {tr("На сайт")}</a>
      <div className="auth-art" aria-hidden>
        <Cutout kind="sun" size={120} color="#F1E5A0" seed={4} className="float a" />
        <Cutout kind="leaf" size={86} color="#A7C98C" seed={7} className="float b" />
        <Cutout kind="ring" size={70} color="#9C9FDD" seed={9} className="float c" />
        <Osi size={210} mood={busy ? "thinking" : err ? "worried" : signup ? "excited" : "happy"} wave={!busy && !err} />
      </div>
      <Card className="auth-card" padding={28} seed={2} lift={6}>
        <Logo size={34} />
        <h1>{signup ? tr("Создать аккаунт") : tr("С возвращением")}</h1>
        <div className="auth-tabs" role="tablist">
          <Pill selected={!signup} onClick={() => { setSignup(false); setErr(null); }}>{tr("Вход")}</Pill>
          <Pill selected={signup} onClick={() => { setSignup(true); setErr(null); }}>{tr("Регистрация")}</Pill>
        </div>
        <form key={signup ? "up" : "in"} className="slide-in" onSubmit={(e) => { e.preventDefault(); void submit(); }} noValidate>
          {signup && <Field label={tr("Имя")} value={name} onChange={setName} autoComplete="given-name" name="name" maxLength={60} autoFocus />}
          <Field label={tr("Почта")} value={email} onChange={setEmail} type="email" inputMode="email" autoComplete="email" name="email" autoFocus={!signup} />
          <Field label={tr("Пароль")} value={pass} onChange={setPass} type="password" autoComplete={signup ? "new-password" : "current-password"} name="password" error={err} />
          <Button type="submit" expand busy={busy === "form"} color="orange">{signup ? tr("Зарегистрироваться") : tr("Войти")}</Button>
        </form>
        {!signup && <button type="button" className="auth-link" onClick={reset}>{tr("Забыл пароль?")}</button>}
        {GOOGLE_WEB && (
          <>
            <div className="auth-or"><span>{tr("или")}</span></div>
            <Button ghost expand busy={busy === "google"} onClick={google}>
              <span className="g-mark" aria-hidden>G</span> {tr("Продолжить с Google")}
            </Button>
          </>
        )}
        <p className="auth-legal">{a}{terms}{b}{privacy}{c}</p>
      </Card>
    </main>
  );
}

/** После перехода по ссылке «сбросить пароль»: задать новый. */
export function NewPassword({ onDone }: { onDone: () => void }) {
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const save = async () => {
    if (a.length < 6) return setErr(tr("Пароль — минимум 6 символов"));
    if (a !== b) return setErr(tr("Пароли не совпадают"));
    setBusy(true);
    const { error } = await sb.auth.updateUser({ password: a, data: { has_password: true } });
    setBusy(false);
    if (error) return setErr(authError(error));
    toast(tr("Пароль сохранён — теперь можно входить и по почте"));
    onDone();
  };
  return (
    <main className="auth">
      <div className="auth-art" aria-hidden><Osi size={190} mood="calm" /></div>
      <Card className="auth-card" padding={28} seed={1} lift={6}>
        <Logo size={34} />
        <h1>{tr("Задай новый пароль")}</h1>
        <form onSubmit={(e) => { e.preventDefault(); void save(); }}>
          <Field label={tr("Новый пароль")} value={a} onChange={setA} type="password" autoComplete="new-password" autoFocus />
          <Field label={tr("Ещё раз")} value={b} onChange={setB} type="password" autoComplete="new-password" error={err} />
          <Button type="submit" expand busy={busy} color="orange">{tr("Готово")}</Button>
        </form>
      </Card>
    </main>
  );
}
