// v004 of trademania-v3-thinking, built on top of v003 (feedback round 3):
//  - Thinking phase +1.5s, more active (faster shimmer, faster scramble, quicker
//    breathing, processing pulses) with decision branches growing out of the big ball
//  - Motion eased with Figma's "Slow" spring instead of linear/expo
//  - Second-half background rebuilt from the Figma frame (SES-06 · Thinking ·
//    Timeline): two blurred ellipses + full-frame ASCII glyph grid with radial ring
//    opacity in overlay blend
//  - Depth-of-field blur ramping in from the bottom of the list (as in Figma), with
//    upcoming rows more visible
//
//   node scripts/trademania-v3-v004.mjs

import { readFileSync, writeFileSync } from "node:fs";

const dir = new URL("../shots/trademania-v3-thinking/", import.meta.url);
const shot = JSON.parse(readFileSync(new URL("v003.json", dir), "utf8"));

const r4 = (v) => +v.toFixed(4);
const get = (id) => {
  const l = shot.layers.find((x) => x.id === id);
  if (!l) throw new Error(`missing layer ${id}`);
  return l;
};
const setKeys = (id, prop, keys) => {
  const l = get(id);
  (l.keyframes ??= {})[prop] = keys;
  delete l.props[prop];
};
const insertBefore = (beforeId, ...layers) => {
  const i = shot.layers.findIndex((x) => x.id === beforeId);
  if (i < 0) throw new Error(`missing layer ${beforeId}`);
  shot.layers.splice(i, 0, ...layers);
};

// ---------- 1. extend the thinking phase ----------
const CUT = 0.78, EXTRA = 1.5; // everything from the title-out onward moves later
const later = (t) => (t >= CUT - 1e-6 ? r4(t + EXTRA) : t);
for (const l of shot.layers) {
  if (l.start !== undefined) l.start = later(l.start);
  if (l.end !== undefined) l.end = later(l.end);
  for (const kfs of Object.values(l.keyframes ?? {})) for (const k of kfs) k.t = later(k.t);
}
shot.duration = r4(shot.duration + EXTRA);
const THINK_END = r4(0.8 + EXTRA); // handoff start (ball starts shrinking)
const HANDOFF_END = r4(1.3 + EXTRA);
shot.note = "Longer, busier thinking with branches from the ball; Figma Slow spring; Figma ASCII bg + bottom blur";

// ---------- 2. thinking: more active ----------
// Faster shimmer (one sweep every 0.75s).
const SWEEP = 0.75;
setKeys("title", "gradientShift", [{ t: 0.1, v: -0.6 }, { t: THINK_END + 0.2, v: r4(-0.6 + (THINK_END + 0.1) / SWEEP) }]);
const hIn = 1.16 + EXTRA, hOut = r4(2.66 + EXTRA);
setKeys("header-thinking", "gradientShift", [{ t: hIn, v: -0.5 }, { t: hOut, v: r4(-0.5 + (hOut - hIn) / SWEEP) }]);
// Timer keeps counting through the longer think.
setKeys("timer", "counter", [{ t: 0.1, v: 0 }, { t: r4(THINK_END - 0.01), v: r4((THINK_END - 0.11) * 2.6) }]);
// Quicker breathing + float while thinking.
const breath = get("orb-breath").keyframes.scale.filter((k) => k.t >= HANDOFF_END);
const think = [];
for (let t = 0, i = 0; t < THINK_END; t = r4(t + 0.36), i++) think.push({ t, v: i % 2 ? 1.035 : 0.99, ease: "sineInOut" });
setKeys("orb-breath", "scale", [...think, { t: HANDOFF_END, v: 1, ease: "sineInOut" }, ...breath]);
const float = [];
for (let t = 0, i = 0; t <= THINK_END; t = r4(t + 0.55), i++) float.push({ t, v: i % 2 ? -9 : 0, ease: "sineInOut" });
setKeys("orb-breath", "y", [...float, { t: HANDOFF_END, v: 0 }]);
// Processing pulses on the halo.
const halo = get("halo").keyframes.opacity.filter((k) => k.t >= HANDOFF_END);
const pulses = [];
for (let t = 0.2, i = 0; t < THINK_END; t = r4(t + 0.36), i++) pulses.push({ t, v: i % 2 ? 0.72 : 1, ease: "sineInOut" });
setKeys("halo", "opacity", [{ t: 0, v: 0.78, ease: "sineInOut" }, ...pulses, { t: HANDOFF_END, v: 0.42, ease: "sineInOut" }, ...halo]);
// Glyphs work harder while thinking, still busy while loading, calm when ready.
const readyAt = r4(2.5 + EXTRA), calmAt = r4(3.1 + EXTRA);
setKeys("orb", "scramble", [{ t: 0, v: 0.95 }, { t: THINK_END, v: 0.95, ease: "sineInOut" }, { t: HANDOFF_END, v: 0.8 }, { t: readyAt, v: 0.8, ease: "sineInOut" }, { t: calmAt, v: 0.12 }]);
setKeys("orb", "scrambleRate", [{ t: 0, v: 26 }, { t: THINK_END, v: 26, ease: "sineInOut" }, { t: HANDOFF_END, v: 16 }, { t: readyAt, v: 16, ease: "sineInOut" }, { t: calmAt, v: 3 }]);
setKeys("orb", "spin", [{ t: 0, v: 1.9 }, { t: THINK_END, v: 1.9, ease: "sineInOut" }, { t: HANDOFF_END, v: 1.2 }, { t: readyAt, v: 1.2, ease: "sineInOut" }, { t: calmAt, v: 0.35 }]);

