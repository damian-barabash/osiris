// Статистика настроения — порт app/lib/screens/mood/mood_stats_screen.dart. Графики — обычный SVG, без библиотек:
// линия по дням «дорисовывается», столбики вырастают. На ноутбуке — сетка листов с графиками.
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { plural, tr } from "@/i18n";
import { Appear, Button, Card, CountUp, Cutout, EmptyState, Icon, Osi, Pill, RoundButton, ScreenHeader, SectionTitle, SlideSwitcher, colorOf, confirm, onColor } from "@/ui";
import type { Mood } from "../../data/models";
import { addDays, day0, sameDate, weekday } from "../../data/repeat";
import { useStore } from "../../data/store";
import { fmtDayShort, fmtRelDay, fmtTime } from "../../format";
import { back, nav } from "../../router";
import { MoodScale, showMoodSheet, showMoodTagsSheet } from "./moodSheet";
import "./mood.css";

const avgOf = (ms: Mood[]) => (ms.length ? ms.reduce((a, m) => a + m.score, 0) / ms.length : 0);
const clampScore = (v: number) => Math.min(5, Math.max(1, Math.round(v)));
const moodHex = (v: number) => colorOf(MoodScale.colors[clampScore(v)]);
const signed = (v: number) => (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(1);

/** Ширина блока в пикселях — график рисуется в настоящих размерах, чтобы линии и подписи не растягивались. */
function useWidth(): [React.RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.clientWidth);
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

/** Среднее настроение по дням: линия, заливка и точки цвета отметки. */
function LineChart({ ms, from, days }: { ms: Mood[]; from: Date; days: number }) {
  const [ref, w] = useWidth();
  const H = 196, L = 26, R = 12, T = 12, B = 26;
  const pts = useMemo(() => {
    const out: { i: number; v: number; day: Date; n: number }[] = [];
    for (let i = 0; i < days; i++) {
      const d = addDays(from, i), day = ms.filter((m) => sameDate(m.at, d));
      if (day.length) out.push({ i, v: avgOf(day), day: d, n: day.length });
    }
    return out;
  }, [ms, from, days]);
  const x = (i: number) => L + (days <= 1 ? 0.5 : i / (days - 1)) * Math.max(0, w - L - R);
  const y = (v: number) => T + ((5.5 - v) / 5) * (H - T - B);
  let line = "";
  pts.forEach((p, k) => {
    if (!k) { line = `M${x(p.i).toFixed(1)} ${y(p.v).toFixed(1)}`; return; }
    const a = pts[k - 1], mx = ((x(a.i) + x(p.i)) / 2).toFixed(1);
    line += ` C${mx} ${y(a.v).toFixed(1)} ${mx} ${y(p.v).toFixed(1)} ${x(p.i).toFixed(1)} ${y(p.v).toFixed(1)}`;
  });
  const area = pts.length > 1 ? `${line} L${x(pts[pts.length - 1].i).toFixed(1)} ${H - B} L${x(pts[0].i).toFixed(1)} ${H - B} Z` : "";
  const step = Math.ceil(days / 5), r = days > 45 ? 3 : 4;
  return (
    <div ref={ref}>
      {w > 0 && (
        <svg className="mood-chart" width={w} height={H} role="img" aria-label={tr("По дням")}>
          {[1, 2, 3, 4, 5].map((v) => (
            <g key={v}>
              <line className="grid" x1={L} x2={w - R} y1={y(v)} y2={y(v)} />
              <text x={L - 10} y={y(v) + 4} textAnchor="end">{v}</text>
            </g>
          ))}
          {Array.from({ length: Math.floor((days - 1) / step) + 1 }, (_, k) => k * step).map((i) => (
            <text key={i} x={x(i)} y={H - 6} textAnchor={i === 0 ? "start" : x(i) > w - R - 24 ? "end" : "middle"} style={{ fontSize: 10 }}>{fmtDayShort(addDays(from, i))}</text>
          ))}
          {area && <path className="area" d={area} />}
          {pts.length > 1 && <path className="line" d={line} pathLength={1} />}
          {pts.map((p, k) => (
            <circle key={p.i} className="dot" cx={x(p.i)} cy={y(p.v)} r={r} fill={moodHex(p.v)} style={{ animationDelay: `${Math.round(250 + (k / Math.max(1, pts.length - 1)) * 800)}ms` }}>
              <title>{`${fmtDayShort(p.day)}: ${p.v.toFixed(1)} · ${MoodScale.label(p.v)}`}</title>
            </circle>
          ))}
        </svg>
      )}
    </div>
  );
}

type Group = { label: string; list: Mood[] };

/** Столбики среднего настроения по группам; пустая группа — серая чёрточка и «—». */
function Bars({ groups, title }: { groups: Group[]; title: string }) {
  const [ref, w] = useWidth();
  const H = 132, top = 22, max = 80, base = top + max;
  const col = w / groups.length, bw = Math.max(8, Math.min(46, col - 12));
  return (
    <div ref={ref}>
      {w > 0 && (
        <svg className="mood-chart" width={w} height={H} role="img" aria-label={title}>
          {groups.map((g, i) => {
            const has = g.list.length > 0, a = avgOf(g.list), h = has ? 10 + (a / 5) * 70 : 4, cx = col * i + col / 2, delay = `${i * 70}ms`;
            return (
              <g key={g.label}>
                <rect className={`bar${has ? "" : " none"}`} x={cx - bw / 2} y={base - h} width={bw} height={h} rx={Math.min(8, h / 2)} fill={has ? moodHex(a) : undefined} style={{ animationDelay: delay }}>
                  {has && <title>{`${g.label}: ${a.toFixed(1)} · ${g.list.length}`}</title>}
                </rect>
                <text className="val" x={cx} y={base - h - 7} textAnchor="middle" style={{ animationDelay: `${i * 70 + 380}ms` }}>{has ? a.toFixed(1) : "—"}</text>
                <text className="cap" x={cx} y={H - 6} textAnchor="middle">{g.label}</text>
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}

/** Влияние тегов: насколько настроение с тегом выше или ниже среднего (полоса от оси вправо или влево). */
function Influence({ rows }: { rows: { tag: string; d: number; n: number }[] }) {
  const span = Math.max(0.5, ...rows.map((r) => Math.abs(r.d)));
  return (
    <div className="mood-inf">
      {rows.map((r, i) => {
        const len = Math.max(1.5, (Math.abs(r.d) / span) * 48);
        return (
          <div key={r.tag} className="mood-inf-row" style={{ animationDelay: `${i * 45}ms` }} title={`${tr(r.tag)}: ${signed(r.d)} · ${r.n}`}>
            <span>{tr(r.tag)}</span>
            <svg viewBox="0 0 100 16" preserveAspectRatio="none" aria-hidden>
              <rect x={r.d >= 0 ? 50 : 50 - len} y={2} width={len} height={12} fill={colorOf(r.d >= 0 ? "sage" : "clay")} style={{ animationDelay: `${i * 45 + 120}ms` }} />
              <line className="axis" x1={50} x2={50} y1={0} y2={16} />
            </svg>
            <em>{signed(r.d)}</em>
          </div>
        );
      })}
    </div>
  );
}

function Block({ title, wide, children, i = 0, color, seed = 2 }: { title: string; wide?: 2 | 3; children: ReactNode; i?: number; color?: string; seed?: number }) {
  return (
    <section className={`mood-block${wide ? ` w${wide}` : ""}`}>
      <Appear i={i}>
        <SectionTitle>{title}</SectionTitle>
        <Card color={color} seed={seed} padding="18px 16px 14px">{children}</Card>
      </Appear>
    </section>
  );
}

/** «Поднимает настроение: **сон** (+0.4)» → жирное без разметки. */
const bold = (s: string) => s.split("**").map((p, i) => (i % 2 ? <b key={i}>{p}</b> : p));

export default function MoodStatsScreen() {
  const s = useStore();
  const [days, setDays] = useState(30);
  const dir = useRef(1);
  const pick = (d: number) => { dir.current = d > days ? 1 : -1; setDays(d); };

  const from = addDays(day0(new Date()), -(days - 1));
  const fromKey = from.getTime();
  const moods = s.moods, events = s.events;

  const st = useMemo(() => {
    const start = new Date(fromKey), prevStart = addDays(start, -days);
    const ms = moods.filter((m) => m.at >= start);
    const prev = moods.filter((m) => m.at < start && m.at >= prevStart);
    const avg = avgOf(ms);

    // теги: отклонение от среднего (от двух отметок)
    const byTag = new Map<string, Mood[]>();
    for (const m of ms) for (const t of m.tags) byTag.has(t) ? byTag.get(t)!.push(m) : byTag.set(t, [m]);
    const tagStats = [...byTag.entries()].filter(([, l]) => l.length >= 2).map(([tag, l]) => ({ tag, d: avgOf(l) - avg, n: l.length })).sort((a, b) => b.d - a.d);

    const notes: string[] = [];
    if (tagStats.length && tagStats[0].d > 0.2) notes.push(tr("Поднимает настроение: **{0}** (+{1})", [tr(tagStats[0].tag), tagStats[0].d.toFixed(1)]));
    if (tagStats.length > 1 && tagStats[tagStats.length - 1].d < -0.2) notes.push(tr("Тянет вниз: **{0}** ({1})", [tr(tagStats[tagStats.length - 1].tag), tagStats[tagStats.length - 1].d.toFixed(1)]));

    // энергия
    const withE = ms.filter((m) => m.energy != null);
    if (withE.length >= 4) {
      const low = withE.filter((m) => m.energy! <= 2), high = withE.filter((m) => m.energy! >= 4);
      if (low.length && high.length && avgOf(high) - avgOf(low) > 0.5) notes.push(tr("Когда энергии много, настроение выше на **{0}**. Сон и отдых решают.", [(avgOf(high) - avgOf(low)).toFixed(1)]));
    }

    // нагрузка: дни с 3+ рабочими встречами против остальных
    const busy: Mood[] = [], calm: Mood[] = [], perDay = new Map<string, number>();
    for (const m of ms) {
      const k = `${m.at.getFullYear()}-${m.at.getMonth()}-${m.at.getDate()}`;
      let n = perDay.get(k);
      if (n == null) { n = s.eventsOn(m.at).filter((e) => e.sphere === "work").length; perDay.set(k, n); }
      (n >= 3 ? busy : calm).push(m);
    }
    const load = busy.length >= 2 && calm.length >= 2;
    if (load) {
      const d = avgOf(busy) - avgOf(calm);
      if (Math.abs(d) > 0.3) notes.push(d < 0 ? tr("В дни с 3+ рабочими встречами настроение ниже на **{0}**.", [(-d).toFixed(1)]) : tr("Насыщенные рабочие дни тебе заходят: +{0} к настроению.", [d.toFixed(1)]));
    }
    return { ms, prev, avg, prevAvg: avgOf(prev), tagStats, withE, busy, calm, load, notes };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moods, events, fromKey, days]);

  const { ms, prev, avg, tagStats, withE } = st;
  const delta = avg - st.prevAvg;
  const sumColor = MoodScale.colors[clampScore(avg)];
  // «▲ лучше, чем раньше (+0.3)» — стрелку из строки приложения заменяет значок
  const strip = (t: string) => t.replace(/^[▲▼]\s*/, "");

  const ask = () => nav("/chat?q=" + encodeURIComponent(tr("Проанализируй моё настроение за последний месяц: что на него влияет и что мне стоит поменять?")));
  const wd = [tr("Пн"), tr("Вт"), tr("Ср"), tr("Чт"), tr("Пт"), tr("Сб"), tr("Вс")];
  const shownTags = tagStats.length > 8 ? [...tagStats.slice(0, 4), ...tagStats.slice(-4)] : tagStats;

  return (
    <div className="mood-screen">
      <ScreenHeader title={tr("Настроение")} back={() => back("/")}>
        <RoundButton icon="tag" label={tr("Что влияет")} onClick={() => void showMoodTagsSheet()} />
        <RoundButton icon="add" filled label={tr("Отметить настроение")} onClick={() => void showMoodSheet()} />
      </ScreenHeader>
      <div className="mood-periods">
        {[7, 30, 90].map((d) => <Pill key={d} dense selected={days === d} onClick={() => pick(d)}>{tr("{0} дней", [d])}</Pill>)}
      </div>

      <SlideSwitcher k={days} dir={dir.current}>
        {!ms.length ? (
          <EmptyState title={tr("Пока нет отметок")} text={tr("Каждые 4 часа при входе Оси спросит, как ты. Через пару дней тут появятся графики.")} mood="calm" action={tr("Отметить настроение")} onAction={() => void showMoodSheet()} />
        ) : (
          <>
            <div className="mood-grid">
              <section className="mood-block first">
                <Appear>
                  <Card color={sumColor} seed={1}>
                    <div className="mood-sum">
                      <Osi size={84} mood={MoodScale.osi[clampScore(avg)]} />
                      <div>
                        <b><CountUp value={avg} format={(v) => v.toFixed(1)} /></b>
                        <p>{tr("{0} · {1} {2}", [MoodScale.label(avg), ms.length, plural(ms.length, tr("отметка"), tr("отметки"), tr("отметок"))])}</p>
                        {prev.length > 0 && (
                          <small>
                            {delta >= 0.05 ? <><Icon name="trend" size={15} />{strip(tr("▲ лучше, чем раньше (+{0})", [delta.toFixed(1)]))}</>
                              : delta <= -0.05 ? <><Icon name="trend-down" size={15} />{strip(tr("▼ хуже, чем раньше ({0})", [delta.toFixed(1)]))}</>
                              : tr("Так же, как раньше")}
                          </small>
                        )}
                      </div>
                    </div>
                  </Card>
                </Appear>
              </section>

              <Block title={tr("По дням")} wide={2} i={1} seed={2}><LineChart ms={ms} from={from} days={days} /></Block>

              <Block title={tr("Время суток")} i={2} seed={0}>
                <Bars title={tr("Время суток")} groups={[
                  { label: tr("Ночь"), list: ms.filter((m) => m.at.getHours() < 6) },
                  { label: tr("Утро"), list: ms.filter((m) => m.at.getHours() >= 6 && m.at.getHours() < 12) },
                  { label: tr("День"), list: ms.filter((m) => m.at.getHours() >= 12 && m.at.getHours() < 18) },
                  { label: tr("Вечер"), list: ms.filter((m) => m.at.getHours() >= 18) },
                ]} />
              </Block>

              <Block title={tr("Дни недели")} i={3} seed={3}>
                <Bars title={tr("Дни недели")} groups={wd.map((label, k) => ({ label, list: ms.filter((m) => weekday(m.at) === k + 1) }))} />
              </Block>

              {shownTags.length > 0 && (
                <Block title={tr("Что влияет")} i={4} seed={1}>
                  <Influence rows={shownTags} />
                  <p className="mood-hint">{tr("Насколько настроение с тегом выше или ниже среднего.")}</p>
                </Block>
              )}

              {withE.length >= 4 && (
                <Block title={tr("Энергия и настроение")} i={5} seed={2}>
                  <Bars title={tr("Энергия и настроение")} groups={[1, 2, 3, 4, 5].map((e) => ({ label: String(e), list: withE.filter((m) => m.energy === e) }))} />
                  <p className="mood-hint">{tr("Среднее настроение при энергии от 1 до 5.")}</p>
                </Block>
              )}

              {st.load && (
                <Block title={tr("Нагрузка")} i={6} seed={3}>
                  <Bars title={tr("Нагрузка")} groups={[{ label: tr("Спокойные дни"), list: st.calm }, { label: tr("3+ рабочих встречи"), list: st.busy }]} />
                  <p className="mood-hint">{tr("Дни с тремя и более рабочими событиями против остальных.")}</p>
                </Block>
              )}

              {st.notes.length > 0 && (
                <Block title={tr("Оси заметил")} i={7} color="butter" seed={3} wide={st.load || withE.length >= 4 || shownTags.length > 0 ? undefined : 2}>
                  <div className="mood-notes">
                    {st.notes.map((o) => (
                      <div key={o} className="mood-note">
                        <Cutout kind="spark" size={14} color={colorOf("orange")} flat />
                        <span>{bold(o)}</span>
                      </div>
                    ))}
                  </div>
                </Block>
              )}
            </div>

            <div className="mood-ask"><Button color="orange" icon="spark" onClick={ask}>{tr("Спросить Оси, что влияет")}</Button></div>

            <SectionTitle>{tr("Отметки")}</SectionTitle>
            <div className="mood-marks">
              {[...ms].reverse().slice(0, 40).map((m, i) => {
                const c = colorOf(MoodScale.colors[clampScore(m.score)]);
                return (
                  <Appear key={m.id} i={i}>
                    <div className="mood-mark">
                      <i style={{ background: c, color: onColor(c) }}>{m.score}</i>
                      <div>
                        <h4>{tr("{0}{1}", [MoodScale.label(m.score), m.energy != null ? tr(" · энергия {0}", [m.energy]) : ""])}</h4>
                        <p>{[fmtRelDay(m.at), fmtTime(m.at), ...(m.tags.length ? [m.tags.map((t) => tr(t)).join(", ")] : []), ...(m.note ? [m.note] : [])].join(" · ")}</p>
                      </div>
                      <RoundButton icon="trash" size={36} label={tr("Удалить")} onClick={async () => { if (await confirm(tr("Удалить отметку?"))) void s.delete("moods", m.id); }} />
                    </div>
                  </Appear>
                );
              })}
            </div>
          </>
        )}
      </SlideSwitcher>
    </div>
  );
}
