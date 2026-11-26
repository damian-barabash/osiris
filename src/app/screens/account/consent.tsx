// Согласие на передачу данных поставщику ИИ — порт app/lib/screens/account/consent.dart.
// Без него Оси не вызывается вообще (чат, быстрая запись, сводка дня): проверка стоит и в data/assistant.ts.
import { L, tr } from "@/i18n";
import { Button, Osi, openSheet } from "@/ui";
import { store } from "../../data/store";
import "./account.css";

const lsGet = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* приватный режим */ } };

/** Адрес страницы сайта на языке интерфейса: /pl/…, /ru/…, английская — без префикса. */
export const sitePage = (p: string) => `/${{ ru: "ru/", pl: "pl/", en: "" }[L.lang]}${p}/`;

export const AiConsent = {
  get granted(): boolean { return store.profile?.raw.ai_consent_at != null; },
  /** Профиль без этого поля (ещё не загружен или старая схема) — не блокируем до загрузки с сервера. */
  get known(): boolean { const raw = store.profile?.raw; return !!raw && "ai_consent_at" in raw; },
  /** Оси нельзя вызывать: согласия нет (и это известно точно). */
  get blocked(): boolean { return AiConsent.known && !AiConsent.granted; },

  revoke: (): Promise<void> => store.updateProfile({ ai_consent_at: null }),

  /** Один раз после входа предложить самим; дальше спрашиваем только когда человек обращается к Оси. */
  async offerOnce(): Promise<boolean> {
    if (!AiConsent.blocked) return false;
    const key = `ai_consent_offered_${store.userId}`;
    if (lsGet(key) === "1") return false;
    lsSet(key, "1");
    await AiConsent.ensure();
    return true;
  },

  /** true — согласие есть (или только что дано). */
  async ensure(): Promise<boolean> {
    if (!AiConsent.blocked) return true;
    const ok = await openSheet<boolean>((close) => <ConsentSheet close={close} />);
    if (ok !== true) return false;
    await store.updateProfile({ ai_consent_at: new Date().toISOString() });
    return AiConsent.granted; // запись могла откатиться (нет сети) — тогда согласия по-прежнему нет
  },
};

function ConsentSheet({ close }: { close: (v?: boolean) => void }) {
  return (
    <div className="acc-consent">
      <Osi size={96} mood="calm" />
      <h2>{tr("Оси работает на ИИ")}</h2>
      <p>{tr("Чтобы Оси отвечал, раскладывал твои записи и писал сводку дня, твои сообщения и данные планера (события, задачи, клиенты, часы, цели, настроение, заметки) отправляются на наш сервер и поставщику ИИ — компании Anthropic (модель Claude).")}</p>
      <p>{tr("Мы не продаём эти данные и не используем их для рекламы. По условиям Anthropic данные, переданные через API, не используются для обучения моделей.")}</p>
      <p className="small">{tr("Без согласия календарь, задачи, часы и цели работают как обычно — просто без Оси. Согласие можно отозвать в настройках: Аккаунт → Оси и ИИ.")}</p>
      <a href={sitePage("privacy")} target="_blank" rel="noopener">{tr("Политика конфиденциальности")}</a>
      <div className="acc-consent-btns">
        <Button expand color="orange" onClick={() => close(true)}>{tr("Согласен, включить Оси")}</Button>
        <Button expand ghost onClick={() => close(false)}>{tr("Не сейчас")}</Button>
      </div>
    </div>
  );
}
