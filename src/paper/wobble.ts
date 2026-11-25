// «Вырезанный ножницами» край — тот же приём, что в приложении (wobblePath в app/lib/paper/paper.dart):
// точки по контуру сдвигаются по нормали гладким шумом и замыкаются кривыми Catmull-Rom.

export type Pt = [number, number];

/** Детерминированный шум 0..1 по строке (одинаковый на сервере и в браузере — важно для гидрации). */
export function rnd(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 13;
  h = Math.imul(h, 0x5bd1e995);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

const smoothNoise = (seed: number, x: number) => {
  const i = Math.floor(x), f = x - i;
  const a = rnd(`${seed}-${i}`) * 2 - 1, b = rnd(`${seed}-${i + 1}`) * 2 - 1;
  return a + (b - a) * (f * f * (3 - 2 * f));
};

const cubic = (p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): Pt => {
  const u = 1 - t;
  return [
    u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
    u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
  ];
};

const resample = (pts: Pt[], step: number): Pt[] => {
  const out: Pt[] = [];
  const n = pts.length;
  let acc = 0;
  for (let k = 0; k < n; k++) {
    const a = pts[k], b = pts[(k + 1) % n];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    let d = acc;
    while (d < len) {
      const t = d / len;
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      d += step;
    }
    acc = d - len;
  }
  const clean: Pt[] = [];
  for (const p of out) {
    const q = clean[clean.length - 1];
    if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > step * 0.5) clean.push(p);
  }
  while (clean.length > 3 && Math.hypot(clean[0][0] - clean[clean.length - 1][0], clean[0][1] - clean[clean.length - 1][1]) < step * 0.5) clean.pop();
  return clean;
};

const cache = new Map<string, string>();

export function wobble(dense: Pt[], { seed = 1, amp = 1.4, step = 10, freq = 0.35 } = {}): string {
  const pts = resample(dense, step);
  const n = pts.length;
  const moved = pts.map((p, k) => {
    const a = pts[(k - 1 + n) % n], b = pts[(k + 1) % n];
    const tx = b[0] - a[0], ty = b[1] - a[1];
    const l = Math.hypot(tx, ty) || 1;
    const w = smoothNoise(seed, k * freq) * amp;
    return [p[0] + (-ty / l) * w, p[1] + (tx / l) * w] as Pt;
  });
  const f = (v: number) => v.toFixed(1);
  let d = `M${f(moved[0][0])} ${f(moved[0][1])}`;
  for (let k = 0; k < n; k++) {
    const p0 = moved[(k - 1 + n) % n], p1 = moved[k], p2 = moved[(k + 1) % n], p3 = moved[(k + 2) % n];
    d += `C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d + "Z";
}

export const rrectPts = (x: number, y: number, w: number, h: number, r: number): Pt[] => {
  const out: Pt[] = [];
  r = Math.min(r, w / 2, h / 2);
  const corner = (cx: number, cy: number, a0: number) => {
    for (let i = 0; i <= 8; i++) {
      const a = a0 + (i / 8) * (Math.PI / 2);
      out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
  };
  corner(x + w - r, y + r, -Math.PI / 2);
  corner(x + w - r, y + h - r, 0);
  corner(x + r, y + h - r, Math.PI / 2);
  corner(x + r, y + r, Math.PI);
  return out;
};

export const ellipsePts = (cx: number, cy: number, rx: number, ry: number): Pt[] =>
  Array.from({ length: 64 }, (_, i) => {
    const a = (i / 64) * Math.PI * 2;
    return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry] as Pt;
  });

export const cubicPts = (segs: [Pt, Pt, Pt, Pt][]): Pt[] => {
  const out: Pt[] = [];
  for (const s of segs) for (let i = 0; i < 24; i++) out.push(cubic(s[0], s[1], s[2], s[3], i / 24));
  return out;
};

export const starPts = (cx: number, cy: number, R: number, r: number, n = 5): Pt[] => {
  const out: Pt[] = [];
  for (let i = 0; i < n * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / n;
    const rr = i % 2 ? r : R;
    out.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  return out;
};

/** Контур скруглённого листа w×h (кэш по размеру и seed). */
export function sheetPath(w: number, h: number, r = 28, seed = 1, amp?: number): string {
  const key = `${Math.round(w)}x${Math.round(h)}r${r}s${seed}a${amp ?? ""}`;
  let d = cache.get(key);
  if (!d) {
    d = wobble(rrectPts(0, 0, w, h, r), { seed, amp: amp ?? Math.max(1.2, Math.min(w, h) / 120), step: Math.max(9, Math.min(w, h) / 22) });
    if (cache.size > 400) cache.clear();
    cache.set(key, d);
  }
  return d;
}

/** Темнее на k (0..1) — слой-тень бумаги. */
export const shade = (hex: string, k = 0.14) => {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.round(v * (1 - k)).toString(16).padStart(2, "0");
  return `#${f((n >> 16) & 255)}${f((n >> 8) & 255)}${f(n & 255)}`;
};
