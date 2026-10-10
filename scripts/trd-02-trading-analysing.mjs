// TRD-02 · "Ob du den nächsten großen Coin tradest," → pixel transition → "jede einzelne
// Kerze analysierst," (Figma 3ajjpzYjyjfDJyp2Jrfvbl, Section 5: frames 97 → 95 → 98).
// Timing follows the reference screen recording (sentence drift → staged cell wipe on
// the Trademania backdrop → cells clear right→left while the next sentence pops in).
// Layout is Figma frame space (1920×1080). Writes shots/trd-02-trading-analysing/v001.json.
import fs from "node:fs";

const ID = "trd-02-trading-analysing";
const FPS = 60;
const snap = (t) => Math.round(t * FPS) / FPS;
const r2 = (v) => Math.round(v * 100) / 100;

const INK = "#0a1a1d", TILE = "#e2ead9";

// ---- timing (s) ----
const T = {
  driftEnd: 1.1667, // 97 holds and drifts slowly…
  wipeIn: [1.1667, 1.8667], // …then cells step on over it
  clear: [2.3333, 2.8333], // short beat on the full backdrop, then cells clear
  popStart: 2.4, // 98 elements pop in, following the clear (right → left)
  popStep: 4 / FPS,
  end: 5.5,
};

// ---- layer helpers ----
const layers = [];
const add = (l) => (layers.push(l), l);
const word = (id, text, left, top, parent, extra = {}) => ({
  id, name: `Word · ${text}`, type: "text", parent,
  props: {
    x: left, y: top, anchorX: 0, anchorY: 0, text, fontFamily: "Geist", fontWeight: 500,
    fontSize: 96, letterSpacing: -1.92, lineHeight: r2(116 / 96 * 1000) / 1000, align: "left", fill: INK,
    ...extra,
  },
});
const tile = (id, name, x, y, w, h, parent) => ({
  id, name: `${name} · tile`, type: "rect", parent,
  props: { x: x + w / 2, y: y + h / 2, width: w, height: h, fill: TILE },
});
const img = (id, name, src, cx, cy, width, parent, extra = {}) => ({
  id, name, type: "image", parent, props: { src, x: r2(cx), y: r2(cy), width: r2(width), ...extra },
});
// Re-express a layer's absolute props relative to a group null at (gx, gy).
const rel = (l, gx, gy) => ((l.props.x = r2(l.props.x - gx)), (l.props.y = r2(l.props.y - gy)), l);

// ---- camera pans (parallax: tiles ride a slightly faster null than words) ----
// 97: slow drift, then accelerates off to the left as the cells take over.
const pan97 = (k) => [
  { t: 0, v: 0, ease: "linear" },
  { t: T.driftEnd, v: r2(-70 * k), ease: [0.4, 0.02, 0.85, 0.5] },
  { t: T.wipeIn[1], v: r2(-1150 * k) },
];
// 98: arrives moving (from the right), settles into a slow drift.
const pan98 = (k) => [
  { t: T.clear[0], v: r2(420 * k), ease: [0.2, 0.7, 0.7, 0.95] },
  { t: T.end, v: r2(-60 * k) },
];

// ---- top: transition layers ----
const cellBox = { x: 966, y: 540, width: 2080, height: 1234.29, cols: 13, rows: 8 }; // snapped to the Figma grid
const cellKeys = {
  progress: [{ t: T.wipeIn[0], v: 0, ease: "quadIn" }, { t: T.wipeIn[1], v: 1 }],
  clear: [{ t: T.clear[0], v: 0, ease: "quadIn" }, { t: T.clear[1], v: 1 }],
};
add({
  id: "dots", name: "Cells · dots", type: "generator", start: T.wipeIn[0], end: T.clear[1] + 1 / FPS,
  props: { generator: "pixelStages", output: "dots", ...cellBox },
  keyframes: cellKeys,
});
add({
  id: "backdrop", name: "Backdrop (Figma 95 BG)", type: "generator", matte: "cells",
  start: T.wipeIn[0], end: T.clear[1] + 1 / FPS,
  props: {
    generator: "tmBackdrop", x: 960, y: 540, width: 1920, height: 1080,
    baseColor: "#d9f9b9", darkColor: INK, blobBlur: 280,
    // Figma "Gradient": dark + light ellipses (net rotation 180° → axis-aligned).
    b1x: 1028, b1y: -410, b1rx: 1711, b1ry: 852, b1a: 1,
    b2x: 980, b2y: 1707, b2rx: 1364, b2ry: 742, b2a: 1, b2Color: "#F5FFEB",
    noise: 0.15, ringX: 960, ringY: 540, tilt: 0.35,
  },
  keyframes: {
    ringShift: [{ t: T.wipeIn[0], v: -0.03, ease: "linear" }, { t: T.clear[1], v: 0.06 }],
  },
});
add({
  id: "cells", name: "Cells · mask (matte)", type: "generator", start: T.wipeIn[0], end: T.clear[1] + 1 / FPS,
  props: { generator: "pixelStages", output: "mask", ...cellBox },
  keyframes: cellKeys,
});

