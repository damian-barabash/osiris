// Листы аккаунта — порт app/lib/screens/account/account_sheets.dart:
// «Забыли пароль?», смена почты, жалоба, выгрузка своих данных, удаление аккаунта, список заблокированных.
import { useEffect, useState } from "react";
import { tr } from "@/i18n";
import { SITE_URL } from "@/config";
import { Button, Field, Osi, Pill, SheetHeader, openSheet, toast } from "@/ui";
import { sb, sendRecoveryEmail } from "../../sb";
import { friends } from "../../data/friends";
import { dateOnly } from "../../data/repeat";
import "./account.css";

/** Куда возвращают ссылки из писем (сброс пароля, смена почты). */
const MAIL_REDIRECT = `${SITE_URL}/app/`;

function authError(e: unknown): string {
  const m = String((e as { message?: string })?.message ?? "").toLowerCase(), c = String((e as { code?: string })?.code ?? "");
  if (m.includes("rate limit") || m.includes("security purposes") || c.startsWith("over_")) return tr("Слишком много писем подряд — попробуй через несколько минут");
  if (c === "email_exists" || (m.includes("already") && m.includes("registered"))) return tr("Эта почта уже занята другим аккаунтом");
  if (!m || m.includes("failed to fetch") || m.includes("network")) return tr("Нет связи с сервером");
  return String((e as { message?: string }).message);
}

interface FieldSheetOpts {
  title: string; sub?: string; note?: string; label: string; initial?: string; action: string; email?: boolean; maxLines?: number; maxLength?: number;
  /** Вернуть текст ошибки или null (тогда лист закроется). */
  onSubmit: (value: string) => Promise<string | null>;
}

/** Лист с одним полем и кнопкой: общий каркас для «Забыли пароль?», смены почты, жалобы. */
function fieldSheet(o: FieldSheetOpts): Promise<void> {
  return openSheet<void>((close) => <FieldSheet o={o} close={() => close()} />);
}

