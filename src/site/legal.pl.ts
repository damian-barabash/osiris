// Dokumenty prawne — wersja polska (wiążąca). Element tablicy: akapit (string) albo lista (string[]).
import type { LegalSet } from "./legal";

const pl: LegalSet = {
  updated: "Obowiązuje od 25 listopada 2026 r.",
  terms: {
    title: "Regulamin serwisu OSIRIS",
    intro: "Regulamin określa zasady korzystania z serwisu i aplikacji OSIRIS dostępnych pod adresem myosiris.app oraz w aplikacjach mobilnych. Prosimy o uważną lekturę przed założeniem konta.",
    sections: [
      { h: "1. Usługodawca", body: [
        "Usługodawcą jest Maksym Yehorov prowadzący działalność gospodarczą pod firmą Maksym Yehorov Maksikon, ul. Zamiany 18 lok. 46, 02-786 Warszawa, NIP: 9512594289, REGON: 528375783 (dalej „Usługodawca”).",
        "Kontakt: dbdcstudio@gmail.com. Serwis został zaprojektowany i wykonany przez DBDC Studio (dbdcstudio.pl).",
      ] },
      { h: "2. Definicje", body: [[
        "Serwis — strona myosiris.app, wersja webowa aplikacji dostępna pod adresem myosiris.app/app oraz aplikacje mobilne OSIRIS.",
        "Użytkownik — osoba fizyczna, która ukończyła 16 lat i korzysta z Serwisu.",
        "Konto — indywidualny profil Użytkownika, w którym gromadzone są jego dane i treści.",
        "Osi — asystent oparty na sztucznej inteligencji, dostępny w Serwisie.",
        "Plan — zakres funkcji Serwisu: „Za darmo”, „Małe radości” albo „Mądra głowa”.",
      ]] },
      { h: "3. Rodzaj i zakres usług", body: [
        "Serwis jest planerem: umożliwia prowadzenie kalendarza, zadań, listy klientów i projektów, ewidencji wpłat i godzin pracy, celów, notatek oraz zapisków nastroju, a także generowanie raportów PDF i korzystanie z asystenta Osi.",
        "Wymagania techniczne: urządzenie z dostępem do Internetu, aktualna przeglądarka z włączoną obsługą JavaScript i pamięci lokalnej albo aplikacja mobilna, oraz aktywny adres e-mail.",
        "Na stronie myosiris.app dostępny jest czat z Osi dla osób niezalogowanych, ograniczony do niewielkiej liczby pytań i służący wyłącznie do uzyskania informacji o Serwisie.",
      ] },
      { h: "4. Konto", body: [
        "Konto można założyć, podając adres e-mail i hasło albo logując się kontem Google. Umowa o świadczenie usług drogą elektroniczną zostaje zawarta z chwilą założenia Konta, na czas nieoznaczony.",
        "Użytkownik odpowiada za poufność hasła i za działania wykonane z użyciem jego Konta. O podejrzeniu nieuprawnionego dostępu należy niezwłocznie powiadomić Usługodawcę.",
        "Użytkownik może w każdej chwili usunąć Konto, wysyłając prośbę na adres dbdcstudio@gmail.com z adresu przypisanego do Konta. Usunięcie Konta powoduje trwałe usunięcie danych Użytkownika.",
      ] },
      { h: "5. Plany i płatności", body: [
        "Plan „Za darmo” jest bezpłatny i obejmuje podstawowe funkcje z limitami opisanymi w Serwisie. Plany „Małe radości” (9,99 zł miesięcznie) oraz „Mądra głowa” (29,99 zł miesięcznie) rozszerzają limity, w szczególności liczbę wiadomości do Osi w ciągu dnia. Ceny zawierają podatki.",
        "Na dzień wejścia w życie Regulaminu płatności działają w trybie testowym: wybór planu płatnego nie powoduje pobrania opłaty. O uruchomieniu płatności Usługodawca poinformuje w Serwisie oraz zaktualizuje Regulamin przed pobraniem pierwszej opłaty.",
        "Po uruchomieniu płatności plan płatny będzie odnawiany co miesiąc do czasu rezygnacji, której można dokonać w dowolnym momencie ze skutkiem na koniec opłaconego okresu.",
      ] },
      { h: "6. Prawo odstąpienia od umowy", body: [
        "Konsument oraz przedsiębiorca na prawach konsumenta może odstąpić od umowy zawartej na odległość w terminie 14 dni bez podania przyczyny, składając oświadczenie na adres dbdcstudio@gmail.com.",
        "Jeżeli Użytkownik zażąda rozpoczęcia świadczenia usługi płatnej przed upływem terminu na odstąpienie, w razie odstąpienia zapłaci za świadczenia spełnione do tej chwili. W przypadku treści cyfrowych dostarczanych niezwłocznie, za wyraźną zgodą Użytkownika i po poinformowaniu go o utracie prawa odstąpienia, prawo to nie przysługuje w zakresie już dostarczonych treści.",
      ] },
      { h: "7. Asystent Osi", body: [
        "Osi wykorzystuje modele sztucznej inteligencji dostarczane przez Anthropic. Odpowiedzi są generowane automatycznie i mogą zawierać błędy lub nieścisłości. Osi nie świadczy porad prawnych, podatkowych, medycznych ani finansowych.",
        "Osi proponuje zmiany w danych w formie kart; zmiany są zapisywane dopiero po ich zatwierdzeniu przez Użytkownika. Przed zatwierdzeniem Użytkownik powinien sprawdzić ich poprawność.",
        "Liczba wiadomości do Osi w ciągu dnia jest ograniczona i zależy od Planu.",
      ] },
      { h: "8. Zasady korzystania", body: [
        "Użytkownik zobowiązuje się korzystać z Serwisu zgodnie z prawem i Regulaminem. Zabronione jest w szczególności:",
        [
          "dostarczanie treści bezprawnych lub naruszających prawa osób trzecich;",
          "podejmowanie prób obejścia zabezpieczeń, limitów lub ograniczeń Serwisu, w tym nakłanianie Osi do działań niezgodnych z jego przeznaczeniem;",
          "automatyczne pobieranie danych, obciążanie infrastruktury oraz używanie Serwisu do rozsyłania niezamówionych informacji;",
          "udostępnianie Konta innym osobom w sposób naruszający bezpieczeństwo danych.",
        ],
        "W razie rażącego naruszenia Regulaminu Usługodawca może ograniczyć dostęp do Serwisu albo wypowiedzieć umowę, informując o tym Użytkownika.",
      ] },
      { h: "9. Treści Użytkownika", body: [
        "Treści wprowadzone do Serwisu pozostają własnością Użytkownika. Użytkownik udziela Usługodawcy niewyłącznej licencji na ich przechowywanie i przetwarzanie wyłącznie w zakresie niezbędnym do świadczenia usług.",
        "Funkcja znajomych pozwala udostępnić wybranym osobom nazwy, terminy i miejsca wydarzeń oraz zadań. Notatki i opisy nie są udostępniane. Nastrój jest udostępniany wyłącznie za odrębną zgodą, którą można w każdej chwili cofnąć.",
      ] },
      { h: "10. Dostępność i odpowiedzialność", body: [
        "Usługodawca dokłada starań, aby Serwis działał nieprzerwanie, jednak nie gwarantuje pełnej dostępności. Możliwe są przerwy techniczne, o których — w miarę możliwości — Usługodawca informuje z wyprzedzeniem.",
        "Serwis jest narzędziem pomocniczym. Użytkownik samodzielnie odpowiada za dotrzymywanie swoich terminów, w tym sądowych i urzędowych, oraz za prawidłowość danych w raportach przekazywanych osobom trzecim.",
        "Odpowiedzialność Usługodawcy wobec Użytkowników niebędących konsumentami jest ograniczona do kwoty opłat uiszczonych w ostatnich 12 miesiącach. Postanowienia Regulaminu nie wyłączają ani nie ograniczają praw konsumentów wynikających z bezwzględnie obowiązujących przepisów.",
      ] },
      { h: "11. Reklamacje", body: [
        "Reklamacje można składać na adres dbdcstudio@gmail.com, opisując problem i podając adres e-mail Konta. Usługodawca odpowiada na reklamację w terminie 14 dni od jej otrzymania.",
        "Konsument może skorzystać z pozasądowych sposobów rozpatrywania sporów, m.in. zwrócić się do miejskiego lub powiatowego rzecznika konsumentów albo skorzystać z platformy ODR: https://ec.europa.eu/consumers/odr.",
      ] },
      { h: "12. Zmiany Regulaminu i postanowienia końcowe", body: [
        "Usługodawca może zmienić Regulamin z ważnych przyczyn: zmiany przepisów, wprowadzenia nowych funkcji lub płatności, względów bezpieczeństwa. O zmianie Użytkownicy zostaną powiadomieni w Serwisie lub e-mailem co najmniej 14 dni przed jej wejściem w życie. Użytkownik, który nie akceptuje zmian, może wypowiedzieć umowę, usuwając Konto.",
        "W sprawach nieuregulowanych stosuje się prawo polskie. Wybór prawa nie pozbawia konsumenta ochrony przyznanej mu przepisami państwa jego zwykłego pobytu.",
      ] },
    ],
  },
  privacy: {
    title: "Polityka prywatności",
    intro: "Wyjaśniamy, jakie dane osobowe przetwarzamy w związku z korzystaniem z OSIRIS, w jakim celu i jakie prawa przysługują osobom, których dane dotyczą.",
    sections: [
      { h: "1. Administrator danych", body: [
        "Administratorem danych osobowych jest Maksym Yehorov prowadzący działalność gospodarczą pod firmą Maksym Yehorov Maksikon, ul. Zamiany 18 lok. 46, 02-786 Warszawa, NIP: 9512594289, REGON: 528375783.",
        "W sprawach dotyczących danych osobowych można pisać na adres: dbdcstudio@gmail.com.",
      ] },
      { h: "2. Jakie dane przetwarzamy", body: [[
        "Dane konta: adres e-mail, imię lub nazwa, hasło (w postaci zaszyfrowanego skrótu), zdjęcie profilowe, język, strefa czasowa, wybrany plan.",
        "Treści wprowadzone do aplikacji: wydarzenia, zadania, klienci i projekty, wpłaty, godziny pracy, cele, notatki, zapiski nastroju oraz informacje, które Użytkownik sam zapisze w polu „Co Osi wie o mnie”.",
        "Rozmowy z Osi oraz dane o wykorzystaniu asystenta (liczba wiadomości, liczba tokenów, koszt).",
        "Dane techniczne: identyfikatory urządzeń do powiadomień push, informacje o błędach, przybliżony region wynikający ze strefy czasowej, typ urządzenia i przeglądarki.",
        "Czat dla gości na stronie: treść pytania i odpowiedzi oraz skrót (hash) adresu IP służący do liczenia limitu pytań. Samego adresu IP nie zapisujemy.",
        "Lista oczekujących: adres e-mail podany w formularzu „Daj mi znać”.",
      ],
        "Nie prosimy o podawanie danych szczególnych kategorii. Zapiski nastroju służą wyłącznie Użytkownikowi; jeżeli Użytkownik wpisze w Serwisie informacje o zdrowiu lub inne dane wrażliwe, robi to dobrowolnie.",
      ] },
      { h: "3. Cele i podstawy prawne", body: [[
        "Świadczenie usług, prowadzenie Konta, działanie asystenta Osi — art. 6 ust. 1 lit. b RODO (wykonanie umowy).",
        "Bezpieczeństwo Serwisu, zapobieganie nadużyciom, limity zapytań, dziennik błędów — art. 6 ust. 1 lit. f RODO (prawnie uzasadniony interes).",
        "Anonimowe statystyki odwiedzin strony — art. 6 ust. 1 lit. a RODO (zgoda wyrażona w banerze cookies).",
        "Powiadomienie o premierze aplikacji (lista oczekujących) — art. 6 ust. 1 lit. a RODO (zgoda).",
        "Rozliczenia i obowiązki księgowe po uruchomieniu płatności — art. 6 ust. 1 lit. c RODO (obowiązek prawny).",
        "Dochodzenie roszczeń i obrona przed nimi — art. 6 ust. 1 lit. f RODO.",
      ]] },
      { h: "4. Sztuczna inteligencja", body: [
        "Gdy Użytkownik pisze do Osi, do dostawcy modelu (Anthropic) przekazywana jest treść wiadomości oraz niezbędny kontekst z Konta: nadchodzące wydarzenia i zadania, klienci i projekty z saldami, cele, podsumowanie nastroju, notatki oraz informacje zapisane w polu „Co Osi wie o mnie”.",
        "Dane te służą wyłącznie do wygenerowania odpowiedzi. Zgodnie z warunkami usług komercyjnych Anthropic nie są wykorzystywane do trenowania modeli. Osi nie podejmuje wobec Użytkownika decyzji wywołujących skutki prawne; każdą zmianę w danych zatwierdza Użytkownik.",
      ] },
      { h: "5. Odbiorcy danych", body: [
        "Dane powierzamy podmiotom, które pomagają nam świadczyć usługi, na podstawie umów powierzenia:",
        [
          "Supabase — baza danych, uwierzytelnianie, przechowywanie plików (centrum danych w Unii Europejskiej, Irlandia);",
          "Anthropic — generowanie odpowiedzi asystenta Osi (USA);",
          "Google — logowanie kontem Google, o ile Użytkownik z niego korzysta;",
          "Apple oraz Google (Firebase) — dostarczanie powiadomień push do aplikacji mobilnych;",
          "GitHub — hosting strony internetowej (USA).",
        ],
        "Znajomi dodani przez Użytkownika widzą wyłącznie dane opisane w Regulaminie (nazwy, terminy i miejsca; nastrój tylko za zgodą). Danych nie sprzedajemy i nie udostępniamy w celach reklamowych.",
      ] },
      { h: "6. Przekazywanie danych poza EOG", body: [
        "Część dostawców ma siedzibę w USA. Przekazanie danych odbywa się na podstawie decyzji Komisji Europejskiej stwierdzającej odpowiedni stopień ochrony (EU–U.S. Data Privacy Framework) albo standardowych klauzul umownych.",
      ] },
      { h: "7. Okres przechowywania", body: [[
        "Dane Konta i treści — do czasu usunięcia Konta; kopie zapasowe są usuwane w ciągu kolejnych 30 dni.",
        "Rozmowy czatu dla gości i statystyki odwiedzin — do 12 miesięcy.",
        "Dziennik błędów i dane bezpieczeństwa — do 12 miesięcy.",
        "Lista oczekujących — do dnia wysłania powiadomienia o premierze albo do cofnięcia zgody.",
        "Dane rozliczeniowe — przez okres wymagany przepisami podatkowymi.",
      ]] },
      { h: "8. Prawa osób, których dane dotyczą", body: [
        "Każdej osobie przysługuje prawo dostępu do danych, ich sprostowania, usunięcia, ograniczenia przetwarzania, przenoszenia danych, sprzeciwu wobec przetwarzania opartego na prawnie uzasadnionym interesie oraz cofnięcia zgody w dowolnym momencie (bez wpływu na zgodność z prawem wcześniejszego przetwarzania).",
        "Aby skorzystać z praw, wystarczy napisać na adres dbdcstudio@gmail.com. Przysługuje również prawo wniesienia skargi do Prezesa Urzędu Ochrony Danych Osobowych (ul. Stawki 2, 00-193 Warszawa).",
      ] },
      { h: "9. Dobrowolność i bezpieczeństwo", body: [
        "Podanie danych jest dobrowolne, ale adres e-mail jest niezbędny do założenia Konta.",
        "Stosujemy szyfrowanie połączeń, kontrolę dostępu na poziomie bazy danych (każdy Użytkownik widzi wyłącznie własne dane), skróty haseł oraz ograniczenia dostępu administracyjnego. Serwis jest przeznaczony dla osób, które ukończyły 16 lat.",
      ] },
      { h: "10. Zmiany polityki", body: [
        "O istotnych zmianach poinformujemy w Serwisie lub e-mailem. Aktualna wersja jest zawsze dostępna na tej stronie.",
      ] },
    ],
  },
  cookies: {
    title: "Polityka cookies",
    intro: "Opisujemy, jakie informacje strona myosiris.app zapisuje w przeglądarce i do czego ich używa.",
    sections: [
      { h: "1. Czego używamy", body: [
        "OSIRIS nie korzysta z reklamowych ani śledzących plików cookie i nie osadza skryptów zewnętrznych sieci reklamowych. Zamiast klasycznych plików cookie używamy pamięci przeglądarki (localStorage i sessionStorage).",
      ] },
      { h: "2. Niezbędne", body: [
        "Te dane są konieczne do działania strony i aplikacji i nie wymagają zgody:",
        { table: [["Nazwa", "Cel", "Czas"], ["osiris-auth", "sesja logowania w wersji webowej", "do wylogowania"], ["osiris_lang, osiris_site_lang", "wybrany język", "do zmiany"], ["osiris_theme", "motyw jasny lub ciemny", "do zmiany"], ["osiris_consent", "wybór dotyczący statystyk", "do zmiany"], ["cal_mode, cal_start, report_* i podobne", "ustawienia widoków w aplikacji", "do zmiany"], ["osiris_guest_chat", "bieżąca rozmowa z Osi na stronie", "do zamknięcia karty"], ["osiris_admin", "sesja panelu administracyjnego", "do zamknięcia karty"]] },
      ] },
      { h: "3. Anonimowe statystyki", body: [
        "Jeżeli wyrazisz zgodę w banerze, zapisujemy na własnym serwerze informację o odsłonie: adres podstrony, stronę odsyłającą, parametry UTM, język, typ urządzenia i przeglądarki oraz region wynikający ze strefy czasowej. Odwiedzający jest rozpoznawany wyłącznie za pomocą skrótu zmienianego każdego dnia; nie zapisujemy adresu IP ani plików cookie i nie budujemy profili.",
        "Nie korzystamy z Google Analytics ani innych zewnętrznych narzędzi analitycznych.",
      ] },
      { h: "4. Logowanie kontem Google", body: [
        "Jeżeli wybierzesz logowanie kontem Google, nastąpi przekierowanie do serwisu Google, który stosuje własne pliki cookie na zasadach opisanych w jego polityce prywatności.",
      ] },
      { h: "5. Jak zmienić wybór", body: [
        "Wybór dotyczący statystyk możesz zmienić w dowolnej chwili, klikając „Ustawienia cookies” w stopce strony. Pamięć przeglądarki możesz też wyczyścić w jej ustawieniach — spowoduje to wylogowanie i przywrócenie ustawień domyślnych.",
      ] },
      { h: "6. Kontakt", body: ["Pytania dotyczące tej polityki prosimy kierować na adres dbdcstudio@gmail.com."] },
    ],
  },
};
export default pl;
