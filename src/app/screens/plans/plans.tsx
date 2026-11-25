// Подписки OSIRIS — порт app/lib/screens/plans/plans.dart и plan_art.dart.
// Оплата пока тестовая: choose_plan() на сервере просто включает тариф на 30 дней.
import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { tr } from "@/i18n";
import { Button, Card, Collapse, Cutout, Icon, Osi, SheetHeader, confirm, openSheet, toast, trackerIcons, type OsiMood } from "@/ui";
import { cubicPts, ellipsePts, rrectPts, shade, wobble, type Pt } from "@/paper/wobble";
import { sb } from "../../sb";
import { store, useStore } from "../../data/store";
import { fmtDay } from "../../format";
import "./plans.css";

export type Plan = "free" | "joy" | "smart";
/** Что упёрлось в лимит бесплатного тарифа (имена таблиц — как в ошибке сервера plan_limit:<таблица>). */
export type Limit = "projects" | "jobs" | "notes" | "trackers";
/** Все поводы показать подписки: лимиты таблиц плюс закрытый значок и дневной лимит сообщений Оси. */
export type PlanReason = Limit | "icon" | "osi";

const PLANS: Plan[] = ["free", "joy", "smart"];
const FREE = { projects: 1, jobs: 1, notes: 3, trackers: 2 } as const;
const INK = "#1F1D1A", CREAM = "#F6F0E3", BUTTER = "#F1E5A0", ORANGE = "#E2582B";

/** В бесплатном тарифе — первые 33 значка + значки по умолчанию. Тот же список в базе: free_icon() в 0015_plan_limits.sql. */
const FREE_ICONS = new Set([...trackerIcons.slice(0, 33), "run", "spark", "sun"]);

const errText = (e: unknown) => String((e as { message?: string })?.message ?? e);

/** Подписка пользователя и лимиты бесплатного тарифа (free: 1 проект, 1 работа, 3 заметки, 2 цели, половина значков). */
export const Plans = {
  freeProjects: FREE.projects, freeJobs: FREE.jobs, freeNotes: FREE.notes, freeGoals: FREE.trackers,

  /** Сообщений Оси в день. */
  osiPerDay: (p: Plan): number => ({ free: 1, joy: 20, smart: 100 })[p],

  /** Действующий тариф: у платного с истёкшим сроком — бесплатный. */
  get current(): Plan {
    const p = store.profile;
    if (!p) return "free";
    const plan = PLANS.find((x) => x === p.plan) ?? "free";
    if (plan === "free" || p.planLifetime || p.planUntil == null || p.planUntil.getTime() > Date.now()) return plan;
    return "free";
  },
  get free(): boolean { return Plans.current === "free"; },

  /** Почему нельзя добавить ещё (null — можно). adding — сколько добавляем сразу. */
  reason(l: PlanReason, adding = 1): string | null {
    if (!Plans.free) return null;
    const s = store;
    switch (l) {
      case "projects": return s.projects.length + adding > FREE.projects ? tr("В бесплатном плане — один проект.") : null;
      case "jobs": return s.jobs.length + adding > FREE.jobs ? tr("В бесплатном плане — одна работа.") : null;
      case "notes": return s.notes.length + adding > FREE.notes ? tr("В бесплатном плане — до 3 заметок.") : null;
      case "trackers": return s.trackers.length + adding > FREE.trackers ? tr("В бесплатном плане — до 2 целей.") : null;
      case "icon": return tr("Этот значок — в подписке. В бесплатном плане доступна половина значков.");
      case "osi": return tr("В бесплатном плане Оси отвечает на одно сообщение в день.");
    }
  },

  /** Достигнут ли лимит бесплатного тарифа. */
  blocked: (l: PlanReason): boolean => Plans.reason(l) != null,

  /** Можно ли создать ещё; если нет — сам открывает окно подписок и возвращает false. */
  allow(l: PlanReason): boolean {
    const why = Plans.reason(l);
    if (why == null) return true;
    void showPlans(why);
    return false;
  },

  /** Значок закрыт бесплатным тарифом. */
  iconLocked: (name: string): boolean => Plans.free && !FREE_ICONS.has(name),

  /** Сервер отказал (plan_limit:<таблица> / plan_icon) → окно подписок. */
  onServerBlock(why: string): void {
    const table = /plan_limit:(\w+)/.exec(why)?.[1];
    const l: PlanReason = table === "projects" || table === "jobs" || table === "notes" || table === "trackers" ? table : "icon";
    void showPlans(Plans.reason(l) ?? tr("Это доступно в подписке."));
  },

  /** Выбрать тариф на сервере (тестовая оплата). */
  async choose(p: Plan): Promise<void> {
    const { error } = await sb.rpc("choose_plan", { p_plan: p });
    if (error) throw error;
    await store.reloadProfile();
  },

  name: (p: Plan): string => ({ free: tr("Бесплатно"), joy: tr("Маленькие радости"), smart: tr("Умница") })[p],
  price: (p: Plan): string => ({ free: tr("0 zł"), joy: tr("9,99 zł"), smart: tr("29,99 zł") })[p],
  /** Цвет листа тарифа (null — обычный лист карточки). */
  color: (p: Plan): string | null => ({ free: null, joy: "butter", smart: "orange" })[p],

  features: (p: Plan): string[] => ({
    free: [
      tr("1 сообщение Оси в день"),
      tr("1 проект и 1 работа"),
      tr("3 заметки и 2 цели"),
      tr("Половина значков"),
      tr("Календарь, задачи, настроение и напоминания — без ограничений"),
    ],
    joy: [
      tr("20 сообщений Оси в день"),
      tr("Проекты, работы, заметки и цели — сколько угодно"),
      tr("Все значки"),
    ],
    smart: [
      tr("100 сообщений Оси в день"),
      tr("Всё из «Маленьких радостей»"),
      tr("Голос за новые функции: раз в месяц голосование прямо в приложении (скоро)"),
    ],
  })[p],
};

