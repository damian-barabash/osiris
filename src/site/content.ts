// Тексты лендинга на трёх языках. Позиционирование: планер для всех занятых людей (не «для фрилансеров»).
export type SiteLang = "en" | "pl" | "ru";
export const SITE_LANGS: SiteLang[] = ["en", "pl", "ru"];
export const LANG_NAME: Record<SiteLang, string> = { en: "English", pl: "Polski", ru: "Русский" };
/** Префикс адреса: английский — корень сайта. */
export const prefix = (l: SiteLang) => (l === "en" ? "" : `/${l}`);

export interface Content {
  meta: { title: string; description: string; ogAlt: string };
  nav: { osi: string; views: string; hours: string; report: string; pricing: string; faq: string; login: string; signup: string; menu: string; lang: string };
  hero: { kicker: string; title: string[]; lead: string; cta: string; cta2: string; note: string; bubble: string };
  ticker: string[];
  osi: { label: string; title: string; lead: string; points: [string, string][]; demo: { user: string; reply: string; cards: [string, string][]; apply: string; applied: string }[]; hint: string };
  views: { label: string; title: string; lead: string; tabs: [string, string][]; work: string; personal: string; points: string[] };
  work: { label: string; title: string; lead: string; hours: { title: string; text: string; points: string[]; running: string; stop: string; earned: string; forecast: string; job: string }; clients: { title: string; text: string; points: string[]; owe: string; paid: string; due: string } };
  report: { label: string; title: string; lead: string; steps: [string, string][]; cta: string; doc: { head: string; period: string; worker: string; forWhom: string; hours: string; days: string; tasks: string; total: string; schedule: string; sign1: string; sign2: string; made: string } };
  extras: { label: string; title: string; items: [string, string, string][] };
  pricing: { label: string; title: string; lead: string; perMonth: string; perDay: string; test: string; plans: { name: string; price: string; osi: string; tagline: string; points: string[]; cta: string }[]; popular: string };
  stores: { label: string; title: string; lead: string; soon: string; ios: string; android: string; web: string; webCta: string; form: { placeholder: string; button: string; ok: string; bad: string; fail: string; consent: string } };
  faq: { label: string; title: string; items: [string, string][] };
  final: { title: string; lead: string; cta: string };
  footer: { tagline: string; product: string; legal: string; contact: string; terms: string; privacy: string; cookies: string; cookieSettings: string; madeBy: string; operator: string; rights: string; webApp: string };
  chat: { open: string; title: string; sub: string; hello: string; placeholder: string; send: string; left: (n: number) => string; typing: string; suggestions: string[]; error: string; busy: string; rate: string; close: string; disclaimer: string;
    wall: { title: string; text: string; signup: string; plans: string; login: string; later: string } };
  cookie: { title: string; text: string; accept: string; necessary: string; settings: string; save: string; more: string; cats: { necessary: [string, string]; analytics: [string, string] }; always: string };
  notFound: { title: string; text: string; home: string };
  skip: string;
}

