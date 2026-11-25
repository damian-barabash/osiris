// Новые строки раздела (ключ — русский, значения — [pl, en]). Строки, которые уже есть в приложении, сюда не нужны.
const d: Record<string, [string, string]> = {
  "Добавить по коду": ["Dodaj po kodzie", "Add by code"],
  "Скопировать": ["Kopiuj", "Copy"],
  "Поделиться": ["Udostępnij", "Share"],
  "Не получилось скопировать": ["Nie udało się skopiować", "Couldn't copy"],
  "Мой код друга в OSIRIS: {0}": ["Mój kod znajomego w OSIRIS: {0}", "My friend code in OSIRIS: {0}"],
  // в приложении эти строки с эмодзи — в веб-версии эмодзи нет
  "{0} теперь в друзьях": ["{0} jest teraz w znajomych", "{0} is now your friend"],
  "Это твой собственный код": ["To Twój własny kod", "That's your own code"],
};
export default d;