// ---- 98 · Analysing (pops in) ----
add({ id: "p98", name: "98 · pan (words)", type: "null", start: T.clear[0], props: { x: 0, y: 0 }, keyframes: { x: pan98(1) } });
add({ id: "p98-near", name: "98 · pan (tiles)", type: "null", start: T.clear[0], props: { x: 0, y: 0 }, keyframes: { x: pan98(1.12) } });

// Each element: a pop null at its center (scale + fade), children relative to it.
const items98 = [
  {
    id: "scale", parent: "p98-near", box: [1526, -77, 319, 319],
    kids: (g) => [img("scale-img", "Scale", "scale.png", 1685.5, 82.5, 287.1, g), tile("scale-tile", "Scale", 1526, -77, 319, 319, g)],
  },
  {
    id: "mug", parent: "p98-near", box: [1686, 852, 159, 159],
    kids: (g) => [img("mug-img", "Coffee mug", "mug.png", 1765.5, 931.5, 142.26, g), tile("mug-tile", "Coffee mug", 1686, 852, 159, 159, g)],
  },
  { id: "w-analysierst", parent: "p98", box: [1328, 404, 492, 116], kids: (g) => [word("analysierst", "analysierst,", 1328, 404, g)] },
  {
    id: "magnifier", parent: "p98", box: [1241, 263, 90, 90],
    kids: (g) => [img("magnifier-img", "Icon · magnifier", "magnifier.svg", 1286, 308, 90, g)],
  },
  { id: "w-kerze", parent: "p98", box: [1060, 558, 247, 116], kids: (g) => [word("kerze", "Kerze", 1060, 558, g)] },
  {
    id: "pencil", parent: "p98-near", box: [726, 693, 159, 159],
    kids: (g) => [img("pencil-img", "Pencil", "pencil.png", 805.5, 760.27, 232.39, g), tile("pencil-tile", "Pencil", 726, 693, 159, 159, g)],
  },
  { id: "w-einzelne", parent: "p98", box: [520, 250, 366, 116], kids: (g) => [word("einzelne", "einzelne", 520, 250, g)] },
  {
    id: "barrel", parent: "p98-near", box: [246.52, 847, 319, 331.76],
    kids: (g) => [img("barrel-img", "Barrel", "barrel.png", 406.02, 968.22, 370.04, g), tile("barrel-tile", "Barrel", 246.52, 847, 319, 331.76, g)],
  },
  {
    id: "card", parent: "p98-near", box: [120, 90, 308, 180],
    kids: (g) => [
      {
        id: "card-value", name: "Win rate · 57 %", type: "text", parent: g,
        props: { x: 261, y: 159.5, anchorX: 0, anchorY: 0, text: "57 %", fontFamily: "Geist", fontWeight: 600, fontSize: 64, letterSpacing: -1.28, lineHeight: 1.297, align: "left", fill: INK },
      },
      img("card-donut", "Win rate · donut", "donut.svg", 193, 201, 88, g),
      {
        id: "card-label", name: "Win rate · label", type: "text", parent: g,
        props: { x: 149, y: 115, anchorX: 0, anchorY: 0, text: "Winrate", fontFamily: "Geist", fontWeight: 500, fontSize: 20, lineHeight: 1.2, align: "left", fill: "#737873" },
      },
      {
        id: "card-bg", name: "Win rate · card", type: "rect", parent: g,
        props: { x: 274, y: 180, width: 308, height: 180, radius: 8, fill: "#ffffff", stroke: "rgba(0,0,0,0.08)", strokeWidth: 1 },
      },
    ],
  },
  { id: "w-jede", parent: "p98", box: [100, 404, 188, 116], kids: (g) => [word("jede", "jede", 100, 404, g)] },
];
items98.forEach((it, n) => {
  const [bx, by, bw, bh] = it.box, cx = bx + bw / 2, cy = by + bh / 2;
  const t0 = snap(T.popStart + n * T.popStep);
  const g = `pop-${it.id}`;
  add({
    id: g, name: `Pop · ${it.id}`, type: "null", parent: it.parent, start: t0, props: { x: r2(cx), y: r2(cy) },
    keyframes: {
      opacity: [{ t: t0, v: 0, ease: "linear" }, { t: snap(t0 + 3 / FPS), v: 1 }],
      scale: [{ t: t0, v: 0.8, ease: "figmaQuick" }, { t: snap(t0 + 0.5), v: 1 }],
    },
  });
  for (const k of it.kids(g)) add(rel(k, cx, cy));
});

