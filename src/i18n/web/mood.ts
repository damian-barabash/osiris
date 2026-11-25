// Новые строки раздела (ключ — русский, значения — [pl, en]). Строки, которые уже есть в приложении, сюда не нужны.
const d: Record<string, [string, string]> = {
  "Отметить настроение": ["Zaznacz nastrój", "Log mood"],
  "Не больше {0} тегов": ["Najwyżej {0} tagów", "No more than {0} tags"],
  "Поменять порядок: {0}": ["Zmień kolejność: {0}", "Reorder: {0}"],
  "Насколько настроение с тегом выше или ниже среднего.": ["O ile nastrój z tym tagiem jest wyższy lub niższy od średniej.", "How much higher or lower your mood is with the tag, compared to the average."],
  "Энергия и настроение": ["Energia a nastrój", "Energy and mood"],
  "Среднее настроение при энергии от 1 до 5.": ["Średni nastrój przy energii od 1 do 5.", "Average mood at each energy level from 1 to 5."],
  "Нагрузка": ["Obciążenie", "Workload"],
  "Спокойные дни": ["Spokojne dni", "Calm days"],
  "3+ рабочих встречи": ["3+ spotkania w pracy", "3+ work meetings"],
  "Дни с тремя и более рабочими событиями против остальных.": ["Dni z co najmniej trzema wydarzeniami w pracy na tle pozostałych.", "Days with three or more work events versus the rest."],
};
export default d;