// ---------- 3. decision branches out of the big ball ----------
// Ball-local space: center (0,0), radius 166. Children of orb-move, so they scale
// and travel with the ball, and get pulled back in as it shrinks into the icon.
const R = 166, BRANCH = "rgba(217,249,185,0.42)";
const rad = (d) => (d * Math.PI) / 180;
const pt = (a, r) => [r4(Math.cos(rad(a)) * r), r4(Math.sin(rad(a)) * r)];
function branchPath(a, len, bend, fork) {
  const [x0, y0] = pt(a, R);
  const [x1, y1] = pt(a + bend * 0.3, R + len * 0.4);
  const [x2, y2] = pt(a + bend * 0.8, R + len * 0.75);
  const [x3, y3] = pt(a + bend, R + len);
  let d = `M${x0} ${y0} C${x1} ${y1} ${x2} ${y2} ${x3} ${y3}`;
  const ends = [[x3, y3]];
  if (fork) {
    const [fx, fy] = pt(a + bend * 0.55, R + len * 0.58);
    const [ex, ey] = pt(a + bend * 0.55 + fork, R + len * 0.58 + len * 0.42);
    const [cx, cy] = pt(a + bend * 0.55 + fork * 0.3, R + len * 0.75);
    d += ` M${fx} ${fy} Q${cx} ${cy} ${ex} ${ey}`;
    ends.push([ex, ey]);
  }
  return { d, ends };
}
// [angle°, length, bend°, fork°|0, grow at, prune at|null]
const BRANCHES = [
  [-150, 210, -14, 0, 0.45, null],
  [-32, 240, 12, 24, 0.6, 1.25],
  [-96, 150, 8, 0, 0.75, null],
  [172, 190, 10, 0, 0.9, 1.55],
  [8, 220, -10, 0, 1.05, null],
  [-62, 270, -10, -26, 1.35, null],
  [-124, 220, 12, 22, 1.6, null],
  [-8, 280, -6, 0, 1.85, null],
];
const RETRACT = THINK_END - 0.1;
const branchLayers = [];
BRANCHES.forEach(([a, len, bend, fork, grow, prune], i) => {
  const { d, ends } = branchPath(a, len, bend, fork);
  const id = `branch${i + 1}`, done = r4(grow + 0.55);
  const trimEnd = [{ t: grow, v: 0, ease: "figmaSlow" }, { t: done, v: 1 }];
  const opacity = [{ t: grow, v: 1 }];
  if (prune) {
    // A discarded decision: retracts back into the ball.
    trimEnd.push({ t: prune, v: 1, ease: "figmaSlow" }, { t: r4(prune + 0.45), v: 0 });
  } else {
    trimEnd.push({ t: RETRACT, v: 1, ease: "figmaSlow" }, { t: r4(RETRACT + 0.45), v: 0 });
  }
  branchLayers.push({
    id, name: `Branch ${i + 1}${prune ? " (pruned)" : ""}`, type: "path", parent: "orb-move", label: "#9fdcc6",
    start: grow,
    props: { d, pathOrigin: "zero", fill: "rgba(0,0,0,0)", stroke: BRANCH, strokeWidth: 2.6, lineCap: "round", x: 0, y: 0 },
    keyframes: { trimEnd, opacity },
  });
  ends.forEach(([ex, ey], j) => {
    const at = r4(done - 0.08 + j * 0.1), gone = prune ? r4(prune + 0.05) : r4(RETRACT + 0.05);
    branchLayers.push({
      id: `${id}-node${j + 1}`, name: `Node ${i + 1}.${j + 1}`, type: "ellipse", parent: "orb-move", label: "#9fdcc6",
      start: r4(at - 0.01), end: r4(gone + 0.3),
      props: { x: ex, y: ey, width: 11, height: 11, fill: "#D9F9B9", shadowColor: "rgba(217,249,185,0.6)", shadowBlur: 14 },
      keyframes: {
        scale: [{ t: at, v: 0, ease: "figmaBouncy" }, { t: r4(at + 0.35), v: 1, ease: "sineInOut" }, { t: r4(at + 0.6), v: 1.35, ease: "sineInOut" }, { t: r4(at + 0.85), v: 1 }],
        opacity: [{ t: gone, v: 1, ease: "figmaSlow" }, { t: r4(gone + 0.25), v: 0 }],
      },
    });
  });
});
insertBefore("halo", ...branchLayers);