function FieldSheet({ o, close }: { o: FieldSheetOpts; close: () => void }) {
  const [value, setValue] = useState(o.initial ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const go = async () => {
    if (busy) return;
    setBusy(true);
    setErr(null);
    const e = await o.onSubmit(value.trim());
    if (e == null) return close();
    setBusy(false);
    setErr(e);
  };
  return (
    <form className="acc-sheet" onSubmit={(e) => { e.preventDefault(); void go(); }} noValidate>
      <SheetHeader title={o.title} sub={o.sub} close={close} />
      {o.note && <p className="acc-note">{o.note}</p>}
      <Field label={o.label} value={value} onChange={setValue} autoFocus maxLines={o.maxLines} maxLength={o.maxLength} error={err}
        type={o.email ? "email" : "text"} inputMode={o.email ? "email" : undefined} autoComplete={o.email ? "email" : "off"} name={o.email ? "email" : undefined} />
      <Button type="submit" expand color="orange" busy={busy}>{o.action}</Button>
    </form>
  );
}

/** «Забыли пароль?» — письмо со ссылкой; она возвращает в веб-версию, где задаётся новый пароль. */
export const forgotPasswordSheet = (email = "") => fieldSheet({
  title: tr("Забыли пароль?"),
  note: tr("Пришлём письмо со ссылкой. Она откроет myosiris.app, там задашь новый пароль — и войдёшь с ним здесь."),
  label: tr("Почта"), initial: email, email: true, action: tr("Отправить письмо"),
  onSubmit: async (v) => {
    if (!v.includes("@")) return tr("Впиши почту");
    try {
      const err = await sendRecoveryEmail(v.toLowerCase(), MAIL_REDIRECT);
      if (err) return authError({ message: err });
    } catch (e) { return authError(e); }
    toast(tr("Письмо отправлено. Проверь почту (и папку «Спам»)."));
    return null;
  },
});

export const changeEmailSheet = (current: string) => fieldSheet({
  title: tr("Сменить почту"), sub: current || undefined,
  note: tr("На новый адрес придёт письмо со ссылкой. Почта сменится после того, как ты по ней перейдёшь."),
  label: tr("Новая почта"), email: true, action: tr("Отправить письмо"),
  onSubmit: async (v) => {
    if (!v.includes("@")) return tr("Впиши почту");
    if (v.toLowerCase() === current.toLowerCase()) return tr("Это твоя текущая почта");
    try {
      const { error } = await sb.auth.updateUser({ email: v.toLowerCase() }, { emailRedirectTo: MAIL_REDIRECT });
      if (error) return authError(error);
    } catch (e) { return authError(e); }
    toast(tr("Письмо отправлено. Проверь почту (и папку «Спам»)."));
    return null;
  },
});

/** Пожаловаться: на друга (kind = user) или на ответ Оси (kind = osi). Жалоба уходит в админку. */
export const reportSheet = ({ kind, targetUser = null, content, title }: { kind: "user" | "osi"; targetUser?: string | null; content: string; title: string }) => fieldSheet({
  title,
  note: tr("Напиши, что не так. Мы посмотрим жалобу в течение 24 часов."),
  label: tr("Что случилось"), maxLines: 4, maxLength: 2000, action: tr("Отправить жалобу"),
  onSubmit: async (v) => {
    if (v.length < 3) return tr("Опиши в двух словах, что не так");
    try {
      const { data, error } = await sb.rpc("report_submit", { p_kind: kind, p_target: targetUser, p_content: content, p_reason: v });
      if (error) return tr("Нет связи с сервером");
      if (data && typeof data === "object" && (data as { error?: unknown }).error === "limit") return tr("Слишком много жалоб за день — напиши нам на почту");
    } catch { return tr("Нет связи с сервером"); }
    toast(tr("Жалоба отправлена. Спасибо!"));
    return null;
  },
});

/** Выгрузка всех своих данных одним файлом JSON — браузер сохраняет его в «Загрузки». */
export async function exportMyData(): Promise<void> {
  try {
    const { data, error } = await sb.rpc("export_my_data");
    if (error || data == null) throw error ?? new Error("empty");
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `osiris-data-${dateOnly(new Date())}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  } catch {
    toast(tr("Не получилось собрать файл. Проверь интернет и попробуй ещё раз."), "error");
  }
}

/** Удаление аккаунта навсегда. Нужно вписать слово-подтверждение; сервер стирает аккаунт и все данные. */
export async function deleteAccountSheet(email: string): Promise<void> {
  const done = await openSheet<boolean>((close) => <DeleteSheet email={email} close={close} />);
  if (done !== true) return;
  // аккаунта на сервере уже нет: убираем сессию только на этом устройстве — приложение само вернётся на экран входа
  try { await sb.auth.signOut({ scope: "local" }); } catch { /* сессия и так недействительна */ }
  toast(tr("Аккаунт удалён"));
}

function DeleteSheet({ email, close }: { email: string; close: (v?: boolean) => void }) {
  const word = tr("УДАЛИТЬ");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const go = async () => {
    if (busy) return;
    if (text.trim().toUpperCase() !== word) return setErr(tr("Впиши слово «{0}», чтобы подтвердить", [word]));
    setBusy(true);
    setErr(null);
    const fail = tr("Не получилось удалить. Проверь интернет и попробуй ещё раз.");
    try {
      const { data, error } = await sb.functions.invoke("account", { body: { action: "delete", confirm: true } });
      if (error) {
        // ответ функции с кодом ошибки лежит в error.context (Response)
        let code: unknown = null;
        try { code = (await (error as { context?: Response }).context?.json())?.error; } catch { /* не JSON */ }
        setBusy(false);
        return setErr(code === "protected" ? tr("Это демонстрационный аккаунт — его удалить нельзя") : fail);
      }
      if (!data || typeof data !== "object" || (data as { ok?: unknown }).ok !== true) throw new Error("fail");
    } catch {
      setBusy(false);
      return setErr(fail);
    }
    close(true);
  };
  return (
    <form className="acc-sheet" onSubmit={(e) => { e.preventDefault(); void go(); }} noValidate>
      <SheetHeader title={tr("Удалить аккаунт")} sub={email || undefined} close={() => close()} />
      <p className="acc-note strong">{tr("Аккаунт и все данные будут стёрты навсегда: события, задачи, клиенты, часы, цели, настроение, заметки, переписка с Оси и друзья. Вернуть их будет нельзя. Если хочешь сохранить копию — сначала скачай данные (Настройки → Данные).")}</p>
      <Field label={tr("Впиши слово «{0}»", [word])} value={text} onChange={setText} autoComplete="off" maxLength={40} error={err} />
      <Button type="submit" expand danger busy={busy}>{tr("Удалить навсегда")}</Button>
    </form>
  );
}

/** Список заблокированных с кнопкой «Разблокировать». */
export const blockedSheet = () => openSheet<void>((close) => <BlockedSheet close={() => close()} />);

function BlockedSheet({ close }: { close: () => void }) {
  const [rows, setRows] = useState<{ user_id: string; name: string | null }[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const load = async () => { try { setRows(await friends.blocks()); } catch { setRows([]); } };
  useEffect(() => { void load(); }, []);
  const unblock = async (id: string) => {
    if (busy) return;
    setBusy(id);
    try { await friends.unblock(id); } catch { toast(tr("Нет связи с сервером"), "error"); }
    await load();
    setBusy(null);
  };
  return (
    <div className="acc-sheet">
      <SheetHeader title={tr("Заблокированные")} close={close} />
      {rows == null ? <div className="acc-wait"><Osi size={64} mood="thinking" /></div>
        : !rows.length ? <p className="acc-note">{tr("Ты никого не блокировал.")}</p>
        : (
          <ul className="acc-blocked">
            {rows.map((r) => (
              <li key={r.user_id}>
                <b>{r.name?.trim() || tr("Без имени")}</b>
                <Pill dense disabled={busy === r.user_id} onClick={() => void unblock(r.user_id)}>{tr("Разблокировать")}</Pill>
              </li>
            ))}
          </ul>
        )}
    </div>
  );
}
