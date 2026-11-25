// Новые строки раздела (ключ — русский, значения — [pl, en]). Строки, которые уже есть в приложении, сюда не нужны.
const d: Record<string, [string, string]> = {
  "Назад": ["Wstecz", "Back"],
  "Вперёд": ["Dalej", "Forward"],
  "Скачать PDF": ["Pobierz PDF", "Download PDF"],
  "Браузер не дал открыть новую вкладку — PDF скачан": ["Przeglądarka zablokowała nową kartę — PDF został pobrany", "The browser blocked the new tab — the PDF was downloaded instead"],
  "Смена через полночь — конец {0}": ["Zmiana przez północ — koniec {0}", "Shift runs past midnight — ends {0}"],
  "Адрес, график, с кем договаривался…": ["Adres, grafik, z kim się umawiałeś…", "Address, schedule, who you agreed with…"],
};
export default d;
