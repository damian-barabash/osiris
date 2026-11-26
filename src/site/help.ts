// Страницы помощи: «Поддержка» (/support/) и «Удаление аккаунта» (/delete-account/ — её требует Google Play).
// Устроены как документы (заголовок, вступление, разделы), но без пометки о переводе; внизу — кнопки.
import type { SiteLang } from "./content";
import type { LegalDoc } from "./legal";

export type HelpKey = "support" | "delete-account";
export const HELP_KEYS: HelpKey[] = ["support", "delete-account"];
export interface HelpSet { support: LegalDoc; "delete-account": LegalDoc; openApp: string; write: string; mailSubject: Record<HelpKey, string> }

const en: HelpSet = {
  openApp: "Open the web version", write: "Write to us",
  mailSubject: { support: "OSIRIS: support", "delete-account": "OSIRIS: delete my account" },
  support: {
    title: "OSIRIS Support",
    intro: "Something isn't working, or you have a question about OSIRIS? Write to us — a real person reads every message.",
    sections: [
      { h: "How to contact us", body: [
        "Email: dbdcstudio@gmail.com. Write from the address your account is registered with and describe what happened — the device, the app version (Settings → Account) and a screenshot help a lot.",
        "We usually reply within 2 business days. Reports about other users or about Osi's replies are reviewed within 24 hours.",
      ] },
      { h: "I forgot my password", body: [
        "On the sign-in screen tap “Forgot password?”, enter your email and we will send you a link. The link opens myosiris.app, where you set a new password — it then works both in the app and in the web version.",
        "No email? Check the spam folder, and make sure you are using the address the account was created with. If you signed up with Google or Apple, you can simply sign in that way.",
      ] },
      { h: "How do I delete my account?", body: [
        "In the app or in the web version: Settings → Account → Delete account. Type the confirmation word and the account is erased immediately, together with all of its data. Details: https://myosiris.app/delete-account/",
      ] },
      { h: "How do I download my data?", body: [
        "Settings → Data → Download my data. You get a single JSON file with everything you have entered: events, tasks, clients, projects, payments, hours, goals, notes, mood entries and your chat with Osi.",
      ] },
      { h: "How do I turn off Osi and AI?", body: [
        "Settings → Account → Osi and AI → switch “Osi is on” off. From that moment nothing is sent to the AI provider: chat, quick capture and the daily summary stop, while the calendar, tasks, hours and goals keep working as usual. You can turn Osi back on at any time.",
      ] },
      { h: "How do I report a problem?", body: [
        "An inappropriate or wrong reply from Osi: press and hold the reply in the app, or use the small flag next to the reply in the web version.",
        "Another user: open the friend's page and choose “Report” or “Block”. A blocked person can no longer invite you; the list is in Settings → Account → Blocked.",
        "A bug or anything else: write to dbdcstudio@gmail.com.",
      ] },
    ],
  },
  "delete-account": {
    title: "Delete your OSIRIS account",
    intro: "How to delete your OSIRIS account and all the data connected to it — in the app, in the web version or by email.",
    sections: [
      { h: "Delete it yourself — in the app or in the web version", body: [
        "This is the fastest way and it works the same in the OSIRIS app for iPhone and Android and in the web version at https://myosiris.app/app/",
        [
          "Open OSIRIS and sign in to the account you want to delete.",
          "Go to Settings → Account.",
          "Scroll to the bottom and choose “Delete account”.",
          "Type the confirmation word shown on the screen (DELETE) and press “Delete forever”.",
        ],
        "The account is deleted immediately and you are signed out. Want to keep a copy? Download your data first: Settings → Data → Download my data.",
      ] },
      { h: "Can't sign in? Ask us by email", body: [
        "Write to dbdcstudio@gmail.com from the email address the account is registered with and ask us to delete the account. We will delete it and confirm by email, usually within 2 business days and no later than within 30 days.",
      ] },
      { h: "What is deleted", body: [
        "Everything connected to the account, permanently:",
        [
          "the account itself: email, name, password, profile photo, settings and plan;",
          "events, tasks, clients, projects, payments, work hours, goals, notes and mood entries;",
          "your conversations with Osi and what Osi remembered about you;",
          "friendships, invitations, blocks and push-notification tokens of your devices.",
        ],
      ] },
      { h: "What is kept", body: [
        "Nothing that identifies you. We keep only anonymous aggregated statistics (for example, the number of accounts created per day) and records we are legally required to keep, such as accounting documents for payments.",
        "Backup copies of the database are overwritten automatically within 30 days.",
      ] },
      { h: "Deletion cannot be undone", body: [
        "Deletion is immediate and irreversible: we cannot restore a deleted account or its data. To use OSIRIS again you would need to create a new account.",
      ] },
    ],
  },
};

