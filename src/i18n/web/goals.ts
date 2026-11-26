// Новые строки раздела (ключ — русский, значения — [pl, en]). Строки, которые уже есть в приложении, сюда не нужны.
const d: Record<string, [string, string]> = {
  "Подарок: {0}": ["Prezent: {0}", "Gift: {0}"],
  "Подарок": ["Prezent", "Gift"],
  "Скоро праздник": ["Zbliża się święto", "A celebration is coming"],
  "через {0} дн.": ["za {0} dni", "in {0} days"],
  "Через {0} дн. — «{1}». Начать копить на подарок заранее?": ["Za {0} dni — „{1}”. Zacząć odkładać na prezent już teraz?", "In {0} days — “{1}”. Start saving for a gift in advance?"],
  "Сколько хочешь собрать? Я прослежу за темпом и напомню, если начнём отставать.": ["Ile chcesz zebrać? Przypilnuję tempa i przypomnę, jeśli zaczniemy zostawać w tyle.", "How much do you want to save? I'll watch the pace and remind you if we fall behind."],
  "Не сейчас": ["Nie teraz", "Not now"],
  "Да, копить": ["Tak, odkładam", "Yes, start saving"],
  "Сумма на подарок": ["Kwota na prezent", "Gift amount"],
  "Это примерно {0} в неделю": ["To około {0} tygodniowo", "That's about {0} a week"],
  "Создать копилку": ["Utwórz skarbonkę", "Create the fund"],
  "Копилка создана — загляни в «Цели»": ["Skarbonka utworzona — zajrzyj do „Celów”", "Fund created — see it in Goals"],
  "Копилка к событию «{0}»": ["Skarbonka na wydarzenie „{0}”", "Fund for “{0}”"],
  "Собрано полностью": ["Zebrano całość", "Fully saved"],
  "Немного отстаём: осталось {0} за {1} дн. — примерно {2} в неделю": ["Trochę zostajemy w tyle: zostało {0} w {1} dni — około {2} tygodniowo", "A little behind: {0} left in {1} days — about {2} a week"],
  "Идём по плану: осталось {0} за {1} дн. — примерно {2} в неделю": ["Zgodnie z planem: zostało {0} w {1} dni — około {2} tygodniowo", "On track: {0} left in {1} days — about {2} a week"],
  "Копилка «{0}» отстаёт": ["Skarbonka „{0}” zostaje w tyle", "The “{0}” fund is falling behind"],
  "Осталось {0} за {1} дн. — это примерно {2} в неделю.": ["Zostało {0} w {1} dni — to około {2} tygodniowo.", "{0} left in {1} days — about {2} a week."],

  "К целям": ["Do celów", "Back to goals"],
  "Введи число": ["Wpisz liczbę", "Enter a number"],
};
export default d;
