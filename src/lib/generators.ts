// Procedural layers: visuals that are code, not keyframed shapes (noise fields,
// particle systems, dithering...). Each generator exposes its own parameters,
// which show up in the inspector and can be keyframed like any other property.
//
// To add one: write `draw(ctx, w, h, t, get)` that draws into the layer box
// (0,0)-(w,h) at comp time `t`, and declare its params. Drawing must be a pure
// function of `t` and params so the preview matches the export.

import type { PropDef } from "./props";

// Local color → [r, g, b] (kept here to avoid an import cycle with animate/props).
let colorProbe: CanvasRenderingContext2D | null = null;
function parseColorRGB(c: string): [number, number, number] {
  colorProbe ??= document.createElement("canvas").getContext("2d")!;
  colorProbe.fillStyle = "#000";
  colorProbe.fillStyle = c;
  const v = String(colorProbe.fillStyle);
  if (v.startsWith("#")) return [1, 3, 5].map((i) => parseInt(v.slice(i, i + 2), 16)) as [number, number, number];
  const m = v.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0];
  return [m[0], m[1], m[2]];
}

type Get = {
  num: (key: string) => number;
  str: (key: string) => string;
  /** A numeric param at another time (e.g. for motion blur from velocity). */
  at: (key: string, time: number) => number;
};

export interface Generator {
  label: string;
  params: PropDef[];
  /** Fonts to load before drawing: [family, weight]. */
  fonts?: [string, number][];
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number, t: number, get: Get) => void;
}

const p = (key: string, label: string, def: number, extra: Partial<PropDef> = {}): PropDef => ({
  key, label, kind: "number", default: def, group: "Content", step: 0.01, ...extra,
});
const c = (key: string, label: string, def: string): PropDef => ({ key, label, kind: "color", default: def, group: "Content" });

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));

// ---------- glyph sprites (shared) ----------

const RAMP = ["·", "+", "*", "?", "#", "%"];
const spriteCache = new Map<string, HTMLCanvasElement[]>();

