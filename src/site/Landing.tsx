// Лендинг myosiris.app. Пререндерится в статический HTML на трёх языках (scripts/prerender.mjs), затем «оживает» в браузере.
// Всё содержимое есть в HTML без JavaScript; скрипт добавляет только движение: Оси, демо чата, переключение видов, счётчики.
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Osi, type OsiMood } from "@/brand/Osi";
import { LogoMark } from "@/brand/Logo";
import { Cutout, PaperSheet } from "@/paper/Paper";
import { rnd } from "@/paper/wobble";
import { track, siteCall } from "@/lib/track";
import { CONTENT, type Content, type SiteLang } from "./content";
import { Ic, appUrl } from "./Chrome";

const C = { orange: "#E2582B", teal: "#2F8794", lavender: "#9C9FDD", sage: "#A7C98C", butter: "#F1E5A0", clay: "#7A4545", navy: "#1F2F45", blush: "#E9A9A0", mustard: "#D8C24B", cream: "#F7F3EA", charcoal: "#2E2D2B" };

/** Элемент виден на экране (для запуска анимаций только там, где на них смотрят). */
function useSeen<T extends Element>(once = true): [React.RefObject<T | null>, boolean] {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setSeen(true); if (once) io.disconnect(); } else if (!once) setSeen(false); }, { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, [once]);
  return [ref, seen];
}

const Label = ({ children }: { children: ReactNode }) => <p className="label rv">{children}</p>;
const openChat = () => window.dispatchEvent(new Event("osiris:chat"));

export function Landing({ lang }: { lang: SiteLang }) {
  const c = CONTENT[lang];
  return (
    <>
      <Hero c={c} />
      <Ticker items={c.ticker} />
      <OsiSection c={c} />
      <Views c={c} lang={lang} />
      <Work c={c} />
      <Report c={c} />
      <Extras c={c} />
      <Pricing c={c} />
      <Stores c={c} lang={lang} />
      <Faq c={c} />
      <Final c={c} />
    </>
  );
}

// ------------------------------------------------------------------ герой
function Hero({ c }: { c: Content }) {
  const h = c.hero;
  return (
    <section className="hero">
      <div className="hero-text">
        <p className="kicker up" style={{ ["--d" as string]: "0.05s" }}><LogoMark size={20} flat /> {h.kicker}</p>
        <h1>{h.title.map((line, i) => <span key={i} className="up" style={{ ["--d" as string]: `${0.12 + i * 0.09}s` }}>{line}</span>)}</h1>
        <p className="lead up" style={{ ["--d" as string]: "0.42s" }}>{h.lead}</p>
        <div className="hero-cta up" style={{ ["--d" as string]: "0.52s" }}>
          <a className="b orange lg" href={appUrl("signup")} onClick={() => track("cta_signup")}>{h.cta} <Ic n="arrow" /></a>
          <button type="button" className="b ghost lg" onClick={openChat}>{h.cta2}</button>
        </div>
        <p className="note up" style={{ ["--d" as string]: "0.6s" }}>{h.note}</p>
      </div>
      <div className="hero-art" aria-hidden>
        <Cutout kind="sun" size={150} color={C.butter} seed={4} className="fl f1" />
        <Cutout kind="leaf" size={92} color={C.sage} seed={7} className="fl f2" />
        <Cutout kind="ring" size={74} color={C.lavender} seed={9} className="fl f3" />
        <Cutout kind="star" size={56} color={C.orange} seed={5} className="fl f4" />
        <div className="hero-cards">
          <MiniCard color={C.teal} time="09:30" title={c.osi.demo[0].cards[0][0]} i={0} />
          <MiniCard color={C.lavender} time="13:00" title={c.work.hours.title} i={1} />
          <MiniCard color={C.sage} time="19:00" title={c.osi.demo[2].cards[0][0]} i={2} />
        </div>
        <div className="hero-osi pop">
          <div className="bubble">{h.bubble}</div>
          <Osi size={300} mood="happy" wave />
        </div>
      </div>
    </section>
  );
}

