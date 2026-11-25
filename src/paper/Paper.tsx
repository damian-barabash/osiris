import type { CSSProperties, ReactNode } from "react";
import { cubicPts, ellipsePts, shade, sheetPath, starPts, wobble } from "./wobble";

/** Настоящий вырезанный лист (SVG-контур) фиксированного размера: для героя лендинга, макетов, наклеек. */
export function PaperSheet({ w, h, r = 28, color, seed = 1, lift = 6, amp, className, style, children }: {
  w: number; h: number; r?: number; color: string; seed?: number; lift?: number; amp?: number; className?: string; style?: CSSProperties; children?: ReactNode;
}) {
  const d = sheetPath(w, h, r, seed, amp);
  return (
    <div className={className} style={{ position: "relative", width: w, height: h, ...style }}>
      <svg aria-hidden width={w + 40} height={h + 48} viewBox={`-20 -20 ${w + 40} ${h + 48}`} style={{ position: "absolute", left: -20, top: -20, overflow: "visible" }}>
        <path d={d} fill="var(--shadow)" transform={`translate(0 ${lift * 2.2})`} style={{ filter: `blur(${lift * 1.5}px)` }} />
        <path d={d} fill={shade(color, 0.14)} transform={`translate(0 ${lift})`} />
        <path d={d} fill={color} />
      </svg>
      <div style={{ position: "absolute", inset: 0 }}>{children}</div>
    </div>
  );
}

export type CutKind = "star" | "ring" | "leaf" | "sun" | "blob" | "spark" | "drop" | "cloud";

const cutCache = new Map<string, [string, string | null]>();
function cutPath(kind: CutKind, seed: number): [string, string | null] {
  const key = kind + seed;
  const hit = cutCache.get(key);
  if (hit) return hit;
  let d = "", hole: string | null = null;
  switch (kind) {
    case "star": d = wobble(starPts(50, 52, 46, 20), { seed, amp: 1.2, step: 4 }); break;
    case "spark": d = wobble(starPts(50, 50, 46, 12, 4), { seed, amp: 1, step: 4 }); break;
    case "ring": d = wobble(ellipsePts(50, 50, 44, 44), { seed, amp: 1.4, step: 5 }); hole = wobble(ellipsePts(50, 50, 22, 22), { seed: seed + 1, amp: 1, step: 4 }); break;
    case "sun": d = wobble(starPts(50, 50, 46, 34, 12), { seed, amp: 0.8, step: 3 }); break;
    case "leaf": d = wobble(cubicPts([[[50, 4], [86, 30], [86, 70], [50, 96]], [[50, 96], [14, 70], [14, 30], [50, 4]]]), { seed, amp: 1.2, step: 5 }); break;
    case "drop": d = wobble(cubicPts([[[50, 4], [80, 44], [88, 96], [50, 96]], [[50, 96], [12, 96], [20, 44], [50, 4]]]), { seed, amp: 1.2, step: 5 }); break;
    case "cloud": d = wobble(cubicPts([[[20, 70], [0, 70], [0, 44], [22, 42]], [[22, 42], [24, 18], [56, 14], [62, 36]], [[62, 36], [84, 28], [100, 48], [86, 64]], [[86, 64], [88, 74], [40, 74], [20, 70]]]), { seed, amp: 1, step: 5 }); break;
    default: d = wobble(cubicPts([[[50, 6], [92, 4], [98, 60], [62, 92]], [[62, 92], [20, 110], [2, 52], [50, 6]]]), { seed, amp: 1.6, step: 5 });
  }
  const out: [string, string | null] = [d, hole];
  cutCache.set(key, out);
  return out;
}

/** Вырезка-декор: звезда, кольцо, лист, солнце, клякса, искра, капля, облако. */
export function Cutout({ kind, size, color, seed = 3, flat = false, className, style }: { kind: CutKind; size: number; color: string; seed?: number; flat?: boolean; className?: string; style?: CSSProperties }) {
  const [d, hole] = cutPath(kind, seed);
  const full = hole ? `${d} ${hole}` : d;
  return (
    <svg aria-hidden className={className} width={size} height={size} viewBox="-6 -6 112 112" style={{ overflow: "visible", flex: "none", ...style }}>
      <g fillRule="evenodd">
        {!flat && <path d={full} fill={shade(color, 0.16)} transform="translate(0 3)" />}
        <path d={full} fill={color} />
      </g>
    </svg>
  );
}