// ---- 97 · Trading (starts built, pans away under the cells) ----
const end97 = snap(T.wipeIn[1] + 2 / FPS);
add({ id: "p97", name: "97 · pan (words)", type: "null", end: end97, props: { x: 0, y: 0 }, keyframes: { x: pan97(1) } });
add({ id: "p97-near", name: "97 · pan (tiles)", type: "null", end: end97, props: { x: 0, y: 0 }, keyframes: { x: pan97(1.1) } });

const button = (id, label, fill, cx, cy, w, rot) => {
  add({ id, name: `Button · ${label}`, type: "null", parent: "p97", props: { x: cx, y: cy, rotation: rot } });
  add({
    id: `${id}-label`, name: `Button · ${label} · label`, type: "text", parent: id,
    props: { x: 0, y: 0, text: label, fontFamily: "Geist", fontWeight: 500, fontSize: 34.487, letterSpacing: -0.6897, lineHeight: 1.08, align: "center", fill: INK },
  });
  add({ id: `${id}-bg`, name: `Button · ${label} · bg`, type: "rect", parent: id, props: { x: 0, y: 0, width: w, height: 83.23, radius: 17.244, fill } });
};
add(img("hand", "Hand cursor", "hand-cursor.png", 355.5, 221.5, 119, "p97"));
button("btn-long", "Long", "#00d16f", 322.98, 152.82, 169.9, -11.53);
button("btn-short", "Short", "#ff6479", 514.98, 179.49, 178, 3.89);
for (const [id, text, l, t] of [
  ["ob", "Ob", 100, 558], ["du", "du", 268, 404], ["den", "den", 493, 465], ["naechsten", "nächsten", 658, 270],
  ["grossen", "großen", 989, 404], ["coin-word", "Coin", 1352, 524], ["tradest", "tradest,", 1469, 712],
]) add(word(id, text, l, t, "p97"));
add(img("candle", "Icon · candle", "candle.svg", 1125, 775, 45, "p97"));
add(img("monitor-img", "Monitor", "monitor.png", 1522.46, 88.65, 368.9, "p97-near"));
add(tile("monitor-tile", "Monitor", 1366, -77, 319, 319, "p97-near"));
add(img("coin-img", "Coin", "coin.png", 1764.6, 434.3, 184.69, "p97-near", { rotation: -20.3 }));
add(tile("coin-tile", "Coin", 1686, 382.01, 159, 141.93, "p97-near"));
add(img("keyboard-img", "Keyboard", "keyboard.png", 729.18, 1002.19, 291.54, "p97-near"));
add(tile("keyboard-tile", "Keyboard", 566, 847, 319, 310.06, "p97-near"));

// ---- bottom: the page grid (static; the cells snap to it) ----
add(img("grid", "Grid", "grid.svg", 966, 540, 1920));

// In/out points don't inherit: copy the sentence roots' range down their trees.
const byId = Object.fromEntries(layers.map((l) => [l.id, l]));
const root = (l) => (l.parent ? root(byId[l.parent]) : l);
for (const l of layers) {
  const r = root(l).id;
  if (r === "p97" || r === "p97-near") l.end ??= end97;
  if (r === "p98" || r === "p98-near") l.start ??= byId[l.parent]?.start ?? T.clear[0];
}

const scene = {
  name: "TRD-02 · Trading → Analysing (pixel transition)",
  note: "First pass from Figma Section 5 (97 → 95 → 98) with the reference's timing: 97 drifts then speeds off left as grid cells step on (dots → tinted → Trademania backdrop), short beat, cells clear right→left while 98 pops in staggered and settles.",
  width: 1920, height: 1080, fps: FPS, duration: T.end, background: "#f4f9ee",
  layers,
};
fs.writeFileSync(`shots/${ID}/v001.json`, JSON.stringify(scene, (k, v) => (["t", "start", "end"].includes(k) ? Math.round(v * 1e4) / 1e4 : v), 2) + "\n");
console.log(`wrote shots/${ID}/v001.json (${layers.length} layers)`);
