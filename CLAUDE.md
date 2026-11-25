# osiris-web — сайт OSIRIS (myosiris.app)

Три части в одном репозитории: **лендинг** (`/`, `/pl/`, `/ru/` + документы), **веб-версия приложения** (`/app/`), **админка** (`/admin/`).
Стек: React 19 + Vite 7 + TypeScript, без UI-библиотек; Supabase (проект Osiris Backend `wdxxxuxsgqsvqdkvbhye`); деплой — GitHub Pages через Actions.

## ⭐ Главное правило

**Обновили приложение OSIRIS — обновили и сайт.** Веб-версия повторяет функционал приложения (`/Volumes/DIAMONCHIK/Project OSIRIS/app`, Flutter). Любая новая функция или правка поведения в приложении переносится сюда в той же сессии; `WEB_VERSION` в `src/config.ts` = версия приложения, с которой сверена веб-версия.

## Команды

- `npm run dev` — разработка (http://localhost:5183/, `/app/`, `/admin/`).
- `npm run build` — типы + сборка + пререндер лендинга. `npx tsc --noEmit` — только типы.
- `npm run i18n` — перечитать переводы приложения из `tool/tr_data.py` в `src/i18n/gen/`.
- `npm run qc` — проверка собранного сайта в headless Chrome (скриншоты в `qc-out/`).

## Структура

```
index.html, app/index.html, admin/index.html   три входа Vite
src/styles/base.css      токены (цвета, кривые анимаций), .paper, .rv, зерно
src/paper/               wobble.ts — «вырезанный ножницами» край; Paper.tsx — PaperSheet, Cutout
src/brand/               Osi.tsx (маскот, 8 настроений), Logo.tsx
src/ui/                  набор интерфейса: kit.tsx, overlays.tsx, icons.tsx, palette.ts, ui.css  → импорт из "@/ui"
src/i18n/                tr(), plural(), L; gen/{pl,en}.json — переводы приложения; web/<раздел>.ts — строки только сайта
src/app/                 веб-версия: main.tsx, sb.ts, router.ts, format.ts, theme.ts, shell/, auth/, data/, widgets/, screens/
src/site/                лендинг, документы, чат-виджет Оси
src/admin/               админка
supabase/ (в репозитории приложения)  миграции и Edge Functions: assistant, smart-push, app-install, site, admin
```

## Веб-версия: правила переноса экранов из приложения

Источник правды — Dart-код приложения: `app/lib/screens/**`, `app/lib/widgets/**`, `app/lib/data/**`. Экран переносится **по смыслу один в один** (те же блоки, тексты, логика, проверки), но раскладка адаптивная: на телефоне (< 900 px) — как в приложении, на ноутбуке — шире: сетки в 2–3 колонки, списки рядом с деталями. Ширина контента ограничена каркасом (`.page`, 1120 px).

**Данные** — `src/app/data/store.ts`:
- `const s = useStore()` — компонент перерисовывается при любом изменении данных. Коллекции: `s.profile, s.clients, s.projects, s.payments, s.tasks, s.events, s.moods, s.trackers, s.stages, s.entries, s.notes, s.chat, s.jobs, s.sessions, s.extras`.
- Запись: `s.insert(table, row)` → id; `s.update(table, id, patch)`; `s.delete(table, id)`; `s.updateMany`, `s.deleteMany`, `s.upsertMany`; `s.updateProfile(patch)`; `s.toggleTask(task)`. Всё оптимистично: экран обновляется сразу. Имена колонок — как в базе (snake_case), время — ISO UTC (`date.toISOString()`), даты без времени — `dateOnly(d)`.
- Справочники и расчёты перенесены из приложения с теми же именами: `s.client(id)`, `s.project(id)`, `s.tracker(id)`, `s.job(id)`, `s.projectsOf`, `s.tasksOf`, `s.paymentsOf`, `s.stagesOf`, `s.entriesOf`, `s.paidOf`, `s.dueOf`, `s.clientDue`, `s.totalDue`, `s.receivedInMonth`, `s.trackerSum`, `s.lastMood`, `s.agenda(day, sphere?)`, `s.eventsOn`, `s.eventsBetween`, `s.deleteOccurrence`, `s.upcomingCritical`, `s.overdue`, `s.running`, `s.sessionsBetween`, `s.rateOf`, `s.extrasBetween`, `s.earned`, `s.extrasEarned`, `s.hoursBetween`, `s.startShift`, `s.stopShift`.
- Модели (`data/models.ts`) — классы с теми же полями, что в Dart (`event.startsAt`, `task.dueAt`, `job.rate` …); сырые строки — `.raw`. Повторения — `data/repeat.ts` (`RepeatRule`, `dateOnly`, `parseDate`, `day0`, `addDays`, `weekday` (1 = пн), `sameDate`, `monthsGen`).
- Прямые запросы к Supabase (RPC, storage, функции) — через `sb` из `src/app/sb.ts`. Функции: `sb.functions.invoke(...)` или `fetch(FN + "/assistant", { headers: { Authorization: "Bearer " + token, apikey } })` для потока SSE.
- Офлайн-очереди в вебе нет (в приложении есть): при ошибке сети запись откатывается и показывается тост.

**Переводы** — ключ = русская строка-шаблон, ровно как в приложении: `tr('Сегодня в плане: {0}.', [n])`, `plural(n, one, few, many)`. Бери строки **дословно из Dart-кода** — тогда перевод pl/en уже есть в `src/i18n/gen/*.json`. Новой строки нет в приложении → добавь её в свой файл `src/i18n/web/<раздел>.ts` как `"Русский": ["Polski", "English"]`. Строку-данные (названия тегов настроения, значения из базы) не оборачивай дважды. Форматы дат и денег — только через `src/app/format.ts` (`money`, `moneyMap`, `fmtDay`, `fmtTime`, `fmtWeekday`, `fmtRelDay`, `fmtHours` …), они учитывают язык.

**Интерфейс** — только из `@/ui` (не изобретать свои кнопки и поля):
- `Card` (бумажный лист: `color` — имя из палитры или hex, `seed`, `onClick`), `Pill`, `Button` (`color`, `ghost`, `danger`, `busy`, `small`, `expand`), `RoundButton`, `Switch`, `Check`, `Tag`, `ImportantTag`, `SectionTitle`, `ScreenHeader` (`back`), `Field`, `ChoiceRow`, `Row`, `ColorChoice`, `IconChoice`, `DateTimeRow`, `EmptyState`, `Progress`, `CountUp`, `CountBadge`.
- Движение: `SlideSwitcher` (смена дня/недели/месяца/вкладки с направлением), `Appear` (появление лесенкой), `Collapse` (раскрытие по высоте). **Ничто не появляется и не исчезает мгновенно**: списки — `Appear`, блоки — `Collapse`, переключения — `SlideSwitcher`, состояние — `transition` в CSS. Кривые: `var(--ease-out)`, `var(--ease-back)`, `var(--ease-io)`.
- Окна: `openSheet((close) => <…/>, { wide?, side? })` → Promise с результатом (лист снизу на телефоне, окно по центру или панель справа на ноутбуке); внутри — `SheetHeader` (`title`, `action`, `onAction`, `close`). `confirm(title, { text, action })` → boolean. `choose(title, options)` → значение. `toast(text, 'error'?)`.
- Значки: `<Icon name="…" />` — имена как в приложении (`briefcase`, `coin` …) плюс служебные (см. `icons.tsx`); нужного нет — добавь в `MAP` из `lucide-react`. **Эмодзи в интерфейсе запрещены** — только значки, `Cutout` и Оси (`<Osi mood="happy|excited|listening|thinking|calm|sad|sleepy|worried" size wave />`).
- Цвета: `colorOf(name)`, `onColor(hex)`, `sphereColor('work'|'personal')` (работа — teal, личное — orange), CSS-переменные `--paper, --card, --ink, --ink-soft, --ink-faint, --line, --orange …`. Тёмная тема — те же переменные; **не хардкодь** цвета текста и фона, кроме цветных листов.
- Стили — обычный CSS рядом с экраном (`TodayScreen.css`, импорт из компонента), классы с префиксом раздела (`.today-…`, `.cal-…`), без CSS-in-JS библиотек. Телефон — `@media (max-width: 899px)`.

**Навигация** — `src/app/router.ts`: `nav('/client/' + id)`, `back('/work')`, `useRoute()` → `{ path, parts, query }`. Маршруты: `/` (сегодня), `/calendar`, `/work` (Проекты или Часы по `profile.hoursTab`), `/projects`, `/hours`, `/client/:id`, `/project/:id`, `/goals`, `/goal/:id`, `/chat`, `/friends`, `/friend/:id`, `/notes`, `/mood`, `/settings`. Экран — `export default function XScreen()` в файле, который уже лежит заглушкой.

**Контракты между разделами** — файлы-заглушки с пометкой `ЗАГЛУШКА` и готовыми сигнатурами. Владелец раздела заменяет тело, **не меняя имена и сигнатуры экспорта** (можно добавлять новые экспорты и необязательные поля). Чужие контракты можно вызывать уже сейчас — они заработают, когда владелец закончит:
`widgets/AgendaCard.tsx` (календарь) · `screens/calendar/eventEditor.tsx` · `screens/projects/editors.tsx` · `screens/goals/trackerEditor.tsx` · `screens/hours/editors.tsx` · `screens/notes/noteEditor.tsx` · `screens/mood/moodSheet.tsx` · `screens/capture/capture.tsx` · `screens/plans/plans.tsx` · `screens/onboarding/Onboarding.tsx` · `screens/checkin.tsx` · `data/friends.ts` · `data/assistant.ts`. Аватар — `widgets/Avatar.tsx` (`PaperAvatar`, `AvatarView`, `avatarUrl`).

**Не переносится в веб** (нет в браузере): Face ID, виджеты iOS, Siri и кнопка действия, локальные уведомления и пуши, OTA-обновления, офлайн-очередь. Голос — через Web Speech API, если браузер умеет (`L.speechLocale`), иначе кнопка скрыта.

**Безопасность:** никакого `dangerouslySetInnerHTML` и `innerHTML`; текст пользователя и ответы Оси выводятся как текст (жирный `**…**` — разбором в React-узлы); ссылки наружу — `rel="noopener"`; секретов в коде нет (в клиенте только publishable-ключ).

## Проверка своей работы

`npx tsc --noEmit` должен проходить без ошибок в твоих файлах. Править можно только файлы своего раздела и свой `src/i18n/web/<раздел>.ts`; общие файлы (`src/ui/**`, `store.ts`, `models.ts`, `router.ts`, `Shell.tsx`, `base.css`) — не трогать, недостающее опиши в итоговом отчёте (исключение: новый значок в `MAP` файла `src/ui/icons.tsx`).

## Лендинг, сервер, админка

- **Лендинг** (`src/site/`): `content.ts` — все тексты на en/pl/ru; `Landing.tsx` — секции; `Chrome.tsx` — шапка и подвал; `Site.tsx` — корень, документы, 404, баннер cookies; `ChatWidget.tsx` — чат Оси (2 вопроса с адреса, дальше окно «создай аккаунт»); `legal.{pl,en,ru}.ts` — документы (польская версия главная); `seo.ts` — title, description, hreflang, OG, JSON-LD. Страницы пререндерятся: `/`, `/pl/`, `/ru/` и `…/terms/`, `…/privacy/`, `…/cookies/`.
- **Сервер** — в репозитории приложения: `supabase/migrations/0018_web.sql`, функции `site` (посещения, ошибки, лист ожидания, гостевой чат; защита от инъекций — `site/guard.ts`, знания Оси — `site/kb.ts`) и `admin`. Деплой: `npx supabase@latest functions deploy <имя> --remote=wdxxxuxsgqsvqdkvbhye --use-api --yes --no-verify-jwt`. При новой функции приложения, заметной снаружи, — дописать её в `kb.ts` и в `content.ts`.
- **Админка** (`src/admin/main.tsx`): свои учётные записи (таблица `admins`), не аккаунты приложения. Разделы: обзор, пользователи, трафик, ошибки, чат Оси, версии, лист ожидания, админы.
- **Картинки**: `node scripts/assets.mjs` после сборки пересоздаёт значки и OG-картинки (снимки героя лендинга), затем ещё раз `npm run build`.
- **Проверка**: `npm run build && SVC=<service_role> ADMIN_EMAIL=… ADMIN_PASS=… node scripts/qc.mjs` — создаёт временный аккаунт с данными, проходит все экраны на ноутбуке и телефоне, удаляет аккаунт по id.
- **Деплой**: push в `main` → GitHub Actions (`.github/workflows/deploy.yml`) → GitHub Pages, домен `myosiris.app` (`public/CNAME`).
