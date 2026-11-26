// Шапка, подвал и мелкие значки лендинга. Значки — свои inline-SVG, чтобы лендинг не тянул набор значков приложения.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Logo } from "@/brand/Logo";
import { openCookieSettings } from "@/lib/consent";
import { track } from "@/lib/track";
import { COMPANY, CONTENT, LANG_NAME, SITE_LANGS, prefix, type SiteLang } from "./content";

const PATHS: Record<string, string> = {
  check: "M5 12.5l4.5 4.5L19 7.5",
  arrow: "M5 12h14M13 6l6 6-6 6",
  menu: "M4 7h16M4 12h16M4 17h16",
  close: "M6 6l12 12M18 6L6 18",
  down: "M6 9l6 6 6-6",
  globe: "M12 3a9 9 0 100 18 9 9 0 000-18zM3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9S14.5 18.4 12 21c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z",
  send: "M4 12l16-8-6 16-3-7-7-1z",
  clock: "M12 3a9 9 0 100 18 9 9 0 000-18zM12 7v5l3 2",
  users: "M16 19v-1.5a3.5 3.5 0 00-3.5-3.5h-5A3.5 3.5 0 004 17.5V19M10 10.5a3 3 0 100-6 3 3 0 000 6zM20 19v-1.5a3.5 3.5 0 00-2.6-3.4M15.5 4.7a3 3 0 010 5.6",
  widgets: "M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z",
  mic: "M12 3a3 3 0 00-3 3v6a3 3 0 006 0V6a3 3 0 00-3-3zM6 11a6 6 0 0012 0M12 17v4",
  star: "M12 3.5l2.7 5.4 6 .9-4.3 4.2 1 6-5.4-2.9L6.6 20l1-6L3.3 9.8l6-.9z",
  smile: "M12 3a9 9 0 100 18 9 9 0 000-18zM8.5 14.5c1 1.2 2.1 1.8 3.5 1.8s2.5-.6 3.5-1.8M9 9.8h.01M15 9.8h.01",
  import: "M12 3v12M7 10l5 5 5-5M4 20h16",
  phone: "M8 3h8a2 2 0 012 2v14a2 2 0 01-2 2H8a2 2 0 01-2-2V5a2 2 0 012-2zM11 18h2",
  laptop: "M5 5h14a1 1 0 011 1v10H4V6a1 1 0 011-1zM2 19h20",
  mail: "M4 6h16v12H4zM4 7l8 6 8-6",
  repeat: "M17 3l3 3-3 3M4 11V9a3 3 0 013-3h13M7 21l-3-3 3-3M20 13v2a3 3 0 01-3 3H4",
  pin: "M12 21s7-6.2 7-11.5A7 7 0 005 9.5C5 14.8 12 21 12 21zM12 12a2.5 2.5 0 100-5 2.5 2.5 0 000 5z",
};
export function Ic({ n, size = 18, sw = 2.2 }: { n: keyof typeof PATHS | string; size?: number; sw?: number }) {
  return <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><path d={PATHS[n] ?? PATHS.star} /></svg>;
}

/** Адрес той же страницы на другом языке. */
export const pageUrl = (lang: SiteLang, page: string) => `${prefix(lang)}/${page ? page + "/" : ""}`;
export const appUrl = (mode?: "signup") => `/app/${mode ? "?mode=signup" : ""}`;

