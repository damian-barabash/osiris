// Корень сайта: шапка, страница (лендинг, документ или 404), подвал, баннер cookies, чат Оси.
import { Suspense, lazy, useEffect, useState } from "react";
import { Osi } from "@/brand/Osi";
import { getConsent, onConsent, setConsent } from "@/lib/consent";
import { track } from "@/lib/track";
import { Footer, Header, Ic, pageUrl, useReveal } from "./Chrome";
import { Landing } from "./Landing";
import { CONTENT, type SiteLang } from "./content";
import { LEGAL, LEGAL_KEYS, type LegalBlock, type LegalKey } from "./legal";

const ChatWidget = lazy(() => import("./ChatWidget"));
export type PageKey = "" | LegalKey | "404";

export function Site({ lang, page }: { lang: SiteLang; page: PageKey }) {
  const [ready, setReady] = useState(false);
  useReveal();
  useEffect(() => {
    document.documentElement.classList.remove("no-js");
    track("view");
    const off = onConsent(() => track("view")); // согласие дали только что — засчитать и эту страницу
    const idle = window.requestIdleCallback ?? ((f: () => void) => setTimeout(f, 900));
    idle(() => setReady(true));
    return off;
  }, []);
  return (
    <>
      <Header lang={lang} page={page === "404" ? "" : page} />
      <main id="main">
        {page === "" ? <Landing lang={lang} /> : page === "404" ? <NotFound lang={lang} /> : <Legal lang={lang} doc={page} />}
      </main>
      <Footer lang={lang} />
      <CookieBanner lang={lang} />
      {ready && <Suspense fallback={null}><ChatWidget lang={lang} /></Suspense>}
    </>
  );
}

function Block({ b }: { b: LegalBlock }) {
  if (typeof b === "string") {
    // адреса и почта в тексте становятся ссылками (текст наш, не пользовательский)
    const parts = b.split(/(https?:\/\/[^\s]+[^\s.,;)]|[\w.]+@[\w.]+\.\w+)/g);
    return <p>{parts.map((p, i) => (/^https?:\/\//.test(p) ? <a key={i} href={p} rel="noopener" target="_blank">{p}</a> : /@/.test(p) && /^[\w.]+@[\w.]+\.\w+$/.test(p) ? <a key={i} href={`mailto:${p}`}>{p}</a> : p))}</p>;
  }
  if (Array.isArray(b)) return <ul>{b.map((x, i) => <li key={i}>{x}</li>)}</ul>;
  return (
    <table>
      <thead><tr>{b.table[0].map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead>
      <tbody>{b.table.slice(1).map((r, i) => <tr key={i}>{r.map((c, k) => <td key={k}>{k === 0 ? <code>{c}</code> : c}</td>)}</tr>)}</tbody>
    </table>
  );
}

function Legal({ lang, doc }: { lang: SiteLang; doc: LegalKey }) {
  const set = LEGAL[lang], d = set[doc], f = CONTENT[lang].footer;
  const names: Record<LegalKey, string> = { terms: f.terms, privacy: f.privacy, cookies: f.cookies };
  return (
    <article className="legal">
      <h1 className="up">{d.title}</h1>
      <p className="updated up" style={{ ["--d" as string]: "0.08s" }}>{set.updated}</p>
      {set.note && <p className="legal-box paper up" style={{ ["--d" as string]: "0.14s" }}>{set.note} <a href={pageUrl("pl", doc)} hrefLang="pl">Wersja polska</a></p>}
      <p className="lead up" style={{ ["--d" as string]: "0.18s" }}>{d.intro}</p>
      {d.sections.map((s, i) => (
        <section key={i} className="rv">
          <h2>{s.h}</h2>
          {s.body.map((b, k) => <Block key={k} b={b} />)}
        </section>
      ))}
      <nav className="legal-nav" aria-label={f.legal}>
        {LEGAL_KEYS.filter((k) => k !== doc).map((k) => <a key={k} className="b ghost sm" href={pageUrl(lang, k)}>{names[k]} <Ic n="arrow" size={15} /></a>)}
      </nav>
    </article>
  );
}

function NotFound({ lang }: { lang: SiteLang }) {
  const n = CONTENT[lang].notFound;
  return (
    <section className="nf">
      <Osi size={180} mood="worried" />
      <h1>{n.title}</h1>
      <p className="lead">{n.text}</p>
      <a className="b orange" href={pageUrl(lang, "")}>{n.home}</a>
    </section>
  );
}

/** Баннер cookies: выезжает снизу, настройки раскрываются по высоте. Открывается заново из подвала. */
function CookieBanner({ lang }: { lang: SiteLang }) {
  const c = CONTENT[lang].cookie;
  const [show, setShow] = useState(false);
  const [closing, setClosing] = useState(false);
  const [more, setMore] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => { if (!getConsent()) setShow(true); }, 1400);
    const reopen = () => { setAnalytics(getConsent()?.analytics ?? false); setMore(true); setClosing(false); setShow(true); };
    window.addEventListener("osiris:cookies", reopen);
    return () => { clearTimeout(t); window.removeEventListener("osiris:cookies", reopen); };
  }, []);
  if (!show) return null;
  const done = (a: boolean) => { setConsent(a); setClosing(true); setTimeout(() => { setShow(false); setClosing(false); setMore(false); }, 320); };
  return (
    <aside className={`ck${closing ? " closing" : ""}`} role="dialog" aria-label={c.title} aria-live="polite">
      <div className="ck-top">
        <Osi size={64} mood="calm" />
        <div><h2>{c.title}</h2><p>{c.text} <a href={pageUrl(lang, "cookies")}>{c.more}</a></p></div>
      </div>
      <div className={`ck-more${more ? " open" : ""}`} inert={!more}>
        <div>
          <div className="ck-cat"><div><b>{c.cats.necessary[0]}</b><small>{c.cats.necessary[1]}</small></div><span className="ck-always">{c.always}</span></div>
          <div className="ck-cat">
            <div><b>{c.cats.analytics[0]}</b><small>{c.cats.analytics[1]}</small></div>
            <button type="button" role="switch" aria-checked={analytics} aria-label={c.cats.analytics[0]} className={`ck-sw${analytics ? " on" : ""}`} onClick={() => setAnalytics((v) => !v)}><i /></button>
          </div>
        </div>
      </div>
      <div className="ck-btns">
        {more ? <button type="button" className="b ink sm" onClick={() => done(analytics)}>{c.save}</button> : <button type="button" className="b ghost sm" onClick={() => setMore(true)}>{c.settings}</button>}
        <button type="button" className="b ghost sm" onClick={() => done(false)}>{c.necessary}</button>
        <button type="button" className="b orange sm" onClick={() => done(true)}>{c.accept}</button>
      </div>
    </aside>
  );
}
