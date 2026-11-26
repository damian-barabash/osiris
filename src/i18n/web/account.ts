// Новые строки раздела (ключ — русский, значения — [pl, en]). Строки, которые уже есть в приложении, сюда не нужны.
// Раздел: вход и аккаунт. Согласие на ИИ, обучение и листы аккаунта целиком берут строки приложения.
const d: Record<string, [string, string]> = {
  // экран входа и каркас: у этих строк не было перевода (показывались по-русски на pl/en)
  "С возвращением": ["Witaj ponownie", "Welcome back"],
  "Зарегистрироваться": ["Zarejestruj się", "Sign up"],
  "Такая почта уже зарегистрирована — войди": ["Ten e-mail jest już zarejestrowany — zaloguj się", "This email is already registered — log in"],
  "Слишком много попыток. Подожди минуту.": ["Za dużo prób. Poczekaj minutę.", "Too many attempts. Wait a minute."],
  "Проверь адрес почты": ["Sprawdź adres e-mail", "Check the email address"],
  "Скажи или напиши — Оси разложит": ["Powiedz albo napisz — Osi to poukłada", "Say it or type it — Osi sorts it out"],
  "Ссылка из письма устарела. Запроси письмо ещё раз.": ["Link z e-maila wygasł. Poproś o nowy e-mail.", "The link from the email has expired. Request a new email."],
};
export default d;
