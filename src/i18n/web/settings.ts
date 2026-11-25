// Новые строки раздела (ключ — русский, значения — [pl, en]). Строки, которые уже есть в приложении, сюда не нужны.
// Раздел: настройки, подписки, онбординг, импорт.
const d: Record<string, [string, string]> = {
  // онбординг (в приложении заголовок с эмодзи — в вебе эмодзи нет)
  "Привет! Я Оси": ["Cześć! Jestem Osi", "Hi! I'm Osi"],

  // вид
  "Как в браузере": ["Jak w przeglądarce", "Same as browser"],
  "Напоминания приходят в приложении на телефоне.": ["Przypomnienia przychodzą w aplikacji na telefonie.", "Reminders arrive in the phone app."],

  // уведомления
  "Напоминания и пуши приходят в приложении OSIRIS на телефоне — браузер их не показывает. Здесь можно выбрать, о чём Оси пишет сам: настройка общая для всего аккаунта.": [
    "Przypomnienia i powiadomienia push przychodzą w aplikacji OSIRIS na telefonie — przeglądarka ich nie pokazuje. Tutaj wybierzesz, o czym Osi pisze sam: to ustawienie całego konta.",
    "Reminders and push notifications arrive in the OSIRIS app on your phone — the browser doesn't show them. Here you choose what Osi writes about on his own: the setting applies to the whole account.",
  ],

  // импорт
  "Календарь (.ics)": ["Kalendarz (.ics)", "Calendar (.ics)"],

  // аккаунт
  "Документы и связь": ["Dokumenty i kontakt", "Documents and contact"],
  "Условия использования": ["Regulamin", "Terms of Service"],
  "Политика конфиденциальности": ["Polityka prywatności", "Privacy Policy"],
  "Файлы cookie": ["Pliki cookie", "Cookies"],
  "Написать нам": ["Napisz do nas", "Contact us"],
  "Версия": ["Wersja", "Version"],
  "Веб-версия сверена с приложением {0}": ["Wersja webowa zgodna z aplikacją {0}", "Web version matches app {0}"],
  "Удаление": ["Usuwanie", "Deletion"],
  "Удалить аккаунт": ["Usuń konto", "Delete account"],
  "По запросу на почту — вместе со всеми данными": ["Na prośbę wysłaną e-mailem — razem ze wszystkimi danymi", "On request by email — together with all data"],
  "OSIRIS: удалить аккаунт": ["OSIRIS: usunięcie konta", "OSIRIS: delete account"],
  "Прошу удалить мой аккаунт OSIRIS и все его данные. Почта аккаунта: {0}": ["Proszę o usunięcie mojego konta OSIRIS i wszystkich jego danych. E-mail konta: {0}", "Please delete my OSIRIS account and all of its data. Account email: {0}"],
  "Прошу удалить мой аккаунт OSIRIS и все его данные.": ["Proszę o usunięcie mojego konta OSIRIS i wszystkich jego danych.", "Please delete my OSIRIS account and all of its data."],
  "Аккаунт удаляется по запросу: напиши на {0} с почты, на которую он зарегистрирован. Вместе с аккаунтом удаляются все дела, заметки, цели и переписка с Оси — вернуть их будет нельзя.": [
    "Konto usuwamy na prośbę: napisz na {0} z adresu, na który jest zarejestrowane. Razem z kontem znikają wszystkie sprawy, notatki, cele i rozmowy z Osi — nie da się ich przywrócić.",
    "Accounts are deleted on request: write to {0} from the email the account is registered with. All your items, notes, goals and chats with Osi are deleted with it — they can't be restored.",
  ],
  "Написать письмо": ["Napisz e-mail", "Write the email"],
};
export default d;