const en: Content = {
  meta: {
    title: "OSIRIS — a planner with an AI assistant for busy people",
    description: "Calendar, tasks, clients, work hours and PDF reports in one place. Tell Osi what's on your mind — he turns it into plans. Web version available now; iPhone and Android apps coming soon.",
    ogAlt: "OSIRIS — planner with Osi, the AI assistant",
  },
  nav: { osi: "Osi", views: "Calendar", hours: "Hours & clients", report: "PDF reports", pricing: "Pricing", faq: "FAQ", login: "Log in", signup: "Sign up", menu: "Menu", lang: "Language" },
  hero: {
    kicker: "Planner with an AI assistant",
    title: ["For busy people", "with 47 tabs open", "in their head"],
    lead: "Say it the way you'd say it to a friend. Osi puts meetings in your calendar, tracks who owes you what, counts your hours and sends a tidy report to your employer.",
    cta: "Start for free",
    cta2: "Ask Osi a question",
    note: "Free plan, no card needed. Works in your browser right now.",
    bubble: "Hi! I'm Osi. Tell me your plans — I'll sort them out.",
  },
  ticker: ["Calendar", "Tasks", "Clients", "Payments", "Work hours", "PDF reports", "Goals", "Mood", "Notes", "Friends", "Widgets", "Siri"],
  osi: {
    label: "Meet Osi",
    title: "You talk. Osi plans.",
    lead: "Osi is the assistant who lives in OSIRIS and knows your calendar, your clients and your deadlines. Write or dictate in plain words — he does the rest.",
    points: [
      ["Understands plain language", "“Dentist on Friday at 3, remind me an hour before” becomes an event with a reminder."],
      ["Nothing changes without you", "Osi shows what he's about to do as cards. It's saved only after you tap Apply."],
      ["Plans around your life", "Finds free slots without overlaps, moves things, remembers your arrangements."],
      ["Speaks your language", "Russian, Polish or English — he answers in the language you write in."],
    ],
    demo: [
      { user: "Meeting with Anna on Friday at 3pm, remind me an hour before", reply: "Here's what I'd add:", cards: [["Meeting with Anna", "Friday · 15:00 · reminder 1 h before"]], apply: "Apply", applied: "Done — it's in your calendar" },
      { user: "Marina paid 500 euro for the branding project", reply: "Got it. Recording the payment:", cards: [["Payment 500 €", "Branding · Marina · today"], ["Still owed", "1 200 € of 1 700 €"]], apply: "Apply", applied: "Saved — balance updated" },
      { user: "Plan the gym twice a week where I'm free", reply: "You're free on Tuesday and Thursday evenings:", cards: [["Gym", "Tuesday · 19:00–20:30"], ["Gym", "Thursday · 19:00–20:30"]], apply: "Apply", applied: "Planned without overlaps" },
    ],
    hint: "Try it yourself — Osi sits in the corner of this page.",
  },
  views: {
    label: "Calendar",
    title: "One calendar, four ways to look at it",
    lead: "A week at a glance, a plain list, the whole month, or a year of colour. Work and personal plans live side by side — and never get mixed up.",
    tabs: [["week", "Week"], ["list", "List"], ["month", "Month"], ["year", "Year"]],
    work: "Work",
    personal: "Personal",
    points: ["Overlaps are flagged before they hurt", "Repeating events: every Monday, every 2 weeks, on the 10th", "Copy an event to any days in two taps", "Yesterday, today and tomorrow one swipe apart"],
  },
  work: {
    label: "Hours & clients",
    title: "Know exactly what you've earned",
    lead: "Whether you're paid by the hour or by the project, OSIRIS keeps count so you don't have to.",
    hours: {
      title: "Hours tracker",
      text: "Start a shift with one tap. OSIRIS counts the time, subtracts breaks and multiplies by your rate.",
      points: ["Several jobs, each with its own rate", "Extra tasks at a fixed price", "Forecast to the end of the month"],
      running: "Shift in progress", stop: "Stop", earned: "Earned this month", forecast: "by the end of the month", job: "Warehouse · 32 zł/h",
    },
    clients: {
      title: "Clients and projects",
      text: "Every client, every project, every payment. See at a glance who has paid and who is taking their time.",
      points: ["Budgets and deadlines per project", "Payments in any currency — never mixed", "A gentle nudge when someone goes quiet"],
      owe: "You are owed", paid: "paid", due: "left",
    },
  },
  report: {
    label: "PDF reports",
    title: "A report your employer will actually read",
    lead: "One tap turns your month into a clean black-and-white PDF: the schedule, the hours, the extra tasks and the total. Send it, save it or print it.",
    steps: [["Pick the period", "This month, last month or your own dates."], ["Choose what to show", "With amounts or hours only, with room for signatures."], ["Send it", "By email or messenger, straight from OSIRIS."]],
    cta: "Make my first report",
    doc: { head: "WORK REPORT", period: "November 2026", worker: "Worker", forWhom: "For", hours: "Hours", days: "Days", tasks: "Tasks", total: "To be paid", schedule: "Work schedule", sign1: "Worker", sign2: "Employer", made: "Made in OSIRIS" },
  },
  extras: {
    label: "And also",
    title: "Small things that make a big difference",
    items: [
      ["widgets", "Widgets", "Today's plan and Osi's note on your home and lock screen."],
      ["siri", "Siri & Action Button", "“Tell Osi” — record a thought without opening the app."],
      ["friends", "Friends & shared events", "Add a friend by code, see each other's plans, invite to events."],
      ["goals", "Goals", "Savings with a forecast, court dates you can't miss, habits with streaks."],
      ["mood", "Mood", "A ten-second check-in and honest stats on what lifts you up."],
      ["import", "Import", "Bring your plans from Structured, .ics calendars or JSON."],
    ],
  },
  pricing: {
    label: "Pricing",
    title: "Start free. Upgrade when Osi becomes a habit.",
    lead: "The calendar, tasks and reminders work on every plan. Plans differ in how much you can talk to Osi.",
    perMonth: "/ month", perDay: "messages to Osi a day", test: "Payments are in test mode for now — plans are switched on without a charge.", popular: "Most chosen",
    plans: [
      { name: "Free", price: "0 zł", osi: "1", tagline: "To look around", points: ["1 project and 1 job", "3 notes, 2 goals", "Calendar and tasks without limits"], cta: "Start for free" },
      { name: "Little Joys", price: "9.99 zł", osi: "20", tagline: "For every day", points: ["Everything without limits", "All icons and colours", "Hours, reports, friends"], cta: "Choose Little Joys" },
      { name: "Smarty", price: "29.99 zł", osi: "100", tagline: "When Osi is your right hand", points: ["Everything in Little Joys", "The most room for Osi", "Vote on new features (soon)"], cta: "Choose Smarty" },
    ],
  },
  stores: {
    label: "Apps",
    title: "Soon in the App Store and Google Play",
    lead: "The iPhone app is in its final polish and the Android version is on its way. Leave your email and we'll write once — on launch day.",
    soon: "Coming soon", ios: "App Store", android: "Google Play", web: "Web version", webCta: "Open now",
    form: { placeholder: "your@email.com", button: "Notify me", ok: "Thanks! We'll write on launch day.", bad: "Please check the email address.", fail: "Couldn't save it. Please try again in a minute.", consent: "We'll use your email only for this one message." },
  },
  faq: {
    label: "FAQ",
    title: "Questions people ask before they start",
    items: [
      ["What exactly can Osi do?", "Osi turns plain words into events, tasks, payments, goals and work shifts. He can also move, change and delete things, find free time and remember your arrangements. He always shows the result as cards first — nothing is saved until you tap Apply."],
      ["Is my data safe?", "Your data is stored in the European Union and only you can see it — access is enforced at the database level. We don't sell data and don't show ads. Osi's answers are generated by Anthropic's Claude; your data isn't used to train models."],
      ["Does it work on a laptop?", "Yes. The web version at myosiris.app works in any modern browser on laptops, tablets and phones, with the same account and the same data as the app."],
      ["When will the apps be in the stores?", "Soon. The iPhone app is being polished and the Android version is next. Leave your email above and we'll tell you on launch day."],
      ["How much does it cost?", "There is a free plan with one message to Osi a day. Little Joys is 9.99 zł a month with 20 messages a day, Smarty is 29.99 zł a month with 100. Payments are currently in test mode."],
      ["Can I send my hours to my employer?", "Yes. In the Hours tab tap Report, choose the period and what to show, and OSIRIS makes a PDF with your schedule, hours, extra tasks and the total. You can send it, save it or print it."],
      ["Which languages are supported?", "English, Polish and Russian. Osi answers in the language you write to him."],
      ["Can I move my plans from another app?", "Yes. OSIRIS imports the Structured export file, .ics calendars and JSON files, without creating duplicates."],
    ],
  },
  final: { title: "Close a few tabs in your head", lead: "Create an account in a minute and tell Osi about your week.", cta: "Start for free" },
  footer: {
    tagline: "A planner with an AI assistant for busy people.", product: "Product", legal: "Legal", contact: "Contact", terms: "Terms of Service", privacy: "Privacy Policy", cookies: "Cookie Policy", cookieSettings: "Cookie settings",
    madeBy: "Designed and built by", operator: "Service operator and data controller", rights: "All rights reserved.", webApp: "Web version",
  },
  chat: {
    open: "Ask Osi", title: "Osi", sub: "Ask me about OSIRIS", hello: "Hi! I'm Osi. Ask me anything about OSIRIS — what it can do, what it costs, where it works.", placeholder: "Your question…", send: "Send",
    left: (n) => (n === 1 ? "1 question left" : `${n} questions left`), typing: "Osi is thinking", suggestions: ["What can Osi do?", "How do PDF reports work?", "How much does it cost?"],
    error: "I couldn't answer just now. Please try again.", busy: "Too many questions for me today. Sign up and ask me inside OSIRIS.", rate: "One moment — I'm still catching my breath.", close: "Close chat",
    disclaimer: "Osi is an AI and can make mistakes. Don't share personal data here.",
    wall: { title: "That was your second question", text: "To keep talking to Osi, create a free account — and with a plan you get up to 100 messages a day, right inside your calendar.", signup: "Create a free account", plans: "See the plans", login: "I already have an account", later: "Maybe later" },
  },
  cookie: {
    title: "A few cookies, no surprises",
    text: "We use the storage needed for the site to work and, with your consent, anonymous statistics that help us improve OSIRIS. No ads, no trackers.",
    accept: "Accept all", necessary: "Only necessary", settings: "Settings", save: "Save choice", more: "Cookie Policy", always: "Always on",
    cats: { necessary: ["Necessary", "Login session, language, theme and your cookie choice. The site can't work without them."], analytics: ["Anonymous statistics", "Page views without cookies and without profiles: which pages are visited and from where."] },
  },
  notFound: { title: "This page got lost between the tabs", text: "Let's go back to where the plans are.", home: "Back to the home page" },
  skip: "Skip to content",
};

