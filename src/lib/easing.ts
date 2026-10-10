import type { Ease } from "./types";

type EaseFn = (p: number) => number;

function cubicBezier(x1: number, y1: number, x2: number, y2: number): EaseFn {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sy = (t: number) => ((ay * t + by) * t + cy) * t;
  const dx = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const err = sx(t) - x;
      if (Math.abs(err) < 1e-6) return sy(t);
      const d = dx(t);
      if (Math.abs(d) < 1e-6) break;
      t -= err / d;
    }
    let lo = 0, hi = 1;
    t = x;
    while (hi - lo > 1e-6) {
      if (sx(t) < x) lo = t;
      else hi = t;
      t = (lo + hi) / 2;
    }
    return sy(t);
  };
}

const c1 = 1.70158, c2 = c1 * 1.525, c3 = c1 + 1;

function bounceOut(p: number) {
  const n = 7.5625, d = 2.75;
  if (p < 1 / d) return n * p * p;
  if (p < 2 / d) return n * (p -= 1.5 / d) * p + 0.75;
  if (p < 2.5 / d) return n * (p -= 2.25 / d) * p + 0.9375;
  return n * (p -= 2.625 / d) * p + 0.984375;
}

/**
 * Damped spring from 0 → 1 (starting at rest), time-normalized to its settle time so
 * it fits any keyframe span. Same physics as Figma's spring presets.
 */
function springEase(stiffness: number, damping: number, mass = 1): EaseFn {
  const w0 = Math.sqrt(stiffness / mass);
  const zeta = damping / (2 * Math.sqrt(stiffness * mass));
  const x = (t: number) => {
    if (zeta < 1) {
      const wd = w0 * Math.sqrt(1 - zeta * zeta);
      return 1 - Math.exp(-zeta * w0 * t) * (Math.cos(wd * t) + ((zeta * w0) / wd) * Math.sin(wd * t));
    }
    if (zeta === 1) return 1 - Math.exp(-w0 * t) * (1 + w0 * t);
    const r1 = -w0 * (zeta - Math.sqrt(zeta * zeta - 1)), r2 = -w0 * (zeta + Math.sqrt(zeta * zeta - 1));
    return 1 - (r2 * Math.exp(r1 * t) - r1 * Math.exp(r2 * t)) / (r2 - r1);
  };
  // Settle time: last moment the response is more than 1% away from rest (the
  // perceptible duration — a tighter threshold squeezes the gentle start).
  let settle = 0;
  for (let t = 0; t < 20; t += 0.002) if (Math.abs(1 - x(t)) > 0.01) settle = t;
  settle = Math.max(settle, 0.05);
  return (p) => (p <= 0 ? 0 : p >= 1 ? 1 : x(p * settle) / x(settle));
}

/** Time-reversed ease: the curve played backwards (ease-out becomes ease-in). */
const mirror = (fn: EaseFn): EaseFn => (p) => 1 - fn(1 - p);

export const EASES: Record<string, EaseFn> = {
  linear: (p) => p,
  hold: () => 0,
  easeIn: (p) => p * p * p,
  easeOut: (p) => 1 - Math.pow(1 - p, 3),
  easeInOut: (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2),
  sineIn: (p) => 1 - Math.cos((p * Math.PI) / 2),
  sineOut: (p) => Math.sin((p * Math.PI) / 2),
  sineInOut: (p) => -(Math.cos(Math.PI * p) - 1) / 2,
  quadIn: (p) => p * p,
  quadOut: (p) => 1 - (1 - p) * (1 - p),
  quadInOut: (p) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2),
  expoIn: (p) => (p === 0 ? 0 : Math.pow(2, 10 * p - 10)),
  expoOut: (p) => (p === 1 ? 1 : 1 - Math.pow(2, -10 * p)),
  expoInOut: (p) =>
    p === 0 ? 0 : p === 1 ? 1 : p < 0.5 ? Math.pow(2, 20 * p - 10) / 2 : (2 - Math.pow(2, -20 * p + 10)) / 2,
  backIn: (p) => c3 * p * p * p - c1 * p * p,
  backOut: (p) => 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2),
  backInOut: (p) =>
    p < 0.5
      ? (Math.pow(2 * p, 2) * ((c2 + 1) * 2 * p - c2)) / 2
      : (Math.pow(2 * p - 2, 2) * ((c2 + 1) * (p * 2 - 2) + c2) + 2) / 2,
  elasticOut: (p) =>
    p === 0 ? 0 : p === 1 ? 1 : Math.pow(2, -10 * p) * Math.sin((p * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1,
  bounceOut,
  spring: (p) => (p >= 1 ? 1 : 1 - Math.exp(-6 * p) * Math.cos(p * Math.PI * 2.5)),
  // Figma spring presets (stiffness, damping, mass).
  figmaGentle: springEase(100, 15),
  figmaQuick: springEase(300, 20),
  figmaBouncy: springEase(600, 15),
  figmaSlow: springEase(80, 20),
  // Mirrored springs: gentle start that keeps accelerating, fastest at the end.
  figmaGentleIn: mirror(springEase(100, 15)),
  figmaSlowIn: mirror(springEase(80, 20)),
  // Smooth "UI" curves.
  smooth: cubicBezier(0.4, 0, 0.2, 1),
  snappy: cubicBezier(0.2, 0.9, 0.1, 1),
  anticipate: cubicBezier(0.6, -0.28, 0.3, 1.3),
};

export const EASE_NAMES = Object.keys(EASES);

const bezierCache = new Map<string, EaseFn>();

export function getEase(ease: Ease | undefined): EaseFn {
  if (!ease) return EASES.linear;
  if (Array.isArray(ease)) {
    const key = ease.join(",");
    let fn = bezierCache.get(key);
    if (!fn) {
      fn = cubicBezier(ease[0], ease[1], ease[2], ease[3]);
      bezierCache.set(key, fn);
    }
    return fn;
  }
  return EASES[ease] ?? EASES.linear;
}
