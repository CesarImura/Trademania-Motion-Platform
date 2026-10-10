"use client";

import { isActive, num, parseColor, str } from "./animate";
import { GENERATORS } from "./generators";
import type { Layer, Shot } from "./types";

// ---------- asset + font loading ----------

const listeners = new Set<() => void>();
export function onAssetsChange(cb: () => void) {
  listeners.add(cb);
  return () => void listeners.delete(cb);
}
const notify = () => listeners.forEach((cb) => cb());

const SYSTEM_FONTS = new Set([
  "arial", "helvetica", "georgia", "times new roman", "courier new", "verdana",
  "system-ui", "sans-serif", "serif", "monospace", "-apple-system",
]);

const fontPromises = new Map<string, Promise<void>>();

export function ensureFont(family: string, weight: number): Promise<void> {
  const key = `${family}:${weight}`;
  let p = fontPromises.get(key);
  if (p) return p;
  if (typeof document === "undefined" || SYSTEM_FONTS.has(family.toLowerCase())) {
    p = Promise.resolve();
  } else {
    p = new Promise<void>((resolve) => {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, "+")}:wght@${weight}&display=block`;
      const done = () =>
        document.fonts
          .load(`${weight} 32px "${family}"`)
          .catch(() => undefined)
          .then(() => {
            notify();
            resolve();
          });
      link.onload = done;
      link.onerror = () => resolve(); // Not a Google font — fall back silently.
      document.head.appendChild(link);
    });
  }
  fontPromises.set(key, p);
  return p;
}

const images = new Map<string, { img: HTMLImageElement; ready: Promise<void> }>();

export function assetUrl(shotId: string, src: string) {
  if (!src) return "";
  if (/^(https?:|data:|blob:|\/)/.test(src)) return src;
  return `/api/assets/${encodeURIComponent(shotId)}/${src.split("/").map(encodeURIComponent).join("/")}`;
}

function getImage(url: string) {
  let entry = images.get(url);
  if (!entry) {
    const img = new Image();
    img.crossOrigin = "anonymous";
    const ready = new Promise<void>((resolve) => {
      img.onload = () => {
        notify();
        resolve();
      };
      img.onerror = () => resolve();
    });
    img.src = url;
    entry = { img, ready };
    images.set(url, entry);
  }
  return entry;
}

/** Resolves once every font and image the shot uses is loaded (or failed). */
export async function preloadShot(shot: Shot, shotId: string) {
  const jobs: Promise<void>[] = [];
  for (const layer of shot.layers) {
    if (layer.type === "text") {
      const families = new Set([str(layer, "fontFamily", 0)]);
      const weights = new Set([num(layer, "fontWeight", 0)]);
      for (const k of layer.keyframes?.fontWeight ?? []) weights.add(Number(k.v));
      for (const f of families) for (const w of weights) jobs.push(ensureFont(f, w));
    }
    if (layer.type === "generator") {
      for (const [f, w] of GENERATORS[str(layer, "generator", 0)]?.fonts ?? []) jobs.push(ensureFont(f, w));
    }
    if (layer.type === "image") {
      const url = assetUrl(shotId, str(layer, "src", 0));
      if (url) jobs.push(getImage(url).ready);
    }
  }
  await Promise.all(jobs);
}

// ---------- geometry ----------

let measureCtx: CanvasRenderingContext2D | null = null;
function measurer() {
  measureCtx ??= document.createElement("canvas").getContext("2d")!;
  return measureCtx;
}

const pathInfoCache = new Map<string, { x: number; y: number; w: number; h: number; length: number; path: Path2D }>();
let svgPath: SVGPathElement | null = null;

function pathInfo(d: string) {
  let info = pathInfoCache.get(d);
  if (info) return info;
  if (!svgPath) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("style", "position:absolute;width:0;height:0;overflow:hidden;visibility:hidden");
    svgPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    svg.appendChild(svgPath);
    document.body.appendChild(svg);
  }
  svgPath.setAttribute("d", d);
  let box = { x: 0, y: 0, width: 0, height: 0 }, length = 0;
  try {
    box = svgPath.getBBox();
    length = svgPath.getTotalLength();
  } catch {
    /* invalid path */
  }
  info = { x: box.x, y: box.y, w: box.width, h: box.height, length, path: new Path2D(d) };
  pathInfoCache.set(d, info);
  return info;
}

function fontString(layer: Layer, t: number) {
  return `${num(layer, "fontWeight", t)} ${num(layer, "fontSize", t)}px "${str(layer, "fontFamily", t)}", system-ui, sans-serif`;
}

function textContent(layer: Layer, t: number) {
  const raw = str(layer, "text", t);
  if (!raw.includes("{counter}")) return raw;
  const d = Math.max(0, Math.min(6, Math.round(num(layer, "counterDecimals", t))));
  let [int, frac] = num(layer, "counter", t).toFixed(d).split(".");
  const group = str(layer, "counterGrouping", t);
  if (group) int = int.replace(/\B(?=(\d{3})+(?!\d))/g, group);
  const value = frac === undefined ? int : int + (str(layer, "counterSeparator", t) || ".") + frac;
  return raw.replaceAll("{counter}", value);
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    if (maxWidth <= 0) {
      out.push(para);
      continue;
    }
    let line = "";
    for (const word of para.split(/(\s+)/)) {
      const next = line + word;
      if (line.trim() && ctx.measureText(next.trimEnd()).width > maxWidth) {
        out.push(line.trimEnd());
        line = word.trimStart();
      } else line = next;
    }
    out.push(line.trimEnd());
  }
  return out;
}

function textLayout(ctx: CanvasRenderingContext2D, layer: Layer, t: number) {
  ctx.font = fontString(layer, t);
  ctx.letterSpacing = `${num(layer, "letterSpacing", t)}px`;
  const lines = wrapLines(ctx, textContent(layer, t), num(layer, "maxWidth", t));
  const widths = lines.map((l) => ctx.measureText(l).width);
  const lh = num(layer, "fontSize", t) * num(layer, "lineHeight", t);
  return { lines, widths, lh, w: Math.max(0, ...widths), h: lines.length * lh };
}

export interface Box { x: number; y: number; w: number; h: number }

export function layerBox(layer: Layer, t: number, shotId = ""): Box {
  switch (layer.type) {
    case "rect":
    case "ellipse":
    case "generator":
      return { x: 0, y: 0, w: num(layer, "width", t), h: num(layer, "height", t) };
    case "text": {
      const l = textLayout(measurer(), layer, t);
      return { x: 0, y: 0, w: l.w, h: l.h };
    }
    case "image": {
      let w = num(layer, "width", t), h = num(layer, "height", t);
      const url = assetUrl(shotId, str(layer, "src", t));
      const img = url ? images.get(url)?.img : undefined;
      const nw = img?.naturalWidth || 0, nh = img?.naturalHeight || 0;
      if (!w && !h) { w = nw; h = nh; }
      else if (!h && nw) h = (w * nh) / nw;
      else if (!w && nh) w = (h * nw) / nh;
      return { x: 0, y: 0, w, h };
    }
    case "path": {
      const p = pathInfo(str(layer, "d", t));
      return { x: p.x, y: p.y, w: p.w, h: p.h };
    }
    default:
      return { x: 0, y: 0, w: 0, h: 0 };
  }
}

function localMatrix(layer: Layer, t: number, shotId: string) {
  const zero = layer.type === "path" && str(layer, "pathOrigin", t) === "zero";
  const b = zero ? { x: 0, y: 0, w: 0, h: 0 } : layerBox(layer, t, shotId);
  const s = num(layer, "scale", t);
  return new DOMMatrix()
    .translateSelf(num(layer, "x", t), num(layer, "y", t))
    .rotateSelf(num(layer, "rotation", t))
    .scaleSelf(s * num(layer, "scaleX", t), s * num(layer, "scaleY", t))
    .translateSelf(-(b.x + num(layer, "anchorX", t) * b.w), -(b.y + num(layer, "anchorY", t) * b.h));
}

/** Matrix from layer space to shot space, following the parent chain. */
export function worldMatrix(shot: Shot, layer: Layer, t: number, shotId = "", depth = 0): DOMMatrix {
  const local = localMatrix(layer, t, shotId);
  if (!layer.parent || depth > 32) return local;
  const parent = shot.layers.find((l) => l.id === layer.parent);
  if (!parent) return local;
  return worldMatrix(shot, parent, t, shotId, depth + 1).multiply(local);
}

export function parentMatrix(shot: Shot, layer: Layer, t: number, shotId = "") {
  const parent = layer.parent ? shot.layers.find((l) => l.id === layer.parent) : undefined;
  return parent ? worldMatrix(shot, parent, t, shotId) : new DOMMatrix();
}

export function layerCorners(shot: Shot, layer: Layer, t: number, shotId = "") {
  const m = worldMatrix(shot, layer, t, shotId);
  const b = layerBox(layer, t, shotId);
  return [
    [b.x, b.y], [b.x + b.w, b.y], [b.x + b.w, b.y + b.h], [b.x, b.y + b.h],
  ].map(([x, y]) => m.transformPoint(new DOMPoint(x, y)));
}

export function hitTest(shot: Shot, t: number, px: number, py: number, shotId = ""): Layer | undefined {
  for (const layer of shot.layers) {
    if (!isActive(layer, shot, t) || layer.locked || layer.type === "null") continue;
    const p = worldMatrix(shot, layer, t, shotId).inverse().transformPoint(new DOMPoint(px, py));
    const b = layerBox(layer, t, shotId);
    if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) return layer;
  }
  return undefined;
}

// ---------- drawing ----------

const STOP_RE = /(#[0-9a-f]{3,8}|rgba?\([^)]*\)|hsla?\([^)]*\)|[a-z]+)\s+(-?[\d.]+%?)/gi;

function parseStops(spec: string): [number, string][] {
  const out: [number, string][] = [];
  for (const m of spec.matchAll(STOP_RE)) {
    const pos = m[2].endsWith("%") ? parseFloat(m[2]) / 100 : parseFloat(m[2]);
    if (Number.isFinite(pos)) out.push([pos, m[1]]);
  }
  return out.sort((a, b) => a[0] - b[0]);
}

function addStops(g: CanvasGradient, stops: [number, string][], repeat: boolean, shift: number) {
  if (!repeat) {
    for (const [pos, col] of stops) g.addColorStop(Math.min(1, Math.max(0, pos)), col);
    return;
  }
  // Tile one period three times across the gradient (which spans 3 periods), offset by shift.
  const off = ((shift % 1) + 1) % 1;
  const pts: [number, string][] = [];
  for (let k = -1; k <= 3; k++) for (const [pos, col] of stops) pts.push([(pos + k + off) / 3, col]);
  const inside = pts.filter(([p]) => p >= 0 && p <= 1);
  // Edge colors so the tiling is seamless at both ends.
  const sample = (u: number) => {
    let a = pts[0], b = pts[pts.length - 1];
    for (let i = 0; i < pts.length - 1; i++) if (pts[i][0] <= u && pts[i + 1][0] >= u) { a = pts[i]; b = pts[i + 1]; break; }
    const k = b[0] === a[0] ? 0 : (u - a[0]) / (b[0] - a[0]);
    const ca = parseColor(a[1]), cb = parseColor(b[1]);
    return `rgba(${[0, 1, 2].map((i) => Math.round(ca[i] + (cb[i] - ca[i]) * k)).join(",")},${ca[3] + (cb[3] - ca[3]) * k})`;
  };
  g.addColorStop(0, sample(0));
  for (const [pos, col] of inside) g.addColorStop(pos, col);
  g.addColorStop(1, sample(1));
}

/**
 * Fill style for the layer's box. For radial fills on shapes, returns a unit-space
 * gradient and the transform to apply before filling (so ellipses get elliptical gradients).
 */
function fillStyle(ctx: CanvasRenderingContext2D, layer: Layer, t: number, box: Box): { style: string | CanvasGradient; unit?: DOMMatrix } {
  const type = str(layer, "fillType", t);
  if (type !== "linear" && type !== "radial") return { style: str(layer, "fill", t) };
  const stops = parseStops(str(layer, "gradientStops", t));
  if (!stops.length) return { style: str(layer, "fill", t) };
  const scale = num(layer, "gradientScale", t) || 1;
  const shift = num(layer, "gradientShift", t);
  const repeat = str(layer, "gradientRepeat", t) === "yes";
  const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
  if (type === "linear") {
    const a = (num(layer, "gradientAngle", t) * Math.PI) / 180;
    const dx = Math.sin(a), dy = -Math.cos(a);
    const half = ((Math.abs(box.w * dx) + Math.abs(box.h * dy)) / 2) * scale;
    const span = repeat ? 3 : 1; // repeat: gradient covers 3 periods, centered
    const sx = repeat ? 0 : shift * half * 2;
    const g = ctx.createLinearGradient(
      cx - dx * half * span + dx * sx, cy - dy * half * span + dy * sx,
      cx + dx * half * span + dx * sx, cy + dy * half * span + dy * sx,
    );
    addStops(g, stops, repeat, repeat ? shift : 0);
    return { style: g };
  }
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.SQRT1_2 * scale);
  addStops(g, stops, false, 0);
  return { style: g, unit: new DOMMatrix().translateSelf(cx, cy).scaleSelf(box.w, box.h) };
}

function fillCurrentPath(ctx: CanvasRenderingContext2D, layer: Layer, t: number, box: Box) {
  const f = fillStyle(ctx, layer, t, box);
  ctx.fillStyle = f.style;
  if (f.unit) {
    ctx.save();
    ctx.transform(f.unit.a, f.unit.b, f.unit.c, f.unit.d, f.unit.e, f.unit.f);
    ctx.fill();
    ctx.restore();
  } else ctx.fill();
}

/** Non-shape fills (text, Path2D): radial gradients use a circle sized to the box. */
function flatFill(ctx: CanvasRenderingContext2D, layer: Layer, t: number, box: Box) {
  const f = fillStyle(ctx, layer, t, box);
  if (!f.unit) return f.style;
  const stops = parseStops(str(layer, "gradientStops", t));
  const r = Math.hypot(box.w, box.h) / 2 * (num(layer, "gradientScale", t) || 1);
  const g = ctx.createRadialGradient(box.x + box.w / 2, box.y + box.h / 2, 0, box.x + box.w / 2, box.y + box.h / 2, r);
  addStops(g, stops, false, 0);
  return g;
}

function paint(ctx: CanvasRenderingContext2D, layer: Layer, t: number, box: Box) {
  const stroke = str(layer, "stroke", t);
  const sw = num(layer, "strokeWidth", t);
  fillCurrentPath(ctx, layer, t, box);
  if (sw > 0) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = sw;
    ctx.stroke();
  }
}

function drawLayer(ctx: CanvasRenderingContext2D, layer: Layer, t: number, shotId: string) {
  switch (layer.type) {
    case "rect": {
      const w = num(layer, "width", t), h = num(layer, "height", t);
      const r = Math.min(num(layer, "radius", t), w / 2, h / 2);
      ctx.beginPath();
      ctx.roundRect(0, 0, w, h, Math.max(0, r));
      paint(ctx, layer, t, { x: 0, y: 0, w, h });
      break;
    }
    case "ellipse": {
      const w = num(layer, "width", t), h = num(layer, "height", t);
      const a0 = num(layer, "arcStart", t), a1 = num(layer, "arcEnd", t);
      if (a1 <= a0) break;
      const full = a1 - a0 >= 1;
      const s = -Math.PI / 2 + a0 * Math.PI * 2, e = -Math.PI / 2 + a1 * Math.PI * 2;
      ctx.beginPath();
      if (!full && str(layer, "stroke", t) && num(layer, "strokeWidth", t) > 0) {
        ctx.ellipse(w / 2, h / 2, w / 2, h / 2, 0, s, e);
        ctx.strokeStyle = str(layer, "stroke", t);
        ctx.lineWidth = num(layer, "strokeWidth", t);
        ctx.lineCap = "round";
        ctx.stroke();
      } else {
        if (!full) ctx.moveTo(w / 2, h / 2);
        ctx.ellipse(w / 2, h / 2, Math.max(0, w / 2), Math.max(0, h / 2), 0, s, e);
        if (!full) ctx.closePath();
        paint(ctx, layer, t, { x: 0, y: 0, w, h });
      }
      break;
    }
    case "text": {
      const l = textLayout(ctx, layer, t);
      const align = str(layer, "align", t);
      const total = l.lines.reduce((n, s) => n + [...s].length, 0);
      let budget = Math.round(Math.min(1, Math.max(0, num(layer, "reveal", t))) * total);
      ctx.textBaseline = "middle";
      ctx.fillStyle = flatFill(ctx, layer, t, { x: 0, y: 0, w: l.w, h: l.h });
      const sw = num(layer, "strokeWidth", t);
      ctx.strokeStyle = str(layer, "stroke", t);
      ctx.lineWidth = sw;
      ctx.lineJoin = "round";
      l.lines.forEach((line, i) => {
        const chars = [...line];
        const shown = chars.slice(0, Math.max(0, budget)).join("");
        budget -= chars.length;
        if (!shown) return;
        const x = align === "left" ? 0 : align === "right" ? l.w - l.widths[i] : (l.w - l.widths[i]) / 2;
        const y = i * l.lh + l.lh / 2;
        if (sw > 0) ctx.strokeText(shown, x, y);
        ctx.fillText(shown, x, y);
      });
      break;
    }
    case "image": {
      const url = assetUrl(shotId, str(layer, "src", t));
      const entry = url ? getImage(url) : undefined;
      if (!entry?.img.complete || !entry.img.naturalWidth) break;
      const b = layerBox(layer, t, shotId);
      const r = num(layer, "radius", t);
      if (r > 0) {
        ctx.beginPath();
        ctx.roundRect(0, 0, b.w, b.h, r);
        ctx.clip();
      }
      ctx.drawImage(entry.img, 0, 0, b.w, b.h);
      break;
    }
    case "path": {
      const info = pathInfo(str(layer, "d", t));
      const ts = num(layer, "trimStart", t), te = num(layer, "trimEnd", t);
      ctx.fillStyle = flatFill(ctx, layer, t, { x: info.x, y: info.y, w: info.w, h: info.h });
      ctx.fill(info.path);
      const sw = num(layer, "strokeWidth", t);
      if (sw > 0 && te > ts) {
        ctx.strokeStyle = str(layer, "stroke", t);
        ctx.lineWidth = sw;
        ctx.lineCap = str(layer, "lineCap", t) as CanvasLineCap;
        ctx.lineJoin = "round";
        if (ts > 0 || te < 1) {
          const len = info.length;
          ctx.setLineDash([Math.max(0.001, len * (te - ts)), len * 2]);
          ctx.lineDashOffset = -len * ts;
        }
        ctx.stroke(info.path);
      }
      break;
    }
    case "generator": {
      const gen = GENERATORS[str(layer, "generator", t)];
      if (!gen) break;
      gen.draw(ctx, num(layer, "width", t), num(layer, "height", t), t, {
        num: (k) => num(layer, k, t),
        at: (k, time) => num(layer, k, time),
        str: (k) => str(layer, k, t),
      });
      break;
    }
  }
}

export interface RenderOptions {
  /** Canvas pixels per shot pixel. */
  scale: number;
  shotId?: string;
  /** Leave the background transparent (used for the editor checkerboard). */
  transparent?: boolean;
}

/**
 * Null parents act as groups: their opacity multiplies and blur adds into children.
 * An isolated null (render as group) is different: its opacity applies once to the
 * finished group image (like an AE precomp), so the cascade stops there.
 */
function groupEffects(shot: Shot, layer: Layer, t: number) {
  let opacity = 1, blur = 0, depth = 0;
  let p = layer.parent ? shot.layers.find((l) => l.id === layer.parent) : undefined;
  while (p && depth++ < 32) {
    if (p.type === "null" && str(p, "isolate", t) === "yes") break;
    if (p.type === "null") {
      opacity *= num(p, "opacity", t);
      blur += num(p, "blur", t);
    }
    p = p.parent ? shot.layers.find((l) => l.id === p!.parent) : undefined;
  }
  return { opacity, blur };
}

let layerBuffer: HTMLCanvasElement | null = null;

/**
 * Layers that draw many primitives (generators, filled+stroked shapes) must be
 * blurred/faded as a whole, not per draw call: canvas applies `filter` and
 * `globalAlpha` to every operation separately, which is both wrong-looking and
 * very slow (a blurred dither orb is ~1,700 individually blurred glyphs).
 * Those layers render into an offscreen buffer sized to their on-screen bounds.
 */
function needsBuffer(layer: Layer, t: number, blur: number, opacity: number) {
  if (layer.type === "generator") return blur > 0.05 || opacity < 1 || str(layer, "blend", t) !== "normal";
  return blur > 0.05 && num(layer, "strokeWidth", t) > 0;
}

function drawWithEffects(
  ctx: CanvasRenderingContext2D, shot: Shot, layer: Layer, t: number, base: DOMMatrix, scale: number, shotId: string,
  useBlend = true,
) {
  const blend = useBlend ? str(layer, "blend", t) : "normal";
  const group = groupEffects(shot, layer, t);
  const opacity = Math.min(1, num(layer, "opacity", t) * group.opacity);
  if (opacity <= 0) return;
  const blur = num(layer, "blur", t) + group.blur;
  const m = base.multiply(worldMatrix(shot, layer, t, shotId));
  const shadowColor = str(layer, "shadowColor", t);
  const hasShadow = !!shadowColor && parseColor(shadowColor)[3] > 0;
  const applyShadow = (c: CanvasRenderingContext2D) => {
    if (!hasShadow) return;
    c.shadowColor = shadowColor;
    c.shadowBlur = num(layer, "shadowBlur", t) * scale;
    c.shadowOffsetX = num(layer, "shadowX", t) * scale;
    c.shadowOffsetY = num(layer, "shadowY", t) * scale;
  };

  const backdrop = layer.type === "rect" || layer.type === "ellipse" ? num(layer, "backdropBlur", t) : 0;
  if (backdrop > 0.05) drawBackdropBlur(ctx, layer, t, m, backdrop * scale, opacity);

  if (!needsBuffer(layer, t, blur, opacity)) {
    ctx.save();
    ctx.setTransform(m);
    ctx.globalAlpha = opacity;
    if (blend !== "normal") ctx.globalCompositeOperation = blend as GlobalCompositeOperation;
    if (blur > 0.05) ctx.filter = `blur(${blur * scale}px)`;
    applyShadow(ctx);
    drawLayer(ctx, layer, t, shotId);
    ctx.restore();
    return;
  }

  // Screen-space bounds of the layer, padded for blur and shadow, clipped to the canvas.
  const b = layerBox(layer, t, shotId);
  const pts = [[b.x, b.y], [b.x + b.w, b.y], [b.x + b.w, b.y + b.h], [b.x, b.y + b.h]].map(([x, y]) => m.transformPoint(new DOMPoint(x, y)));
  let pad = Math.ceil(blur * scale * 3) + 2;
  if (hasShadow) pad += Math.ceil((num(layer, "shadowBlur", t) * 2 + Math.abs(num(layer, "shadowX", t)) + Math.abs(num(layer, "shadowY", t))) * scale);
  const x0 = Math.max(0, Math.floor(Math.min(...pts.map((p) => p.x)) - pad));
  const y0 = Math.max(0, Math.floor(Math.min(...pts.map((p) => p.y)) - pad));
  const x1 = Math.min(ctx.canvas.width, Math.ceil(Math.max(...pts.map((p) => p.x)) + pad));
  const y1 = Math.min(ctx.canvas.height, Math.ceil(Math.max(...pts.map((p) => p.y)) + pad));
  const w = x1 - x0, h = y1 - y0;
  if (w <= 0 || h <= 0) return;

  layerBuffer ??= document.createElement("canvas");
  if (layerBuffer.width < w || layerBuffer.height < h) {
    layerBuffer.width = Math.max(layerBuffer.width, w);
    layerBuffer.height = Math.max(layerBuffer.height, h);
  }
  const bctx = layerBuffer.getContext("2d")!;
  bctx.save();
  bctx.setTransform(1, 0, 0, 1, 0, 0);
  bctx.clearRect(0, 0, w, h);
  bctx.setTransform(new DOMMatrix().translateSelf(-x0, -y0).multiply(m));
  applyShadow(bctx);
  drawLayer(bctx, layer, t, shotId);
  bctx.restore();

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = opacity;
  if (blend !== "normal") ctx.globalCompositeOperation = blend as GlobalCompositeOperation;
  if (blur > 0.05) ctx.filter = `blur(${blur * scale}px)`;
  ctx.drawImage(layerBuffer, 0, 0, w, h, x0, y0, w, h);
  ctx.restore();
}

/** Blur what's already on `ctx` inside the layer's shape (CSS backdrop-filter). */
function drawBackdropBlur(ctx: CanvasRenderingContext2D, layer: Layer, t: number, m: DOMMatrix, px: number, opacity: number) {
  const W = ctx.canvas.width, H = ctx.canvas.height;
  const copy = poolCanvas("backdrop", W, H);
  const cctx = copy.getContext("2d")!;
  cctx.setTransform(1, 0, 0, 1, 0, 0);
  cctx.clearRect(0, 0, W, H);
  cctx.drawImage(ctx.canvas, 0, 0);
  const w = num(layer, "width", t), h = num(layer, "height", t);
  ctx.save();
  ctx.setTransform(m);
  ctx.beginPath();
  if (layer.type === "rect") ctx.roundRect(0, 0, w, h, Math.max(0, Math.min(num(layer, "radius", t), w / 2, h / 2)));
  else ctx.ellipse(w / 2, h / 2, Math.max(0, w / 2), Math.max(0, h / 2), 0, 0, Math.PI * 2);
  ctx.clip();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = opacity;
  ctx.filter = `blur(${px}px)`;
  ctx.drawImage(copy, 0, 0);
  ctx.restore();
}

const canvasPool = new Map<string, HTMLCanvasElement>();
function poolCanvas(key: string, w: number, h: number) {
  let c = canvasPool.get(key);
  if (!c) canvasPool.set(key, (c = document.createElement("canvas")));
  if (c.width !== w) c.width = w;
  if (c.height !== h) c.height = h;
  return c;
}

/** Draw one layer (handling its track matte) onto `target`. */
function drawEntry(target: CanvasRenderingContext2D, shot: Shot, layer: Layer, t: number, base: DOMMatrix, scale: number, shotId: string) {
  const matte = layer.matte ? shot.layers.find((l) => l.id === layer.matte) : undefined;
  if (!matte) return drawWithEffects(target, shot, layer, t, base, scale, shotId);
  // Track matte: draw the layer offscreen, keep only where the matte has alpha.
  const mc = poolCanvas("matte", target.canvas.width, target.canvas.height);
  const mctx = mc.getContext("2d")!;
  mctx.setTransform(1, 0, 0, 1, 0, 0);
  mctx.clearRect(0, 0, mc.width, mc.height);
  drawWithEffects(mctx, shot, layer, t, base, scale, shotId, false);
  // The matte renders into its own buffer first and is then composited in one
  // full-frame draw: compositing it directly would skip destination-in entirely
  // whenever the matte draws nothing (opacity 0, empty text), leaving the layer unmasked.
  const inverse = layer.matteMode === "inverse";
  const matteOn = isActive({ ...matte, hidden: false }, shot, t);
  const ac = poolCanvas("matteAlpha", mc.width, mc.height);
  const actx = ac.getContext("2d")!;
  actx.setTransform(1, 0, 0, 1, 0, 0);
  actx.clearRect(0, 0, ac.width, ac.height);
  if (matteOn) drawWithEffects(actx, shot, { ...matte, hidden: false }, t, base, scale, shotId, false);
  mctx.save();
  mctx.setTransform(1, 0, 0, 1, 0, 0);
  mctx.globalCompositeOperation = inverse ? "destination-out" : "destination-in";
  mctx.drawImage(ac, 0, 0);
  mctx.restore();
  target.save();
  target.setTransform(1, 0, 0, 1, 0, 0);
  const blend = str(layer, "blend", t);
  if (blend !== "normal") target.globalCompositeOperation = blend as GlobalCompositeOperation;
  target.drawImage(mc, 0, 0);
  target.restore();
}

/** Composite a group buffer with a depth-of-field blur ramping down the frame (or up, when end < start). */
function compositeRamp(ctx: CanvasRenderingContext2D, src: HTMLCanvasElement, scale: number, start: number, end: number, max: number, alpha = 1) {
  const W = src.width, H = src.height;
  if (alpha <= 0) return;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = Math.min(1, alpha);
  if (max <= 0.05) {
    ctx.drawImage(src, 0, 0);
    ctx.restore();
    return;
  }
  if (end < start) {
    // Upward ramp: flip the buffer, ramp down, flip back.
    const flip = poolCanvas("rampFlip", W, H);
    const fctx = flip.getContext("2d")!;
    fctx.setTransform(1, 0, 0, -1, 0, H);
    fctx.clearRect(0, 0, W, H);
    fctx.drawImage(src, 0, 0);
    const out = poolCanvas("rampFlipOut", W, H);
    const octx = out.getContext("2d")!;
    octx.setTransform(1, 0, 0, 1, 0, 0);
    octx.clearRect(0, 0, W, H);
    compositeRamp(octx, flip, scale, H / scale - start, H / scale - end, max, 1);
    ctx.setTransform(1, 0, 0, -1, 0, H);
    ctx.drawImage(out, 0, 0);
    ctx.restore();
    return;
  }
  const s0 = Math.max(0, Math.min(H, start * scale)), s1 = Math.max(s0 + 1, end * scale);
  if (s0 > 0) ctx.drawImage(src, 0, 0, W, s0, 0, 0, W, s0);
  const N = 12;
  for (let i = 0; i < N; i++) {
    const y0 = s0 + ((s1 - s0) * i) / N;
    const y1 = i === N - 1 ? H : s0 + ((s1 - s0) * (i + 1)) / N;
    if (y0 >= H) break;
    const b = max * Math.pow((i + 1) / N, 1.3) * scale;
    const pad = Math.ceil(b * 3);
    const sy = Math.max(0, Math.floor(y0 - pad)), ey = Math.min(H, Math.ceil(y1 + pad));
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, y0, W, y1 - y0);
    ctx.clip();
    ctx.filter = `blur(${b}px)`;
    ctx.drawImage(src, 0, sy, W, ey - sy, 0, sy, W, ey - sy);
    ctx.restore();
  }
  ctx.restore();
}

/**
 * Composite a group buffer through a focus plane: sharp (only `base` blur) within
 * `range` of the line through (fx, fy) at `angle`, blur growing to base + `max` over
 * `falloff` on both sides. Blur levels cross-fade along the plane's normal through
 * gradient masks, so there are no band seams.
 */
function compositeFocus(
  ctx: CanvasRenderingContext2D, src: HTMLCanvasElement, scale: number,
  fx: number, fy: number, angle: number, range: number, falloff: number, max: number, base: number, alpha = 1,
) {
  if (alpha <= 0) return;
  const W = src.width, H = src.height;
  const N = Math.max(2, Math.min(8, Math.ceil(max / 8)));
  // Big blurs are computed on a downsampled copy (identical look, a fraction of the cost).
  let level = 0;
  const drawBlurred = (target: CanvasRenderingContext2D, blur: number) => {
    const px = blur * scale;
    const ds = Math.min(8, Math.max(1, px / 6));
    if (ds <= 1.01) {
      if (px > 0.05) target.filter = `blur(${px}px)`;
      target.drawImage(src, 0, 0);
      target.filter = "none";
      return;
    }
    const c = poolCanvas(`focus:${level++}`, Math.ceil(W / ds), Math.ceil(H / ds));
    const cx = c.getContext("2d")!;
    cx.setTransform(1, 0, 0, 1, 0, 0);
    cx.clearRect(0, 0, c.width, c.height);
    cx.filter = `blur(${px / ds}px)`;
    cx.drawImage(src, 0, 0, c.width, c.height);
    cx.filter = "none";
    target.drawImage(c, 0, 0, W, H);
  };
  const out = poolCanvas("focusOut", W, H);
  const octx = out.getContext("2d")!;
  octx.setTransform(1, 0, 0, 1, 0, 0);
  octx.clearRect(0, 0, W, H);
  drawBlurred(octx, base);

  const tmp = poolCanvas("focusTmp", W, H);
  const tctx = tmp.getContext("2d")!;
  const rad = (angle * Math.PI) / 180;
  const nx = -Math.sin(rad), ny = Math.cos(rad); // normal to the focus line
  const reach = range + falloff;
  const px = fx * scale, py = fy * scale, R = reach * scale;
  const u = (d: number) => Math.min(1, Math.max(0, (d + reach) / (2 * reach)));
  for (let i = 1; i <= N; i++) {
    const d0 = range + (falloff * (i - 1)) / N, d1 = range + (falloff * i) / N;
    tctx.setTransform(1, 0, 0, 1, 0, 0);
    tctx.globalCompositeOperation = "source-over";
    tctx.clearRect(0, 0, W, H);
    drawBlurred(tctx, base + max * Math.pow(i / N, 1.3));
    // Keep this level only where it takes over: 0 inside ±d0, ramping to 1 at ±d1.
    const g = tctx.createLinearGradient(px - nx * R, py - ny * R, px + nx * R, py + ny * R);
    g.addColorStop(0, "#000");
    g.addColorStop(u(-d1), "#000");
    g.addColorStop(u(-d0), "rgba(0,0,0,0)");
    g.addColorStop(u(d0), "rgba(0,0,0,0)");
    g.addColorStop(u(d1), "#000");
    g.addColorStop(1, "#000");
    tctx.globalCompositeOperation = "destination-in";
    tctx.fillStyle = g;
    tctx.fillRect(0, 0, W, H);
    tctx.globalCompositeOperation = "source-over";
    octx.drawImage(tmp, 0, 0);
  }
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = Math.min(1, alpha);
  ctx.drawImage(out, 0, 0);
  ctx.restore();
}

export function renderFrame(ctx: CanvasRenderingContext2D, shot: Shot, t: number, opts: RenderOptions) {
  const { scale, shotId = "" } = opts;
  const base = new DOMMatrix().scaleSelf(scale, scale);
  const mattes = new Set(shot.layers.map((l) => l.matte).filter(Boolean) as string[]);
  const byId = new Map(shot.layers.map((l) => [l.id, l]));
  // Nearest ancestor null that renders its descendants as a group.
  const groupOf = (layer: Layer): Layer | undefined => {
    let p = layer.parent ? byId.get(layer.parent) : undefined, depth = 0;
    while (p && depth++ < 32) {
      if (p.type === "null" && str(p, "isolate", t) === "yes") return p;
      p = p.parent ? byId.get(p.parent) : undefined;
    }
    return undefined;
  };
  const drawable = (l: Layer) => l.type !== "null" && !mattes.has(l.id) && isActive(l, shot, t);

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.setTransform(base);
  if (!opts.transparent && shot.background) {
    ctx.fillStyle = shot.background;
    ctx.fillRect(0, 0, shot.width, shot.height);
  }
  const doneGroups = new Set<string>();
  for (let i = shot.layers.length - 1; i >= 0; i--) {
    const layer = shot.layers[i];
    if (!drawable(layer)) continue;
    const group = groupOf(layer);
    if (!group) {
      drawEntry(ctx, shot, layer, t, base, scale, shotId);
      continue;
    }
    if (doneGroups.has(group.id)) continue;
    doneGroups.add(group.id);
    // Render the whole group (at the position of its bottom-most member), then composite.
    const gc = poolCanvas(`group:${group.id}`, ctx.canvas.width, ctx.canvas.height);
    const gctx = gc.getContext("2d")!;
    gctx.setTransform(1, 0, 0, 1, 0, 0);
    gctx.clearRect(0, 0, gc.width, gc.height);
    for (let j = shot.layers.length - 1; j >= 0; j--) {
      const member = shot.layers[j];
      if (drawable(member) && groupOf(member) === group) drawEntry(gctx, shot, member, t, base, scale, shotId);
    }
    // Group opacity = the isolated null's own opacity × any null groups above it; the
    // group's own blur plus its parent nulls' blur apply once to the finished group.
    const above = groupEffects(shot, group, t);
    const alpha = num(group, "opacity", t) * above.opacity;
    const groupBlur = num(group, "blur", t) + above.blur;
    const focus = num(group, "focusBlur", t);
    if (focus > 0.05) {
      compositeFocus(
        ctx, gc, scale, num(group, "focusX", t), num(group, "focusY", t), num(group, "focusAngle", t),
        num(group, "focusRange", t), num(group, "focusFalloff", t), focus, groupBlur, alpha,
      );
    } else if (groupBlur > 0.05 && num(group, "rampBlur", t) <= 0.05) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = Math.min(1, alpha);
      ctx.filter = `blur(${groupBlur * scale}px)`;
      ctx.drawImage(gc, 0, 0);
      ctx.restore();
    } else {
      compositeRamp(ctx, gc, scale, num(group, "rampStart", t), num(group, "rampEnd", t), num(group, "rampBlur", t), alpha);
    }
  }
  ctx.restore();
}
