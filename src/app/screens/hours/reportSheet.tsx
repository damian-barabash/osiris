// Лист «Рапорт» — порт app/lib/screens/hours/report_sheet.dart:
// работа, период, что показывать → PDF (скачать / поделиться / открыть и распечатать).
import { useMemo, useState } from "react";
import { plural, tr } from "@/i18n";
import { Button, Card, ChoiceRow, Collapse, DateTimeRow, Field, Row, SheetHeader, Switch, colorOf, openSheet, toast } from "@/ui";
import { addDays, day0 } from "../../data/repeat";
import { useStore } from "../../data/store";
import { fmtDayShort, fmtMonthYear, money } from "../../format";
import { ReportData, isWholeMonth } from "./reportData";
import { fmtHoursText } from "./util";
import "./hours.css";

/** from — начало периода на экране, to — конец, не включая. */
export function showReportSheet({ from, to }: { from: Date; to: Date }): Promise<void> {
  return openSheet((close) => <ReportSheet from={from} to={to} close={() => close()} />).then(() => undefined);
}

// Настройки рапорта запоминаются под теми же ключами, что в приложении (SharedPreferences): report_* и report_to_<jobId>.
const pref = {
  bool(key: string, fallback: boolean) { try { const v = localStorage.getItem(key); return v == null ? fallback : v === "true"; } catch { return fallback; } },
  str(key: string) { try { return localStorage.getItem(key) ?? ""; } catch { return ""; } },
  set(key: string, v: string | boolean) { try { localStorage.setItem(key, String(v)); } catch { /* приватный режим */ } },
};

const periodTitle = (from: Date, to: Date) => (isWholeMonth(from, to) ? fmtMonthYear(from) : `${fmtDayShort(from)} – ${fmtDayShort(addDays(to, -1))}`);

/** Умеет ли браузер отдавать файлы в системное «Поделиться». */
function canShareFiles(): boolean {
  try { return typeof navigator !== "undefined" && !!navigator.canShare?.({ files: [new File(["%PDF"], "a.pdf", { type: "application/pdf" })] }); } catch { return false; }
}