const pl: HelpSet = {
  openApp: "Otwórz wersję webową", write: "Napisz do nas",
  mailSubject: { support: "OSIRIS: pomoc", "delete-account": "OSIRIS: usunięcie konta" },
  support: {
    title: "Pomoc OSIRIS",
    intro: "Coś nie działa albo masz pytanie o OSIRIS? Napisz do nas — każdą wiadomość czyta człowiek.",
    sections: [
      { h: "Jak się z nami skontaktować", body: [
        "E-mail: dbdcstudio@gmail.com. Napisz z adresu, na który jest zarejestrowane konto, i opisz, co się stało — bardzo pomagają: urządzenie, wersja aplikacji (Ustawienia → Konto) i zrzut ekranu.",
        "Zwykle odpowiadamy w ciągu 2 dni roboczych. Zgłoszenia dotyczące innych użytkowników albo odpowiedzi Osi sprawdzamy w ciągu 24 godzin.",
      ] },
      { h: "Nie pamiętam hasła", body: [
        "Na ekranie logowania wybierz „Nie pamiętasz hasła?”, wpisz e-mail — wyślemy link. Link otworzy myosiris.app, gdzie ustawisz nowe hasło; działa ono potem i w aplikacji, i w wersji webowej.",
        "Nie ma e-maila? Sprawdź folder ze spamem i upewnij się, że podajesz adres, na który założono konto. Jeśli konto powstało przez Google lub Apple, po prostu zaloguj się w ten sposób.",
      ] },
      { h: "Jak usunąć konto?", body: [
        "W aplikacji albo w wersji webowej: Ustawienia → Konto → Usuń konto. Wpisz słowo potwierdzające — konto zostanie usunięte od razu, razem ze wszystkimi danymi. Szczegóły: https://myosiris.app/pl/delete-account/",
      ] },
      { h: "Jak pobrać swoje dane?", body: [
        "Ustawienia → Dane → Pobierz moje dane. Dostaniesz jeden plik JSON ze wszystkim, co masz w OSIRIS: wydarzenia, zadania, klienci, projekty, płatności, godziny, cele, notatki, wpisy nastroju i rozmowy z Osi.",
      ] },
      { h: "Jak wyłączyć Osi i AI?", body: [
        "Ustawienia → Konto → Osi i AI → wyłącz przełącznik „Osi włączony”. Od tej chwili nic nie trafia do dostawcy AI: czat, szybki zapis i podsumowanie dnia przestają działać, a kalendarz, zadania, godziny i cele działają jak zwykle. Osi możesz włączyć ponownie w każdej chwili.",
      ] },
      { h: "Jak zgłosić problem?", body: [
        "Niewłaściwa albo błędna odpowiedź Osi: przytrzymaj odpowiedź w aplikacji albo użyj małej flagi obok odpowiedzi w wersji webowej.",
        "Inny użytkownik: otwórz stronę znajomego i wybierz „Zgłoś” albo „Zablokuj”. Zablokowana osoba nie może cię już zaprosić; listę znajdziesz w Ustawienia → Konto → Zablokowani.",
        "Błąd w działaniu albo cokolwiek innego: napisz na dbdcstudio@gmail.com.",
      ] },
    ],
  },
  "delete-account": {
    title: "Usunięcie konta OSIRIS",
    intro: "Jak usunąć konto OSIRIS i wszystkie powiązane z nim dane — w aplikacji, w wersji webowej albo e-mailem.",
    sections: [
      { h: "Usuń samodzielnie — w aplikacji albo w wersji webowej", body: [
        "To najszybszy sposób; działa tak samo w aplikacji OSIRIS na iPhone'a i Androida oraz w wersji webowej pod adresem https://myosiris.app/app/",
        [
          "Otwórz OSIRIS i zaloguj się na konto, które chcesz usunąć.",
          "Przejdź do Ustawienia → Konto.",
          "Przewiń na dół i wybierz „Usuń konto”.",
          "Wpisz słowo potwierdzające widoczne na ekranie (USUŃ) i naciśnij „Usuń na zawsze”.",
        ],
        "Konto zostaje usunięte od razu, a ty zostajesz wylogowany. Chcesz zachować kopię? Najpierw pobierz dane: Ustawienia → Dane → Pobierz moje dane.",
      ] },
      { h: "Nie możesz się zalogować? Napisz do nas", body: [
        "Napisz na dbdcstudio@gmail.com z adresu e-mail, na który jest zarejestrowane konto, z prośbą o jego usunięcie. Usuniemy konto i potwierdzimy to e-mailem — zwykle w ciągu 2 dni roboczych, nie później niż w ciągu 30 dni.",
      ] },
      { h: "Co jest usuwane", body: [
        "Wszystko, co jest powiązane z kontem — trwale:",
        [
          "samo konto: e-mail, imię, hasło, zdjęcie profilowe, ustawienia i plan;",
          "wydarzenia, zadania, klienci, projekty, płatności, godziny pracy, cele, notatki i wpisy nastroju;",
          "rozmowy z Osi oraz to, co Osi o tobie zapamiętał;",
          "znajomości, zaproszenia, blokady i tokeny powiadomień push twoich urządzeń.",
        ],
      ] },
      { h: "Co zostaje", body: [
        "Nic, co pozwala cię zidentyfikować. Zostają wyłącznie anonimowe, zbiorcze statystyki (np. liczba kont założonych danego dnia) oraz zapisy, które musimy przechowywać na podstawie przepisów prawa — na przykład dokumenty księgowe dotyczące płatności.",
        "Kopie zapasowe bazy danych są automatycznie nadpisywane w ciągu 30 dni.",
      ] },
      { h: "Usunięcia nie da się cofnąć", body: [
        "Usunięcie jest natychmiastowe i nieodwracalne: nie możemy przywrócić usuniętego konta ani jego danych. Żeby znów korzystać z OSIRIS, trzeba założyć nowe konto.",
      ] },
    ],
  },
};

