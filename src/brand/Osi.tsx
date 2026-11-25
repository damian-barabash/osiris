import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { cubicPts, ellipsePts, rrectPts, shade, wobble } from "../paper/wobble";

// Оси — порт OsiPainter из приложения (app/lib/brand/mascot.dart), холст 200×200.
// Анимация (покачивание, моргание, лучи, взмах) идёт по requestAnimationFrame и только пока маскот виден.

export type OsiMood = "happy" | "excited" | "listening" | "thinking" | "calm" | "sad" | "sleepy" | "worried";

const ORANGE = "#E2582B", SHADE = "#C24C25", CREAM = "#F6F0E3", INK = "#1F1D1A", CLAY = "#7A4545", BLUSH = "#E9A9A0";

const BODY = wobble(
  cubicPts([
    [[100, 32], [142, 32], [170, 66], [170, 110]],
    [[170, 110], [170, 154], [144, 180], [100, 180]],
    [[100, 180], [56, 180], [30, 154], [30, 110]],
    [[30, 110], [30, 66], [58, 32], [100, 32]],
  ]),
  { seed: 21, amp: 0.9, step: 6, freq: 0.1 },
);
const FOOT = [76, 124].map((x) => wobble(ellipsePts(x, 178, 15, 9), { seed: x, amp: 0.4, step: 4, freq: 0.15 }));
const RAY = [0, 1, 2].map((i) => wobble(rrectPts(-6, -14, 12, 28, 3), { seed: 30 + i, amp: 0.35, step: 3, freq: 0.15 }));
const ARM = [1, 2].map((i) => wobble(rrectPts(-9, -2, 18, 36, 9), { seed: 40 + i, amp: 0.4, step: 4, freq: 0.15 }));
const EYE = (() => {
  const w = 92, h = 52, c = [100, 100];
  const pts: [number, number][] = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24, u = 1 - t;
    pts.push([u * u * (c[0] - w / 2) + 2 * u * t * c[0] + t * t * (c[0] + w / 2), u * u * c[1] + 2 * u * t * (c[1] - h * 1.05) + t * t * c[1]]);
  }
  for (let i = 1; i < 24; i++) {
    const t = i / 24, u = 1 - t;
    pts.push([u * u * (c[0] + w / 2) + 2 * u * t * c[0] + t * t * (c[0] - w / 2), u * u * c[1] + 2 * u * t * (c[1] + h * 1.05) + t * t * c[1]]);
  }
  return wobble(pts, { seed: 50, amp: 0.4, step: 4, freq: 0.15 });
})();

const Paper = ({ d, color, lift = 2, edge }: { d: string; color: string; lift?: number; edge?: string }) => (
  <>
    <path d={d} fill={shade(color, 0.18)} transform={`translate(0 ${lift})`} />
    <path d={d} fill={color} stroke={edge} strokeWidth={edge ? 1.6 : undefined} />
  </>
);