function sprites(color: string, px: number, family: string, ramp = RAMP) {
  const key = `${color}|${px}|${family}|${ramp.join("")}`;
  let s = spriteCache.get(key);
  if (s) return s;
  s = ramp.map((ch) => {
    const cv = document.createElement("canvas");
    cv.width = cv.height = Math.ceil(px * 1.2);
    const x = cv.getContext("2d")!;
    x.fillStyle = color;
    x.font = `500 ${px}px "${family}", ui-monospace, monospace`;
    x.textAlign = "center";
    x.textBaseline = "middle";
    x.fillText(ch, cv.width / 2, cv.height / 2 + px * 0.04);
    return cv;
  });
  // Only cache once the font has actually loaded, otherwise we'd freeze fallback glyphs.
  // (fonts.check() returns true before the stylesheet is even attached, so don't use it.)
  const loaded = [...document.fonts].some((f) => f.family.replace(/["']/g, "") === family && f.status === "loaded");
  if (loaded) spriteCache.set(key, s);
  return s;
}

/** Deterministic hash → [0, 1). Same inputs give the same value in preview and export. */
function hash3(a: number, b: number, c: number) {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

let grainTile: HTMLCanvasElement | null = null;
/** 256px tile of seeded monochrome noise for film grain. */
function grain() {
  if (grainTile) return grainTile;
  grainTile = document.createElement("canvas");
  grainTile.width = grainTile.height = 256;
  const g = grainTile.getContext("2d")!;
  const img = g.createImageData(256, 256);
  for (let i = 0; i < 256 * 256; i++) {
    const v = Math.round(hash3(i % 256, Math.floor(i / 256), 7) * 255);
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return grainTile;
}

function blob(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rgb: string, a: number) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${rgb},${a})`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}


// ---------- Trademania backdrop (gradient + noise + glyph dither) ----------

const TM_RAMP = ["-", "=", "+", "*", "?", "#", "%", "@"];
// Figma's dither overlay: white glyphs whose alpha rings out from a center.
// [distance / ringRadius, alpha], from the radial gradient on the "Union" layer.
const TM_RINGS: [number, number][] = [[0.054, 0.1], [0.196, 1], [0.289, 0.1], [0.425, 0.6], [0.556, 0.1], [0.759, 1]];
function ringAlpha(r: number) {
  if (r <= TM_RINGS[0][0]) return TM_RINGS[0][1];
  for (let i = 1; i < TM_RINGS.length; i++) {
    const [r1, a1] = TM_RINGS[i];
    if (r <= r1) {
      const [r0, a0] = TM_RINGS[i - 1];
      return a0 + ((a1 - a0) * (r - r0)) / (r1 - r0);
    }
  }
  return 1;
}

/** Blurred dark ellipses over a flat base, rendered at quarter res (it's all low frequency). */
const BASE_RES = 0.25;
const baseCache = new Map<string, { cv: HTMLCanvasElement; pad: number }>();
function tmBase(w: number, h: number, base: string, dark: string, blobs: number[][], blur: number, colors: string[] = []) {
  const key = [w, h, base, dark, blur, ...blobs.flat(), ...colors].map((v) => (typeof v === "number" ? v.toFixed(2) : v)).join("|");
  const hit = baseCache.get(key);
  if (hit) return hit;
  // Pad so the blur sees the shapes beyond the layer edge instead of transparency.
  const pad = Math.ceil(blur * 3 * BASE_RES) + 2;
  const cv = document.createElement("canvas");
  cv.width = Math.max(1, Math.ceil(w * BASE_RES) + pad * 2);
  cv.height = Math.max(1, Math.ceil(h * BASE_RES) + pad * 2);
  const x = cv.getContext("2d")!;
  x.fillStyle = base;
  x.fillRect(0, 0, cv.width, cv.height);
  x.filter = `blur(${blur * BASE_RES}px)`;
  blobs.forEach(([bx, by, rx, ry, a], k) => {
    if (a <= 0) return;
    x.fillStyle = colors[k] || dark;
    x.globalAlpha = clamp(a);
    x.beginPath();
    x.ellipse(pad + bx * BASE_RES, pad + by * BASE_RES, Math.max(0.1, rx * BASE_RES), Math.max(0.1, ry * BASE_RES), 0, 0, Math.PI * 2);
    x.fill();
  });
  if (baseCache.size > 16) baseCache.clear();
  const out = { cv, pad };
  baseCache.set(key, out);
  return out;
}

let glyphBuffer: HTMLCanvasElement | null = null;

// ---------- generators ----------

export const GENERATORS: Record<string, Generator> = {
  /** ASCII dither field: a glowing band at the top plus an optional centered bloom. */
  ditherField: {
    label: "Dither field",
    fonts: [["Roboto Mono", 500]],
    params: [
      p("gridMix", "Top band", 1, { min: 0, max: 1 }),
      p("orbMix", "Center bloom", 0, { min: 0, max: 1 }),
      p("boost", "Boost", 0, { min: 0 }),
      p("intensity", "Intensity", 1, { min: 0 }),
      p("coverage", "Band height", 0.593, { min: 0.05 }),
      p("floor", "Fill floor", 0, { min: 0, max: 1 }),
      p("edgeFade", "Edge fade", 0.45, { min: 0, max: 1 }),
      p("cell", "Cell size", 16.3, { step: 0.1, min: 4 }),
      p("speed", "Speed", 1, { min: 0 }),
      c("glyphColor", "Glyph color", "#D9F9B9"),
    ],
    draw(ctx, w, h, t, get) {
      const m2 = get.num("gridMix"), m1 = get.num("orbMix"), boost = get.num("boost");
      const cell = Math.max(4, get.num("cell"));
      const tt = t * get.num("speed");
      const spr = sprites(get.str("glyphColor"), 36, "Roboto Mono");
      const base = ctx.globalAlpha;
      // Band: glow from the top edge down to `coverage`·h; `floor` keeps a base level
      // everywhere (1 = uniform full-screen field); `intensity` scales the whole band.
      const intensity = get.num("intensity"), floor = clamp(get.num("floor")), edge = clamp(get.num("edgeFade"));
      const cx = w / 2, cy = h * (600 / 1080), bandH = h * Math.max(0.05, get.num("coverage")), r1 = w * (760 / 1920);
      for (let y = 8; y < h; y += cell) {
        const f = (floor + (1 - floor) * Math.pow(Math.max(0, 1 - y / bandH), 1.5)) * intensity;
        for (let x = 6; x < w; x += cell) {
          const n = Math.sin(x * 0.011 + tt * 1.7) * 0.5 + Math.sin(y * 0.019 - tt * 1.1) * 0.3 + Math.sin((x - y) * 0.007 + tt * 0.8) * 0.4;
          const hh = 1 - edge * Math.min(1, Math.abs(x - cx) / cx);
          const v2 = f * hh * (0.62 + (0.38 * n) / 1.2);
          const dx = x - cx, dy = y - cy;
          const d1 = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy * 1.6) / r1);
          const v1 = d1 * d1 * (0.7 + 0.3 * n);
          const a = m2 * v2 * (0.42 + 0.18 * boost) + m1 * v1 * 0.09;
          if (a < 0.012) continue;
          const v = Math.max(m2 * v2, v1 * m1 * 0.6);
          ctx.globalAlpha = base * Math.min(1, a);
          ctx.drawImage(spr[Math.min(5, Math.max(0, Math.floor(v * 7)))], x - cell / 2, y - cell / 2, cell, cell);
        }
      }
      ctx.globalAlpha = base;
    },
  },

  /**
   * Full-frame glyph grid whose opacity follows concentric radial rings (the
   * Trademania Figma "Dither" layer: white glyphs, radial ring gradient, overlay
   * blend). Animate `ringShift` to ripple the rings outward.
   */
  asciiRings: {
    label: "ASCII rings",
    fonts: [["Roboto Mono", 500]],
    params: [
      p("cell", "Cell size", 16.3, { step: 0.1, min: 4 }),
      p("ringCX", "Ring center X", 982, { step: 1 }),
      p("ringCY", "Ring center Y", 544, { step: 1 }),
      p("ringRadius", "Ring radius", 1431, { step: 1, min: 1 }),
      { key: "ringStops", label: "Ring stops (pos:alpha)", kind: "string", default: "0.054:0.1, 0.196:1, 0.289:0.1, 0.425:0.6, 0.557:0.1, 0.759:1", group: "Content" },
      p("ringShift", "Ring shift", 0, { step: 0.005 }),
      p("alpha", "Glyph opacity", 1, { min: 0 }),
      p("scramble", "Scramble", 0, { min: 0, max: 1 }),
      p("scrambleRate", "Scramble rate", 8, { step: 1, min: 0 }),
      c("glyphColor", "Glyph color", "#ffffff"),
    ],
    draw(ctx, w, h, t, get) {
      const cell = Math.max(4, get.num("cell"));
      const cxr = get.num("ringCX"), cyr = get.num("ringCY"), rr = Math.max(1, get.num("ringRadius"));
      const shift = get.num("ringShift"), alpha = get.num("alpha");
      const scramble = clamp(get.num("scramble")), tick = Math.floor(t * Math.max(0, get.num("scrambleRate")));
      const stops = get.str("ringStops").split(",").map((s) => s.split(":").map(Number)).filter((s) => s.length === 2 && s.every(Number.isFinite));
      stops.sort((a, b) => a[0] - b[0]);
      const ring = (u: number) => {
        if (!stops.length) return 1;
        if (u <= stops[0][0]) return stops[0][1];
        for (let i = 0; i < stops.length - 1; i++) {
          const [p0, a0] = stops[i], [p1, a1] = stops[i + 1];
          if (u <= p1) return a0 + ((a1 - a0) * (u - p0)) / (p1 - p0);
        }
        return stops[stops.length - 1][1];
      };
      const spr = sprites(get.str("glyphColor"), 36, "Roboto Mono");
      const base = ctx.globalAlpha;
      let ci = 0;
      for (let x = cell / 2; x < w + cell; x += cell, ci++) {
        let cj = 0;
        for (let y = cell / 2; y < h + cell; y += cell, cj++) {
          const a = ring(Math.hypot(x - cxr, y - cyr) / rr - shift) * alpha;
          if (a < 0.01) continue;
          let g = Math.floor(hash3(ci, cj, 1) * 6);
          if (scramble > 0 && hash3(ci, cj, tick + 77) < scramble) g = Math.floor(hash3(cj, ci, tick) * 6);
          ctx.globalAlpha = base * Math.min(1, a);
          ctx.drawImage(spr[g], x - cell / 2, y - cell / 2, cell, cell);
        }
      }
      ctx.globalAlpha = base;
    },
  },

  /** Glowing orb with three spinning noise layers and drifting ASCII glyphs. */
  ditherOrb: {
    label: "Dither orb",
    fonts: [["Roboto Mono", 500]],
    params: [
      p("energy", "Energy", 1, { min: 0, max: 1 }),
      p("spin", "Spin speed", 1, { min: 0 }),
      p("scramble", "Scramble", 0, { min: 0, max: 1 }),
      p("scrambleRate", "Scramble rate", 12, { step: 1, min: 0 }),
      p("glyphAlpha", "Glyph strength", 1, { min: 0 }),
      p("blobs", "Blob strength", 1, { min: 0 }),
      p("vignette", "Edge darken", 0.42, { min: 0, max: 1 }),
      p("grain", "Grain", 0, { min: 0, max: 1 }),
      p("lightX", "Light X", 0.35, { min: 0, max: 1 }),
      p("lightY", "Light Y", 0.25, { min: 0, max: 1 }),
      { key: "lighting", label: "Lighting", kind: "enum", default: "classic", options: ["classic", "studio"], group: "Content" },
      p("lightSize", "Light size (studio)", 0.8, { min: 0.05 }),
      c("rim", "Rim light (studio)", "#6f9161"),
      p("rimX", "Rim X", 0.22, { min: 0, max: 1 }),
      p("rimY", "Rim Y", 0.86, { min: 0, max: 1 }),
      p("rimSize", "Rim size", 0.55, { min: 0.05 }),
      p("core", "Core darkness (studio)", 0.75, { min: 0, max: 1 }),
      c("light", "Light", "#a6cf90"),
      c("mid", "Mid", "#6a995c"),
      c("shade", "Shade", "#3f653a"),
      c("edge", "Edge", "#2a432a"),
      c("glyphColor", "Glyph color", "#ecffdc"),
    ],
    draw(ctx, w, h, t, get) {
      // Authored at 560px; scale into the layer box.
      const S = 560, R = S / 2;
      const energy = get.num("energy"), ts = t * get.num("spin"), blobs = get.num("blobs");
      // Scramble: each cell re-rolls its glyph `scrambleRate` times per second with
      // probability `scramble` — reads as the orb "working".
      const scramble = clamp(get.num("scramble")), tick = Math.floor(t * Math.max(0, get.num("scrambleRate")));
      const glyphAlpha = get.num("glyphAlpha");
      ctx.save();
      ctx.scale(w / S, h / S);
      ctx.beginPath();
      ctx.arc(R, R, R, 0, Math.PI * 2);
      ctx.clip();
      // Highlight position as a fraction of the diameter (0.35, 0.25 = upper left).
      const lx = get.num("lightX") * S, ly = get.num("lightY") * S;
      let g: CanvasGradient;
      if (get.str("lighting") === "studio") {
        // Studio: mid-tone body, dark core behind the mark, broad key light, bounce rim.
        ctx.fillStyle = get.str("mid");
        ctx.fillRect(0, 0, S, S);
        const spot = (x: number, y: number, r: number, color: string, alpha: number) => {
          const [cr, cg, cb] = parseColorRGB(color);
          g = ctx.createRadialGradient(x, y, 0, x, y, r);
          g.addColorStop(0, `rgba(${cr},${cg},${cb},${alpha})`);
          g.addColorStop(0.55, `rgba(${cr},${cg},${cb},${alpha * 0.45})`);
          g.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, S, S);
        };
        // Edge tone first, so the key and rim lights can still reach the rim.
        g = ctx.createRadialGradient(R, R, R * 0.7, R, R, R);
        const [er, eg, eb] = parseColorRGB(get.str("edge"));
        g.addColorStop(0, `rgba(${er},${eg},${eb},0)`);
        g.addColorStop(1, `rgba(${er},${eg},${eb},0.55)`);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, S, S);
        spot(R * 0.85, R * 0.95, R * 0.95, get.str("shade"), clamp(get.num("core")));
        spot(lx, ly, R * get.num("lightSize"), get.str("light"), 1);
        spot(get.num("rimX") * S, get.num("rimY") * S, R * get.num("rimSize"), get.str("rim"), 0.9);
      } else {
        g = ctx.createRadialGradient(lx, ly, R * 0.05, R, R, R * 1.05);
        g.addColorStop(0, get.str("light"));
        g.addColorStop(0.45, get.str("mid"));
        g.addColorStop(0.8, get.str("shade"));
        g.addColorStop(1, get.str("edge"));
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, S, S);
      }
      const layers = [
        { sp: 0.9, rgb: "217,249,185", a: 0.42, op: "soft-light" },
        { sp: -0.6, rgb: "18,36,20", a: 0.5, op: "multiply" },
        { sp: 1.5, rgb: "196,240,160", a: 0.28, op: "screen" },
      ] as const;
      layers.forEach((l, i) => {
        ctx.save();
        ctx.translate(R, R);
        ctx.rotate(ts * l.sp + i * 2.1);
        ctx.globalCompositeOperation = l.op;
        for (let j = 0; j < 3; j++) {
          const an = j * 2.094 + i;
          blob(ctx, Math.cos(an) * R * 0.48, Math.sin(an) * R * 0.48, R * (0.5 + 0.1 * j), l.rgb, l.a * (0.8 + 0.2 * energy) * blobs);
        }
        ctx.restore();
      });
      ctx.globalCompositeOperation = "source-over";
      const spr = sprites(get.str("glyphColor"), 36, "Roboto Mono");
      const cell = S / 46;
      const base = ctx.globalAlpha;
      for (let y = cell / 2; y < S; y += cell) {
        for (let x = cell / 2; x < S; x += cell) {
          const dx = x - R, dy = y - R;
          if (dx * dx + dy * dy > R * R) continue;
          const n = Math.sin(x * 0.045 + ts * 2.4) + Math.sin(y * 0.05 - ts * 1.6) * 0.7 + Math.sin((x + y) * 0.028 + ts * 3.1) * 0.6;
          const light = clamp(1.05 - Math.hypot(x - lx, y - ly) / (R * 1.5));
          const v = clamp((0.5 + n / 4.6) * (0.55 + 0.45 * light));
          let glyph = Math.min(5, Math.floor(v * 6.2));
          let a = (0.08 + 0.3 * v) * (0.75 + 0.25 * energy);
          if (scramble > 0) {
            const ci = Math.round(x / cell), cj = Math.round(y / cell);
            if (hash3(ci, cj, tick) < scramble) {
              glyph = Math.floor(hash3(cj, ci, tick + 9173) * 6);
              a *= 0.7 + 0.6 * hash3(ci + 31, cj, tick);
            }
          }
          ctx.globalAlpha = base * Math.min(1, a * glyphAlpha);
          ctx.drawImage(spr[glyph], x - cell / 2, y - cell / 2, cell, cell);
        }
      }
      ctx.globalAlpha = base;
      const grainAmt = clamp(get.num("grain"));
      if (grainAmt > 0) {
        ctx.save();
        ctx.globalCompositeOperation = "overlay";
        ctx.globalAlpha = base * grainAmt;
        ctx.fillStyle = ctx.createPattern(grain(), "repeat")!;
        ctx.fillRect(0, 0, S, S);
        ctx.restore();
      }
      g = ctx.createRadialGradient(R, R, R * 0.62, R, R, R);
      g.addColorStop(0, "rgba(8,18,10,0)");
      g.addColorStop(1, `rgba(8,18,10,${clamp(get.num("vignette"))})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, S, S);
      ctx.restore();
    },
  },

  /**
   * Trademania V3 backdrop (SES-01 page, SES-02 button): flat green base, blurred
   * dark ellipses, film noise, and a white glyph dither blended `overlay` whose
   * alpha rings out from (ringX, ringY). Blob/ring positions are in layer pixels.
   */
  tmBackdrop: {
    label: "Trademania backdrop",
    fonts: [["Geist Mono", 500]],
    params: [
      c("baseColor", "Base", "#a3c890"),
      c("darkColor", "Dark", "#0a1a1d"),
      p("blobBlur", "Blob blur", 308, { step: 1, min: 0 }),
      p("b1x", "Blob 1 X", 1034, { step: 1 }),
      p("b1y", "Blob 1 Y", -101, { step: 1 }),
      p("b1rx", "Blob 1 radius X", 1711, { step: 1, min: 0 }),
      p("b1ry", "Blob 1 radius Y", 852, { step: 1, min: 0 }),
      p("b1a", "Blob 1 strength", 1, { min: 0, max: 1 }),
      p("b2x", "Blob 2 X", 0, { step: 1 }),
      p("b2y", "Blob 2 Y", 0, { step: 1 }),
      p("b2rx", "Blob 2 radius X", 400, { step: 1, min: 0 }),
      p("b2ry", "Blob 2 radius Y", 200, { step: 1, min: 0 }),
      p("b2a", "Blob 2 strength", 0, { min: 0, max: 1 }),
      c("b2Color", "Blob 2 color (empty = dark)", ""),
      p("noise", "Noise", 0.2, { min: 0, max: 1 }),
      { key: "noiseBlend", label: "Noise blend", kind: "enum", default: "multiply", options: ["overlay", "multiply", "soft-light", "source-over"], group: "Content" },
      c("glyphColor", "Glyph color", "#ffffff"),
      { key: "glyphBlend", label: "Glyph blend", kind: "enum", default: "overlay", options: ["overlay", "soft-light", "screen", "source-over"], group: "Content" },
      p("glyphAlpha", "Glyph strength", 1, { min: 0 }),
      p("glyphReveal", "Glyph reveal", 1, { min: 0, max: 1 }),
      p("cell", "Cell size", 16.29, { step: 0.01, min: 4 }),
      p("glyphSize", "Glyph size", 1.1, { min: 0.2 }),
      p("ringX", "Ring center X", 943, { step: 1 }),
      p("ringY", "Ring center Y", 541, { step: 1 }),
      p("ringRadius", "Ring radius", 1431, { step: 1, min: 1 }),
      p("ringShift", "Ring shift", 0, { step: 0.005 }),
      p("tilt", "Top-bright tilt", 0.35),
      p("speed", "Field speed", 1, { min: 0 }),
      p("scramble", "Scramble", 0.04, { min: 0, max: 1 }),
      p("scrambleRate", "Scramble rate", 10, { step: 1, min: 0 }),
    ],
    draw(ctx, w, h, t, get) {
      if (w <= 0 || h <= 0) return;
      const n = get.num;
      const blobs = [
        [n("b1x"), n("b1y"), n("b1rx"), n("b1ry"), n("b1a")],
        [n("b2x"), n("b2y"), n("b2rx"), n("b2ry"), n("b2a")],
      ];
      const b = tmBase(w, h, get.str("baseColor"), get.str("darkColor"), blobs, Math.max(0, n("blobBlur")), ["", get.str("b2Color")]);
      const base = ctx.globalAlpha;
      ctx.save();
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(b.cv, b.pad, b.pad, w * BASE_RES, h * BASE_RES, 0, 0, w, h);
      const noise = clamp(n("noise"));
      if (noise > 0) {
        ctx.globalAlpha = base * noise;
        ctx.globalCompositeOperation = get.str("noiseBlend") as GlobalCompositeOperation;
        ctx.fillStyle = ctx.createPattern(grain(), "repeat")!;
        ctx.fillRect(0, 0, w, h);
        ctx.globalAlpha = base;
      }
      ctx.restore();

      // Glyphs go into a device-resolution buffer, then blend onto the base in one go.
      const glyphAlpha = n("glyphAlpha"), reveal = clamp(n("glyphReveal"));
      if (glyphAlpha <= 0 || reveal <= 0) return;
      const m = ctx.getTransform();
      const s = Math.min(4, Math.max(0.1, Math.hypot(m.a, m.b)));
      const gw = Math.ceil(w * s), gh = Math.ceil(h * s);
      glyphBuffer ??= document.createElement("canvas");
      if (glyphBuffer.width < gw || glyphBuffer.height < gh) {
        glyphBuffer.width = Math.max(glyphBuffer.width, gw);
        glyphBuffer.height = Math.max(glyphBuffer.height, gh);
      }
      const g = glyphBuffer.getContext("2d")!;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, gw, gh);
      g.setTransform(s, 0, 0, s, 0, 0);
      const spr = sprites(get.str("glyphColor"), 36, "Geist Mono", TM_RAMP);
      const cell = Math.max(4, n("cell")), box = cell * n("glyphSize");
      const tt = t * n("speed"), tilt = n("tilt");
      const rx = n("ringX"), ry = n("ringY"), rr = Math.max(1, n("ringRadius")), shift = n("ringShift");
      const scramble = clamp(n("scramble")), tick = Math.floor(t * Math.max(0, n("scrambleRate")));
      const cols = Math.ceil(w / cell), rows = Math.ceil(h / cell);
      for (let j = 0; j < rows; j++) {
        const y = (j + 0.5) * cell;
        for (let i = 0; i < cols; i++) {
          const x = (i + 0.5) * cell;
          // Reveal sweeps up from the bottom with per-cell jitter.
          if (reveal < 1 && hash3(i, j, 51) * 0.7 + 0.3 * (1 - y / h) > reveal) continue;
          const a = ringAlpha(Math.hypot(x - rx, y - ry) / rr - shift) * glyphAlpha;
          if (a < 0.01) continue;
          const f =
            Math.sin(x * 0.006 + tt * 0.9) * 0.5 +
            Math.sin(y * 0.009 - tt * 0.7) * 0.35 +
            Math.sin((x + y) * 0.004 + tt * 0.5) * 0.45 +
            Math.sin((x - 1.3 * y) * 0.011 - tt * 1.3) * 0.2;
          const v = clamp(0.45 + f * 0.24 + tilt * (0.5 - y / h));
          let k = Math.min(TM_RAMP.length - 1, Math.floor(v * TM_RAMP.length));
          if (scramble > 0 && hash3(i, j, tick) < scramble) k = Math.floor(hash3(j, i, tick + 9173) * TM_RAMP.length);
          g.globalAlpha = Math.min(1, a);
          g.drawImage(spr[k], x - box / 2, y - box / 2, box, box);
        }
      }
      ctx.save();
      ctx.globalAlpha = base;
      ctx.globalCompositeOperation = get.str("glyphBlend") as GlobalCompositeOperation;
      ctx.drawImage(glyphBuffer, 0, 0, gw, gh, 0, 0, w, h);
      ctx.restore();
    },
  },

  /** Pixel-block transition: grid cells flip on (flashing the accent first) as `progress` goes 0→1. */
  pixelWipe: {
    label: "Pixel wipe",
    params: [
      p("progress", "Progress", 0, { min: 0, max: 1 }),
      p("cols", "Columns", 13, { step: 1, min: 1 }),
      p("rows", "Rows", 8, { step: 1, min: 1 }),
      c("color", "Color", "#F4F9EE"),
      c("accent", "Flash color", "#D9F9B9"),
      p("flash", "Flash length", 0.18, { min: 0, max: 0.9 }),
      { key: "mode", label: "Mode", kind: "enum", default: "linear", options: ["linear", "radial"], group: "Content" },
      p("sweep", "Directional", 0.55, { min: 0, max: 1 }),
      p("angle", "Direction (deg, linear)", -30, { step: 1 }),
      p("originX", "Origin X (radial)", 0.5, { min: 0, max: 1 }),
      p("originY", "Origin Y (radial)", 0.5, { min: 0, max: 1 }),
      p("seed", "Seed", 3, { step: 1 }),
    ],
    draw(ctx, w, h, t, get) {
      const prog = get.num("progress");
      if (prog <= 0) return;
      const cols = Math.max(1, Math.round(get.num("cols"))), rows = Math.max(1, Math.round(get.num("rows")));
      const cw = w / cols, ch = h / rows;
      const flash = clamp(get.num("flash"), 0, 0.9), sweep = clamp(get.num("sweep")), seed = Math.round(get.num("seed"));
      const an = (get.num("angle") * Math.PI) / 180, dx = Math.cos(an), dy = Math.sin(an);
      const radial = get.str("mode") === "radial";
      const ox = get.num("originX") * w, oy = get.num("originY") * h;
      // Sweep position of a cell center, normalized to 0–1: distance from the origin
      // (radial) or projection onto the direction (linear).
      const corners = [[0, 0], [w, 0], [0, h], [w, h]];
      const proj = ([x, y]: number[]) => (radial ? Math.hypot(x - ox, y - oy) : x * dx + y * dy);
      const cv = corners.map(proj);
      const lo = radial ? 0 : Math.min(...cv), span = Math.max(1e-6, Math.max(...cv) - lo);
      const color = get.str("color"), accent = get.str("accent");
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          const u = (proj([(i + 0.5) * cw, (j + 0.5) * ch]) - lo) / span;
          const th = ((1 - sweep) * hash3(i, j, seed) + sweep * u) * (1 - flash);
          const age = prog - th;
          if (age < 0) continue;
          ctx.fillStyle = prog < 1 && age < flash ? accent : color;
          // Overdraw by half a pixel so neighbouring cells don't show seams.
          ctx.fillRect(i * cw - 0.5, j * ch - 0.5, cw + 1, ch + 1);
        }
      }
    },
  },

  /**
   * Staged pixel transition: each grid cell steps on (dots → tinted dots → full) as
   * `progress` goes 0→1, and steps back off as `clear` goes 0→1. Two outputs with the
   * same per-cell timing: `mask` (alpha to matte a backdrop: tint stage partial, full
   * stage opaque) and `dots` (the halftone dots of the early stages).
   */
  pixelStages: {
    label: "Pixel stages",
    params: [
      p("progress", "Progress", 0, { min: 0, max: 1 }),
      p("clear", "Clear", 0, { min: 0, max: 1 }),
      { key: "output", label: "Output", kind: "enum", default: "mask", options: ["mask", "dots"], group: "Content" },
      p("cols", "Columns", 13, { step: 1, min: 1 }),
      p("rows", "Rows", 8, { step: 1, min: 1 }),
      p("stage", "Stage length", 0.3, { min: 0.01, max: 0.9 }),
      p("tint", "Tint stage alpha", 0.45, { min: 0, max: 1 }),
      p("dotPitch", "Dots per cell", 9, { step: 1, min: 1 }),
      p("dotSize", "Dot size", 4.6, { min: 0.5 }),
      c("dotColor", "Dot color", "rgba(10,26,29,0.5)"),
      p("sweep", "Directional", 0.78, { min: 0, max: 1 }),
      p("angle", "Direction (deg)", -160, { step: 1 }),
      p("clearAngle", "Clear direction (deg)", -160, { step: 1 }),
      p("seed", "Seed", 7, { step: 1 }),
    ],
    draw(ctx, w, h, t, get) {
      const prog = get.num("progress"), clr = get.num("clear");
      if (prog <= 0 || clr >= 1) return;
      const cols = Math.max(1, Math.round(get.num("cols"))), rows = Math.max(1, Math.round(get.num("rows")));
      const cw = w / cols, ch = h / rows;
      const stage = clamp(get.num("stage"), 0.01, 0.9), sweep = clamp(get.num("sweep")), seed = Math.round(get.num("seed"));
      // Normalized sweep position of a cell (0 = first) along a direction.
      const along = (deg: number) => {
        const a = (deg * Math.PI) / 180, dx = Math.cos(a), dy = Math.sin(a);
        const cv = [0, w * dx, h * dy, w * dx + h * dy];
        const lo = Math.min(...cv), span = Math.max(1e-6, Math.max(...cv) - lo);
        return (i: number, j: number) => ((i + 0.5) * cw * dx + (j + 0.5) * ch * dy - lo) / span;
      };
      const uIn = along(get.num("angle")), uOut = along(get.num("clearAngle"));
      // Quantized level 0–3: off, dots, tinted dots, full. Building steps through all
      // of them; clearing goes full → tint → off (no dots on the way out).
      const phase = (p: number, th: number) => (p - th * (1 - stage)) / stage;
      const build = (k: number) => (k <= 0 ? 0 : k >= 1 ? 3 : 1 + Math.min(1, Math.floor(k * 2)));
      const remain = (k: number) => (k <= 0 ? 3 : k < 0.3 ? 2 : 0);
      const dots = get.str("output") === "dots";
      const tint = clamp(get.num("tint"));
      const pitch = Math.max(1, Math.round(get.num("dotPitch"))), r = get.num("dotSize") / 2;
      const base = ctx.globalAlpha;
      ctx.fillStyle = dots ? get.str("dotColor") : "#000";
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          const jit = hash3(i, j, seed);
          const on = build(phase(prog, (1 - sweep) * jit + sweep * uIn(i, j)));
          const lv = Math.min(on, remain(phase(clr, (1 - sweep) * hash3(j, i, seed + 31) + sweep * uOut(i, j))));
          if (lv <= 0) continue;
          const x0 = i * cw, y0 = j * ch;
          if (!dots) {
            if (lv < 2) continue;
            ctx.globalAlpha = base * (lv === 3 ? 1 : tint);
            ctx.fillRect(x0 - 0.5, y0 - 0.5, cw + 1, ch + 1);
            continue;
          }
          if (lv === 3 || on === 3) continue; // full, or tinting on the way out: no dots
          // Halftone lattice shared by all cells, so neighbouring cells line up.
          ctx.beginPath();
          for (let b = 0; b < pitch; b++) {
            for (let a = 0; a < pitch; a++) {
              const x = x0 + ((a + 0.5) * cw) / pitch, y = y0 + ((b + 0.5) * ch) / pitch;
              ctx.moveTo(x + r, y);
              ctx.arc(x, y, r, 0, Math.PI * 2);
            }
          }
          ctx.fill();
        }
      }
      ctx.globalAlpha = base;
    },
  },
};

