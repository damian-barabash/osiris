// Вопрос, который уйдёт Оси сразу при открытии чата (как ChatScreen(initial: …) в приложении).
// Передаётся в памяти, а не через адрес: ссылка вида /chat?q=… не должна отправлять сообщения сама
// (в адресе текст только подставляется в поле ввода).
import { nav } from "../../router";

let queued: string | null = null;

/** Открыть чат и сразу спросить Оси. */
export function askOsi(text: string) {
  queued = text.trim() || null;
  nav("/chat");
}

/** Забрать отложенный вопрос (один раз). */
export function takeQueuedQuestion(): string | null {
  const q = queued;
  queued = null;
  return q;
}