const ru: HelpSet = {
  openApp: "Открыть веб-версию", write: "Написать нам",
  mailSubject: { support: "OSIRIS: поддержка", "delete-account": "OSIRIS: удалить аккаунт" },
  support: {
    title: "Поддержка OSIRIS",
    intro: "Что-то не работает или есть вопрос про OSIRIS? Напиши нам — каждое письмо читает человек.",
    sections: [
      { h: "Как с нами связаться", body: [
        "Почта: dbdcstudio@gmail.com. Пиши с адреса, на который зарегистрирован аккаунт, и расскажи, что случилось — очень помогают устройство, версия приложения (Настройки → Аккаунт) и снимок экрана.",
        "Обычно отвечаем в течение 2 рабочих дней. Жалобы на других пользователей и на ответы Оси смотрим в течение 24 часов.",
      ] },
      { h: "Я забыл пароль", body: [
        "На экране входа нажми «Забыли пароль?», впиши почту — пришлём письмо со ссылкой. Она откроет myosiris.app, там задашь новый пароль; он подойдёт и в приложении, и в веб-версии.",
        "Письма нет? Проверь папку «Спам» и убедись, что указываешь почту, на которую создавался аккаунт. Если аккаунт создан через Google или Apple — просто войди этим способом.",
      ] },
      { h: "Как удалить аккаунт?", body: [
        "В приложении или в веб-версии: Настройки → Аккаунт → Удалить аккаунт. Впиши слово-подтверждение — аккаунт сотрётся сразу, вместе со всеми данными. Подробнее: https://myosiris.app/ru/delete-account/",
      ] },
      { h: "Как скачать свои данные?", body: [
        "Настройки → Данные → Скачать мои данные. Получишь один файл JSON со всем, что есть в OSIRIS: события, задачи, клиенты, проекты, оплаты, часы, цели, заметки, отметки настроения и переписка с Оси.",
      ] },
      { h: "Как выключить Оси и ИИ?", body: [
        "Настройки → Аккаунт → Оси и ИИ → выключи переключатель «Оси включён». С этого момента поставщику ИИ ничего не передаётся: чат, быстрая запись и сводка дня перестают работать, а календарь, задачи, часы и цели работают как обычно. Включить Оси обратно можно в любой момент.",
      ] },
      { h: "Как сообщить о проблеме?", body: [
        "Неуместный или ошибочный ответ Оси: в приложении нажми на ответ и удерживай, в веб-версии — маленький флажок рядом с ответом.",
        "Другой пользователь: открой страницу друга и выбери «Пожаловаться» или «Заблокировать». Заблокированный человек больше не сможет тебя пригласить; список — в Настройки → Аккаунт → Заблокированные.",
        "Ошибка в работе или что угодно ещё: напиши на dbdcstudio@gmail.com.",
      ] },
    ],
  },
  "delete-account": {
    title: "Удаление аккаунта OSIRIS",
    intro: "Как удалить аккаунт OSIRIS и все связанные с ним данные — в приложении, в веб-версии или по почте.",
    sections: [
      { h: "Удалить самому — в приложении или в веб-версии", body: [
        "Это самый быстрый способ; он одинаково работает в приложении OSIRIS для iPhone и Android и в веб-версии по адресу https://myosiris.app/app/",
        [
          "Открой OSIRIS и войди в аккаунт, который хочешь удалить.",
          "Перейди в Настройки → Аккаунт.",
          "Прокрути вниз и выбери «Удалить аккаунт».",
          "Впиши слово-подтверждение с экрана (УДАЛИТЬ) и нажми «Удалить навсегда».",
        ],
        "Аккаунт удаляется сразу, и ты выходишь из него. Хочешь сохранить копию? Сначала скачай данные: Настройки → Данные → Скачать мои данные.",
      ] },
      { h: "Не получается войти? Напиши нам", body: [
        "Напиши на dbdcstudio@gmail.com с почты, на которую зарегистрирован аккаунт, и попроси его удалить. Мы удалим аккаунт и подтвердим это письмом — обычно в течение 2 рабочих дней и не позднее чем через 30 дней.",
      ] },
      { h: "Что удаляется", body: [
        "Всё, что связано с аккаунтом, — безвозвратно:",
        [
          "сам аккаунт: почта, имя, пароль, фото профиля, настройки и тариф;",
          "события, задачи, клиенты, проекты, оплаты, рабочие часы, цели, заметки и отметки настроения;",
          "переписка с Оси и то, что Оси о тебе запомнил;",
          "дружбы, приглашения, блокировки и токены пуш-уведомлений твоих устройств.",
        ],
      ] },
      { h: "Что остаётся", body: [
        "Ничего, что позволяет тебя опознать. Остаются только анонимная сводная статистика (например, число аккаунтов, созданных за день) и записи, которые мы обязаны хранить по закону, — например, бухгалтерские документы об оплатах.",
        "Резервные копии базы данных автоматически перезаписываются в течение 30 дней.",
      ] },
      { h: "Удаление нельзя отменить", body: [
        "Удаление происходит сразу и необратимо: восстановить удалённый аккаунт и его данные мы не можем. Чтобы снова пользоваться OSIRIS, нужно будет создать новый аккаунт.",
      ] },
    ],
  },
};

export const HELP: Record<SiteLang, HelpSet> = { en, pl, ru };
