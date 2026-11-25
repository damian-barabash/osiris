// Импорт: показать, что из файла перенесётся, и перенести — порт app/lib/screens/settings/import_sheet.dart.
import { useMemo, useState } from "react";
import { tr } from "@/i18n";
import { Appear, Button, Card, Collapse, Osi, SectionTitle, SheetHeader, SlideSwitcher, Switch, Row, openSheet, toast } from "@/ui";
import { store } from "../../data/store";
import { fmtDay, fmtTime } from "../../format";
import "./SettingsScreen.css";
import { ImportError, buildImportRows, isPast, parseImport, type ImportItem, type ImportPlan } from "./importer";

const errText = (e: unknown) => (e instanceof ImportError ? tr(e.message) : String((e as { message?: string })?.message ?? e));

/** Прочитать выбранный файл и показать, что из него перенесётся. */
export async function startImport(file: File): Promise<void> {
  let plan: ImportPlan;
  try {
    plan = parseImport(await file.text());
  } catch (e) {
    toast(tr("Не получилось прочитать файл: {0}", [errText(e)]), "error");
    return;
  }
  if (!plan.items.length) {
    toast(tr("В файле не нашлось дел с названием и датой"), "error");
    return;
  }
  await openSheet<void>((close) => <ImportSheet plan={plan} fileName={file.name} close={() => close()} />);
}

function ImportSheet({ plan, fileName, close }: { plan: ImportPlan; fileName: string; close: () => void }) {
  const [history, setHistory] = useState(false); // перенести и прошедшее
  const [routine, setRoutine] = useState(false); // «Подъём» и «Сон» из Structured
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<number | null>(null);

  const today = useMemo(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); }, []);
  const all = plan.items;
  const future = useMemo(() => all.filter((x) => !isPast(x, today)), [all, today]);
  const past = all.length - future.length;
  const routines = useMemo(() => all.filter((x) => x.routine).length, [all]);
  const chosen = useMemo(() => all.filter((x) => (history || !isPast(x, today)) && (routine || !x.routine)), [all, today, history, routine]);
  const ev = chosen.filter((x) => !x.task || x.repeat).length;
  const tk = chosen.length - ev;
  const rep = chosen.filter((x) => x.repeat).length;
  const upto = future.length ? future.reduce((a, x) => (x.start > a ? x.start : a), future[0].start) : null;
  const nearest = chosen.filter((x) => !isPast(x, today)).slice(0, 5);

  const run = async () => {
    const uid = store.userId;
    if (!uid || busy) return;
    setBusy(true);
    const items = chosen;
    try {
      const { events, tasks } = await buildImportRows(items, uid);
      await store.upsertMany("events", events);
      await store.upsertMany("tasks", tasks);
      setDone(items.length);
    } catch (e) {
      // ошибку сервера показывает само хранилище (тост каркаса) — второй раз не дублируем
      if (!store.error) toast(tr("Ошибка: {0}", [errText(e)]), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SlideSwitcher k={done == null ? "plan" : "done"}>
      {done != null ? (
        <div className="imp-done">
          <SheetHeader title={tr("Готово")} close={close} />
          <Osi size={120} mood="excited" />
          <h3>{tr("Перенёс {0}. Всё уже в календаре — загляни во вкладку «Календарь».", [done])}</h3>
          <p>{tr("Если импортировать этот файл ещё раз — дела обновятся, копий не будет.")}</p>
          <Button expand color="orange" onClick={close}>{tr("Отлично")}</Button>
        </div>
      ) : (
        <div className="imp">
          <SheetHeader title={tr("Импорт: {0}", [tr(plan.source)])} sub={fileName} close={close} />
          <Card color="butter" seed={44} className="imp-found">
            <Osi size={64} mood="happy" />
            <div>
              <b>{tr("Нашёл {0}", [all.length])}</b>
              <span>
                {[
                  tr("впереди: {0}", [future.length]),
                  ...(upto ? [tr("до {0}", [fmtDay(upto)])] : []),
                  ...(past > 0 ? [tr("в прошлом: {0}", [past])] : []),
                ].join(" · ")}
              </span>
            </div>
          </Card>

          <SectionTitle>{tr("Что перенести")}</SectionTitle>
          <Row title={tr("История")} sub={tr("Прошедшие дела ({0}) — выполненные будут отмечены", [past])}>
            <Switch value={history} onChange={setHistory} disabled={past === 0 || busy} label={tr("История")} />
          </Row>
          {routines > 0 && (
            <Row title={tr("Подъём и сон")} sub={tr("Ежедневные «Проснись» и «Иди спать» из Structured ({0})", [routines])}>
              <Switch value={routine} onChange={setRoutine} disabled={busy} label={tr("Подъём и сон")} />
            </Row>
          )}
          <p className="imp-counts" aria-live="polite">
            {[
              tr("В календарь: {0}", [ev]),
              tr("задач с галочкой: {0}", [tk]),
              ...(rep > 0 ? [tr("повторов: {0}", [rep])] : []),
              ...(plan.ignored > 0 ? [tr("не понял: {0}", [plan.ignored])] : []),
            ].join(" · ")}
          </p>

          <Collapse open={nearest.length > 0}>
            <div className="imp-near">
              <SectionTitle>{tr("Ближайшие")}</SectionTitle>
              {nearest.map((x, i) => <Appear key={x.sourceId} i={i}><ItemRow x={x} seed={i} /></Appear>)}
            </div>
          </Collapse>

          <div className="imp-go">
            <Button expand color="orange" icon="download" busy={busy} disabled={!chosen.length} onClick={() => void run()}>{tr("Перенести {0}", [chosen.length])}</Button>
          </div>
          <p className="imp-note">{tr("Всё попадёт в «Личное». Повторный импорт того же файла обновит дела, а не задвоит их.")}</p>
        </div>
      )}
    </SlideSwitcher>
  );
}

function ItemRow({ x, seed }: { x: ImportItem; seed: number }) {
  const when = x.allDay ? fmtDay(x.start) : `${fmtDay(x.start)}, ${fmtTime(x.start)}${x.end ? `–${fmtTime(x.end)}` : ""}`;
  return (
    <Card color={x.color} seed={seed} lift={2} padding="9px 12px" className="imp-row">
      <b>{x.title}</b>
      <span>{when}</span>
    </Card>
  );
}