function saveFile(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

type Period = "screen" | "prev" | "custom";
type Action = "download" | "share" | "print";

function ReportSheet({ from, to, close }: { from: Date; to: Date; close: () => void }) {
  const s = useStore();
  const [jobId, setJobId] = useState<string | null>(() => s.jobs.find((j) => !j.archived)?.id ?? null);
  const [period, setPeriod] = useState<Period>("screen");
  const [cFrom, setCFrom] = useState(from);
  const [cTo, setCTo] = useState(() => addDays(to, -1)); // включительно
  const [showMoney, setShowMoney] = useState(() => pref.bool("report_money", true));
  const [sign, setSign] = useState(() => pref.bool("report_sign", true));
  const [allDays, setAllDays] = useState(() => pref.bool("report_all_days", true));
  const [worker, setWorker] = useState(() => pref.str("report_worker") || s.profile?.name || "");
  const [recipient, setRecipient] = useState(() => pref.str(`report_to_${jobId}`));
  const [busy, setBusy] = useState<Action | null>(null);
  const share = useMemo(canShareFiles, []);

  const isMonth = from.getDate() === 1 && to.getDate() === 1;
  const prev: [Date, Date] = isMonth ? [new Date(from.getFullYear(), from.getMonth() - 1, 1), from] : [addDays(from, -7), from];
  const range: [Date, Date] = (() => {
    if (period === "prev") return prev;
    if (period === "custom") {
      const a = day0(cFrom), b = addDays(day0(cTo), 1);
      return b > a ? [a, b] : [a, addDays(a, 1)];
    }
    return [from, to];
  })();

  const jobs = s.jobs.filter((j) => !j.archived || j.id === jobId);
  const job = s.job(jobId);
  const d = job
    ? new ReportData({
        job, from: range[0], to: range[1],
        sessions: s.sessionsBetween(range[0], range[1], job.id).filter((x) => !x.running),
        extras: s.extrasBetween(range[0], range[1], job.id),
        rateOf: s.rateOf, worker: worker.trim(), recipient: recipient.trim(), showMoney, signatures: sign, allDays,
      })
    : null;
  const running = !!d && s.running.some((x) => x.jobId === d.job.id && x.start >= d.from && x.start < d.to);

  const remember = () => {
    pref.set("report_money", showMoney);
    pref.set("report_sign", sign);
    pref.set("report_all_days", allDays);
    pref.set(`report_to_${jobId}`, recipient.trim());
    pref.set("report_worker", worker.trim());
  };

  const go = async (action: Action) => {
    if (busy) return;
    if (!d) return toast(tr("Сначала добавь работу"));
    if (!d.sessions.length && !d.extras.length) return toast(tr("За этот период нет ни смен, ни заданий"));
    // окно для просмотра открываем сразу, по нажатию: после ожидания браузер его заблокирует
    const win = action === "print" ? window.open("", "_blank") : null;
    setBusy(action);
    remember();
    try {
      const { buildReportPdf } = await import("./reportPdf");
      const bytes = await buildReportPdf(d);
      const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
      if (action === "print") {
        if (win) win.location.href = URL.createObjectURL(blob);
        else { saveFile(blob, d.fileName); toast(tr("Браузер не дал открыть новую вкладку — PDF скачан")); }
      } else if (action === "share") {
        try {
          await navigator.share({ files: [new File([blob], d.fileName, { type: "application/pdf" })], title: d.fileName.replace(/\.pdf$/, "") });
        } catch (e) {
          if ((e as Error)?.name !== "AbortError") saveFile(blob, d.fileName); // не вышло поделиться — хотя бы скачать
        }
      } else saveFile(blob, d.fileName);
    } catch (e) {
      win?.close();
      toast(tr("Не получилось сделать PDF: {0}", [(e as Error)?.message ?? e]), "error");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="hrs-editor">
      <SheetHeader title={tr("Рапорт")} sub={tr("PDF для работодателя: график, часы и задания")} close={close} />
      {jobs.length > 1 && (
        <ChoiceRow<string | null> label={tr("Работа")} value={jobId} options={jobs.map((j) => [j.id, j.name, colorOf(j.color, "teal")])}
          onChange={(v) => { setJobId(v); setRecipient(pref.str(`report_to_${v}`)); }} />
      )}
      <ChoiceRow<Period> label={tr("Период")} value={period} onChange={setPeriod}
        options={[["screen", periodTitle(from, to), null], ["prev", periodTitle(prev[0], prev[1]), null], ["custom", tr("Свой период"), null]]} />
      <Collapse open={period === "custom"}>
        <div className="hrs-custom">
          <DateTimeRow label={tr("С")} value={cFrom} withTime={false} onChange={(v) => v && setCFrom(v)} />
          <DateTimeRow label={tr("По")} value={cTo} withTime={false} onChange={(v) => v && setCTo(v)} />
        </div>
      </Collapse>
      <Field label={tr("Работник")} hint={tr("Имя и фамилия")} value={worker} onChange={setWorker} name="name" autoComplete="name" maxLength={80} />
      <Field label={tr("Для кого (необязательно)")} hint={tr("Фирма или начальник")} value={recipient} onChange={setRecipient} maxLength={140} />
      <div className="hrs-toggles">
        <Row title={tr("Показывать суммы")} sub={tr("Ставка, деньги за дни и итог к оплате")}><Switch value={showMoney} onChange={setShowMoney} label={tr("Показывать суммы")} /></Row>
        <Row title={tr("Все дни периода")} sub={tr("Пустые дни тоже — как настоящий график")}><Switch value={allDays} onChange={setAllDays} label={tr("Все дни периода")} /></Row>
        <Row title={tr("Место для подписей")} sub={tr("Работник, работодатель, дата")}><Switch value={sign} onChange={setSign} label={tr("Место для подписей")} /></Row>
      </div>
      {d && (
        <Card color="butter" seed={31} padding="12px 16px" className="hrs-report-total">
          <b>
            {[
              fmtHoursText(d.hours),
              `${d.workDays} ${plural(d.workDays, tr("день"), tr("дня"), tr("дней"))}`,
              ...(d.extras.length ? [`${d.extras.length} ${plural(d.extras.length, tr("задание"), tr("задания"), tr("заданий"))}`] : []),
            ].join(" · ")}
          </b>
          <Collapse open={showMoney}><span>{tr("К оплате: {0}", [money(d.hoursMoney + d.extrasMoney, d.job.currency)])}</span></Collapse>
          <Collapse open={running}><small>{tr("Идущая смена в рапорт не попадёт, пока её не закончишь.")}</small></Collapse>
        </Card>
      )}
      <div className="hrs-report-actions">
        <Button expand icon="download" busy={busy === "download"} disabled={!!busy} onClick={() => void go("download")}>{tr("Скачать PDF")}</Button>
        {share && <Button expand ghost icon="share" busy={busy === "share"} disabled={!!busy} onClick={() => void go("share")}>{tr("Отправить или сохранить PDF")}</Button>}
        <Button expand ghost icon="printer" busy={busy === "print"} disabled={!!busy} onClick={() => void go("print")}>{tr("Посмотреть и распечатать")}</Button>
      </div>
    </div>
  );
}