// ---------------------------------------------------------------- Оси для карточки тарифа

const quadPts = (a: Pt, c: Pt, b: Pt): Pt[] => Array.from({ length: 24 }, (_, i) => {
  const t = i / 24, u = 1 - t;
  return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]] as Pt;
});

// контуры в координатах Оси 200×200 — считаются один раз
const NIGHTCAP = wobble([...quadPts([58, 34], [92, -6], [168, -14]), ...quadPts([168, -14], [150, 12], [142, 34]), [142, 34]], { seed: 5, amp: 1.2, step: 6 });
const NIGHTCAP_CUFF = wobble(rrectPts(52, 26, 96, 18, 9), { seed: 6, amp: 1, step: 6 });
const POMPOM = wobble(ellipsePts(170, -14, 11, 11), { seed: 7, amp: 1.4, step: 4 });
const BOARD = wobble([[100, -8], [164, 12], [100, 32], [36, 12]], { seed: 8, amp: 1, step: 6 });
const BAND = wobble(rrectPts(66, 18, 68, 24, 6), { seed: 9, amp: 0.9, step: 6 });
const TASSEL = wobble(rrectPts(-6, 0, 12, 20, 4), { seed: 10, amp: 0.7, step: 4 });
const BALLOON = wobble(cubicPts([[[0, -30], [22, -30], [26, -2], [0, 22]], [[0, 22], [-26, -2], [-22, -30], [0, -30]]]), { seed: 11, amp: 1, step: 5 });

const ART_MOOD: Record<Plan, OsiMood> = { free: "sleepy", joy: "happy", smart: "excited" };
/** Подложка-лист контрастного цвета, чтобы оранжевый Оси читался на любой карточке. */
const ART_BACK: Record<Plan, string> = { free: "#C4D3F2", joy: CREAM, smart: BUTTER };

