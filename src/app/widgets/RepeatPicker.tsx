// Выбор повторения: пресеты + дни недели + «до какого числа» — порт app/lib/widgets/repeat_picker.dart.
import { tr } from "@/i18n";
import { ChoiceRow, Collapse, DateTimeRow, Icon, choose } from "@/ui";
import { RepeatRule, weekday } from "../data/repeat";
import "./RepeatPicker.css";

type Preset = "none" | "daily" | "weekdays" | "weekly" | "biweekly" | "monthly" | "yearly" | "custom";

function presetOf(r: RepeatRule | null): Preset {
  if (!r) return "none";
  if (r.freq === "daily" && r.interval === 1) return "daily";
  if (r.freq === "weekly" && r.interval === 1 && r.days.length === 5 && r.days.every((d) => d <= 5)) return "weekdays";
  if (r.freq === "weekly" && r.interval === 1) return "weekly";
  if (r.freq === "weekly" && r.interval === 2) return "biweekly";
  if (r.freq === "monthly" && r.interval === 1) return "monthly";
  if (r.freq === "yearly" && r.interval === 1) return "yearly";
  return "custom";
}

export function RepeatPicker({ value: r, start, onChange }: { value: RepeatRule | null; start: Date; onChange: (v: RepeatRule | null) => void }) {
  const p = presetOf(r);
  const wd = [tr("Пн"), tr("Вт"), tr("Ср"), tr("Чт"), tr("Пт"), tr("Сб"), tr("Вс")];
  const make = (v: Preset): RepeatRule | null => {
    const until = r?.until ?? null;
    switch (v) {
      case "daily": return new RepeatRule("daily", 1, [], until);
      case "weekdays": return new RepeatRule("weekly", 1, [1, 2, 3, 4, 5], until);
      case "weekly": return new RepeatRule("weekly", 1, [weekday(start)], until);
      case "biweekly": return new RepeatRule("weekly", 2, [weekday(start)], until);
      case "monthly": return new RepeatRule("monthly", 1, [], until);
      case "yearly": return new RepeatRule("yearly", 1, [], until);
      default: return null;
    }
  };
  const options: [Preset, string, (string | null)?][] = [
    ["none", tr("Нет")], ["daily", tr("Каждый день")], ["weekdays", tr("По будням")], ["weekly", tr("Каждую неделю")], ["biweekly", tr("Раз в 2 недели")], ["monthly", tr("Каждый месяц")], ["yearly", tr("Каждый год")],
  ];
  if (p === "custom" && r) options.push(["custom", r.describe(start), "orange"]);
  const weekly = !!r && r.freq === "weekly";
  const cur = r && r.days.length ? r.days : [weekday(start)];
  const toggle = (d: number) => {
    if (!r) return;
    const next = new Set(cur);
    if (!next.delete(d)) next.add(d);
    if (!next.size) return;
    onChange(new RepeatRule("weekly", r.interval, [...next].sort((a, b) => a - b), r.until, r.count));
  };
  return (
    <div className="rp">
      <ChoiceRow<Preset> label={tr("Повтор")} value={p} options={options} onChange={(v) => { if (v !== "custom") onChange(make(v)); }} />
      <Collapse open={weekly}>
        <div className="rp-days" inert={!weekly}>
          {[1, 2, 3, 4, 5, 6, 7].map((d) => (
            <button key={d} type="button" className={`rp-day${cur.includes(d) ? " on" : ""}`} aria-pressed={cur.includes(d)} onClick={() => toggle(d)}>{wd[d - 1]}</button>
          ))}
        </div>
      </Collapse>
      <Collapse open={!!r}>
        <div inert={!r}>
          <DateTimeRow label={tr("Повторять до")} value={r?.until ?? null} withTime={false} clearable
            onChange={(v) => { if (r) onChange(v == null ? r.copyWith({ clearUntil: true }) : r.copyWith({ until: new Date(v.getFullYear(), v.getMonth(), v.getDate()) })); }} />
          {r && <div className="rp-desc"><Icon name="repeat" size={13} />{r.describe(start)}</div>}
        </div>
      </Collapse>
    </div>
  );
}

export type RepeatScope = "this" | "following" | "all";

/** «Только это / Это и следующие / Вся серия». undefined — передумал. */
export function askRepeatScope(del: boolean): Promise<RepeatScope | undefined> {
  return choose<RepeatScope>(del ? tr("Удалить повторяющееся событие") : tr("Изменить повторяющееся событие"), [
    { value: "this", label: tr("Только это") },
    { value: "following", label: tr("Это и следующие") },
    { value: "all", label: tr("Вся серия"), danger: del },
  ]);
}
