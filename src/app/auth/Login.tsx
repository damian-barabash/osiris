// Вход и регистрация — как экран входа приложения (app/lib/screens/login_screen.dart): почта + пароль, Google.
import { useState } from "react";
import { tr } from "@/i18n";
import { APPLE_WEB, GOOGLE_WEB } from "@/config";
import { Button, Card, Cutout, Field, Logo, Osi, Pill, toast } from "@/ui";
import { sb } from "../sb";
import { forgotPasswordSheet } from "../screens/account/sheets";

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
  const [busy, setBusy] = useState<"" | "form" | "google" | "apple">("");
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

  // включается флагом APPLE_WEB, когда у Apple создан Services ID
  const apple = async () => {
    setErr(null);
    setBusy("apple");
    const { error } = await sb.auth.signInWithOAuth({ provider: "apple", options: { redirectTo: appUrl() } });
    if (error) { setBusy(""); setErr(authError(error)); }
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
        {!signup && <button type="button" className="auth-link" onClick={() => void forgotPasswordSheet(email.trim())}>{tr("Забыли пароль?")}</button>}
        {(GOOGLE_WEB || APPLE_WEB) && (
          <>
            <div className="auth-or"><span>{tr("или")}</span></div>
            <div className="auth-social">
              {APPLE_WEB && (
                <Button ghost expand busy={busy === "apple"} disabled={!!busy} onClick={apple}>
                  <svg className="apple-mark" aria-hidden viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M16.37 12.6c-.03-2.6 2.12-3.85 2.22-3.91-1.21-1.77-3.09-2.01-3.76-2.04-1.6-.16-3.12.94-3.93.94-.81 0-2.06-.92-3.39-.89-1.74.03-3.35 1.01-4.25 2.57-1.81 3.14-.46 7.79 1.3 10.34.86 1.25 1.89 2.65 3.24 2.6 1.3-.05 1.79-.84 3.36-.84 1.57 0 2.01.84 3.39.81 1.4-.03 2.29-1.27 3.14-2.53.99-1.45 1.4-2.85 1.42-2.92-.03-.01-2.72-1.04-2.74-4.13zM13.8 4.96c.71-.87 1.2-2.07 1.06-3.27-1.03.04-2.27.69-3.01 1.55-.66.76-1.24 1.99-1.08 3.16 1.15.09 2.32-.58 3.03-1.44z" /></svg>
                  {tr("Продолжить с Apple")}
                </Button>
              )}
              {GOOGLE_WEB && (
                <Button ghost expand busy={busy === "google"} disabled={!!busy} onClick={google}>
                  <span className="g-mark" aria-hidden>G</span> {tr("Продолжить с Google")}
                </Button>
              )}
            </div>
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
