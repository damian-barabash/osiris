// Новые строки раздела (ключ — русский, значения — [pl, en]). Строки, которые уже есть в приложении, сюда не нужны.
const d: Record<string, [string, string]> = {
  "Сообщения Оси на сегодня закончились. Завтра продолжим.": ["Wiadomości do Osi na dziś się skończyły. Jutro wracamy.", "You're out of Osi messages for today. We'll continue tomorrow."],
  "Посмотреть подписки": ["Zobacz subskrypcje", "See plans"],
  "Очистить чат": ["Wyczyść czat", "Clear chat"],
  "Показать раньше": ["Pokaż wcześniejsze", "Show earlier"],
  "К новым сообщениям": ["Do najnowszych wiadomości", "Jump to latest"],
  "Спроси, например": ["Zapytaj na przykład", "Try asking"],
  "Голосовой ввод": ["Wprowadzanie głosowe", "Voice input"],
  "Остановить запись": ["Zatrzymaj nagrywanie", "Stop recording"],
  "Отправить": ["Wyślij", "Send"],
  "Enter — отправить, Shift + Enter — новая строка": ["Enter — wyślij, Shift + Enter — nowa linia", "Enter to send, Shift + Enter for a new line"],
  "Отвечаю…": ["Odpowiadam…", "Replying…"],
  "Что-то пошло не так": ["Coś poszło nie tak", "Something went wrong"],
  "Убрать из предложения": ["Usuń z propozycji", "Remove from the proposal"],
};
export default d;
