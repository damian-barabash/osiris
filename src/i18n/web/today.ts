// Новые строки раздела (ключ — русский, значения — [pl, en]). Строки, которые уже есть в приложении, сюда не нужны.
const d: Record<string, [string, string]> = {
  // главная
  "Никто": ["Nikt", "Nobody"],
  "Начать смену — на вкладке «Часы»": ["Rozpocznij zmianę — w zakładce „Godziny”", "Start a shift — on the “Hours” tab"],
  "Статистика": ["Statystyki", "Stats"],
  "Обновить сводку": ["Odśwież podsumowanie", "Refresh the brief"],
  "Встреча, звонок, поездка": ["Spotkanie, telefon, wyjazd", "A meeting, a call, a trip"],
  "Дело со сроком": ["Sprawa z terminem", "Something with a due date"],
  "Мысль, идея, список": ["Myśl, pomysł, lista", "A thought, an idea, a list"],
  "Скажи Оси — он разложит сам": ["Powiedz Osi — sam to poukłada", "Tell Osi — he will sort it out"],
  "Все заметки": ["Wszystkie notatki", "All notes"],
  // заметки
  "Новая заметка": ["Nowa notatka", "New note"],
  "Ничего не найдено": ["Nic nie znaleziono", "Nothing found"],
  "Попробуй другое слово или сними фильтр.": ["Spróbuj innego słowa albo zdejmij filtr.", "Try another word or clear the filter."],
  "Открепить": ["Odepnij", "Unpin"],
  // «Ты это сделал?»
  "Перенести": ["Przełóż", "Move"],
};
export default d;
