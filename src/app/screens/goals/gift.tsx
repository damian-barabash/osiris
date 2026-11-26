// Копилка на подарок: за 3 недели – 3 месяца до дня рождения или годовщины Оси предлагает начать копить.
// Копилка — обычная цель «деньги» со ссылкой на событие (trackers.event_id) и сроком в день праздника.
// Если накопление отстаёт от ровного темпа, на «Сегодня» появляется мягкое напоминание (на телефон приходит пуш).
import { useState } from "react";
import { tr } from "@/i18n";
import { Appear, Button, Card, Field, Icon, Osi, SheetHeader, openSheet, toast } from "@/ui";
import { store, useStore, type Store } from "../../data/store";
import type { Event, Tracker } from "../../data/models";
import { addDays, dateOnly, day0 } from "../../data/repeat";
import { fmtDay, money } from "../../format";
import { nav } from "../../router";
import { Plans } from "../plans/plans";

/** Событие — день рождения или годовщина (тот же список слов, что на сервере). */
export const BIRTHDAY = /день рожд|(^|[^\p{L}])др([^\p{L}]|$)|днюх|именин|годовщин|юбилей|urodzin|imienin|rocznic|birthday|b-?day|anniversar/iu;
/** То же слово целиком, с окончанием («рождения», «urodziny») — чтобы убрать его из названия копилки. */
const STRIP = /(день\s+рожд|(?<!\p{L})др(?!\p{L})|днюх|именин|годовщин|юбиле|urodzin|imienin|rocznic|birthday|b-?day|anniversar)\p{L}*/giu;
const ASKED = "gift_asked";
const asked = (): string[] => { try { const v = JSON.parse(localStorage.getItem(ASKED) ?? "[]"); return Array.isArray(v) ? v : []; } catch { return []; } };
const markAsked = (key: string) => { try { localStorage.setItem(ASKED, JSON.stringify([...asked().filter((k) => k !== key), key].slice(-200))); } catch { /* */ } };
const daysTo = (d: Date) => Math.round((day0(d).getTime() - day0(new Date()).getTime()) / 86400_000);

/** Ближайший праздник без копилки, про который ещё не спрашивали. */
export function upcomingGift(s: Store): { event: Event; days: number; key: string } | null {
  const from = addDays(day0(new Date()), 21), to = addDays(day0(new Date()), 93);
  const withFund = new Set(s.trackers.filter((t) => !t.archived).map((t) => t.eventId));
  const seen = new Set(asked());
  for (const e of s.eventsBetween(from, to)) {
    const key = `${e.id}:${dateOnly(e.startsAt)}`;
    if (BIRTHDAY.test(e.title) && !e.sharedFrom && !withFund.has(e.id) && !seen.has(key)) return { event: e, days: daysTo(e.startsAt), key };
  }
  return null;
}

