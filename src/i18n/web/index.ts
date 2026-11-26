// Строки, которых нет в приложении (только веб-версия): ключ — русский, значения — [pl, en].
// У каждого раздела свой файл, чтобы правки не пересекались.
import core from "./core";
import today from "./today";
import calendar from "./calendar";
import work from "./work";
import hours from "./hours";
import goals from "./goals";
import chat from "./chat";
import social from "./social";
import mood from "./mood";
import settings from "./settings";
import account from "./account";

export const WEB: Record<string, [string, string]> = { ...core, ...today, ...calendar, ...work, ...hours, ...goals, ...chat, ...social, ...mood, ...settings, ...account };
