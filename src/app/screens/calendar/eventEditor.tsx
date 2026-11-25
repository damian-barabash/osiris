// Редактор события — порт app/lib/screens/calendar/event_editor.dart.
// Новое или существующее; у повторения спрашивает «только это / и следующие / вся серия».
import { useState } from "react";
import { plural, tr } from "@/i18n";
import { Button, Card, ChoiceRow, Collapse, ColorChoice, DateTimeRow, Field, Icon, Pill, Row, SheetHeader, Switch, confirm, openSheet, toast } from "@/ui";
import type { Event, Row as DbRow, Sphere } from "../../data/models";
import { store, useStore } from "../../data/store";
import { friends, useFriends } from "../../data/friends";
import { RepeatRule, dateOnly, day0, sameDate } from "../../data/repeat";
import { RepeatPicker, askRepeatScope, type RepeatScope } from "../../widgets/RepeatPicker";
import { showCopyDays } from "./copyDays";
import "./calendar.css";

type Opts = { event?: Event; day?: Date; clientId?: string; projectId?: string };

/** Редактор события (новое или существующее; у повторения спрашивает «только это / и следующие / вся серия»). */
export function showEventEditor(o: Opts = {}): Promise<void> {
  return openSheet<void>((close) => <EventEditor {...o} close={() => close()} />, { side: true }).then(() => undefined);
}

function defaultStart(day?: Date): Date {
  const now = new Date();
  const d = day ?? now;
  const h = sameDate(d, now) ? Math.min(23, Math.max(0, now.getHours() + 1)) : 10;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), h);
}

/** Варианты «Напомнить»: null — нет, 0 — в момент начала (минуты хранятся как в приложении). */
export const remindOptions = (): [number | null, string][] => [[null, tr("Нет")], [0, tr("В момент")], [5, tr("5 мин")], [15, tr("15 мин")], [30, tr("30 мин")], [60, tr("Час")], [1440, tr("За день")]];

/** Приглашения уходят после закрытия редактора (событие к этому моменту уже на сервере). */
async function sendInvites(id: string, ids: string[]) {
  try {
    // у друзей есть вариант, который возвращает текст ошибки (как в приложении); inviteToEvent показывает её сам
    const withResult = (friends as typeof friends & { invite2event?: (eventId: string, friendIds: string[]) => Promise<string | null> }).invite2event;
    if (withResult) {
      const err = await withResult(id, ids);
      if (err) return toast(err, "error");
    } else await friends.inviteToEvent(id, ids);
    toast(tr("Позвали: {0}", [friends.accepted.filter((f) => ids.includes(f.id)).map((f) => f.name).join(", ")]));
  } catch (err) {
    toast(String((err as Error)?.message ?? err), "error");
  }
}