const pl: Content = {
  meta: {
    title: "OSIRIS — planer z asystentem AI dla zabieganych",
    description: "Kalendarz, zadania, klienci, godziny pracy i raporty PDF w jednym miejscu. Powiedz Osi, co masz w głowie — zamieni to w plan. Wersja webowa działa już teraz; aplikacje na iPhone'a i Androida wkrótce.",
    ogAlt: "OSIRIS — planer z Osi, asystentem AI",
  },
  nav: { osi: "Osi", views: "Kalendarz", hours: "Godziny i klienci", report: "Raporty PDF", pricing: "Cennik", faq: "FAQ", login: "Zaloguj się", signup: "Załóż konto", menu: "Menu", lang: "Język" },
  hero: {
    kicker: "Planer z asystentem AI",
    title: ["Planer dla tych,", "którzy mają w głowie", "47 otwartych kart"],
    lead: "Mów tak, jak do znajomego. Osi wpisze spotkania do kalendarza, przypilnuje, kto ile ci wisi, policzy godziny i wyśle pracodawcy porządny raport.",
    cta: "Zacznij za darmo",
    cta2: "Zapytaj Osi",
    note: "Plan darmowy, bez karty. Działa w przeglądarce już teraz.",
    bubble: "Cześć! Jestem Osi. Opowiedz mi o planach — poukładam je.",
  },
  ticker: ["Kalendarz", "Zadania", "Klienci", "Wpłaty", "Godziny pracy", "Raporty PDF", "Cele", "Nastrój", "Notatki", "Znajomi", "Widżety", "Siri"],
  osi: {
    label: "Poznaj Osi",
    title: "Ty mówisz. Osi planuje.",
    lead: "Osi to asystent, który mieszka w OSIRIS i zna twój kalendarz, klientów i terminy. Napisz albo podyktuj zwykłymi słowami — resztę zrobi sam.",
    points: [
      ["Rozumie zwykły język", "„Dentysta w piątek o 15, przypomnij godzinę wcześniej” zamienia się w wydarzenie z przypomnieniem."],
      ["Nic się nie zmienia bez ciebie", "Osi pokazuje na kartach, co chce zrobić. Zapisuje dopiero, gdy stukniesz „Zastosuj”."],
      ["Planuje wokół twojego życia", "Znajduje wolne okna bez kolizji, przesuwa rzeczy, pamięta ustalenia."],
      ["Mówi w twoim języku", "Po polsku, rosyjsku albo angielsku — odpowiada w języku, w którym piszesz."],
    ],
    demo: [
      { user: "Spotkanie z Anią w piątek o 15, przypomnij godzinę wcześniej", reply: "Proponuję dodać:", cards: [["Spotkanie z Anią", "Piątek · 15:00 · przypomnienie 1 h wcześniej"]], apply: "Zastosuj", applied: "Gotowe — jest w kalendarzu" },
      { user: "Marina zapłaciła 500 euro za projekt brandingu", reply: "Jasne. Zapisuję wpłatę:", cards: [["Wpłata 500 €", "Branding · Marina · dziś"], ["Zostało do zapłaty", "1 200 € z 1 700 €"]], apply: "Zastosuj", applied: "Zapisane — saldo zaktualizowane" },
      { user: "Zaplanuj siłownię dwa razy w tygodniu tam, gdzie mam wolne", reply: "Masz wolne we wtorki i czwartki wieczorem:", cards: [["Siłownia", "Wtorek · 19:00–20:30"], ["Siłownia", "Czwartek · 19:00–20:30"]], apply: "Zastosuj", applied: "Zaplanowane bez kolizji" },
    ],
    hint: "Sprawdź samodzielnie — Osi siedzi w rogu tej strony.",
  },
  views: {
    label: "Kalendarz",
    title: "Jeden kalendarz, cztery sposoby patrzenia",
    lead: "Tydzień na jednym ekranie, zwykła lista, cały miesiąc albo rok w kolorach. Praca i sprawy prywatne obok siebie — i nigdy się nie mieszają.",
    tabs: [["week", "Tydzień"], ["list", "Lista"], ["month", "Miesiąc"], ["year", "Rok"]],
    work: "Praca",
    personal: "Prywatne",
    points: ["Kolizje widać, zanim zabolą", "Powtórzenia: co poniedziałek, co 2 tygodnie, każdego 10.", "Kopiowanie wydarzenia na dowolne dni w dwóch stuknięciach", "Wczoraj, dziś i jutro o jedno przesunięcie palcem"],
  },
  work: {
    label: "Godziny i klienci",
    title: "Wiesz dokładnie, ile zarobiłeś",
    lead: "Płacą ci za godzinę czy za projekt — OSIRIS liczy to za ciebie.",
    hours: {
      title: "Ewidencja godzin",
      text: "Zacznij zmianę jednym stuknięciem. OSIRIS policzy czas, odejmie przerwy i pomnoży przez stawkę.",
      points: ["Kilka prac, każda z własną stawką", "Zlecenia dodatkowe za stałą cenę", "Prognoza do końca miesiąca"],
      running: "Zmiana trwa", stop: "Stop", earned: "Zarobione w tym miesiącu", forecast: "do końca miesiąca", job: "Magazyn · 32 zł/h",
    },
    clients: {
      title: "Klienci i projekty",
      text: "Każdy klient, każdy projekt, każda wpłata. Od razu widać, kto zapłacił, a kto się nie spieszy.",
      points: ["Budżety i terminy dla każdego projektu", "Wpłaty w dowolnej walucie — nigdy nie sumowane razem", "Delikatne przypomnienie, gdy ktoś zamilkł"],
      owe: "Są ci winni", paid: "zapłacono", due: "zostało",
    },
  },
  report: {
    label: "Raporty PDF",
    title: "Raport, który pracodawca naprawdę przeczyta",
    lead: "Jedno stuknięcie zamienia twój miesiąc w czysty, czarno-biały PDF: harmonogram, godziny, zlecenia dodatkowe i suma. Wyślij, zapisz albo wydrukuj.",
    steps: [["Wybierz okres", "Ten miesiąc, poprzedni albo własne daty."], ["Zdecyduj, co pokazać", "Z kwotami albo same godziny, z miejscem na podpisy."], ["Wyślij", "Mailem albo komunikatorem, prosto z OSIRIS."]],
    cta: "Zrób pierwszy raport",
    doc: { head: "RAPORT GODZIN PRACY", period: "Listopad 2026", worker: "Pracownik", forWhom: "Dla", hours: "Godzin", days: "Dni", tasks: "Zleceń", total: "Do zapłaty", schedule: "Harmonogram pracy", sign1: "Pracownik", sign2: "Pracodawca", made: "Sporządzono w OSIRIS" },
  },
  extras: {
    label: "A do tego",
    title: "Drobiazgi, które robią różnicę",
    items: [
      ["widgets", "Widżety", "Plan dnia i notka od Osi na ekranie głównym i blokady."],
      ["siri", "Siri i przycisk czynności", "„Powiedz Osi” — zapisz myśl bez otwierania aplikacji."],
      ["friends", "Znajomi i wspólne wydarzenia", "Dodaj znajomego kodem, widźcie swoje plany, zapraszaj na wydarzenia."],
      ["goals", "Cele", "Oszczędzanie z prognozą, terminy sądowe, których nie wolno przegapić, nawyki z serią."],
      ["mood", "Nastrój", "Dziesięć sekund na zapis i uczciwe statystyki tego, co ci służy."],
      ["import", "Import", "Przenieś plany ze Structured, kalendarzy .ics albo JSON."],
    ],
  },
  pricing: {
    label: "Cennik",
    title: "Zacznij za darmo. Rozszerz, gdy Osi wejdzie ci w nawyk.",
    lead: "Kalendarz, zadania i przypomnienia działają w każdym planie. Plany różnią się tym, ile możesz rozmawiać z Osi.",
    perMonth: "/ mies.", perDay: "wiadomości do Osi dziennie", test: "Płatności działają na razie w trybie testowym — plany włączają się bez opłaty.", popular: "Najczęściej wybierany",
    plans: [
      { name: "Za darmo", price: "0 zł", osi: "1", tagline: "Żeby się rozejrzeć", points: ["1 projekt i 1 praca", "3 notatki, 2 cele", "Kalendarz i zadania bez limitów"], cta: "Zacznij za darmo" },
      { name: "Małe radości", price: "9,99 zł", osi: "20", tagline: "Na co dzień", points: ["Wszystko bez limitów", "Wszystkie ikony i kolory", "Godziny, raporty, znajomi"], cta: "Wybieram Małe radości" },
      { name: "Mądra głowa", price: "29,99 zł", osi: "100", tagline: "Gdy Osi to twoja prawa ręka", points: ["Wszystko z Małych radości", "Najwięcej miejsca dla Osi", "Głosowanie na nowe funkcje (wkrótce)"], cta: "Wybieram Mądrą głowę" },
    ],
  },
  stores: {
    label: "Aplikacje",
    title: "Wkrótce w App Store i Google Play",
    lead: "Aplikacja na iPhone'a przechodzi ostatnie szlify, a wersja na Androida jest w drodze. Zostaw e-mail — napiszemy raz, w dniu premiery.",
    soon: "Wkrótce", ios: "App Store", android: "Google Play", web: "Wersja webowa", webCta: "Otwórz teraz",
    form: { placeholder: "twoj@email.pl", button: "Daj mi znać", ok: "Dzięki! Napiszemy w dniu premiery.", bad: "Sprawdź adres e-mail.", fail: "Nie udało się zapisać. Spróbuj za chwilę.", consent: "Użyjemy adresu tylko do tej jednej wiadomości." },
  },
  faq: {
    label: "FAQ",
    title: "Pytania, które padają przed startem",
    items: [
      ["Co dokładnie potrafi Osi?", "Osi zamienia zwykłe słowa w wydarzenia, zadania, wpłaty, cele i zmiany w pracy. Potrafi też przesuwać, zmieniać i usuwać, szukać wolnego czasu i pamiętać ustalenia. Zawsze najpierw pokazuje wynik na kartach — nic nie zapisze, dopóki nie stukniesz „Zastosuj”."],
      ["Czy moje dane są bezpieczne?", "Dane są przechowywane w Unii Europejskiej i widzisz je tylko ty — dostęp jest pilnowany na poziomie bazy danych. Nie sprzedajemy danych i nie wyświetlamy reklam. Odpowiedzi Osi generuje Claude firmy Anthropic; twoje dane nie służą do trenowania modeli."],
      ["Czy działa na laptopie?", "Tak. Wersja webowa pod adresem myosiris.app działa w każdej nowoczesnej przeglądarce na laptopach, tabletach i telefonach — z tym samym kontem i tymi samymi danymi co aplikacja."],
      ["Kiedy aplikacje trafią do sklepów?", "Wkrótce. Aplikacja na iPhone'a jest dopracowywana, a wersja na Androida będzie następna. Zostaw e-mail powyżej, a damy znać w dniu premiery."],
      ["Ile to kosztuje?", "Jest plan darmowy z jedną wiadomością do Osi dziennie. Małe radości kosztują 9,99 zł miesięcznie (20 wiadomości dziennie), Mądra głowa — 29,99 zł miesięcznie (100 wiadomości). Płatności działają obecnie w trybie testowym."],
      ["Czy mogę wysłać godziny pracodawcy?", "Tak. W zakładce Godziny stuknij „Raport”, wybierz okres i to, co pokazać, a OSIRIS przygotuje PDF z harmonogramem, godzinami, zleceniami dodatkowymi i sumą. Możesz go wysłać, zapisać albo wydrukować."],
      ["Jakie języki są obsługiwane?", "Polski, angielski i rosyjski. Osi odpowiada w języku, w którym do niego piszesz."],
      ["Czy mogę przenieść plany z innej aplikacji?", "Tak. OSIRIS importuje plik eksportu Structured, kalendarze .ics i pliki JSON, bez tworzenia duplikatów."],
    ],
  },
  final: { title: "Zamknij kilka kart w głowie", lead: "Załóż konto w minutę i opowiedz Osi o swoim tygodniu.", cta: "Zacznij za darmo" },
  footer: {
    tagline: "Planer z asystentem AI dla zabieganych.", product: "Produkt", legal: "Dokumenty", contact: "Kontakt", terms: "Regulamin", privacy: "Polityka prywatności", cookies: "Polityka cookies", cookieSettings: "Ustawienia cookies",
    madeBy: "Projekt i wykonanie", operator: "Usługodawca i administrator danych", rights: "Wszelkie prawa zastrzeżone.", webApp: "Wersja webowa",
  },
  chat: {
    open: "Zapytaj Osi", title: "Osi", sub: "Zapytaj mnie o OSIRIS", hello: "Cześć! Jestem Osi. Zapytaj mnie o OSIRIS — co potrafi, ile kosztuje, gdzie działa.", placeholder: "Twoje pytanie…", send: "Wyślij",
    left: (n) => (n === 1 ? "Zostało 1 pytanie" : `Zostały ${n} pytania`), typing: "Osi myśli", suggestions: ["Co potrafi Osi?", "Jak działają raporty PDF?", "Ile to kosztuje?"],
    error: "Nie udało mi się odpowiedzieć. Spróbuj jeszcze raz.", busy: "Za dużo pytań jak na dziś. Załóż konto i pytaj mnie w OSIRIS.", rate: "Chwileczkę — jeszcze łapię oddech.", close: "Zamknij czat",
    disclaimer: "Osi to AI i może się mylić. Nie podawaj tu danych osobowych.",
    wall: { title: "To było twoje drugie pytanie", text: "Żeby rozmawiać z Osi dalej, załóż darmowe konto — a z planem masz nawet 100 wiadomości dziennie, od razu w swoim kalendarzu.", signup: "Załóż darmowe konto", plans: "Zobacz plany", login: "Mam już konto", later: "Może później" },
  },
  cookie: {
    title: "Kilka ciasteczek, zero niespodzianek",
    text: "Używamy pamięci niezbędnej do działania strony oraz — za twoją zgodą — anonimowych statystyk, które pomagają ulepszać OSIRIS. Bez reklam i trackerów.",
    accept: "Akceptuję wszystkie", necessary: "Tylko niezbędne", settings: "Ustawienia", save: "Zapisz wybór", more: "Polityka cookies", always: "Zawsze włączone",
    cats: { necessary: ["Niezbędne", "Sesja logowania, język, motyw i twój wybór dotyczący cookies. Bez nich strona nie zadziała."], analytics: ["Anonimowe statystyki", "Odsłony stron bez plików cookie i bez profilowania: które strony są odwiedzane i skąd."] },
  },
  notFound: { title: "Ta strona zgubiła się między kartami", text: "Wróćmy tam, gdzie są plany.", home: "Na stronę główną" },
  skip: "Przejdź do treści",
};