export function Header({ lang, page }: { lang: SiteLang; page: string }) {
  const c = CONTENT[lang];
  const [open, setOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [stuck, setStuck] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);
  const home = page === "";
  const a = (id: string) => (home ? `#${id}` : `${pageUrl(lang, "")}#${id}`);

  useEffect(() => {
    const on = () => setStuck(window.scrollY > 12);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle("menu-open", open);
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); setLangOpen(false); } };
    const click = (e: MouseEvent) => { if (!langRef.current?.contains(e.target as Node)) setLangOpen(false); };
    document.addEventListener("keydown", key);
    document.addEventListener("click", click);
    return () => { document.removeEventListener("keydown", key); document.removeEventListener("click", click); };
  }, [open]);

  const links: [string, string][] = [["osi", c.nav.osi], ["calendar", c.nav.views], ["hours", c.nav.hours], ["report", c.nav.report], ["pricing", c.nav.pricing], ["faq", c.nav.faq]];
  const pickLang = (l: SiteLang) => { try { localStorage.setItem("osiris_site_lang", l); } catch { /* */ } track("lang_switch"); };

  return (
    <header className={`hd${stuck ? " stuck" : ""}${open ? " open" : ""}`}>
      <a className="skip" href="#main">{c.skip}</a>
      <div className="hd-bar">
        <a href={pageUrl(lang, "")} className="hd-logo" aria-label="OSIRIS"><Logo size={30} /></a>
        <nav className="hd-nav" aria-label={c.nav.menu}>
          {links.map(([id, t]) => <a key={id} href={a(id)}>{t}</a>)}
        </nav>
        <div className="hd-right">
          <div className={`lang${langOpen ? " open" : ""}`} ref={langRef}>
            <button type="button" className="lang-btn" aria-haspopup="true" aria-expanded={langOpen} aria-label={c.nav.lang} onClick={() => setLangOpen((v) => !v)}>
              <Ic n="globe" size={16} /> <span>{lang.toUpperCase()}</span> <Ic n="down" size={14} />
            </button>
            <div className="lang-menu" role="menu" inert={!langOpen}>
              {SITE_LANGS.map((l) => (
                <a key={l} role="menuitem" href={pageUrl(l, page)} hrefLang={l} lang={l} aria-current={l === lang ? "true" : undefined} onClick={() => pickLang(l)}>{LANG_NAME[l]}</a>
              ))}
            </div>
          </div>
          <a className="b ghost sm hd-login" href={appUrl()} onClick={() => track("cta_login")}>{c.nav.login}</a>
          <a className="b orange sm" href={appUrl("signup")} onClick={() => track("cta_signup")}>{c.nav.signup}</a>
          <button type="button" className="hd-burger" aria-label={c.nav.menu} aria-expanded={open} onClick={() => setOpen((v) => !v)}><Ic n={open ? "close" : "menu"} size={22} /></button>
        </div>
      </div>
      <div className="hd-sheet" inert={!open}>
        <nav aria-label={c.nav.menu}>
          {links.map(([id, t], i) => <a key={id} href={a(id)} style={{ ["--i" as string]: i }} onClick={() => setOpen(false)}>{t}</a>)}
        </nav>
        <div className="hd-sheet-cta">
          <a className="b ghost" href={appUrl()} onClick={() => track("cta_login")}>{c.nav.login}</a>
          <a className="b orange" href={appUrl("signup")} onClick={() => track("cta_signup")}>{c.nav.signup}</a>
        </div>
      </div>
    </header>
  );
}

export function Footer({ lang }: { lang: SiteLang }) {
  const c = CONTENT[lang], f = c.footer;
  return (
    <footer className="ft">
      <div className="ft-grid">
        <div className="ft-brand">
          <Logo size={30} />
          <p>{f.tagline}</p>
          <a className="b ghost sm" href={appUrl()}>{f.webApp} <Ic n="arrow" size={15} /></a>
        </div>
        <FtCol title={f.product}>
          <a href={`${pageUrl(lang, "")}#osi`}>{c.nav.osi}</a>
          <a href={`${pageUrl(lang, "")}#calendar`}>{c.nav.views}</a>
          <a href={`${pageUrl(lang, "")}#hours`}>{c.nav.hours}</a>
          <a href={`${pageUrl(lang, "")}#report`}>{c.nav.report}</a>
          <a href={`${pageUrl(lang, "")}#pricing`}>{c.nav.pricing}</a>
        </FtCol>
        <FtCol title={f.legal}>
          <a href={pageUrl(lang, "terms")}>{f.terms}</a>
          <a href={pageUrl(lang, "privacy")}>{f.privacy}</a>
          <a href={pageUrl(lang, "cookies")}>{f.cookies}</a>
          <button type="button" onClick={openCookieSettings}>{f.cookieSettings}</button>
        </FtCol>
        <FtCol title={f.contact}>
          <a href={pageUrl(lang, "support")}>{f.support}</a>
          <a href={pageUrl(lang, "delete-account")}>{f.deleteAccount}</a>
          <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>
          <a href={COMPANY.studioUrl} target="_blank" rel="noopener">dbdcstudio.pl</a>
        </FtCol>
      </div>
      <div className="ft-legal">
        <address>
          <b>{f.operator}</b>
          <span>{COMPANY.name}</span>
          <span>{COMPANY.street}, {COMPANY.city}, {COMPANY.country[lang]}</span>
          <span>NIP: {COMPANY.nip} · REGON: {COMPANY.regon}</span>
        </address>
        <div className="ft-made">
          <span>© {new Date().getFullYear()} OSIRIS. {f.rights}</span>
          <span>{f.madeBy} <a href={COMPANY.studioUrl} target="_blank" rel="noopener">{COMPANY.studio}</a></span>
        </div>
      </div>
    </footer>
  );
}

function FtCol({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="ft-col">
      <h2>{title}</h2>
      {children}
    </div>
  );
}

/** Появление блоков при прокрутке: элементам с классом .rv добавляется .in, когда они входят в экран. */
export function useReveal() {
  useEffect(() => {
    const els = [...document.querySelectorAll<HTMLElement>(".rv:not([data-in])")];
    if (!("IntersectionObserver" in window)) { els.forEach((e) => { e.dataset.in = "1"; }); return; }
    const io = new IntersectionObserver((list) => {
      for (const e of list) if (e.isIntersecting) { (e.target as HTMLElement).dataset.in = "1"; io.unobserve(e.target); }
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, []);
}