function EventEditor({ event: e, day, clientId: client0, projectId: project0, close }: Opts & { close: () => void }) {
  const s = useStore();
  const fr = useFriends(); // статусы приглашений меняются в реальном времени (друг принял / отказался)
  const [title, setTitle] = useState(e?.title ?? "");
  const [location, setLocation] = useState(e?.location ?? "");
  const [notes, setNotes] = useState(e?.notes ?? "");
  const [start, setStart] = useState<Date>(() => e?.startsAt ?? defaultStart(day));
  const [end, setEnd] = useState<Date | null>(e?.endsAt ?? null);
  const [allDay, setAllDay] = useState(e?.allDay ?? false);
  const [sphere, setSphere] = useState<Sphere>(e?.sphere ?? "work");
  const [important, setImportant] = useState(e?.important ?? false);
  const [clientId, setClientId] = useState<string | null>(e?.clientId ?? client0 ?? null);
  const [projectId, setProjectId] = useState<string | null>(e?.projectId ?? project0 ?? null);
  const [color, setColor] = useState<string | null>(e?.color ?? null);
  const [remind, setRemind] = useState<number | null>(() => (e ? e.remindMinutes : s.profile?.remindDefault ?? null));
  const [repeat, setRepeat] = useState<RepeatRule | null>(e?.repeat ?? null);
  const [invite, setInvite] = useState<Set<string>>(() => new Set()); // кого позвать при сохранении (id друзей)
  const [busy, setBusy] = useState(false);

  const row = (): DbRow => ({
    title: title.trim(),
    location: location.trim() || null,
    notes: notes.trim(),
    starts_at: (allDay ? day0(start) : start).toISOString(),
    ends_at: allDay || !end ? null : end.toISOString(),
    all_day: allDay,
    sphere,
    priority: important ? "important" : "normal",
    client_id: clientId,
    project_id: projectId,
    color,
    remind_minutes: remind,
    repeat: repeat?.toJson() ?? null,
  });

  /** Правка одного раза серии: только он / он и дальше / вся серия. */
  async function saveOccurrence(scope: RepeatScope, r: DbRow) {
    const occ = e!;
    const occDay = occ.occurrence!;
    const single = { ...r, repeat: null, repeat_skip: [] as string[] };
    if (scope === "this") {
      await s.update("events", occ.id, { repeat_skip: [...new Set([...occ.skip, dateOnly(occDay)])] });
      await s.insert("events", single);
    } else if (scope === "following") {
      await s.deleteOccurrence(occ, "future");
      await s.insert("events", { ...r, repeat_skip: [], ...(repeat ? { repeat: new RepeatRule(repeat.freq, repeat.interval, repeat.days, repeat.until).toJson() } : {}) });
    } else {
      if (!repeat) { await s.update("events", occ.id, single); return; }
      // сдвиг, который сделали у этого раза, переносим на начало серии
      const shift = start.getTime() - occ.startsAt.getTime();
      const st = allDay ? day0(occ.seriesStart) : new Date(occ.seriesStart.getTime() + shift);
      const dur = end ? end.getTime() - start.getTime() : null;
      await s.update("events", occ.id, { ...r, starts_at: st.toISOString(), ends_at: allDay || dur == null ? null : new Date(st.getTime() + dur).toISOString() });
    }
  }

  async function save() {
    if (busy) return;
    if (!title.trim()) return toast(tr("Как назовём событие?"));
    setBusy(true);
    const r = row();
    try {
      let id: string | undefined = e?.id;
      if (!e) id = await s.insert("events", r);
      else if (e.occurrence && e.repeat) {
        const scope = await askRepeatScope(false);
        if (!scope) return setBusy(false);
        await saveOccurrence(scope, r);
      } else await s.update("events", e.id, r);
      close();
      if (invite.size && id) void sendInvites(id, [...invite]);
    } catch (err) {
      setBusy(false);
      toast(tr("Ошибка: {0}", [String((err as Error)?.message ?? err)]), "error");
    }
  }

  /** Копия события на выбранные дни: то же время и длительность, без повтора. */
  async function copy() {
    const t = title.trim();
    if (!t) return toast(tr("Как назовём событие?"));
    const days = await showCopyDays({ source: start, title: t });
    if (!days?.length) return;
    const base = row();
    const dur = allDay || !end ? null : end.getTime() - start.getTime();
    for (const d of days) {
      const st = allDay ? day0(d) : new Date(d.getFullYear(), d.getMonth(), d.getDate(), start.getHours(), start.getMinutes());
      await s.insert("events", { ...base, starts_at: st.toISOString(), ends_at: dur == null ? null : new Date(st.getTime() + dur).toISOString(), repeat: null, repeat_skip: [] });
    }
    toast(tr("Скопировано: {0} {1}", [days.length, plural(days.length, tr("день"), tr("дня"), tr("дней"))]));
  }

  async function del() {
    if (!e) return;
    if (e.occurrence && e.repeat) {
      const scope = await askRepeatScope(true);
      if (!scope) return;
      await s.deleteOccurrence(e, scope === "following" ? "future" : scope);
    } else {
      if (!(await confirm(tr("Удалить событие?")))) return;
      await s.delete("events", e.id);
    }
    close();
  }

  /** Друзья: позвать в своё событие; у копии чужого — кто позвал. */
  function friendsBlock() {
    if (e?.sharedFrom != null) {
      const by = fr.sharedBy(e.id);
      return (
        <Card color="butter" seed={17} padding="10px 14px" className="ev-shared">
          <Icon name="users" size={18} />
          <span>{by == null ? tr("Совместное событие. Время и место меняет тот, кто позвал.") : tr("Совместное событие: позвал(а) {0}. Время и место меняет {0}.", [by.otherName])}</span>
        </Card>
      );
    }
    const list = fr.accepted;
    if (!list.length) return null;
    const guests = e ? fr.guestsOf(e.id) : [];
    const flip = (id: string) => setInvite((old) => { const next = new Set(old); if (!next.delete(id)) next.add(id); return next; });
    return (
      <div className="choice-row">
        <div className="label">{tr("Позвать друзей")}</div>
        <div className="wrap">
          {list.map((f) => {
            const g = guests.find((x) => (x.otherId ?? x.toUser) === f.id && x.status !== "declined");
            if (g) {
              const going = g.status === "accepted";
              return (
                <Pill key={f.id} dense selected icon={going ? "tick" : "clock"} color={going ? "sage" : "butter"}
                  onClick={async () => { if (await confirm(tr("Убрать {0} из события?", [f.name]), { action: tr("Убрать") })) await fr.cancelInvite(g.id); }}>
                  {f.name} · {going ? tr("идёт") : tr("ждём ответа")}
                </Pill>
              );
            }
            const on = invite.has(f.id);
            const declined = guests.some((x) => (x.otherId ?? x.toUser) === f.id) && !on;
            return <Pill key={f.id} dense selected={on} color="orange" icon={on ? "tick" : "user-plus"} onClick={() => flip(f.id)}>{declined ? `${f.name} · ${tr("отказ")}` : f.name}</Pill>;
          })}
        </div>
        <Collapse open={invite.size > 0}><div className="ev-hint">{tr("Приглашение уйдёт после «Сохранить».")}</div></Collapse>
      </div>
    );
  }

  const projects = (clientId == null ? s.projects : s.projectsOf(clientId)).filter((p) => p.status !== "done" || p.id === projectId);
  const clients = s.clients.filter((c) => !c.archived || c.id === clientId);
  const reminds = remindOptions();
  if (remind != null && !reminds.some((o) => o[0] === remind)) reminds.push([remind, tr("{0} мин", [remind])]);

  return (
    <div className="ev">
      <SheetHeader title={e ? tr("Событие") : tr("Новое событие")} action={tr("Сохранить")} onAction={() => void save()} busy={busy} close={close} />
      <Field label={tr("Название")} hint={tr("Встреча с клиентом")} value={title} onChange={setTitle} autoFocus={!e} />
      <Row title={tr("Весь день")}><Switch value={allDay} onChange={setAllDay} label={tr("Весь день")} /></Row>
      <DateTimeRow label={tr("Начало")} value={start} withTime={!allDay} onChange={(v) => {
        if (!v) return;
        // в режиме «весь день» поле даёт полночь — часы оставляем прежние
        const next = allDay ? new Date(v.getFullYear(), v.getMonth(), v.getDate(), start.getHours(), start.getMinutes()) : v;
        if (end) setEnd(new Date(next.getTime() + (end.getTime() - start.getTime())));
        setStart(next);
      }} />
      <Collapse open={!allDay}>
        <div inert={allDay}>
          <DateTimeRow label={tr("Конец")} value={end} clearable onChange={(v) => setEnd(v == null ? null : v < start ? new Date(start.getTime() + 3600_000) : v)} />
        </div>
      </Collapse>
      <RepeatPicker value={repeat} start={start} onChange={setRepeat} />
      <Field label={tr("Где")} hint={tr("Офис, адрес, ссылка на созвон")} value={location} onChange={setLocation} />
      {friendsBlock()}
      <ChoiceRow<Sphere> label={tr("Календарь")} value={sphere} options={[["work", tr("Работа"), "#2F8794"], ["personal", tr("Личное"), "#E2582B"]]} onChange={setSphere} />
      <ChoiceRow<boolean> label={tr("Важность")} value={important} options={[[false, tr("Обычное")], [true, tr("Важное"), "#C8402A"]]} onChange={setImportant} />
      <ChoiceRow<number | null> label={tr("Напомнить")} value={remind} options={reminds} onChange={setRemind} />
      {clients.length > 0 && (
        <ChoiceRow<string | null> label={tr("Клиент")} value={clientId} options={[[null, tr("Без клиента")], ...clients.map((c): [string | null, string, string] => [c.id, c.name, c.color])]}
          onChange={(v) => { setClientId(v); if (v != null && projectId != null && store.project(projectId)?.clientId !== v) setProjectId(null); }} />
      )}
      {projects.length > 0 && (
        <ChoiceRow<string | null> label={tr("Проект")} value={projectId} options={[[null, tr("Без проекта")], ...projects.map((p): [string | null, string, string] => [p.id, p.name, p.color])]} onChange={setProjectId} />
      )}
      <ColorChoice value={color ?? ""} onChange={(v) => setColor(v === color ? null : v)} />
      <Field label={tr("Заметки")} value={notes} onChange={setNotes} maxLines={4} />
      <div className="ev-actions">
        <Button expand busy={busy} onClick={() => void save()}>{tr("Сохранить")}</Button>
        {e && <Button expand ghost icon="copy" disabled={busy} onClick={() => void copy()}>{tr("Копировать на другие дни")}</Button>}
        {e && <button type="button" className="ev-delete" onClick={() => void del()}>{tr("Удалить событие")}</button>}
      </div>
    </div>
  );
}