/** Время в секундах, обновляется ~30 раз в секунду, пока элемент на экране. На сервере и при reduced-motion — 0. */
function useClock(ref: React.RefObject<Element | null>, on: boolean) {
  const [t, setT] = useState(0);
  useEffect(() => {
    if (!on || typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0, visible = true, last = 0;
    const start = performance.now() - Math.random() * 4000;
    const tick = (now: number) => {
      if (now - last > 32) {
        last = now;
        setT((now - start) / 1000);
      }
      if (visible) raf = requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver(([e]) => {
      const was = visible;
      visible = e.isIntersecting && !document.hidden;
      if (visible && !was) raf = requestAnimationFrame(tick);
    });
    if (ref.current) io.observe(ref.current);
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      visible = false;
    };
  }, [on, ref]);
  return t;
}

export function Osi({ size = 120, mood = "happy", wave = false, animate = true, look, className, style, title }: {
  size?: number; mood?: OsiMood; wave?: boolean; animate?: boolean; look?: [number, number]; className?: string; style?: CSSProperties; title?: string;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const sec = useClock(ref, animate);
  const t = sec / 6; // цикл 6 с, как в приложении
  const bob = Math.sin(t * Math.PI * 4) * 2.2;
  const blinkAt = (at: number) => {
    const d = Math.abs((t % 1) - at);
    return d < 0.014 ? 1 - d / 0.014 : 0;
  };
  const blink = Math.max(blinkAt(0.31), blinkAt(0.83));
  const up = mood === "excited";
  const rayWiggle = Math.sin(t * Math.PI * 6) * (up ? 7 : mood === "sleepy" || mood === "sad" ? 1 : 3);
  const waveA = wave ? Math.sin(t * Math.PI * 10) * 0.5 : 0;
  const armL = 0.75 + (up ? 1.2 : 0) - (mood === "sad" ? 0.35 : 0);
  const armR = -0.75 - (up || wave ? 1.25 + waveA : 0) + (mood === "sad" ? 0.35 : 0);
  const lid = mood === "sleepy" ? 0.38 : mood === "sad" ? 0.8 : 1;
  const open = (1 - blink) * lid;
  const lk = look ?? (mood === "thinking" ? [10, -10] : mood === "listening" ? [-2, -2] : mood === "sad" ? [0, 8] : [Math.sin(t * Math.PI * 2) * 5, 0]);
  const deg = (r: number) => (r * 180) / Math.PI;
  const clip = `osi${useId().replace(/[:«»]/g, "")}`;
  const eyeMode = mood === "happy" ? "smile" : "open";

  return (
    <svg ref={ref} className={className} width={size} height={size * 1.05} viewBox="0 -10 200 210" style={{ overflow: "visible", flex: "none", ...style }} role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <ellipse cx={100} cy={192} rx={(112 - bob * 3) / 2} ry={6} fill="rgba(60,30,10,0.2)" style={{ filter: "blur(4px)" }} />
      <g transform={`translate(0 ${bob.toFixed(2)})`}>
        {FOOT.map((d, i) => <path key={i} d={d} fill={SHADE} />)}
        {([[72, 30, -22], [100, 21, 0], [128, 30, 22]] as const).map(([x, y, a], i) => (
          <g key={i} transform={`translate(${x} ${y + (mood === "sad" || mood === "sleepy" ? 3 : 0)}) rotate(${(a * (mood === "sad" ? 1.5 : 1) + (i - 1) * rayWiggle * 0.6).toFixed(2)})`}>
            <Paper d={RAY[i]} color="#F3DC7A" lift={2} edge="rgba(170,110,30,0.45)" />
          </g>
        ))}
        <g transform={`translate(36 118) rotate(${deg(armL).toFixed(1)})`}><Paper d={ARM[0]} color={SHADE} lift={1.5} /></g>
        <g transform={`translate(164 118) rotate(${deg(armR).toFixed(1)})`}><Paper d={ARM[1]} color={SHADE} lift={1.5} /></g>
        <Paper d={BODY} color={ORANGE} lift={3} />
        <ellipse cx={58} cy={128} rx={9} ry={5} fill={BLUSH} opacity={0.7} />
        <ellipse cx={142} cy={128} rx={9} ry={5} fill={BLUSH} opacity={0.7} />
        {eyeMode === "smile" ? (
          blink > 0.4 ? (
            <line x1={70} y1={100} x2={130} y2={100} stroke={INK} strokeWidth={7} strokeLinecap="round" />
          ) : (
            <path d="M68 108 Q100 74 132 108" fill="none" stroke={INK} strokeWidth={7} strokeLinecap="round" />
          )
        ) : (
          <g transform={`translate(0 100) scale(1 ${Math.max(0.04, open * (up ? 1.1 : 1)).toFixed(3)}) translate(0 -100)`}>
            <Paper d={EYE} color={CREAM} lift={1.5} />
            <clipPath id={clip}><path d={EYE} /></clipPath>
            <g clipPath={`url(#${clip})`}>
              <circle cx={100 + lk[0]} cy={100 + lk[1]} r={17} fill={INK} />
              <circle cx={94 + lk[0]} cy={94 + lk[1]} r={5} fill={CREAM} />
              {mood === "calm" && <rect x={40} y={40} width={120} height={38} fill={SHADE} />}
            </g>
            <path d="M54 100 Q100 45.4 146 100" fill="none" stroke={INK} strokeWidth={4} strokeLinecap="round" />
          </g>
        )}
        {mood === "worried" && <path d="M66 66 L92 74 M134 66 L108 74" stroke={INK} strokeWidth={4.5} strokeLinecap="round" />}
        {(mood === "happy" || mood === "excited") && <path d="M86 143 Q100 160 114 143 Z" fill={CLAY} stroke={INK} strokeWidth={4.5} strokeLinejoin="round" />}
        {mood === "listening" && (() => {
          const r = 5 + Math.abs(Math.sin(t * Math.PI * 12)) * 3;
          return <ellipse cx={100} cy={146} rx={r * 0.8} ry={r} fill={CLAY} stroke={INK} strokeWidth={4.5} />;
        })()}
        {mood === "thinking" && <line x1={91} y1={146} x2={109} y2={148} stroke={INK} strokeWidth={4.5} strokeLinecap="round" />}
        {(mood === "calm" || mood === "sleepy") && <path d="M91 146 Q100 151 109 146" fill="none" stroke={INK} strokeWidth={4.5} strokeLinecap="round" />}
        {(mood === "sad" || mood === "worried") && <path d="M90 150 Q100 142 110 150" fill="none" stroke={INK} strokeWidth={4.5} strokeLinecap="round" />}
        {mood === "listening" && [0, 1, 2].map((i) => {
          const a = (t * 3 + i / 3) % 1, r = 10 + a * 22;
          return <path key={i} d={`M${178 + r * Math.cos(-0.6)} ${96 + r * Math.sin(-0.6)} A${r} ${r} 0 0 1 ${178 + r * Math.cos(0.6)} ${96 + r * Math.sin(0.6)}`} fill="none" stroke="currentColor" strokeOpacity={1 - a} strokeWidth={3.5} strokeLinecap="round" />;
        })}
        {mood === "thinking" && ([[160, 50, 5], [172, 34, 7], [186, 16, 10]] as const).map(([x, y, r], i) => (
          <circle key={i} cx={x} cy={y - ((Math.sin(t * Math.PI * 4) + 1) / 2) * 2 * i} r={r} fill={CREAM} stroke={shade(CREAM, 0.15)} strokeWidth={1} />
        ))}
        {mood === "sleepy" && [0, 1].map((i) => {
          const a = (t * 1.5 + i / 2) % 1;
          return <text key={i} x={156 + a * 22} y={52 - a * 30} fontSize={14 + a * 12} fontWeight={800} fill="currentColor" opacity={1 - a}>z</text>;
        })}
      </g>
    </svg>
  );
}