// ---------- Trademania "Live / Replay data" card charts ----------

// Figma line paths (absolute M/L/C) → y(x) sampled on a uniform x grid, normalized to
// the chart box. `ox/oy` place the SVG in the box, `flip` mirrors it vertically
// (Figma's -scale-y on the red line), `w/h` is the chart box size.
const LINE_SAMPLES = 120;
function sampleLine(d: string, ox: number, oy: number, flip: number | null, w: number, h: number) {
  const nums = d.match(/-?[\d.]+(?:e-?\d+)?/g)!.map(Number);
  const cmds = d.match(/[MLC]/g)!;
  const pts: [number, number][] = [];
  let i = 0, cx = 0, cy = 0;
  for (const c of cmds) {
    if (c === "M" || c === "L") {
      cx = nums[i++]; cy = nums[i++];
      pts.push([cx, cy]);
    } else {
      const [x1, y1, x2, y2, x3, y3] = nums.slice(i, (i += 6));
      for (let s = 1; s <= 24; s++) {
        const u = s / 24, v = 1 - u;
        pts.push([
          v * v * v * cx + 3 * v * v * u * x1 + 3 * v * u * u * x2 + u * u * u * x3,
          v * v * v * cy + 3 * v * v * u * y1 + 3 * v * u * u * y2 + u * u * u * y3,
        ]);
      }
      cx = x3; cy = y3;
    }
  }
  const norm = pts.map(([x, y]) => [(x + ox) / w, (flip === null ? y + oy : flip - y) / h]);
  const x0 = norm[0][0], x1 = norm[norm.length - 1][0];
  const out: number[] = [];
  let k = 0;
  for (let s = 0; s <= LINE_SAMPLES; s++) {
    const x = x0 + ((x1 - x0) * s) / LINE_SAMPLES;
    while (k < norm.length - 2 && norm[k + 1][0] < x) k++;
    const [ax, ay] = norm[k], [bx, by] = norm[k + 1];
    out.push(ay + (by - ay) * clamp((x - ax) / Math.max(1e-6, bx - ax)));
  }
  return { x0, x1, ys: out };
}

