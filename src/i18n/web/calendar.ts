// Новые строки раздела (ключ — русский, значения — [pl, en]). Строки, которые уже есть в приложении, сюда не нужны.
const d: Record<string, [string, string]> = {
  "Вид календаря": ["Widok kalendarza", "Calendar view"],
  "Двойной клик — весь день": ["Podwójne kliknięcie — cały dzień", "Double-click for the whole day"],
  "Предыдущая неделя": ["Poprzedni tydzień", "Previous week"],
  "Предыдущий месяц": ["Poprzedni miesiąc", "Previous month"],
  "Следующий месяц": ["Następny miesiąc", "Next month"],
  "Предыдущий год": ["Poprzedni rok", "Previous year"],
  "Следующий год": ["Następny rok", "Next year"],
  "Сказать или написать Оси — он разложит сам": ["Powiedz lub napisz do Osi — sam wszystko poukłada", "Tell or write to Osi — he will sort it out"],
};
export default d;
