// Палитра листов — как P.named в приложении (цвета хранятся в базе по имени).
export const NAMED: Record<string, string> = {
  clay: "#7A4545", orange: "#E2582B", lavender: "#9C9FDD", sage: "#A7C98C", charcoal: "#2E2D2B", teal: "#2F8794", mustard: "#D8C24B", butter: "#F1E5A0", navy: "#1F2F45", blush: "#E9A9A0",
  mint: "#B8E0D2", peach: "#F6C6A8", lilac: "#CDB8E6", sky: "#A9CFEA", rose: "#F2B8C6", sand: "#E8D8B0", pistachio: "#C9DFA0", powder: "#C4D3F2", apricot: "#F4B183", seafoam: "#8FCFC0", cream: "#F3E9D2",
  coral: "#EE8C79", plum: "#8E5C86", olive: "#9AA36B", cocoa: "#8B6A55", slate: "#6D7A8C", cherry: "#B5413F", forest: "#3F6B4F",
};
export const COLOR_NAMES = Object.keys(NAMED);
export const P = { ...NAMED, ink: "#1F1D1A", creamInk: "#F6F0E3", danger: "#C8402A", work: "#2F8794", personal: "#E2582B" } as Record<string, string>;

/** Цвет листа по имени из базы (или уже готовый #hex / css-переменная). */
export const colorOf = (name?: string | null, fallback = "orange") => (name && (NAMED[name] ?? (name.startsWith("#") || name.startsWith("var(") ? name : null))) || NAMED[fallback] || fallback;

const lum = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f((n >> 16) & 255) + 0.7152 * f((n >> 8) & 255) + 0.0722 * f(n & 255);
};
/** Цвет текста на листе: тёмные чернила на светлом, кремовый на тёмном. Для css-переменных — чернила темы. */
export const onColor = (c: string) => (c.startsWith("#") && c.length === 7 ? (lum(c) > 0.42 ? "#1F1D1A" : "#F6F0E3") : "var(--ink)");
export const sphereColor = (s: "work" | "personal") => (s === "work" ? P.work : P.personal);