function MiniCard({ color, time, title, i }: { color: string; time: string; title: string; i: number }) {
  return (
    <div className={`mini mini${i} paper s${i + 1}`} style={{ ["--sheet" as string]: color, ["--on" as string]: color === C.sage || color === C.lavender ? "#1F1D1A" : "#F6F0E3" }}>
      <span>{time}</span>
      <b>{title}</b>
    </div>
  );
}

function Ticker({ items }: { items: string[] }) {
  const row = (k: number) => (
    <div className="tk-row" aria-hidden={k > 0}>
      {items.map((t, i) => <span key={i}><Cutout kind={i % 2 ? "spark" : "star"} size={18} color={i % 3 ? C.butter : C.orange} seed={i + 2} flat />{t}</span>)}
    </div>
  );
  return <div className="ticker">{row(0)}{row(1)}</div>;
}

// ------------------------------------------------------------------ Оси: демо чата
function OsiSection({ c }: { c: Content }) {
  const o = c.osi;
  const [ref, seen] = useSeen<HTMLDivElement>();
  const [n, setN] = useState(0);
  /** 0 — набирается вопрос, 1 — Оси думает, 2 — ответ и карточки, 3 — «Применить» нажато */
  const [step, setStep] = useState(3);
  const [typed, setTyped] = useState(o.demo[0].user.length);
  const d = o.demo[n];

  useEffect(() => {
    if (!seen || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let live = true;
    const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
    (async () => {
      await wait(500);
      for (let k = n; live; k = (k + 1) % o.demo.length) {
        const text = o.demo[k].user;
        setN(k); setStep(0); setTyped(0);
        for (let i = 1; i <= text.length && live; i++) { setTyped(i); await wait(26); }
        await wait(450); if (!live) return;
        setStep(1); await wait(1100); if (!live) return;
        setStep(2); await wait(2300); if (!live) return;
        setStep(3); await wait(3000);
      }
    })();
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seen]);

  const mood: OsiMood = step === 0 ? "listening" : step === 1 ? "thinking" : step === 3 ? "excited" : "happy";
  return (
    <section className="sec osi" id="osi">
      <div className="sec-head">
        <Label>{o.label}</Label>
        <h2 className="rv">{o.title}</h2>
        <p className="lead rv">{o.lead}</p>
      </div>
      <div className="osi-grid">
        <div className="demo rv" ref={ref}>
          <div className="demo-top">
            <Osi size={86} mood={mood} />
            <div className="dots" role="tablist">{o.demo.map((_, i) => <span key={i} className={i === n ? "on" : ""} />)}</div>
          </div>
          <div className="demo-body" aria-live="off">
            <div className="msg me">{d.user.slice(0, typed)}{step === 0 && <i className="caret" />}</div>
            {step === 1 && <div className="msg osi typing"><i /><i /><i /></div>}
            {step >= 2 && (
              <div className="msg osi in" key={n}>
                <p>{d.reply}</p>
                {d.cards.map(([t, s], i) => (
                  <div key={i} className={`act${step === 3 ? " done" : ""}`} style={{ animationDelay: `${0.12 + i * 0.14}s` }}>
                    <span className="act-ic"><Ic n={step === 3 ? "check" : "star"} size={15} /></span>
                    <span><b>{t}</b><small>{s}</small></span>
                  </div>
                ))}
                <div className={`apply${step === 3 ? " done" : ""}`}>{step === 3 ? d.applied : d.apply}</div>
              </div>
            )}
          </div>
        </div>
        <ul className="points">
          {o.points.map(([t, s], i) => (
            <li key={i} className="rv" style={{ ["--d" as string]: `${i * 0.08}s` }}>
              <span className="pt-ic" style={{ background: [C.orange, C.teal, C.sage, C.lavender][i] }}><Ic n={["mic", "check", "repeat", "globe"][i]} size={18} /></span>
              <div><h3>{t}</h3><p>{s}</p></div>
            </li>
          ))}
          <li className="rv hint"><button type="button" className="link" onClick={openChat}>{o.hint} <Ic n="arrow" size={15} /></button></li>
        </ul>
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ виды календаря
const EV: [number, number, number, string, boolean][] = [ // день 0..6, начало, длительность (ч), цвет, работа
  [0, 9, 2, C.teal, true], [0, 15, 1.5, C.orange, false], [1, 10, 3, C.teal, true], [1, 18, 1.5, C.sage, false], [2, 9, 1.5, C.lavender, true], [2, 13, 2, C.teal, true],
  [3, 11, 2, C.teal, true], [3, 19, 1.5, C.sage, false], [4, 9, 4, C.teal, true], [4, 15, 1, C.orange, false], [5, 11, 3, C.butter, false], [6, 13, 2, C.blush, false],
];

function Views({ c, lang }: { c: Content; lang: SiteLang }) {
  const v = c.views;
  const [tab, setTab] = useState(0);
  const [dir, setDir] = useState(1);
  const [sphere, setSphere] = useState<null | boolean>(null);
  const loc = { en: "en-GB", pl: "pl-PL", ru: "ru-RU" }[lang];
  const wd = Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(loc, { weekday: "short" }).format(new Date(2026, 10, 23 + i)).replace(".", ""));
  const months = Array.from({ length: 12 }, (_, i) => new Intl.DateTimeFormat(loc, { month: "short" }).format(new Date(2026, i, 1)).replace(".", ""));
  const names = [c.osi.demo[0].cards[0][0], c.work.hours.title, c.osi.demo[2].cards[0][0], c.work.clients.title, c.nav.report];
  const ev = EV.filter((e) => sphere === null || e[4] === sphere);
  const go = (i: number) => { setDir(i > tab ? 1 : -1); setTab(i); };

  let body: ReactNode;
  if (tab === 0) {
    body = (
      <div className="vw-week">
        {wd.map((w, d) => (
          <div key={d} className={`vw-col${d === 2 ? " today" : ""}`}>
            <span className="vw-wd">{w}<b>{23 + d}</b></span>
            <div className="vw-track">
              {ev.filter((e) => e[0] === d).map((e, i) => <i key={i} style={{ top: `${(e[1] - 8) * 7.4}%`, height: `${e[2] * 7.4}%`, background: e[3], animationDelay: `${(d * 2 + i) * 0.035}s` }} />)}
            </div>
          </div>
        ))}
      </div>
    );
  } else if (tab === 1) {
    body = (
      <div className="vw-list">
        {ev.slice(0, 6).map((e, i) => (
          <div key={i} className="vw-item" style={{ ["--c" as string]: e[3], animationDelay: `${i * 0.05}s` }}>
            <span className="vw-date"><b>{23 + e[0]}</b>{wd[e[0]]}</span>
            <span className="vw-bar" />
            <span className="vw-t"><b>{names[i % names.length]}</b><small>{String(Math.floor(e[1])).padStart(2, "0")}:00–{String(Math.floor(e[1] + e[2])).padStart(2, "0")}:{e[2] % 1 ? "30" : "00"}</small></span>
          </div>
        ))}
      </div>
    );
  } else if (tab === 2) {
    body = (
      <div className="vw-month">
        {wd.map((w) => <span key={w} className="vw-mh">{w}</span>)}
        {Array.from({ length: 35 }, (_, i) => {
          const day = i - 5; // ноябрь 2026 начинается в воскресенье → сетка с понедельника
          const dots = day > 0 && day <= 30 ? ev.filter((e) => (e[0] + day * 3) % 7 < 2).slice(0, 3) : [];
          return (
            <span key={i} className={`vw-day${day === 25 ? " today" : ""}${day < 1 || day > 30 ? " out" : ""}`} style={{ animationDelay: `${i * 0.012}s` }}>
              {day > 0 && day <= 30 ? day : ""}
              <em>{dots.map((e, k) => <i key={k} style={{ background: e[3] }} />)}</em>
            </span>
          );
        })}
      </div>
    );
  } else {
    body = (
      <div className="vw-year">
        {months.map((m, i) => (
          <div key={m} className="vw-mini" style={{ animationDelay: `${i * 0.03}s` }}>
            <b>{m}</b>
            <div>{Array.from({ length: 28 }, (_, k) => {
              const r = rnd(`y${i}-${k}`);
              const col = r > 0.72 ? C.teal : r > 0.5 ? C.orange : r > 0.38 ? C.sage : null;
              return <i key={k} style={col && (sphere === null || (sphere ? col === C.teal : col !== C.teal)) ? { background: col } : undefined} />;
            })}</div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <section className="sec views" id="calendar">
      <div className="sec-head">
        <Label>{v.label}</Label>
        <h2 className="rv">{v.title}</h2>
        <p className="lead rv">{v.lead}</p>
      </div>
      <div className="vw rv paper" style={{ ["--lift" as string]: "7px" }}>
        <div className="vw-bar-top">
          <div className="tabs" role="tablist">
            <span className="tabs-thumb" style={{ ["--i" as string]: tab, ["--n" as string]: v.tabs.length }} />
            {v.tabs.map(([k, t], i) => <button key={k} type="button" role="tab" aria-selected={tab === i} className={tab === i ? "on" : ""} onClick={() => go(i)}>{t}</button>)}
          </div>
          <div className="spheres">
            <button type="button" aria-pressed={sphere === true} className={sphere === true ? "on" : ""} style={{ ["--c" as string]: C.teal }} onClick={() => setSphere(sphere === true ? null : true)}><i />{v.work}</button>
            <button type="button" aria-pressed={sphere === false} className={sphere === false ? "on" : ""} style={{ ["--c" as string]: C.orange }} onClick={() => setSphere(sphere === false ? null : false)}><i />{v.personal}</button>
          </div>
        </div>
        <div className="vw-stage" role="tabpanel">
          <div key={`${tab}-${sphere}`} className="vw-slide" style={{ ["--from" as string]: `${dir * 34}px` }}>{body}</div>
        </div>
      </div>
      <ul className="ticks">
        {v.points.map((p, i) => <li key={i} className="rv" style={{ ["--d" as string]: `${i * 0.06}s` }}><span><Ic n="check" size={15} /></span>{p}</li>)}
      </ul>
    </section>
  );
}

// ------------------------------------------------------------------ часы и клиенты
function useCount(to: number, on: boolean, ms = 1400) {
  const [v, setV] = useState(to);
  useEffect(() => {
    if (!on || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / ms);
      setV(to * (1 - (1 - k) ** 3));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    setV(0);
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [on, to, ms]);
  return v;
}

function Timer() {
  const [s, setS] = useState(2 * 3600 + 47 * 60 + 12);
  useEffect(() => { const t = setInterval(() => setS((x) => x + 1), 1000); return () => clearInterval(t); }, []);
  const p = (n: number) => String(n).padStart(2, "0");
  return <span className="timer" suppressHydrationWarning>{p(Math.floor(s / 3600))}:{p(Math.floor(s / 60) % 60)}:{p(s % 60)}</span>;
}

function Work({ c }: { c: Content }) {
  const w = c.work;
  const [ref, seen] = useSeen<HTMLDivElement>();
  const earned = useCount(4864, seen);
  const owe = useCount(3150, seen);
  const fmt = (n: number) => Math.round(n).toLocaleString("pl-PL").replace(/ /g, " ");
  const bars = [4, 7.5, 8, 0, 6, 8, 8.5, 0, 0, 8, 7, 8, 9, 5];
  const clients: [string, string, number, number][] = [["Marina", C.lavender, 500, 1700], ["Studio Nord", C.sage, 2400, 3600], ["Tomek", C.butter, 900, 1650]];
  return (
    <section className="sec work" id="hours">
      <div className="sec-head">
        <Label>{w.label}</Label>
        <h2 className="rv">{w.title}</h2>
        <p className="lead rv">{w.lead}</p>
      </div>
      <div className="work-grid" ref={ref}>
        <article className="wk paper rv" style={{ ["--sheet" as string]: C.teal, ["--on" as string]: "#F6F0E3", ["--lift" as string]: "7px" }}>
          <h3>{w.hours.title}</h3>
          <p>{w.hours.text}</p>
          <div className="wk-run">
            <span className="pulse" />
            <div><small>{w.hours.running}</small><Timer /><small>{w.hours.job}</small></div>
            <span className="stop"><i />{w.hours.stop}</span>
          </div>
          <div className="wk-sum">
            <div><small>{w.hours.earned}</small><b>{fmt(earned)} zł</b></div>
            <div className="bars">{bars.map((h, i) => <i key={i} style={{ height: seen ? `${h * 10}%` : "0%", transitionDelay: `${i * 0.04}s` }} />)}</div>
          </div>
          <p className="wk-fore"><Ic n="clock" size={15} /> ≈ 6 420 zł {w.hours.forecast}</p>
          <ul>{w.hours.points.map((p, i) => <li key={i}><Ic n="check" size={15} />{p}</li>)}</ul>
        </article>
        <article className="wk paper s2 rv" style={{ ["--sheet" as string]: C.cream, ["--on" as string]: "#1F1D1A", ["--lift" as string]: "7px", ["--d" as string]: "0.1s" }}>
          <h3>{w.clients.title}</h3>
          <p>{w.clients.text}</p>
          <div className="owe"><small>{w.clients.owe}</small><b>{fmt(owe)} zł</b></div>
          <div className="cl">
            {clients.map(([name, col, paid, total], i) => (
              <div key={name} className="cl-row">
                <span className="cl-av" style={{ background: col }}>{name[0]}</span>
                <div>
                  <span className="cl-top"><b>{name}</b><small>{fmt(paid)} / {fmt(total)} zł</small></span>
                  <span className="cl-bar"><i style={{ width: seen ? `${(paid / total) * 100}%` : "0%", background: col, transitionDelay: `${0.2 + i * 0.12}s` }} /></span>
                </div>
              </div>
            ))}
          </div>
          <ul>{w.clients.points.map((p, i) => <li key={i}><Ic n="check" size={15} />{p}</li>)}</ul>
        </article>
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ рапорт PDF
function Report({ c }: { c: Content }) {
  const r = c.report, d = r.doc;
  const [ref, seen] = useSeen<HTMLDivElement>();
  const rows: [string, number, number][] = [["02", 8, 8], ["03", 7, 9], ["04", 8, 8.5], ["05", 9, 6], ["06", 8, 8], ["09", 10, 7], ["10", 8, 8], ["11", 7, 9.5]];
  return (
    <section className="sec report" id="report">
      <div className="rp-text">
        <Label>{r.label}</Label>
        <h2 className="rv">{r.title}</h2>
        <p className="lead rv">{r.lead}</p>
        <ol className="steps">
          {r.steps.map(([t, s], i) => <li key={i} className="rv" style={{ ["--d" as string]: `${i * 0.08}s` }}><span>{i + 1}</span><div><h3>{t}</h3><p>{s}</p></div></li>)}
        </ol>
        <a className="b ink rv" href={appUrl("signup")} onClick={() => track("cta_signup")}>{r.cta} <Ic n="arrow" /></a>
      </div>
      <div className={`rp-art${seen ? " seen" : ""}`} ref={ref} aria-hidden>
        <Cutout kind="spark" size={70} color={C.orange} seed={3} className="fl f1" />
        <div className="plane"><Ic n="send" size={34} sw={2} /></div>
        <div className="doc">
          <header><span className="doc-logo"><LogoMark size={26} color="#1F1D1A" flat /> OSIRIS</span><span className="doc-h"><b>{d.head}</b>{d.period}</span></header>
          <div className="doc-fields"><span><small>{d.worker}</small>Anna Kowalska</span><span><small>{d.forWhom}</small>Logistic Sp. z o.o.</span></div>
          <div className="doc-tiles">
            {[[d.hours, "164:30"], [d.days, "21"], [d.tasks, "3"], [d.total, "5 464 zł"]].map(([k, v]) => <span key={k}><small>{k}</small><b>{v}</b></span>)}
          </div>
          <p className="doc-cap">{d.schedule}</p>
          <div className="doc-rows">
            {rows.map(([day, start, len], i) => (
              <div key={day}><span>{day}.11</span><em><i style={{ left: `${(start - 6) * 7.1}%`, width: seen ? `${len * 7.1}%` : "0%", transitionDelay: `${0.3 + i * 0.07}s` }} /></em><span>{String(len).replace(".5", ":30").replace(/^(\d+)$/, "$1:00")}</span></div>
            ))}
          </div>
          <footer><span>{d.sign1}</span><span>{d.sign2}</span></footer>
          <p className="doc-made">{d.made}</p>
        </div>
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ ещё, тарифы, магазины, вопросы
function Extras({ c }: { c: Content }) {
  const e = c.extras;
  const col = [C.lavender, C.orange, C.sage, C.butter, C.blush, C.teal];
  const ic: Record<string, string> = { widgets: "widgets", siri: "mic", friends: "users", goals: "star", mood: "smile", import: "import" };
  return (
    <section className="sec extras">
      <div className="sec-head">
        <Label>{e.label}</Label>
        <h2 className="rv">{e.title}</h2>
      </div>
      <div className="ex-grid">
        {e.items.map(([k, t, s], i) => (
          <article key={k} className={`ex paper s${i % 4} rv`} style={{ ["--d" as string]: `${(i % 3) * 0.07}s` }}>
            <span className="ex-ic" style={{ background: col[i], color: i === 1 || i === 5 ? "#F6F0E3" : "#1F1D1A" }}><Ic n={ic[k]} size={22} /></span>
            <h3>{t}</h3>
            <p>{s}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function Pricing({ c }: { c: Content }) {
  const p = c.pricing;
  const moods: OsiMood[] = ["sleepy", "happy", "excited"];
  const sheet = [C.cream, C.orange, C.navy];
  return (
    <section className="sec pricing" id="pricing">
      <div className="sec-head">
        <Label>{p.label}</Label>
        <h2 className="rv">{p.title}</h2>
        <p className="lead rv">{p.lead}</p>
      </div>
      <div className="pr-grid">
        {p.plans.map((pl, i) => (
          <article key={i} className={`pr paper s${i + 1} rv${i === 1 ? " hot" : ""}`} style={{ ["--sheet" as string]: sheet[i], ["--on" as string]: i === 0 ? "#1F1D1A" : "#F6F0E3", ["--lift" as string]: "7px", ["--d" as string]: `${i * 0.09}s` } as CSSProperties}>
            {i === 1 && <span className="sticker">{p.popular}</span>}
            <div className="pr-top">
              <div><h3>{pl.name}</h3><p>{pl.tagline}</p></div>
              <span className="pr-osi" style={{ background: i === 1 ? C.butter : i === 2 ? C.lavender : C.sage }}><Osi size={74} mood={moods[i]} /></span>
            </div>
            <p className="price"><b>{pl.price}</b>{i > 0 && <span>{p.perMonth}</span>}</p>
            <p className="osi-n"><b>{pl.osi}</b> {p.perDay}</p>
            <ul>{pl.points.map((x, k) => <li key={k}><Ic n="check" size={15} />{x}</li>)}</ul>
            <a className={`b ${i === 1 ? "ink" : i === 2 ? "cream" : "ghost"}`} href={appUrl("signup")} onClick={() => track("cta_signup")}>{pl.cta}</a>
          </article>
        ))}
      </div>
      <p className="pr-note rv">{p.test}</p>
    </section>
  );
}

function Stores({ c, lang }: { c: Content; lang: SiteLang }) {
  const s = c.stores, f = s.form;
  const [email, setEmail] = useState("");
  const [trap, setTrap] = useState("");
  const [state, setState] = useState<"" | "busy" | "ok" | "bad" | "fail">("");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) return setState("bad");
    setState("busy");
    try {
      const [st] = await siteCall({ action: "waitlist", email: email.trim(), lang, platform: "both", website: trap });
      setState(st === 200 ? "ok" : st === 400 ? "bad" : "fail");
      if (st === 200) track("waitlist");
    } catch { setState("fail"); }
  };
  return (
    <section className="sec stores" id="apps">
      <div className="st paper rv" style={{ ["--sheet" as string]: C.charcoal, ["--on" as string]: "#F6F0E3", ["--lift" as string]: "8px" }}>
        <Cutout kind="sun" size={120} color={C.mustard} seed={11} className="fl f1" />
        <Cutout kind="blob" size={90} color={C.orange} seed={6} className="fl f2" />
        <div className="st-text">
          <p className="label">{s.label}</p>
          <h2>{s.title}</h2>
          <p className="lead">{s.lead}</p>
          <div className="badges">
            <span className="badge"><Ic n="phone" size={22} /><span><small>{s.soon}</small><b>{s.ios}</b></span></span>
            <span className="badge"><Ic n="phone" size={22} /><span><small>{s.soon}</small><b>{s.android}</b></span></span>
            <a className="badge live" href={appUrl()} onClick={() => track("store_click")}><Ic n="laptop" size={22} /><span><small>{s.web}</small><b>{s.webCta}</b></span></a>
          </div>
        </div>
        <form className="st-form" onSubmit={submit} noValidate>
          <Osi size={120} mood={state === "ok" ? "excited" : state === "bad" || state === "fail" ? "worried" : "happy"} />
          <label className="sr" htmlFor="wl-email">Email</label>
          <div className={`st-field${state === "bad" ? " bad" : ""}`}>
            <Ic n="mail" size={18} />
            <input id="wl-email" type="email" inputMode="email" autoComplete="email" placeholder={f.placeholder} value={email} maxLength={160} disabled={state === "ok"} onChange={(e) => { setEmail(e.target.value); if (state) setState(""); }} />
          </div>
          <input className="hp" type="text" name="website" tabIndex={-1} autoComplete="off" value={trap} onChange={(e) => setTrap(e.target.value)} aria-hidden />
          <button type="submit" className="b orange" disabled={state === "busy" || state === "ok"}>{f.button}</button>
          <p className={`st-msg${state && state !== "busy" ? " show" : ""}`} role="status">{state === "ok" ? f.ok : state === "bad" ? f.bad : state === "fail" ? f.fail : f.consent}</p>
          {!state && <p className="st-consent">{f.consent}</p>}
        </form>
      </div>
    </section>
  );
}

function Faq({ c }: { c: Content }) {
  const f = c.faq;
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section className="sec faq" id="faq">
      <div className="sec-head">
        <Label>{f.label}</Label>
        <h2 className="rv">{f.title}</h2>
      </div>
      <div className="fq">
        {f.items.map(([q, a], i) => (
          <div key={i} className={`fq-item paper s${i % 4} rv${open === i ? " open" : ""}`} style={{ ["--d" as string]: `${Math.min(i, 5) * 0.04}s` }}>
            <h3><button type="button" aria-expanded={open === i} aria-controls={`fq${i}`} onClick={() => setOpen(open === i ? null : i)}>{q}<span className="fq-plus" /></button></h3>
            <div id={`fq${i}`} className="fq-body" role="region"><div><p>{a}</p></div></div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Final({ c }: { c: Content }) {
  return (
    <section className="sec final">
      <PaperCta>
        <Osi size={170} mood="excited" wave />
        <h2>{c.final.title}</h2>
        <p>{c.final.lead}</p>
        <a className="b cream lg" href={appUrl("signup")} onClick={() => track("cta_signup")}>{c.final.cta} <Ic n="arrow" /></a>
      </PaperCta>
    </section>
  );
}
const PaperCta = ({ children }: { children: ReactNode }) => (
  <div className="fin paper rv" style={{ ["--sheet" as string]: C.orange, ["--on" as string]: "#F6F0E3", ["--lift" as string]: "9px" }}>
    <Cutout kind="star" size={70} color={C.butter} seed={2} className="fl f1" />
    <Cutout kind="leaf" size={80} color={C.sage} seed={8} className="fl f2" />
    <Cutout kind="ring" size={64} color={C.cream} seed={10} className="fl f3" />
    {children}
  </div>
);

export { PaperSheet };