// SES-03 small card (chart box 731×352.83) and SES-04 expanded card (1742×711.7).
const LIVE_LINES = {
  red: {
    color: "#FF6479", wide: 1.186,
    small: sampleLine("M0.543935 123.538L152.66 116.007C195.392 113.892 236.559 99.0466 270.823 73.424C321.911 35.2203 387.384 21.6335 449.441 36.4107L502.236 48.9823C539.014 57.7399 577.451 56.6448 613.67 45.8075L731.544 10.5384", 0.46, 0, 286.46, 731, 352.83),
    big: sampleLine("M0.960984 253.836L400.255 236.804C478.464 233.469 554.374 209.363 620.18 166.967L686.164 124.455C783.054 62.0323 900.542 40.0464 1013.45 63.2094L1230.43 107.724C1296.14 121.205 1364.07 119.509 1429.03 102.763L1742.96 21.8361", 0.94, 0, 587.65, 1742, 711.7),
  },
  green: {
    color: "#D9F9B9", wide: 1.514,
    small: sampleLine("M1.13611 246.317L132.745 232.651C187.119 227.005 235.941 196.848 265.33 150.754L275.532 134.753C319.051 66.4988 407.089 42.1332 479.508 78.3008C528.857 102.947 587.483 100.094 634.207 70.773L732.136 9.31729", -0.71, -8.85, null, 731, 352.83),
    big: sampleLine("M2.00693 505.842L328.39 476.678C450.737 465.746 562.572 403.026 635.699 304.332L640.086 298.411C756.275 141.6 965.037 85.2567 1144.35 162.316C1262.47 213.081 1397.32 207.059 1510.45 145.968L1744.01 19.8417", -1.15, -18.98, null, 1742, 711.7),
  },
};