const PaperPath = ({ d, color, lift = 2 }: { d: string; color: string; lift?: number }) => (
  <>
    <path d={d} fill={shade(color, 0.18)} transform={`translate(0 ${lift})`} />
    <path d={d} fill={color} />
  </>
);

/**
 * Оси для карточки тарифа:
 * free — сонный, в ночном колпаке, «1» (экономит силы: одно сообщение в день);
 * joy — счастливый, с воздушным шариком и конфетти, «20»;
 * smart — восторженный, в академической шапочке с кисточкой, «100».
 */
export function PlanArt({ plan, size = 112 }: { plan: Plan; size?: number }) {
  const s = size, osi = s * 0.8, ox = s * 0.14, oy = s * 0.2, k = osi / 200;
  const idx = PLANS.indexOf(plan);
  const back = useMemo(() => wobble(ellipsePts(s * 0.55, s * 0.6, s * 0.38, s * 0.38), { seed: 20 + idx, amp: 2, step: 7, freq: 0.3 }), [s, idx]);
  const label = String(Plans.osiPerDay(plan));
  const bw = label.length * 9.4 + 18, bh = 26;
  const bubble = useMemo(() => `${wobble(rrectPts(0, 0, bw, bh, 13), { seed: 12, amp: 0.8, step: 6 })} M${bw * 0.62} ${bh - 2}L${bw * 0.86} ${bh + 9}L${bw * 0.86 - 2} ${bh - 4}Z`, [bw]);
  // шарик привязан к руке Оси
  const ax = ox + 176 * k, ay = oy + 112 * k, tx = s * 0.94, ty = s * 0.2;
  const confetti = plan === "joy" ? [ORANGE, "#2F8794", "#9C9FDD"] : plan === "smart" ? [CREAM, INK, CREAM] : [];
  const spots: Pt[] = [[s * 0.06, s * 0.62], [s * 0.2, s * 0.9], [s * 0.95, s * 0.74]];
  const r = s * 0.05;

  return (
    <div className="plan-art" style={{ width: s, height: s }} aria-hidden>
      <svg className="plan-art-layer" width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
        <PaperPath d={back} color={ART_BACK[plan]} />
        {plan === "joy" && (
          <>
            <path d={`M${ax} ${ay}Q${ax + 10} ${(ay + ty) / 2} ${tx} ${ty + 14}`} fill="none" stroke="rgba(31,29,26,0.6)" strokeWidth={1.2} />
            <g transform={`translate(${tx} ${ty})`}>
              <g className="plan-sway">
                <g transform={`scale(${s / 160})`}><PaperPath d={BALLOON} color="#9C9FDD" /></g>
              </g>
            </g>
          </>
        )}
      </svg>
      <Osi size={osi} mood={ART_MOOD[plan]} style={{ position: "absolute", left: ox, top: oy - 10 * k }} />
      <svg className="plan-art-layer" width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
        <g transform={`translate(${ox} ${oy}) scale(${k})`}>
          {plan === "free" && (
            <>
              <PaperPath d={NIGHTCAP} color="#1F2F45" />
              <PaperPath d={NIGHTCAP_CUFF} color={CREAM} lift={1.5} />
              <PaperPath d={POMPOM} color={BUTTER} lift={1.5} />
            </>
          )}
          {plan === "smart" && (
            <>
              <PaperPath d={BAND} color={INK} lift={1.5} />
              <PaperPath d={BOARD} color="#2E2D2B" lift={2.5} />
              <path d="M100 12L150 18" stroke={BUTTER} strokeWidth={3} strokeLinecap="round" />
              <g transform="translate(150 18)">
                <g className="plan-swing"><path d={TASSEL} fill={BUTTER} /></g>
              </g>
            </>
          )}
        </g>
        {/* облачко с числом сообщений в день */}
        <g transform={`translate(0 ${s * 0.04})`}>
          <g className="plan-float">
            <PaperPath d={bubble} color={CREAM} lift={1.5} />
            <text x={bw / 2} y={bh / 2 + 0.5} textAnchor="middle" dominantBaseline="central" fontSize={15} fontWeight={800} fill={INK}>{label}</text>
          </g>
        </g>
      </svg>
      {confetti.map((c, i) => (
        <Cutout key={i} kind="spark" flat size={r * 2} seed={50 + i} color={c} className="plan-conf" style={{ left: spots[i][0] - r, top: spots[i][1] - r, animationDelay: `${-i * 0.66}s` }} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- окно с подписками

let opened: Promise<void> | null = null;

/** Окно подписок. reason — почему показали («В бесплатном плане — один проект.»). */
export function showPlans(reason?: string): Promise<void> {
  // лимит ловят и экран, и сервер — второе окно поверх первого не нужно
  if (opened) return opened;
  opened = openSheet<void>((close) => <PlansSheet reason={reason} close={() => close()} />, { wide: true }).then(() => { opened = null; });
  return opened;
}

function PlansSheet({ reason, close }: { reason?: string; close: () => void }) {
  return (
    <div className="plans-sheet">
      <SheetHeader title={tr("Подписка")} close={close} />
      {reason && (
        <Card color="var(--paper-deep)" seed={41} lift={2} padding="10px 16px 10px 10px" className="plans-reason appear">
          <Osi size={58} mood="worried" />
          <b>{reason}</b>
        </Card>
      )}
      <PlanCards onPicked={close} />
    </div>
  );
}

/** Три карточки тарифов с кнопками. Используется в окне, в настройках и при первом входе. */
export function PlanCards({ onPicked, firstRun = false }: { onPicked?: () => void; firstRun?: boolean }): ReactNode {
  const s = useStore();
  const [busy, setBusy] = useState<Plan | null>(null);
  const cur = Plans.current;
  const p = s.profile;
  const lifetime = p?.planLifetime === true;

  const pick = async (plan: Plan) => {
    if (busy) return;
    if (plan === "free") {
      if (!firstRun && Plans.current !== "free" && !(await confirm(tr("Перейти на бесплатный план?"), { action: tr("Перейти"), danger: false }))) return;
      setBusy("free");
      try {
        await Plans.choose("free");
        onPicked?.();
      } catch (e) {
        toast(tr("Не получилось: {0}", [errText(e)]), "error");
      } finally {
        setBusy(null);
      }
      return;
    }
    const ok = await openSheet<boolean>((close) => <TestPayment plan={plan} close={close} />);
    if (ok === true) {
      onPicked?.();
      toast(tr("Готово! Теперь у тебя «{0}»", [Plans.name(plan)]));
    }
  };

  return (
    <div className="plans">
      <div className="plans-grid">
        {(["smart", "joy", "free"] as Plan[]).map((plan, i) => (
          <div key={plan} className="appear" style={{ animationDelay: `${i * 70}ms` }}>
            <PlanCard
              plan={plan}
              current={!firstRun && plan === cur}
              lifetime={lifetime && plan === cur}
              until={plan === cur && !lifetime ? p?.planUntil ?? null : null}
              busy={busy === plan}
              // пожизненный тариф не меняется
              onPick={lifetime || (!firstRun && plan === cur) ? undefined : () => void pick(plan)}
            />
          </div>
        ))}
      </div>
      <p className="plans-note">{tr("Оплата пока тестовая: деньги не списываются. Платная подписка действует 30 дней, сменить можно в любой момент в настройках.")}</p>
    </div>
  );
}

function PlanCard({ plan, current, lifetime, until, busy, onPick }: { plan: Plan; current: boolean; lifetime: boolean; until: Date | null; busy: boolean; onPick?: () => void }) {
  const status = lifetime ? tr("Твой план · навсегда") : current ? (until ? tr("Твой план · до {0}", [fmtDay(until)]) : tr("Твой план")) : null;
  // наклейка «Твой план»: читается на любом листе
  const sticker = plan === "joy" ? INK : BUTTER;
  return (
    <Card color={Plans.color(plan)} seed={60 + PLANS.indexOf(plan)} lift={plan === "smart" ? 5 : 3} padding="16px 18px" className={`plan-card plan-${plan}${current ? " current" : ""}`}>
      <div className="plan-head">
        <div className="plan-head-text">
          <h3>{Plans.name(plan)}</h3>
          <div className="plan-price">
            <b>{Plans.price(plan)}</b>
            {plan !== "free" && <span>{tr(" / мес")}</span>}
          </div>
          <Collapse open={status != null}>
            <div className="plan-sticker-wrap">
              <span className="plan-sticker" style={{ background: sticker, color: plan === "joy" ? CREAM : INK, "--sticker-shade": shade(sticker, 0.18) } as CSSProperties}>
                {lifetime && <Cutout kind="star" size={13} seed={3} color={ORANGE} flat />}
                {status}
              </span>
            </div>
          </Collapse>
        </div>
        <PlanArt plan={plan} size={104} />
      </div>
      <ul className="plan-features">
        {Plans.features(plan).map((f) => (
          <li key={f}>
            <Cutout kind="spark" size={12} seed={f.length} color={plan === "smart" ? BUTTER : ORANGE} flat />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <Collapse open={!!onPick}>
        <div className="plan-pick">
          <Button expand busy={busy} disabled={!onPick} color={plan === "smart" ? INK : plan === "joy" ? "orange" : null} onClick={onPick}>
            {plan === "free" ? tr("Остаться бесплатно") : tr("Выбрать за {0}", [Plans.price(plan)])}
          </Button>
        </div>
      </Collapse>
    </Card>
  );
}

/** Тестовая оплата: настоящего платежа нет, сервер просто включает тариф. */
function TestPayment({ plan, close }: { plan: Plan; close: (ok?: boolean) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pay = async () => {
    setBusy(true);
    setError(null);
    try {
      await new Promise((r) => setTimeout(r, 700)); // «платёж»
      await Plans.choose(plan);
      close(true);
    } catch (e) {
      setError(tr("Не получилось: {0}", [errText(e)]));
      setBusy(false);
    }
  };
  return (
    <div className="plans-pay">
      <SheetHeader title={tr("Оплата")} sub={tr("Тестовый режим")} close={() => close()} />
      <Card color={Plans.color(plan)} seed={77} className="plans-pay-card">
        <div>
          <b>{Plans.name(plan)}</b>
          <span>{tr("на 30 дней")}</span>
        </div>
        <strong>{Plans.price(plan)}</strong>
      </Card>
      <p className="plans-pay-info"><Icon name="info" size={18} />{tr("Это тестовая оплата: деньги не списываются. Настоящая оплата появится позже.")}</p>
      <Collapse open={error != null}><p className="plans-pay-error" role="alert">{error}</p></Collapse>
      <Button expand color="orange" icon="card" busy={busy} onClick={() => void pay()}>{tr("Оплатить {0} (тест)", [Plans.price(plan)])}</Button>
    </div>
  );
}

// ---------------------------------------------------------------- первый вход

/** Экран выбора подписки — только один раз, при первом входе. */
export function PlanChoiceScreen({ onDone }: { onDone: () => void }): ReactNode {
  return (
    <main className="plans-first">
      <div className="plans-first-art" aria-hidden>
        <Cutout kind="star" size={38} seed={4} color={BUTTER} className="a" />
        <Cutout kind="ring" size={30} seed={8} color="#9C9FDD" className="b" />
        <Osi size={124} mood="excited" />
      </div>
      <h1>{tr("Выбери подписку")}</h1>
      <p className="plans-first-sub">{tr("Начать можно бесплатно, а сменить план — в любой момент в настройках.")}</p>
      <PlanCards firstRun onPicked={onDone} />
    </main>
  );
}
