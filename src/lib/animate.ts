import { getEase } from "./easing";
import { propDef } from "./props";
import type { Keyframe, Layer, Shot, Value } from "./types";

// ---------- colors ----------

export type RGBA = [number, number, number, number];

const colorCache = new Map<string, RGBA>();
let probe: CanvasRenderingContext2D | null = null;

export function parseColor(input: string): RGBA {
  const s = input.trim().toLowerCase();
  const hit = colorCache.get(s);
  if (hit) return hit;
  let out: RGBA = [0, 0, 0, 0];
  if (s === "transparent" || s === "none" || s === "") {
    out = [0, 0, 0, 0];
  } else if (s.startsWith("#")) {
    let h = s.slice(1);
    if (h.length === 3 || h.length === 4) h = [...h].map((ch) => ch + ch).join("");
    const num = (i: number) => parseInt(h.slice(i, i + 2), 16);
    out = [num(0), num(2), num(4), h.length === 8 ? num(6) / 255 : 1];
  } else if (s.startsWith("rgb")) {
    const parts = s.replace(/rgba?\(|\)/g, "").split(/[\s,/]+/).filter(Boolean).map(parseFloat);
    out = [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0, parts[3] ?? 1];
  } else if (typeof document !== "undefined") {
    // Named colors / hsl(): let the browser normalize it.
    probe ??= document.createElement("canvas").getContext("2d");
    if (probe) {
      probe.fillStyle = "#000";
      probe.fillStyle = s;
      const norm = probe.fillStyle as string;
      if (norm !== s) out = parseColor(norm);
    }
  }
  colorCache.set(s, out);
  return out;
}

export function rgbaString([r, g, b, a]: RGBA): string {
  return `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${+a.toFixed(4)})`;
}

export function toHex(input: string): string {
  const [r, g, b] = parseColor(input);
  return "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
}

function lerpColor(a: string, b: string, p: number): string {
  const ca = parseColor(a), cb = parseColor(b);
  return rgbaString([0, 1, 2, 3].map((i) => ca[i] + (cb[i] - ca[i]) * p) as RGBA);
}

function isColor(v: Value) {
  return typeof v === "string" && /^(#|rgb|hsl|transparent)/i.test(v.trim());
}

// ---------- evaluation ----------

export function sortedKeys(kfs: Keyframe[]): Keyframe[] {
  return [...kfs].sort((a, b) => a.t - b.t);
}

export function evalKeyframes(kfs: Keyframe[], t: number): Value {
  if (kfs.length === 1 || t <= kfs[0].t) return kfs[0].v;
  const last = kfs[kfs.length - 1];
  if (t >= last.t) return last.v;
  let i = 0;
  while (i < kfs.length - 2 && t >= kfs[i + 1].t) i++;
  const a = kfs[i], b = kfs[i + 1];
  const span = b.t - a.t;
  const p = span <= 0 ? 1 : getEase(a.ease)((t - a.t) / span);
  if (typeof a.v === "number" && typeof b.v === "number") return a.v + (b.v - a.v) * p;
  if (isColor(a.v) && isColor(b.v)) return lerpColor(a.v as string, b.v as string, p);
  return p >= 1 ? b.v : a.v;
}

export function getValue(layer: Layer, key: string, t: number): Value {
  const kfs = layer.keyframes?.[key];
  if (kfs && kfs.length) return evalKeyframes(kfs, t);
  const v = layer.props[key];
  if (v !== undefined) return v;
  return propDef(layer, key)?.default ?? 0;
}

export function num(layer: Layer, key: string, t: number): number {
  const v = getValue(layer, key, t);
  return typeof v === "number" ? v : parseFloat(v) || 0;
}

export function str(layer: Layer, key: string, t: number): string {
  return String(getValue(layer, key, t));
}

export function layerStart(layer: Layer) {
  return layer.start ?? 0;
}

export function layerEnd(layer: Layer, shot: Shot) {
  return layer.end ?? shot.duration;
}

export function isActive(layer: Layer, shot: Shot, t: number) {
  return !layer.hidden && t >= layerStart(layer) && t < layerEnd(layer, shot) + 1e-9;
}

// ---------- editing helpers (mutate in place; callers clone) ----------

export const EPS = 1e-4;

export function snapTime(t: number, fps: number) {
  return +(Math.round(t * fps) / fps).toFixed(4);
}

export function setValueAt(layer: Layer, key: string, t: number, v: Value) {
  const kfs = layer.keyframes?.[key];
  if (kfs && kfs.length) {
    const existing = kfs.find((k) => Math.abs(k.t - t) < EPS);
    if (existing) existing.v = v;
    else {
      // New keyframe inherits the ease of the segment it splits.
      const prev = sortedKeys(kfs).filter((k) => k.t < t).pop();
      kfs.push({ t, v, ...(prev?.ease ? { ease: prev.ease } : {}) });
      kfs.sort((a, b) => a.t - b.t);
    }
  } else {
    layer.props[key] = v;
  }
}

export function toggleAnimated(layer: Layer, key: string, t: number) {
  const kfs = layer.keyframes?.[key];
  if (kfs && kfs.length) {
    layer.props[key] = evalKeyframes(kfs, t);
    delete layer.keyframes![key];
    if (!Object.keys(layer.keyframes!).length) delete layer.keyframes;
  } else {
    const v = getValue(layer, key, t);
    layer.keyframes ??= {};
    layer.keyframes[key] = [{ t, v }];
    delete layer.props[key];
  }
}

export function toggleKeyframeAt(layer: Layer, key: string, t: number) {
  const kfs = layer.keyframes?.[key];
  if (!kfs) return toggleAnimated(layer, key, t);
  const idx = kfs.findIndex((k) => Math.abs(k.t - t) < EPS);
  if (idx >= 0) {
    if (kfs.length === 1) return toggleAnimated(layer, key, t);
    kfs.splice(idx, 1);
  } else {
    setValueAt(layer, key, t, evalKeyframes(kfs, t));
  }
}

export function allKeyTimes(layer: Layer): number[] {
  const set = new Set<number>();
  for (const kfs of Object.values(layer.keyframes ?? {})) for (const k of kfs) set.add(+k.t.toFixed(4));
  return [...set].sort((a, b) => a - b);
}

export function uid(prefix: string, taken: Set<string>) {
  let i = 1;
  while (taken.has(`${prefix}-${i}`)) i++;
  return `${prefix}-${i}`;
}

export function formatTime(t: number, fps: number) {
  const total = Math.round(t * fps);
  const s = Math.floor(total / fps);
  const f = total % fps;
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}:${String(f).padStart(2, "0")}`;
}
