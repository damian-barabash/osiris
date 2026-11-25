import type { CSSProperties } from "react";
import "./logo.css";

// Знак OSIRIS — вектор из design/mark.py (кадр 500×460): два «глаза» и три луча.
const UPPER = "M83.1 296.3 Q259.4 392.1 416.0 232.0 Q243.0 38.8 61.6 226.5";
const LOWER = "M233 222.75 Q324.5 223.5 416 323 Q236 534 50 320 Q141.5 222 233 222.75 Z";
const RAYS = [[115, 75, -20], [232, 55, 0], [352, 75, 20]] as const;

/** Знак из оранжевой бумаги со слоем-тенью. draw — прорисовка линий при появлении (CSS). */
export function LogoMark({ size = 36, color = "#E2582B", draw = false, flat = false, className, style }: { size?: number; color?: string; draw?: boolean; flat?: boolean; className?: string; style?: CSSProperties }) {
  const layer = (c: string, dy: number, cls = "") => (
    <g transform={`translate(0 ${dy})`} className={cls}>
      <path d={LOWER} pathLength={1} fill="none" stroke={c} strokeWidth={25} strokeLinejoin="miter" strokeMiterlimit={8} className="lm-lower" />
      <path d={UPPER} pathLength={1} fill="none" stroke={c} strokeWidth={25} strokeLinejoin="miter" strokeMiterlimit={8} className="lm-upper" />
      {RAYS.map(([x, y, r], i) => (
        <rect key={i} x={x - 14} y={y - 31} width={28} height={62} rx={4} fill={c} transform={`rotate(${r} ${x} ${y})`} className="lm-ray" style={{ transformOrigin: `${x}px ${y}px`, ["--i" as string]: i }} />
      ))}
    </g>
  );
  return (
    <svg aria-hidden className={`logomark${draw ? " draw" : ""}${className ? " " + className : ""}`} width={size} height={(size * 460) / 500} viewBox="0 0 500 460" style={{ overflow: "visible", flex: "none", ...style }}>
      {!flat && layer("color-mix(in srgb, " + color + " 84%, #000)", 9, "lm-shade")}
      {layer(color, 0)}
    </svg>
  );
}

export function Wordmark({ size = 18, className }: { size?: number; className?: string }) {
  return <span className={`wordmark${className ? " " + className : ""}`} style={{ fontSize: size, letterSpacing: size * 0.22, marginRight: -size * 0.22 }}>OSIRIS</span>;
}

/** Знак + слово. */
export function Logo({ size = 30, className }: { size?: number; className?: string }) {
  return (
    <span className={`logo${className ? " " + className : ""}`}>
      <LogoMark size={size} />
      <Wordmark size={size * 0.56} />
    </span>
  );
}