// ---------- 4. Figma "Slow" spring on motion ----------
const MOTION = new Set(["x", "y", "scale", "scaleX", "scaleY", "rotation", "opacity", "blur", "trimEnd", "fill"]);
const SKIP_LAYERS = new Set(["orb-breath", "halo", "ring", "glow2", "dither", "orb", "push", ...branchLayers.map((l) => l.id)]);
const CONVERT = new Set([undefined, "expoOut", "easeInOut", "quadInOut", "easeOut", "backOut", "smooth", "sineInOut"]);
let converted = 0;
for (const l of shot.layers) {
  if (SKIP_LAYERS.has(l.id)) continue;
  for (const [prop, kfs] of Object.entries(l.keyframes ?? {})) {
    if (!MOTION.has(prop)) continue;
    kfs.forEach((k, i) => {
      if (i === kfs.length - 1 || !CONVERT.has(k.ease)) return;
      if (kfs[i + 1].v === k.v) return; // holds stay holds
      k.ease = "figmaSlow";
      converted++;
    });
  }
}

// ---------- 5. Figma background for the second half ----------
// Fade-in timing of the original background swap (bg-swap), already shifted.
const swap = get("base").keyframes.opacity.map((k) => ({ ...k }));
get("base").hidden = true;
get("glow2").hidden = true;
setKeys("dither", "gridMix", [{ t: 0, v: 0 }]); // first-half bloom only; Figma grid takes over
// Gaussian-blurred ellipse ≈ radial gradient with an erf falloff around the edge.
function blurredEllipse(id, name, cx, cy, rx, ry, sigma, color, alpha) {
  const hx = rx + 2.5 * sigma, hy = ry + 2.5 * sigma;
  const at = (k) => r4((rx + k * sigma) / hx);
  const [r, g, b] = color;
  const c = (a) => `rgba(${r},${g},${b},${r4(a * alpha)})`;
  return {
    id, name, type: "ellipse", label: "#9fdcc6",
    props: {
      x: cx, y: cy, width: r4(hx * 2), height: r4(hy * 2), fillType: "radial", gradientScale: 0.70711,
      gradientStops: `${c(1)} 0, ${c(0.977)} ${at(-2)}, ${c(0.84)} ${at(-1)}, ${c(0.5)} ${at(0)}, ${c(0.16)} ${at(1)}, ${c(0.023)} ${at(2)}, ${c(0)} 1`,
    },
    keyframes: { opacity: swap.map((k) => ({ ...k })) },
  };
}
insertBefore(
  "base",
  blurredEllipse("figma-glow-lime", "BG glow · lime (Figma)", 928, -235.5, 837, 366.5, 250, [217, 249, 185], 0.32),
  blurredEllipse("figma-glow-deep", "BG glow · deep (Figma)", 928, -92.5, 1570, 596.5, 400, [14, 21, 19], 1),
);
insertBefore("dither", {
  id: "ascii", name: "ASCII rings (Figma dither)", type: "generator", label: "#9fdcc6",
  props: { generator: "asciiRings", x: 960, y: 540, width: 1920, height: 1080, blend: "overlay", scramble: 0.12, scrambleRate: 6 },
  keyframes: {
    opacity: swap.map((k) => ({ ...k })),
    // Rings ripple outward: quicker while the agent loads, slow drift once ready.
    ringShift: [{ t: swap[0].t, v: -0.06 }, { t: readyAt, v: 0.06, ease: "sineInOut" }, { t: shot.duration, v: 0.09 }],
  },
});

// ---------- 6. bottom blur (depth of field) on the list ----------
Object.assign(get("camera").props, { isolate: "yes", rampBlur: 14, rampStart: 640, rampEnd: 1000 });
// Upcoming rows are visible-but-soft (Figma), not faded to 28%; the ramp does the blurring.
const lift = (v) => (v <= 0.28 ? (v * 0.6) / 0.28 : 0.6 + ((v - 0.28) * 0.4) / 0.72);
for (const l of shot.layers) {
  if (!/^(step\d|sub\d)(-desc)?$/.test(l.id)) continue;
  for (const k of l.keyframes?.opacity ?? []) k.v = r4(lift(k.v));
  for (const k of l.keyframes?.blur ?? []) k.v = r4(k.v * 0.5);
}

writeFileSync(new URL("v004.json", dir), JSON.stringify(shot, null, 2) + "\n");
console.log(`v004: ${shot.layers.length} layers, ${shot.duration}s, ${converted} segments → figmaSlow`);