/** «Подарок: Маша» из «День рождения Маши» — без самого слова «день рождения». */
const fundTitle = (title: string) => {
  const who = title.replace(STRIP, " ").replace(/[«»"„”:–—-]/g, " ").replace(/(^|\s)(у|of|u)(\s|$)/giu, " ").replace(/\s+/g, " ").trim();
  return who ? tr("Подарок: {0}", [who]) : tr("Подарок");
};

/** Создать копилку на событие. Возвращает id или null (лимит бесплатного плана). */
export async function createGiftFund(e: Event, target: number): Promise<string | null> {
  if (!Plans.allow("trackers")) return null;
  const id = await store.insert("trackers", { title: fundTitle(e.title), kind: "money", target, unit: store.profile?.currency ?? "PLN", deadline: dateOnly(e.startsAt), sphere: "personal", icon: "gift", color: "rose", event_id: e.id });
  return store.tracker(id) ? id : null;
}

function GiftSheet({ e, days, close }: { e: Event; days: number; close: (v?: boolean) => void }) {
  const [step, setStep] = useState(0);
  const [sum, setSum] = useState("");
  const [busy, setBusy] = useState(false);
  const cur = store.profile?.currency ?? "PLN";
  const n = parseFloat(sum.replace(",", ".").replace(/\s/g, ""));
  const weeks = Math.max(1, Math.round(days / 7));
  const save = async () => {
    if (!(n > 0)) return;
    setBusy(true);
    const id = await createGiftFund(e, Math.round(n * 100) / 100);
    setBusy(false);
    close(true);
    if (id) { toast(tr("Копилка создана — загляни в «Цели»")); nav("/goal/" + id); }
  };
  return (
    <div className="gift-sheet">
      <SheetHeader title={tr("Скоро праздник")} sub={`${fmtDay(e.startsAt)} · ${tr("через {0} дн.", [days])}`} close={() => close(false)} />
      <div className="gift-top">
        <Osi size={120} mood={step ? "excited" : "happy"} wave={!step} />
        <p>{step === 0 ? tr("Через {0} дн. — «{1}». Начать копить на подарок заранее?", [days, e.title]) : tr("Сколько хочешь собрать? Я прослежу за темпом и напомню, если начнём отставать.")}</p>
      </div>
      <div key={step} className="slide-in">
        {step === 0 ? (
          <div className="dialog-actions">
            <Button ghost onClick={() => close(false)}>{tr("Не сейчас")}</Button>
            <Button color="orange" icon="gift" onClick={() => setStep(1)}>{tr("Да, копить")}</Button>
          </div>
        ) : (
          <>
            <Field label={tr("Сумма на подарок")} value={sum} onChange={setSum} inputMode="decimal" suffix={cur} autoFocus onEnter={save} />
            {n > 0 && <Appear><p className="gift-hint"><Icon name="trend" size={15} /> {tr("Это примерно {0} в неделю", [money(Math.ceil(n / weeks), cur)])}</p></Appear>}
            <Button expand color="orange" busy={busy} disabled={!(n > 0)} onClick={save}>{tr("Создать копилку")}</Button>
          </>
        )}
      </div>
    </div>
  );
}

/** Показать предложение (про каждый праздник спрашиваем один раз). eventId — открыть для конкретного события. */
export async function offerGift(e: Event, days = daysTo(e.startsAt)): Promise<boolean> {
  markAsked(`${e.id}:${dateOnly(e.startsAt)}`);
  return (await openSheet<boolean>((close) => <GiftSheet e={e} days={days} close={close} />)) === true;
}
/** При входе: если впереди праздник без копилки — спросить. true — лист был показан. */
export async function maybeOfferGift(): Promise<boolean> {
  if (document.querySelector(".sheet-layer")) return false;
  const g = upcomingGift(store);
  if (!g) return false;
  await offerGift(g.event, g.days);
  return true;
}

/** Темп копилки: сколько осталось, за сколько дней и отстаёт ли от ровного накопления (как fundPace на сервере). */
export function fundPace(s: Store, t: Tracker): { left: number; days: number; perWeek: number; behind: boolean; saved: number } | null {
  if (t.kind !== "money" || !t.target || !t.deadline) return null;
  const now = Date.now(), end = t.deadline.getTime() + 12 * 3600_000, start = new Date(t.raw.created_at ?? now).getTime();
  const days = Math.ceil((end - now) / 86400_000);
  if (days <= 0 || end <= start) return null;
  const saved = s.trackerSum(t.id), left = Math.max(0, Math.round(t.target - saved));
  const expected = t.target * Math.min(1, (now - start) / (end - start));
  return { left, days, saved, perWeek: Math.ceil(left / Math.max(1, days / 7)), behind: left > 0 && saved < expected * 0.7 && now - start > 6 * 86400_000 };
}

/** На экране цели: к какому событию привязана копилка и как идёт накопление. */
export function GiftLink({ t }: { t: Tracker }) {
  const s = useStore();
  const e = t.eventId ? s.events.find((x) => x.id === t.eventId) : null;
  const p = fundPace(s, t);
  if (!t.eventId || (!e && !p)) return null;
  return (
    <Card color={p?.behind ? "butter" : null} seed={2} className="gift-link">
      <Icon name="gift" size={20} />
      <div>
        {e && <b>{tr("Копилка к событию «{0}»", [e.title])}</b>}
        {p && <span>{p.left === 0 ? tr("Собрано полностью") : p.behind ? tr("Немного отстаём: осталось {0} за {1} дн. — примерно {2} в неделю", [money(p.left, t.unit ?? "PLN"), p.days, money(p.perWeek, t.unit ?? "PLN")]) : tr("Идём по плану: осталось {0} за {1} дн. — примерно {2} в неделю", [money(p.left, t.unit ?? "PLN"), p.days, money(p.perWeek, t.unit ?? "PLN")])}</span>}
      </div>
    </Card>
  );
}

/** На «Сегодня»: копилки на подарок, которые отстают от темпа. */
export function GiftNudges() {
  const s = useStore();
  const list = s.trackers.filter((t) => !t.archived && t.eventId).map((t) => ({ t, p: fundPace(s, t) })).filter((x) => x.p?.behind);
  if (!list.length) return null;
  return (
    <div className="gift-nudges">
      {list.slice(0, 2).map(({ t, p }, i) => (
        <Appear key={t.id} i={i}>
          <Card color="butter" seed={i + 1} className="gift-nudge" onClick={() => nav("/goal/" + t.id)}>
            <Osi size={54} mood="worried" />
            <div>
              <b>{tr("Копилка «{0}» отстаёт", [t.title])}</b>
              <span>{tr("Осталось {0} за {1} дн. — это примерно {2} в неделю.", [money(p!.left, t.unit ?? "PLN"), p!.days, money(p!.perWeek, t.unit ?? "PLN")])}</span>
            </div>
            <Icon name="right" />
          </Card>
        </Appear>
      ))}
    </div>
  );
}