const ru: Content = {
  meta: {
    title: "OSIRIS — планер с ИИ-помощником для занятых людей",
    description: "Календарь, задачи, клиенты, учёт часов и рапорты PDF в одном месте. Скажи Оси, что у тебя в голове, — он превратит это в план. Веб-версия работает уже сейчас; приложения для iPhone и Android — скоро.",
    ogAlt: "OSIRIS — планер с Оси, ИИ-помощником",
  },
  nav: { osi: "Оси", views: "Календарь", hours: "Часы и клиенты", report: "Рапорты PDF", pricing: "Тарифы", faq: "Вопросы", login: "Войти", signup: "Регистрация", menu: "Меню", lang: "Язык" },
  hero: {
    kicker: "Планер с ИИ-помощником",
    title: ["Планер для тех,", "у кого в голове", "47 вкладок"],
    lead: "Говори так, как сказал бы другу. Оси запишет встречи в календарь, проследит, кто сколько должен, посчитает часы и отправит работодателю аккуратный рапорт.",
    cta: "Начать бесплатно",
    cta2: "Спросить Оси",
    note: "Бесплатный план, карта не нужна. Работает в браузере уже сейчас.",
    bubble: "Привет! Я Оси. Расскажи о планах — я всё разложу.",
  },
  ticker: ["Календарь", "Задачи", "Клиенты", "Оплаты", "Учёт часов", "Рапорты PDF", "Цели", "Настроение", "Заметки", "Друзья", "Виджеты", "Siri"],
  osi: {
    label: "Знакомься: Оси",
    title: "Ты говоришь. Оси планирует.",
    lead: "Оси — помощник, который живёт в OSIRIS и знает твой календарь, клиентов и сроки. Напиши или продиктуй обычными словами — остальное он сделает сам.",
    points: [
      ["Понимает обычную речь", "«Стоматолог в пятницу в три, напомни за час» превращается в событие с напоминанием."],
      ["Ничего не меняет без тебя", "Оси показывает карточками, что собирается сделать. Запись появится только после «Применить»."],
      ["Планирует вокруг твоей жизни", "Находит свободные окна без пересечений, переносит дела, помнит договорённости."],
      ["Говорит на твоём языке", "По-русски, по-польски или по-английски — отвечает на том языке, на котором ты пишешь."],
    ],
    demo: [
      { user: "Встреча с Аней в пятницу в 15:00, напомни за час", reply: "Предлагаю добавить:", cards: [["Встреча с Аней", "Пятница · 15:00 · напоминание за 1 ч"]], apply: "Применить", applied: "Готово — уже в календаре" },
      { user: "Марина заплатила 500 евро за брендинг", reply: "Понял. Записываю оплату:", cards: [["Оплата 500 €", "Брендинг · Марина · сегодня"], ["Осталось получить", "1 200 € из 1 700 €"]], apply: "Применить", applied: "Сохранено — остаток обновлён" },
      { user: "Распланируй спортзал два раза в неделю там, где я свободен", reply: "Ты свободен по вторникам и четвергам вечером:", cards: [["Спортзал", "Вторник · 19:00–20:30"], ["Спортзал", "Четверг · 19:00–20:30"]], apply: "Применить", applied: "Запланировано без пересечений" },
    ],
    hint: "Попробуй сам — Оси сидит в углу этой страницы.",
  },
  views: {
    label: "Календарь",
    title: "Один календарь, четыре взгляда на него",
    lead: "Неделя на одном экране, простой список, весь месяц или год в цвете. Работа и личное рядом — и никогда не путаются.",
    tabs: [["week", "Неделя"], ["list", "Список"], ["month", "Месяц"], ["year", "Год"]],
    work: "Работа",
    personal: "Личное",
    points: ["Пересечения видны до того, как станут проблемой", "Повторы: каждый понедельник, раз в 2 недели, 10-го числа", "Копирование события на любые дни в два касания", "Вчера, сегодня и завтра — на расстоянии одного свайпа"],
  },
  work: {
    label: "Часы и клиенты",
    title: "Ты точно знаешь, сколько заработал",
    lead: "Платят за час или за проект — OSIRIS считает за тебя.",
    hours: {
      title: "Учёт часов",
      text: "Начни смену одним касанием. OSIRIS посчитает время, вычтет перерывы и умножит на ставку.",
      points: ["Несколько работ, у каждой своя ставка", "Задания сверх смены за фиксированную цену", "Прогноз до конца месяца"],
      running: "Смена идёт", stop: "Стоп", earned: "Заработано за месяц", forecast: "к концу месяца", job: "Склад · 32 zł/ч",
    },
    clients: {
      title: "Клиенты и проекты",
      text: "Каждый клиент, каждый проект, каждая оплата. Сразу видно, кто заплатил, а кто не торопится.",
      points: ["Бюджеты и дедлайны у каждого проекта", "Оплаты в любой валюте — суммы не смешиваются", "Мягкое напоминание, когда кто-то пропал"],
      owe: "Тебе должны", paid: "оплачено", due: "осталось",
    },
  },
  report: {
    label: "Рапорты PDF",
    title: "Рапорт, который работодатель действительно прочитает",
    lead: "Одно касание превращает твой месяц в чистый чёрно-белый PDF: график, часы, задания и итог. Отправь, сохрани или распечатай.",
    steps: [["Выбери период", "Этот месяц, прошлый или свои даты."], ["Реши, что показать", "С суммами или только часы, с местом для подписей."], ["Отправь", "По почте или в мессенджер, прямо из OSIRIS."]],
    cta: "Сделать первый рапорт",
    doc: { head: "РАПОРТ О РАБОТЕ", period: "Ноябрь 2026", worker: "Работник", forWhom: "Кому", hours: "Часов", days: "Дней", tasks: "Заданий", total: "К оплате", schedule: "График работы", sign1: "Работник", sign2: "Работодатель", made: "Составлено в OSIRIS" },
  },
  extras: {
    label: "А ещё",
    title: "Мелочи, которые многое меняют",
    items: [
      ["widgets", "Виджеты", "План на день и записка от Оси на главном экране и экране блокировки."],
      ["siri", "Siri и кнопка действия", "«Сказать Оси» — запиши мысль, не открывая приложение."],
      ["friends", "Друзья и совместные события", "Добавь друга по коду, смотрите планы друг друга, зовите на события."],
      ["goals", "Цели", "Накопления с прогнозом, судебные даты, которые нельзя проспать, привычки с сериями."],
      ["mood", "Настроение", "Десять секунд на отметку и честная статистика того, что тебя радует."],
      ["import", "Импорт", "Перенеси планы из Structured, календарей .ics или JSON."],
    ],
  },
  pricing: {
    label: "Тарифы",
    title: "Начни бесплатно. Расширь, когда Оси войдёт в привычку.",
    lead: "Календарь, задачи и напоминания работают на любом тарифе. Тарифы отличаются тем, сколько можно общаться с Оси.",
    perMonth: "/ мес.", perDay: "сообщений Оси в день", test: "Оплата пока работает в тестовом режиме — тарифы включаются без списания.", popular: "Выбирают чаще",
    plans: [
      { name: "Бесплатно", price: "0 zł", osi: "1", tagline: "Чтобы осмотреться", points: ["1 проект и 1 работа", "3 заметки, 2 цели", "Календарь и задачи без ограничений"], cta: "Начать бесплатно" },
      { name: "Маленькие радости", price: "9,99 zł", osi: "20", tagline: "На каждый день", points: ["Всё без ограничений", "Все значки и цвета", "Часы, рапорты, друзья"], cta: "Выбрать «Маленькие радости»" },
      { name: "Умница", price: "29,99 zł", osi: "100", tagline: "Когда Оси — твоя правая рука", points: ["Всё из «Маленьких радостей»", "Больше всего места для Оси", "Голосование за новые функции (скоро)"], cta: "Выбрать «Умницу»" },
    ],
  },
  stores: {
    label: "Приложения",
    title: "Скоро в App Store и Google Play",
    lead: "Приложение для iPhone проходит последнюю полировку, версия для Android на подходе. Оставь почту — напишем один раз, в день выхода.",
    soon: "Скоро", ios: "App Store", android: "Google Play", web: "Веб-версия", webCta: "Открыть сейчас",
    form: { placeholder: "твоя@почта.com", button: "Сообщить мне", ok: "Спасибо! Напишем в день выхода.", bad: "Проверь адрес почты.", fail: "Не получилось сохранить. Попробуй через минуту.", consent: "Адрес нужен только для этого одного письма." },
  },
  faq: {
    label: "Вопросы",
    title: "О чём спрашивают перед началом",
    items: [
      ["Что именно умеет Оси?", "Оси превращает обычные слова в события, задачи, оплаты, цели и смены. Ещё он переносит, меняет и удаляет дела, ищет свободное время и помнит договорённости. Сначала он всегда показывает результат карточками — ничего не сохранится, пока ты не нажмёшь «Применить»."],
      ["Мои данные в безопасности?", "Данные хранятся в Европейском союзе, и видишь их только ты — доступ ограничен на уровне базы данных. Мы не продаём данные и не показываем рекламу. Ответы Оси генерирует Claude от Anthropic; твои данные не используются для обучения моделей."],
      ["Работает ли на ноутбуке?", "Да. Веб-версия на myosiris.app работает в любом современном браузере на ноутбуках, планшетах и телефонах — с тем же аккаунтом и теми же данными, что и приложение."],
      ["Когда приложения появятся в магазинах?", "Скоро. Приложение для iPhone дорабатывается, версия для Android — следующая. Оставь почту выше, и мы сообщим в день выхода."],
      ["Сколько это стоит?", "Есть бесплатный план с одним сообщением Оси в день. «Маленькие радости» — 9,99 zł в месяц (20 сообщений в день), «Умница» — 29,99 zł в месяц (100 сообщений). Оплата сейчас работает в тестовом режиме."],
      ["Можно отправить часы работодателю?", "Да. Во вкладке «Часы» нажми «Рапорт», выбери период и что показать — OSIRIS соберёт PDF с графиком, часами, заданиями и итогом. Его можно отправить, сохранить или распечатать."],
      ["Какие языки поддерживаются?", "Русский, польский и английский. Оси отвечает на том языке, на котором ты ему пишешь."],
      ["Можно перенести планы из другого приложения?", "Да. OSIRIS импортирует файл экспорта Structured, календари .ics и файлы JSON, не создавая дублей."],
    ],
  },
  final: { title: "Закрой пару вкладок в голове", lead: "Создай аккаунт за минуту и расскажи Оси о своей неделе.", cta: "Начать бесплатно" },
  footer: {
    tagline: "Планер с ИИ-помощником для занятых людей.", product: "Продукт", legal: "Документы", contact: "Контакт", terms: "Пользовательское соглашение", privacy: "Политика конфиденциальности", cookies: "Политика cookies", cookieSettings: "Настройки cookies",
    madeBy: "Дизайн и разработка", operator: "Оператор сервиса и администратор данных", rights: "Все права защищены.", webApp: "Веб-версия",
  },
  chat: {
    open: "Спросить Оси", title: "Оси", sub: "Спроси меня про OSIRIS", hello: "Привет! Я Оси. Спроси меня про OSIRIS — что он умеет, сколько стоит, где работает.", placeholder: "Твой вопрос…", send: "Отправить",
    left: (n) => (n === 1 ? "Остался 1 вопрос" : `Осталось ${n} вопроса`), typing: "Оси думает", suggestions: ["Что умеет Оси?", "Как работают рапорты PDF?", "Сколько это стоит?"],
    error: "Не получилось ответить. Попробуй ещё раз.", busy: "На сегодня вопросов слишком много. Зарегистрируйся и спрашивай меня в OSIRIS.", rate: "Секунду — я ещё перевожу дух.", close: "Закрыть чат",
    disclaimer: "Оси — ИИ и может ошибаться. Не пиши здесь личные данные.",
    wall: { title: "Это был твой второй вопрос", text: "Чтобы общаться с Оси дальше, создай бесплатный аккаунт — а с подпиской будет до 100 сообщений в день, прямо в твоём календаре.", signup: "Создать бесплатный аккаунт", plans: "Посмотреть тарифы", login: "У меня уже есть аккаунт", later: "Может, позже" },
  },
  cookie: {
    title: "Немного cookies, никаких сюрпризов",
    text: "Мы используем хранилище, без которого сайт не работает, и — с твоего согласия — анонимную статистику, которая помогает улучшать OSIRIS. Без рекламы и трекеров.",
    accept: "Принять все", necessary: "Только необходимые", settings: "Настройки", save: "Сохранить выбор", more: "Политика cookies", always: "Всегда включены",
    cats: { necessary: ["Необходимые", "Сессия входа, язык, тема и твой выбор по cookies. Без них сайт не работает."], analytics: ["Анонимная статистика", "Просмотры страниц без файлов cookie и без профилей: какие страницы открывают и откуда приходят."] },
  },
  notFound: { title: "Эта страница потерялась между вкладками", text: "Вернёмся туда, где планы.", home: "На главную" },
  skip: "Перейти к содержимому",
};

export const CONTENT: Record<SiteLang, Content> = { en, pl, ru };

/** Реквизиты для подвала и документов. */
export const COMPANY = {
  name: "Maksym Yehorov Maksikon",
  street: "ul. Zamiany 18 lok. 46",
  city: "02-786 Warszawa",
  country: { en: "Poland", pl: "Polska", ru: "Польша" } as Record<SiteLang, string>,
  nip: "9512594289",
  regon: "528375783",
  email: "dbdcstudio@gmail.com",
  studio: "DBDC Studio",
  studioUrl: "https://dbdcstudio.pl/",
};
