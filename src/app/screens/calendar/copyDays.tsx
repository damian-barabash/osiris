// Выбор дней, куда скопировать событие — порт app/lib/screens/calendar/copy_days_sheet.dart.
import { useState } from "react";
import { plural, tr } from "@/i18n";
import { Button, Card, Icon, SheetHeader, SlideSwitcher, openSheet } from "@/ui";
import { useStore } from "../../data/store";
import { dateOnly, parseDate, sameDate } from "../../data/repeat";
import { fmtDay } from "../../format";
import { MonthSwitcher, daysIn, leadOf, monthStart, useSwipe, weekdayNames, ymKey } from "./parts";

/** Возвращает выбранные дни (без времени, по порядку) или undefined. */
export function showCopyDays(o: { source: Date; title: string }): Promise<Date[] | undefined> {
  return openSheet<Date[]>((close) => <CopyDaysSheet {...o} close={close} />);
}

function CopyDaysSheet({ source, title, close }: { source: Date; title: string; close: (v?: Date[]) => void }) {
  const s = useStore();
  const [month, setMonth] = useState(() => monthStart(source));
  const [picked, setPicked] = useState<Set<string>>(() => new Set());
  const [dir, setDir] = useState(1);
  const shift = (d: number) => { setDir(Math.sign(d)); setMonth((m) => new Date(m.getFullYear(), m.getMonth() + d, 1)); };
  const swipe = useSwipe(shift);
  const toggle = (day: Date) => setPicked((old) => { const next = new Set(old); const k = dateOnly(day); if (!next.delete(k)) next.add(k); return next; });
  const n = picked.size;
  const lead = leadOf(month), days = daysIn(month), now = new Date();
  const dayWord = plural(n, tr("день"), tr("дня"), tr("дней"));
  return (
    <div className="cal-copy">
      <SheetHeader title={tr("Копировать")} sub={tr("«{0}» — выбери дни, событие появится в каждом", [title])} close={() => close()} />
      <MonthSwitcher month={month} dir={dir} onShift={shift} small />
      <div className="cal-swipe cal-clip" {...swipe}>
        <SlideSwitcher k={ymKey(month)} dir={dir}>
          <Card seed={91} padding="12px 8px 8px">
            <div className="cal-wd">{weekdayNames().map((w) => <span key={w}>{w}</span>)}</div>
            <div className="cal-copy-grid">
              {Array.from({ length: lead }, (_, i) => <span key={"l" + i} />)}
              {Array.from({ length: days }, (_, i) => {
                const day = new Date(month.getFullYear(), month.getMonth(), i + 1);
                const on = picked.has(dateOnly(day));
                const busy = s.agenda(day).length > 0;
                const cls = ["cal-pick", on && "on", sameDate(day, now) && "today", sameDate(day, source) && "source"].filter(Boolean).join(" ");
                return (
                  <button key={i} type="button" className={cls} aria-pressed={on} aria-label={fmtDay(day)} onClick={() => toggle(day)}>
                    <b>{i + 1}</b>
                    <span className="cal-pick-mark">{on ? <Icon name="tick" size={10} strokeWidth={3.2} /> : busy ? <i /> : null}</span>
                  </button>
                );
              })}
            </div>
          </Card>
        </SlideSwitcher>
      </div>
      <div className="cal-copy-foot">
        <span>{n === 0 ? tr("Дни не выбраны") : tr("Выбрано: {0} {1}", [n, dayWord])}</span>
        <button type="button" className={`cal-link${n > 0 ? "" : " off"}`} disabled={n === 0} onClick={() => setPicked(new Set())}>{tr("Сбросить")}</button>
      </div>
      <Button expand icon="copy" disabled={n === 0} onClick={() => close([...picked].sort().map(parseDate))}>{n === 0 ? tr("Добавить") : tr("Добавить ({0})", [n])}</Button>
    </div>
  );
}