GENERATORS.liveLines = {
  label: "Live chart lines",
  params: [
    p("morph", "Small → big shape", 0, { min: 0, max: 1 }),
    p("lineWidth", "Line width", 22, { step: 0.1, min: 0 }),
    p("draw", "Draw on", 1, { min: 0, max: 1 }),
    p("drawLag", "Green lag", 0.12, { min: 0, max: 1 }),
    p("phase", "Flow phase", 0, { step: 0.01 }),
    p("wave", "Flow amplitude (× box h)", 0.02, { step: 0.001, min: 0 }),
    p("shimmer", "Highlight drift", 0.06, { step: 0.005, min: 0 }),
    c("fade", "Edge color", "#020203"),
  ],
  draw(ctx, w, h, t, get) {
    if (w <= 0 || h <= 0) return;
    const n = get.num;
    const morph = clamp(n("morph")), lw = Math.max(0, n("lineWidth")), phase = n("phase");
    const wave = n("wave") * h, shimmer = n("shimmer"), fade = get.str("fade");
    const m = ctx.getTransform();
    const s = Math.max(0.05, Math.hypot(m.a, m.b)); // filter blur is in device pixels
    const lerp = (a: number, b: number) => a + (b - a) * morph;
    const lines = [
      { ...LIVE_LINES.red, drawn: clamp(n("draw")), k: 0 },
      { ...LIVE_LINES.green, drawn: clamp((n("draw") - n("drawLag")) / Math.max(1e-6, 1 - n("drawLag"))), k: 1 },
    ];
    ctx.save();
    ctx.lineCap = "butt";
    ctx.lineJoin = "round";
    for (const L of lines) {
      if (L.drawn <= 0) continue;
      const x0 = lerp(L.small.x0, L.big.x0) * w, x1 = lerp(L.small.x1, L.big.x1) * w;
      const last = Math.max(1, Math.round(LINE_SAMPLES * L.drawn));
      ctx.beginPath();
      for (let i = 0; i <= last; i++) {
        const u = i / LINE_SAMPLES;
        // Travelling wave, pinned near the ends so the line stays anchored.
        const env = Math.sin(Math.PI * u);
        const dy = wave * env * Math.sin(2 * Math.PI * (u * 1.3 - phase) + L.k * 1.7);
        const y = lerp(L.small.ys[i], L.big.ys[i]) * h + dy;
        const x = x0 + (x1 - x0) * u;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      const mid = 0.49 + shimmer * Math.sin(2 * Math.PI * phase + L.k * 2.1);
      const g = ctx.createLinearGradient(x0, 0, x0 + (x1 - x0) * 1.014, 0);
      g.addColorStop(0, fade);
      g.addColorStop(clamp(mid, 0.05, 0.95), L.color);
      g.addColorStop(1, fade);
      ctx.strokeStyle = g;
      ctx.lineWidth = lw;
      // Figma stack, bottom → top: core, wide glow, tight glow.
      for (const blur of [0, L.wide, 0.316]) {
        ctx.filter = blur ? `blur(${(blur * lw * s).toFixed(2)}px)` : "none";
        ctx.stroke();
      }
    }
    ctx.restore();
  },
};

// Replay card candles (chart box 744×352.83), center offsets from Figma; bodies span 23–77 %.
const CANDLES: [number, number, number, boolean][] = [
  [-303.47, 47.49, 141.115, true], [-227.47, 36.29, 118.731, true], [-151.47, 61.11, 88.562, false],
  [-75.47, -5.55, 132.356, true], [0.53, 4.67, 111.919, false], [76.53, -2.15, 195.615, true],
  [152.53, 67.44, 101.214, false], [228.53, 33.86, 98.294, true], [303.53, -33.29, 131.383, true],
];

GENERATORS.replayChart = {
  label: "Replay candles",
  params: [
    p("progress", "Candles in", 1, { min: 0, max: 1 }),
    p("grid", "Grid lines", 1, { min: 0, max: 1 }),
    p("glow", "Glow (σ px)", 33.3, { step: 0.1, min: 0 }),
    c("up", "Up candle", "#EEEEEE"),
    c("down", "Down candle", "#868686"),
  ],
  draw(ctx, w, h, t, get) {
    if (w <= 0 || h <= 0) return;
    const n = get.num;
    const sx = w / 744, sy = h / 352.83;
    const m = ctx.getTransform();
    const s = Math.max(0.05, Math.hypot(m.a, m.b));
    ctx.save();
    // Dashed guides: white, alpha 0 → 0.32 → 0 across.
    const grid = clamp(n("grid"));
    if (grid > 0) {
      const g = ctx.createLinearGradient(0, 0, w, 0);
      g.addColorStop(0, "rgba(255,255,255,0)");
      g.addColorStop(0.505, `rgba(255,255,255,${0.32 * grid})`);
      g.addColorStop(0.904, "rgba(255,255,255,0)");
      ctx.strokeStyle = g;
      ctx.lineWidth = 4 * sy;
      ctx.setLineDash([7.9155 * sx, 7.9155 * sx]);
      ctx.lineDashOffset = -3.96 * sx;
      for (const y of [288, 178, 82]) {
        ctx.beginPath();
        // Figma tilts them -0.69°: 9 px rise across the box.
        ctx.moveTo(0, (y + 4.5) * sy);
        ctx.lineTo(w * grid, (y + 4.5 - 9 * grid) * sy);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }
    // Candles pop in left → right ("Kerze für Kerze").
    const prog = clamp(n("progress")) * (CANDLES.length + 1.5);
    const glow = Math.max(0, n("glow"));
    CANDLES.forEach(([dx, dy, ch, up], i) => {
      const a = clamp(prog - i, 0, 1.5) / 1.5;
      if (a <= 0) return;
      const e = 1 - Math.pow(1 - a, 3);
      const cx = (744 / 2 + dx) * sx, cy = (352.83 / 2 + dy) * sy;
      const hh = ch * sy * (0.2 + 0.8 * e);
      const top = cy - hh / 2, bw = 36 * sx;
      ctx.globalAlpha = e;
      ctx.fillStyle = ctx.strokeStyle = up ? get.str("up") : get.str("down");
      ctx.lineWidth = 9 * sx;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(cx, top);
      ctx.lineTo(cx, top + hh);
      ctx.rect(cx - bw / 2, top + hh * 0.2333, bw, hh * 0.5334);
      for (const b of [0, glow]) {
        ctx.filter = b ? `blur(${(b * sy * s).toFixed(2)}px)` : "none";
        ctx.fill();
        ctx.stroke();
      }
    });
    ctx.restore();
  },
};

// ---------- Trademania product chart (SES-09 live / replay windows) ----------

// Candlestick plot + price axis drawn over the chart area of a flattened product
// screenshot. Live (`rate` > 0): the last candle forms in real time and a new one
// opens every 1/rate s, shifting the series left. Replay: `reveal` 0→1 draws the
// candles on left → right behind an amber playhead. The box is plot + axis column;
// prices map to the screenshot's axis (86,060 … 85,900).
type Candle = { o: number; c: number; h: number; l: number; v: number };
const candleCache = new Map<string, Candle[]>();
function candleSeries(seed: number, n: number, vol = 1): Candle[] {
  const key = `${seed}|${vol}`;
  const cached = candleCache.get(key);
  if (cached && cached.length >= n) return cached;
  const s: Candle[] = [];
  let c = 85975;
  for (let i = 0; i < n; i++) {
    const o = c;
    c = o + (hash3(i, seed, 1) - 0.5) * 26 * vol + (85985 - o) * 0.08 * vol;
    if (hash3(i, seed, 4) > 0.95) c += (hash3(i, seed, 5) - 0.5) * 60 * vol; // the odd spike
    c = Math.min(86045, Math.max(85925, c));
    const h = Math.max(o, c) + hash3(i, seed, 2) * 9 * vol, l = Math.min(o, c) - hash3(i, seed, 3) * 9 * vol;
    s.push({ o, c, h, l, v: 0.2 + 0.8 * hash3(i, seed, 6) * (0.4 + Math.min(1, Math.abs(c - o) / 18)) });
  }
  candleCache.set(key, s);
  return s;
}
const fmtPrice = (p: number) => Math.round(p).toLocaleString("en-US");

GENERATORS.productChart = {
  label: "Product chart (live / replay)",
  fonts: [["Geist", 400], ["Geist", 500]],
  params: [
    p("count", "Visible candles", 60, { step: 1, min: 5 }),
    p("rate", "Live: new candle every (1/s)", 0, { min: 0 }),
    p("reveal", "Replay: reveal", 1, { min: 0, max: 1 }),
    p("playhead", "Replay: show playhead", 0, { min: 0, max: 1, step: 1 }),
    p("plotWidth", "Plot width (fraction)", 0.956, { min: 0.5, max: 1 }),
    p("seed", "Seed", 7, { step: 1 }),
    p("volatility", "Volatility", 1, { min: 0.2, max: 3 }),
    p("glow", "Live: new-candle glow", 0, { min: 0, max: 1 }),
    c("bg", "Background", "#0F0F12"),
    c("up", "Up", "#00D16F"),
    c("down", "Down", "#FF6479"),
    c("accent", "MA / playhead", "#FFB947"),
  ],
  draw(ctx, w, h, t, get) {
    const n = get.num;
    const count = Math.max(5, Math.round(n("count")));
    const rate = Math.max(0, n("rate"));
    const pw = w * clamp(n("plotWidth"), 0.5, 1);
    const sp = pw / (count + 1.2), bw = sp * 0.58;
    const yOf = (price: number) => ((7 + (86060 - price) * 2.40625) / 399) * h;
    const up = get.str("up"), down = get.str("down"), accent = get.str("accent");
    const lw = h * 0.004;

    // Series: live advances with time, replay reveals a fixed window.
    const series = candleSeries(Math.round(n("seed")), count + 400, +n("volatility").toFixed(2));
    let first: number, shown: number, formFrac: number;
    if (rate > 0) {
      const tick = t * rate;
      first = Math.floor(tick) + 20;
      shown = count;
      formFrac = tick - Math.floor(tick);
    } else {
      const r = clamp(n("reveal")) * count;
      first = 20;
      shown = Math.min(count, Math.floor(r) + 1);
      formFrac = r >= count ? 1 : r - Math.floor(r);
    }
    const candles: Candle[] = [];
    for (let i = 0; i < shown; i++) {
      const k = series[first + i];
      if (i < shown - 1 || formFrac >= 1) { candles.push(k); continue; }
      // Forming candle: close wanders toward its final value; wicks grow with it.
      const wob = Math.sin(2 * Math.PI * (formFrac * 3.3 + i * 0.37)) * Math.sin(Math.PI * formFrac) * 7 * n("volatility");
      const cl = k.o + (k.c - k.o) * formFrac + wob;
      candles.push({
        o: k.o, c: cl,
        h: Math.max(k.o, cl) + (k.h - Math.max(k.o, k.c)) * formFrac,
        l: Math.min(k.o, cl) - (Math.min(k.o, k.c) - k.l) * formFrac,
        v: k.v * (0.15 + 0.85 * formFrac),
      });
    }

    // Plot + axis background and grid.
    ctx.fillStyle = get.str("bg");
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.lineWidth = lw * 0.6;
    ctx.setLineDash([lw * 2, lw * 2]);
    for (let k = 0; k <= 8; k++) {
      const y = yOf(86060 - k * 20);
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(pw, y); ctx.stroke();
    }
    ctx.setLineDash([]);

    // Volume.
    const vBase = h * 0.995, vMax = h * 0.1;
    candles.forEach((k, i) => {
      const x = (i + 0.6) * sp;
      ctx.fillStyle = k.c >= k.o ? "rgba(0,209,111,0.16)" : "rgba(255,100,121,0.14)";
      ctx.fillRect(x - sp / 2, vBase - k.v * vMax, sp * 0.96, k.v * vMax);
    });

    // Entry / stop levels (match the screenshot's labels on the left).
    ctx.strokeStyle = "rgba(255,159,67,0.7)";
    ctx.lineWidth = lw;
    ctx.beginPath(); ctx.moveTo(0, ((257 - 84) / 399) * h); ctx.lineTo(pw, ((257 - 84) / 399) * h); ctx.stroke();
    ctx.strokeStyle = "rgba(255,100,121,0.75)";
    ctx.setLineDash([lw * 1.2, lw * 1.6]);
    ctx.beginPath(); ctx.moveTo(0, ((318 - 84) / 399) * h); ctx.lineTo(pw, ((318 - 84) / 399) * h); ctx.stroke();
    ctx.setLineDash([]);

    // Moving average.
    ctx.strokeStyle = accent;
    ctx.globalAlpha = 0.8;
    ctx.lineWidth = lw;
    ctx.beginPath();
    candles.forEach((_, i) => {
      let sum = 0;
      for (let j = 0; j < 12; j++) sum += series[first + i - j].c;
      const x = (i + 0.6) * sp, y = yOf(i === candles.length - 1 ? (sum - series[first + i].c + candles[i].c) / 12 : sum / 12);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.globalAlpha = 1;

    // New-candle glow: a soft column that flashes as each live candle opens.
    const glow = rate > 0 ? clamp(n("glow")) * Math.pow(1 - clamp(formFrac / 0.45), 2) : 0;
    if (glow > 0) {
      const gx = (candles.length - 1 + 0.6) * sp;
      const g = ctx.createLinearGradient(gx - sp * 2, 0, gx + sp * 2, 0);
      const last0 = candles[candles.length - 1], col = last0.c >= last0.o ? "0,209,111" : "255,100,121";
      g.addColorStop(0, `rgba(${col},0)`);
      g.addColorStop(0.5, `rgba(${col},${(0.28 * glow).toFixed(3)})`);
      g.addColorStop(1, `rgba(${col},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(gx - sp * 2, 0, sp * 4, h);
    }

    // Candles.
    candles.forEach((k, i) => {
      const x = (i + 0.6) * sp;
      ctx.fillStyle = ctx.strokeStyle = k.c >= k.o ? up : down;
      ctx.lineWidth = Math.max(lw * 0.5, sp * 0.08);
      ctx.beginPath(); ctx.moveTo(x, yOf(k.h)); ctx.lineTo(x, yOf(k.l)); ctx.stroke();
      const y0 = yOf(Math.max(k.o, k.c)), y1 = yOf(Math.min(k.o, k.c));
      ctx.fillRect(x - bw / 2, y0, bw, Math.max(lw * 0.8, y1 - y0));
    });

    const last = candles[candles.length - 1];
    const lastX = (candles.length - 1 + 0.6) * sp;
    // Replay playhead.
    if (rate === 0 && n("playhead") >= 0.5 && n("reveal") < 1) {
      ctx.strokeStyle = accent;
      ctx.lineWidth = lw;
      ctx.beginPath(); ctx.moveTo(lastX + sp * 0.6, 0); ctx.lineTo(lastX + sp * 0.6, h); ctx.stroke();
      ctx.fillStyle = accent;
      ctx.fillRect(lastX + sp * 0.6 - lw * 2, 0, lw * 4, lw * 4);
    }

    // Price axis.
    const fs = h * 0.029;
    ctx.font = `400 ${fs}px "Geist", sans-serif`;
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    for (let k = 0; k <= 8; k++) ctx.fillText(fmtPrice(86060 - k * 20), pw + fs * 0.4, yOf(86060 - k * 20));

    // Last-price line + tag.
    const py = yOf(last.c);
    ctx.strokeStyle = "rgba(255,255,255,0.28)";
    ctx.lineWidth = lw * 0.6;
    ctx.setLineDash([lw * 1.5, lw * 1.5]);
    ctx.beginPath(); ctx.moveTo(0, py); ctx.lineTo(pw, py); ctx.stroke();
    ctx.setLineDash([]);
    const tagH = fs * 1.75, tagW = w - pw + fs * 0.6;
    if (glow > 0) {
      // Price tag pulses with the glow.
      ctx.fillStyle = last.c >= last.o ? up : down;
      ctx.globalAlpha = 0.35 * glow;
      const grow = fs * 0.6 * glow;
      ctx.fillRect(pw - fs * 0.6 - grow, py - tagH / 2 - grow, tagW + grow * 2, tagH + grow * 2);
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = last.c >= last.o ? up : down;
    ctx.fillRect(pw - fs * 0.6, py - tagH / 2, tagW, tagH);
    ctx.fillStyle = last.c >= last.o ? "#05140c" : "#ffffff";
    ctx.font = `500 ${fs}px "Geist", sans-serif`;
    ctx.fillText(fmtPrice(last.c), pw + fs * 0.4, py + fs * 0.05);
  },
};

// ---------- Roulette thumbnails (OBK-01) ----------

// Mini chart tiles in the style of the Figma "Heatmap thumb": dark violet pixel
// grid, mint/pink candles, hot orange accents. One look per `kind`; `seed`
// varies the data so every row of the reel gets its own image.
const THUMB_KINDS = ["heatmap", "footprint", "volume", "delta", "vwap", "spread", "profile", "tape", "dom"];
const TH = {
  bg: "#150a28", cell: [104, 54, 168] as const,
  up: "#6fe8c4", down: "#f2607f", hot: "#ff9a1f", hotter: "#ffd447", lilac: "#c5b9ee",
};

GENERATORS.chartThumb = {
  label: "Chart thumbnail",
  params: [
    { key: "kind", label: "Kind", kind: "enum", default: "heatmap", options: THUMB_KINDS, group: "Content" },
    p("seed", "Seed", 1, { step: 1 }),
    p("radius", "Corner radius", 4, { min: 0 }),
  ],
  draw(ctx, w, h, _t, get) {
    const kind = get.str("kind"), seed = Math.round(get.num("seed")), rad = Math.max(0, get.num("radius"));
    const rnd = (i: number, j = 0, salt = 0) => hash3(i + 31 * salt, j, seed * 97 + 13);
    const cols = 14, rows = 9, cw = w / cols, ch = h / rows;
    const cell = (a: number) => `rgba(${TH.cell[0]},${TH.cell[1]},${TH.cell[2]},${a.toFixed(3)})`;

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(0, 0, w, h, rad);
    ctx.clip();
    ctx.fillStyle = TH.bg;
    ctx.fillRect(0, 0, w, h);
    // Pixel field (every kind gets a quiet version of it).
    const fieldA = kind === "heatmap" ? 0.75 : 0.28;
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const v = rnd(i, j, 1);
      if (v < 0.35) continue;
      ctx.fillStyle = cell((v - 0.35) * fieldA);
      ctx.fillRect(i * cw, j * ch, cw + 0.3, ch + 0.3);
    }

    // Random-walk candles across [x0, x1] inside the band [y0, y1].
    const candles = (n: number, x0: number, x1: number, y0: number, y1: number, salt = 2) => {
      const sp = (x1 - x0) / n, bw = sp * 0.5;
      let c = 0.5;
      const pts: number[] = [];
      for (let i = 0; i < n; i++) {
        const o = c;
        c = Math.min(0.9, Math.max(0.1, o + (rnd(i, 0, salt) - 0.5) * 0.35));
        const hi = Math.max(o, c) + rnd(i, 1, salt) * 0.12, lo = Math.min(o, c) - rnd(i, 2, salt) * 0.12;
        const y = (v: number) => y1 - v * (y1 - y0), x = x0 + (i + 0.5) * sp;
        ctx.fillStyle = ctx.strokeStyle = c >= o ? TH.up : TH.down;
        ctx.lineWidth = Math.max(0.6, sp * 0.1);
        ctx.beginPath(); ctx.moveTo(x, y(hi)); ctx.lineTo(x, y(lo)); ctx.stroke();
        ctx.fillRect(x - bw / 2, y(Math.max(o, c)), bw, Math.max(1, y(Math.min(o, c)) - y(Math.max(o, c))));
        pts.push(x, y((o + c) / 2));
      }
      return pts;
    };
    const line = (pts: number[], color: string, width: number) => {
      ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineJoin = "round";
      ctx.beginPath();
      for (let i = 0; i < pts.length; i += 2) (i ? ctx.lineTo : ctx.moveTo).call(ctx, pts[i], pts[i + 1]);
      ctx.stroke();
    };

    switch (kind) {
      case "heatmap": {
        const bx = Math.floor(3 + rnd(0, 0, 3) * 6), by = Math.floor(3 + rnd(1, 0, 3) * 3);
        for (let j = -1; j <= 1; j++) for (let i = -2; i <= 2; i++) {
          const d = Math.abs(i) + Math.abs(j);
          ctx.fillStyle = d === 0 ? "#fff1a8" : d === 1 ? TH.hotter : d === 2 ? TH.hot : "rgba(255,120,60,0.55)";
          ctx.fillRect((bx + i) * cw, (by + j) * ch, cw + 0.3, ch + 0.3);
        }
        candles(12, 0, w, h * 0.1, h * 0.8);
        break;
      }
      case "footprint": {
        const n = 6, sp = w / n;
        for (let i = 0; i < n; i++) {
          const top = 1 + Math.floor(rnd(i, 0, 4) * 3), len = 4 + Math.floor(rnd(i, 1, 4) * 3), up = rnd(i, 2, 4) > 0.45;
          for (let j = top; j < Math.min(rows, top + len); j++) {
            const a = rnd(i, j, 5), b = rnd(i, j, 6);
            ctx.fillStyle = `rgba(242,96,127,${(0.25 + a * 0.75).toFixed(3)})`;
            ctx.fillRect(i * sp + sp * 0.12, j * ch + 1, sp * 0.36, ch - 2);
            ctx.fillStyle = `rgba(111,232,196,${(0.25 + b * 0.75).toFixed(3)})`;
            ctx.fillRect(i * sp + sp * 0.52, j * ch + 1, sp * 0.36, ch - 2);
          }
          ctx.strokeStyle = up ? TH.up : TH.down; ctx.lineWidth = 1.2;
          ctx.strokeRect(i * sp + sp * 0.08, top * ch, sp * 0.84, Math.min(rows - top, len) * ch);
        }
        break;
      }
      case "volume": {
        candles(12, 0, w, h * 0.08, h * 0.58);
        for (let i = 0; i < 14; i++) {
          const v = 0.2 + rnd(i, 0, 7) * 0.8;
          ctx.fillStyle = rnd(i, 1, 7) > 0.45 ? "rgba(111,232,196,0.8)" : "rgba(242,96,127,0.8)";
          ctx.fillRect(i * cw + cw * 0.15, h - v * h * 0.32, cw * 0.7, v * h * 0.32);
        }
        break;
      }
      case "delta": {
        const mid = h * 0.55;
        let cum = 0;
        const pts: number[] = [];
        for (let i = 0; i < 14; i++) {
          const d = (rnd(i, 0, 8) - 0.45) * 2;
          cum += d * 0.12;
          ctx.fillStyle = d >= 0 ? TH.up : TH.down;
          const bh = Math.abs(d) * h * 0.28;
          ctx.fillRect(i * cw + cw * 0.18, d >= 0 ? mid - bh : mid, cw * 0.64, bh);
          pts.push((i + 0.5) * cw, h * 0.3 - cum * h);
        }
        ctx.fillStyle = "rgba(255,255,255,0.25)";
        ctx.fillRect(0, mid - 0.5, w, 1);
        line(pts, TH.hotter, 1.6);
        break;
      }
      case "vwap": {
        const pts = candles(12, 0, w, h * 0.12, h * 0.88);
        const sm: number[] = [];
        for (let i = 0; i < pts.length; i += 2) {
          let s = 0, c = 0;
          for (let j = Math.max(0, i - 6); j <= i; j += 2) { s += pts[j + 1]; c++; }
          sm.push(pts[i], s / c);
        }
        ctx.fillStyle = "rgba(197,185,238,0.16)";
        ctx.beginPath();
        for (let i = 0; i < sm.length; i += 2) (i ? ctx.lineTo : ctx.moveTo).call(ctx, sm[i], sm[i + 1] - h * 0.14);
        for (let i = sm.length - 2; i >= 0; i -= 2) ctx.lineTo(sm[i], sm[i + 1] + h * 0.14);
        ctx.fill();
        line(sm, TH.hot, 1.8);
        break;
      }
      case "spread": {
        const a: number[] = [], b: number[] = [];
        let v = 0.5;
        for (let i = 0; i <= 20; i++) {
          v = Math.min(0.8, Math.max(0.2, v + (rnd(i, 0, 9) - 0.5) * 0.12));
          const gap = 0.05 + rnd(i, 1, 9) * 0.1, x = (i / 20) * w;
          a.push(x, h * (1 - v - gap)); b.push(x, h * (1 - v + gap));
        }
        ctx.fillStyle = "rgba(255,154,31,0.22)";
        ctx.beginPath();
        for (let i = 0; i < a.length; i += 2) (i ? ctx.lineTo : ctx.moveTo).call(ctx, a[i], a[i + 1]);
        for (let i = b.length - 2; i >= 0; i -= 2) ctx.lineTo(b[i], b[i + 1]);
        ctx.fill();
        line(a, TH.down, 1.6);
        line(b, TH.up, 1.6);
        break;
      }
      case "profile": {
        candles(8, 0, w * 0.55, h * 0.1, h * 0.9);
        const poc = 2 + Math.floor(rnd(0, 0, 10) * 5);
        for (let j = 0; j < rows; j++) {
          const v = j === poc ? 1 : 0.15 + rnd(j, 0, 11) * 0.65 * (1 - Math.abs(j - poc) / rows);
          ctx.fillStyle = j === poc ? TH.hot : "rgba(197,185,238,0.55)";
          ctx.fillRect(w - v * w * 0.42, j * ch + 1, v * w * 0.42, ch - 2);
        }
        break;
      }
      case "tape": {
        for (let j = 0; j < 8; j++) {
          const y = (j + 0.5) * (h / 8), up = rnd(j, 0, 12) > 0.45, big = rnd(j, 1, 12) > 0.8;
          ctx.fillStyle = up ? TH.up : TH.down;
          ctx.globalAlpha = big ? 1 : 0.75;
          ctx.fillRect(w * 0.06, y - h * 0.03, w * (0.08 + rnd(j, 2, 12) * 0.12), h * 0.06);
          ctx.globalAlpha = 1;
          ctx.fillStyle = big ? TH.hotter : "rgba(255,255,255,0.35)";
          ctx.fillRect(w * 0.32, y - h * 0.025, w * (0.18 + rnd(j, 3, 12) * 0.2), h * 0.05);
          ctx.fillStyle = "rgba(255,255,255,0.2)";
          ctx.fillRect(w * 0.76, y - h * 0.025, w * 0.16, h * 0.05);
        }
        break;
      }
      case "dom": {
        const rh = h / 9, mid = 4;
        for (let j = 0; j < 9; j++) {
          const y = j * rh;
          if (j === mid) {
            ctx.fillStyle = "rgba(255,212,71,0.85)";
            ctx.fillRect(w * 0.42, y + 1, w * 0.16, rh - 2);
            continue;
          }
          const v = 0.2 + rnd(j, 0, 13) * 0.8;
          ctx.fillStyle = "rgba(255,255,255,0.18)";
          ctx.fillRect(w * 0.44, y + rh * 0.3, w * 0.12, rh * 0.4);
          if (j > mid) { ctx.fillStyle = TH.up; ctx.fillRect(w * 0.4 - v * w * 0.36, y + 1, v * w * 0.36, rh - 2); }
          else { ctx.fillStyle = TH.down; ctx.fillRect(w * 0.6, y + 1, v * w * 0.36, rh - 2); }
        }
        break;
      }
    }
    ctx.restore();
  },
};

// ---------- Liquidity heatmap (OBK-02 · Money) ----------

// The plot of the Trademania heatmap window: $10 price buckets × time columns,
// heat = resting liquidity (purple → magenta → orange → yellow), with persistent
// bands, a hot wall at `wallPrice`, live candles and the chart legend. Prices map
// as y = (pTop − price) · pxPer, matching the screenshot's axis.
const HEAT_STOPS: [number, [number, number, number]][] = [
  [0, [10, 7, 22]], [0.22, [34, 14, 70]], [0.45, [74, 26, 118]], [0.62, [150, 40, 130]],
  [0.78, [232, 84, 96]], [0.9, [255, 168, 52]], [1, [255, 238, 150]],
];
const heatColor = (v: number) => {
  v = clamp(v);
  let i = 1;
  while (i < HEAT_STOPS.length - 1 && HEAT_STOPS[i][0] < v) i++;
  const [a, ca] = HEAT_STOPS[i - 1], [b, cb] = HEAT_STOPS[i];
  const u = (v - a) / Math.max(1e-6, b - a);
  return `rgb(${ca.map((c, j) => Math.round(c + (cb[j] - c) * u)).join(",")})`;
};

GENERATORS.liquidityHeatmap = {
  label: "Liquidity heatmap",
  fonts: [["Geist", 500]],
  params: [
    p("cols", "Time columns", 64, { step: 1, min: 8 }),
    p("pTop", "Price at top", 86069.7, { step: 1 }),
    p("pxPer", "Pixels per $", 1.7, { min: 0.1 }),
    p("wallPrice", "Wall price", 85860, { step: 10 }),
    p("wallFrom", "Wall from (x fraction)", 0.69, { min: 0, max: 1 }),
    p("wallTo", "Wall to (x fraction)", 0.79, { min: 0, max: 1 }),
    p("wall", "Wall heat", 1, { min: 0, max: 1.5 }),
    p("shimmer", "Shimmer", 1, { min: 0, max: 2 }),
    p("rate", "Live: candle ticks per s", 1.2, { min: 0 }),
    p("legend", "Show legend", 1, { min: 0, max: 1, step: 1 }),
    p("reveal", "Candles: draw on", 1, { min: 0, max: 1 }),
    p("legendIn", "Legend: fade in", 1, { min: 0, max: 1 }),
    p("axisW", "Axis column width", 0, { min: 0 }),
    p("axisIn", "Axis: fade in", 1, { min: 0, max: 1 }),
    p("wallFade", "Wall: fade", 0, { min: 0, max: 1 }),
    p("wallExtend", "Wall: band extends right", 0, { min: 0, max: 1 }),
    p("dim", "Heat: dim", 0, { min: 0, max: 1 }),
    p("candleDim", "Candles: dim (except hero)", 0, { min: 0, max: 1 }),
    p("hero", "Hero candle index (−1 = none)", -1, { step: 1 }),
    p("seed", "Seed", 5, { step: 1 }),
  ],
  draw(ctx, w, h, t, get) {
    const n = get.num;
    const axisW = Math.max(0, n("axisW"));
    const fullW = w;
    w = Math.max(10, w - axisW); // plot width; the axis column sits to its right
    const cols = Math.max(8, Math.round(n("cols")));
    const pTop = n("pTop"), pxPer = n("pxPer"), seed = Math.round(n("seed"));
    const yOf = (price: number) => (pTop - price) * pxPer;
    const bucket = 10, rowH = bucket * pxPer;
    const cw = w / cols;
    const pBottom = pTop - h / pxPer;
    const shimmer = n("shimmer");
    const wallP = n("wallPrice"), wallHeat = n("wall");
    const wf = n("wallFrom"), wt = n("wallTo");

    const wallFade = clamp(n("wallFade")), wallExt = clamp(n("wallExtend"));
    ctx.fillStyle = heatColor(0);
    ctx.fillRect(0, 0, w, h);

    // Persistent liquidity bands (price levels people rest orders at).
    const bands: [number, number][] = [[86000, 0.72], [85900, 0.62], [85960, 0.45], [86040, 0.4], [85800, 0.5], [85940, 0.35], [85760, 0.42]];
    const firstRow = Math.floor(pBottom / bucket) * bucket;
    for (let price = firstRow; price <= pTop + bucket; price += bucket) {
      const y = yOf(price + bucket);
      let band = 0;
      for (const [bp, s] of bands) if (Math.abs(bp - price) < 1) band = s;
      for (let c = 0; c < cols; c++) {
        const x = c * cw;
        const base = hash3(c, Math.round(price), seed);
        // Bands run in long horizontal streaks with gaps; the rest is sparse noise.
        const streak = band > 0 && hash3(Math.floor(c / 5), Math.round(price), seed + 1) > 0.25 ? band : 0;
        let v = Math.max(streak * (0.8 + 0.3 * base), base > 0.55 ? (base - 0.55) * 0.9 : 0);
        // Slow shimmer, different per cell.
        v *= 1 + shimmer * 0.18 * Math.sin(t * (1.3 + base * 1.7) + base * 40);
        // The wall: hot block at its price, building over the last stretch of time.
        const u = (c + 0.5) / cols;
        if (Math.abs(price - wallP) < 1 || Math.abs(price - (wallP - bucket)) < 1) {
          if (u >= wf && u <= wt) {
            const core = Math.abs(price - wallP) < 1 && u > wf + (wt - wf) * 0.25 && u < wt - (wt - wf) * 0.25;
            v = Math.max(v, wallHeat * (core ? 1.05 : 0.86) * (0.92 + 0.08 * Math.sin(t * 5 + c)));
            v *= 1 - wallFade * 0.55;
          } else if (u > wf - 0.12 && u < wf) v = Math.max(v, wallHeat * 0.42 * (1 - wallFade * 0.5));
          else if (u > wt && wallExt > 0) {
            // The band carries on to the right (the wall is still resting there).
            const reach = wt + wallExt * (1 - wt);
            if (u <= reach) v = Math.max(v, wallHeat * (0.78 - 0.32 * ((u - wt) / Math.max(1e-6, 1 - wt))) * (0.9 + 0.1 * Math.sin(t * 4 + c)));
          }
        }
        if (v < 0.04) continue;
        ctx.fillStyle = heatColor(v);
        ctx.fillRect(x, y, cw + 0.4, rowH + 0.4);
      }
    }

    // Dim: the heat sinks back into a cool slate so the candles take over.
    const dim = clamp(n("dim"));
    if (dim > 0) {
      ctx.fillStyle = `rgba(12,22,27,${(0.82 * dim).toFixed(3)})`;
      ctx.fillRect(0, 0, w, h);
    }

    // Candles: a climb toward 85,975 across the right ~60% of the plot.
    const nC = Math.round(cols * 0.62), c0 = cols - nC;
    const rate = Math.max(0, n("rate"));
    const tick = t * rate, frac = tick - Math.floor(tick);
    let prev = 85690;
    // Draw-on: candles appear left → right, the newest one growing in.
    const shownC = clamp(n("reveal")) * nC;
    for (let i = 0; i < nC; i++) {
      const grow = clamp(shownC - i);
      if (grow <= 0) break;
      const target = 85690 + (85975 - 85690) * Math.pow(i / (nC - 1), 1.2);
      const o = prev;
      let c = target + (hash3(i, seed, 7) - 0.5) * 34;
      const last = i === nC - 1;
      if (last) c = 85975 + Math.sin(2 * Math.PI * (frac * 2.3 + Math.floor(tick) * 0.37)) * 9;
      const hero = i === Math.round(n("hero"));
      let o2 = o, hi = Math.max(o, c) + hash3(i, seed, 8) * 14, lo = Math.min(o, c) - hash3(i, seed, 9) * 14;
      if (hero) { o2 = 85872; c = 85902; hi = 85908; lo = 85866; } // the strong green candle that gets selected
      prev = c;
      const x = (c0 + i + 0.5) * cw, bw = cw * 0.56;
      ctx.globalAlpha = grow * (hero ? 1 : 1 - 0.55 * clamp(n("candleDim")));
      ctx.fillStyle = ctx.strokeStyle = c >= o2 ? "#6fe8c4" : "#f2607f";
      ctx.lineWidth = Math.max(1, cw * 0.1);
      ctx.beginPath(); ctx.moveTo(x, yOf(hi)); ctx.lineTo(x, yOf(lo)); ctx.stroke();
      const y0 = yOf(Math.max(o2, c)), y1 = yOf(Math.min(o2, c));
      ctx.fillRect(x - bw / 2, y0, bw, Math.max(1.2, y1 - y0));
      ctx.globalAlpha = 1;
      if (hero) prev = c;
      if (last) {
        ctx.strokeStyle = "rgba(255,255,255,0.35)";
        ctx.setLineDash([3, 3]);
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0, yOf(c)); ctx.lineTo(w, yOf(c)); ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // Legend (top-left, as in the product).
    // Price axis column (matches the product's axis; used once the window chrome is gone).
    const axisIn = clamp(n("axisIn"));
    if (axisW > 0 && axisIn > 0) {
      ctx.globalAlpha = axisIn;
      ctx.fillStyle = "#0F0F12";
      ctx.fillRect(w, 0, fullW - w, h);
      ctx.font = `500 12.6px "Geist", sans-serif`;
      ctx.textBaseline = "middle";
      ctx.textAlign = "left";
      for (let price = Math.ceil(pBottom / 20) * 20; price <= pTop; price += 20) {
        ctx.fillStyle = price % 100 === 0 ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.55)";
        ctx.fillText(Math.round(price).toLocaleString("en-US"), w + 13, yOf(price));
      }
      const tagY = yOf(85974.65);
      ctx.fillStyle = "#6fe8c4";
      ctx.fillRect(w + 2, tagY - 9, fullW - w - 4, 18);
      ctx.fillStyle = "#06140f";
      ctx.fillText("85,974.65", w + 8, tagY + 0.5);
      ctx.globalAlpha = 1;
    }

    const legendIn = clamp(n("legendIn"));
    if (n("legend") >= 0.5 && legendIn > 0) {
      ctx.globalAlpha = legendIn;
      const fs = 12.6;
      ctx.font = `500 ${fs}px "Geist", sans-serif`;
      ctx.textBaseline = "middle";
      ctx.textAlign = "left";
      let x = 10;
      const put = (s: string, color: string, gap = 6) => { ctx.fillStyle = color; ctx.fillText(s, x, 16); x += ctx.measureText(s).width + gap; };
      put("BTC / USDT", "rgba(255,255,255,0.92)", 9);
      put("1", "rgba(255,255,255,0.92)", 9);
      put("Binance", "rgba(255,255,255,0.92)", 9);
      for (const [l, v] of [["O", "85,963.36"], ["H", "85,998.01"], ["L", "85,960.22"], ["C", "85,974.65"]]) {
        put(l, "rgba(255,255,255,0.6)", 0);
        put(v, "#3fd39a", 5);
      }
      put("+11.28 (+0.01%)", "#3fd39a");
      x = 10;
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.fillText("Volume", x, 40);
      ctx.fillStyle = "#3fd39a";
      ctx.fillText("6.73", x + ctx.measureText("Volume").width + 8, 40);
      ctx.globalAlpha = 1;
    }
  },
};

/**
 * Order-book ladder (VOL "Folge dem Volumen"): rows of price / notional / size
 * that scroll by `scroll` rows (positive = rows move up, price falling). Row 0
 * sits on `centerY` and is never drawn (the focus row is real layers); rows fade
 * out as they near it so they can pass behind it. Price color follows the side
 * of the center (asks red above, bids green below) and its alpha falls off with
 * distance like the Figma frames. `side` limits drawing to one half so each half
 * can sit in its own blur-ramp group. `shutter` > 0 smears rows vertically by how
 * far `scroll` travelled during that window (motion blur from real velocity).
 */
GENERATORS.orderLadder = {
  label: "Order ladder",
  fonts: [["Geist", 500]],
  params: [
    p("scroll", "Scroll (rows)", 0, { step: 0.01 }),
    { key: "side", label: "Side", kind: "enum", default: "both", options: ["both", "asks", "bids"], group: "Content" },
    p("centerY", "Center Y", 540, { step: 1 }),
    p("rowHeight", "Row height", 104, { step: 1, min: 10 }),
    p("fontSize", "Font size", 60, { step: 1, min: 4 }),
    p("col1", "Price right edge", 690, { step: 1 }),
    p("col2", "Notional right edge", 1170, { step: 1 }),
    p("col3", "Size right edge", 1650, { step: 1 }),
    p("rowAlpha", "Row opacity", 0.32, { min: 0, max: 1 }),
    p("gapFade", "Center fade (rows)", 0.45, { min: 0.05, max: 1 }),
    p("shutter", "Motion blur shutter (s)", 0, { step: 0.005, min: 0 }),
    { key: "priceAlphas", label: "Price alpha by distance", kind: "string", default: "0.52, 0.42, 0.32, 0.22, 0.18", group: "Content" },
    p("basePrice", "Best price", 85974.65, { step: 0.01 }),
    p("tick", "Tick size", 1.3, { step: 0.01 }),
    c("askColor", "Ask color", "#f97474"),
    c("bidColor", "Bid color", "#3fcf8e"),
    c("textColor", "Text color", "#F4F9EE"),
  ],
  draw(ctx, _w, h, t, get) {
    const cy = get.num("centerY"), rh = Math.max(10, get.num("rowHeight")), scroll = get.num("scroll");
    const shutter = Math.max(0, get.num("shutter"));
    const scroll0 = shutter > 0 ? get.at("scroll", t - shutter) : scroll;
    // One pass per ~5 px travelled during the shutter, each at 1/N strength.
    const passes = Math.max(1, Math.min(28, Math.ceil((Math.abs(scroll - scroll0) * rh) / 5)));
    const side = get.str("side"), fade = Math.max(0.05, get.num("gapFade"));
    const fs = get.num("fontSize"), rowAlpha = get.num("rowAlpha");
    const cols = [get.num("col1"), get.num("col2"), get.num("col3")];
    const alphas = get.str("priceAlphas").split(",").map(Number).filter(Number.isFinite);
    const ask = parseColorRGB(get.str("askColor")), bid = parseColorRGB(get.str("bidColor"));
    const base = get.num("basePrice"), tick = get.num("tick");
    // Price alpha at a continuous distance d (rows) from the center.
    const priceAlpha = (d: number) => {
      if (!alphas.length) return 1;
      const i = Math.max(0, d - 1);
      const i0 = Math.min(alphas.length - 1, Math.floor(i)), i1 = Math.min(alphas.length - 1, i0 + 1);
      return alphas[i0] + (alphas[i1] - alphas[i0]) * (i - Math.floor(i));
    };
    const fmt = (v: number, dec: number) => v.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec });
    // Row n's values (n < 0 above the best price, n > 0 below). The Figma
    // ladder for |n| ≤ 5, then deterministic filler.
    const FIGMA: Record<number, [number, number]> = {
      [-5]: [207356.8, 2.418], [-4]: [63115.09, 0.736], [-3]: [437511.3, 5.102], [-2]: [110105.05, 1.284], [-1]: [338713.68, 3.95],
      1: [395465.63, 4.612], 2: [78714.64, 0.918], 3: [626363.57, 7.305], 4: [184090.65, 2.147], 5: [133757.36, 1.56],
    };
    const rows = new Map<number, [string, string, string]>();
    const row = (n: number) => {
      let r = rows.get(n);
      if (r) return r;
      const price = n < 0 ? base + 1.68 + (-n - 1) * tick : base - 1.52 - (n - 1) * tick;
      const f = FIGMA[n];
      const size = f ? f[1] : +(0.3 + hash3(n + 512, 3, 9) * 7.5).toFixed(3);
      r = [fmt(price, 2), fmt(f ? f[0] : price * size, 2), fmt(size, 3)];
      rows.set(n, r);
      return r;
    };
    ctx.font = `500 ${fs}px "Geist", ui-sans-serif, sans-serif`;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    const textColor = get.str("textColor");
    const lo = Math.min(scroll, scroll0), hi = Math.max(scroll, scroll0);
    const nMin = Math.floor(lo - cy / rh) - 1, nMax = Math.ceil(hi + (h - cy) / rh) + 1;
    const prev = ctx.globalAlpha;
    for (let pass = 0; pass < passes; pass++) {
      const sc = passes === 1 ? scroll : scroll0 + ((scroll - scroll0) * (pass + 0.5)) / passes;
      for (let n = nMin; n <= nMax; n++) {
        if (n === 0) continue;
        const y = cy + (n - sc) * rh;
        const above = y < cy;
        if ((side === "asks" && !above) || (side === "bids" && above)) continue;
        const d = Math.abs(y - cy) / rh;
        const gate = clamp((d - (1 - fade)) / fade);
        const a = (rowAlpha * gate * gate * (3 - 2 * gate)) / passes;
        if (a < 0.0005) continue;
        const [price, notional, size] = row(n), [cr, cg, cb] = above ? ask : bid;
        ctx.globalAlpha = prev * a;
        ctx.fillStyle = `rgba(${cr},${cg},${cb},${priceAlpha(d)})`;
        ctx.fillText(price, cols[0], y);
        ctx.fillStyle = textColor;
        ctx.fillText(notional, cols[1], y);
        ctx.fillText(size, cols[2], y);
      }
    }
    ctx.globalAlpha = prev;
  },
};

export const GENERATOR_NAMES = Object.keys(GENERATORS);
