// BRN-07 → BRN-08 (Trademania V3, Figma "Section 7", node 15902:43415):
// a grabbing hand drags the Indicator card in with the Chart card trailing →
// prompt types on → hand clicks Send → the dark mass of the backdrop lifts off
// the bottom → answer: "64 % bei 1,8R" punches up in beats (impact frames,
// lime tint + echo, glyph shockwaves, a small camera kick on the landing) and the
// candle chart builds left→right from the screen edge into the liquidity sweep.
//
// v002: drag-and-drop cards, impact frames, 9 extra history candles on the left.
// v003: one drag with both cards trailing the hand, lime-only impact beats, history
// candles fading out to the left.
// v004: denser chart — gap fillers between the Figma candles, history from the left
// edge and new candles past the tag, all thinner, fading out at both edges.
// The grab hand (assets/hand-grab.png) was generated with Figma AI and keyed with
// scripts/lib/key-magenta.mjs.
//
// Geometry comes from the Figma frames (1920×1080). Both frames share the same
// backdrop (tmBackdrop) — only the dark ellipse moves (y 811 → 181). Candle paths
// are extracted from the Figma SVGs into scripts/data/brn-07-candles.json.
//
//   node scripts/brn-07-prompt-answer.mjs

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const FPS = 60;
const f = (n) => +(n / FPS).toFixed(4); // frame → seconds
const k = (frame, v, ease) => (ease ? { t: f(frame), v, ease } : { t: f(frame), v });
const r2 = (v) => +v.toFixed(2);

const CANDLES = JSON.parse(readFileSync(new URL("data/brn-07-candles.json", import.meta.url), "utf8"));

// ---------- BRN-07 measurements ----------
const PROMPT = "Was ist mein Edge in dieser Situation?";
// Prefix widths in Geist 500 54px / -0.54 tracking (measured in Chrome).
const PREFIX = [
  0, 51.74, 79.06, 107.1, 119.67, 132.98, 160.88, 180.9, 193.47, 240.7, 270.58, 283.35, 315.05, 327.62, 359.98,
  391.27, 422.98, 453, 465.57, 478.87, 510.57, 523.14, 555.43, 567.77, 597.78, 625.68, 655.69, 675.9, 688.47, 723.23,
  737.1, 756.71, 787.57, 817.56, 836.55, 849.08, 879.75, 910.58, 939.73,
];
const ROW = { x: 427.5, y: 540 }; // left edge / vertical center of the prompt row
const CARET_GAP = 24, SEND_OFF = CARET_GAP + 4 + 24 + 36; // text end → caret, → send center
const CHIP_Y = 376 + 89 / 2;
// Fingertip on Send (Figma hand at 1435,541 ×160; tip at 0.32/0.16 of the image).
const TIP = { dx: 1435 + 160 * 0.32 - 1457.5, dy: 541 + 160 * 0.16 - 540 };

// ---------- BRN-08 measurements ----------
const AX = 424; // answer column left
const BIG_Y = 308.67, BIG_64 = 214.37, BIG_MID = 715.05; // widths of "64" / "64 % bei " in Geist 600 176px
const CHART = { x: 424, y: 600 };
const CANDLE_BOX = [
  [13, 13.09, 39.29], [58, 14.34, 36.06], [104, 18.72, 45.05], [150, 45.68, 38.94], [195, 53.01, 32.55],
  [241, 51.2, 45.72], [286, 77.98, 34.71], [332, 80.84, 35.37], [378, 79.41, 46.19], [423, 94.07, 27.81],
  [469, 90.71, 44.61], [514, 105.07, 32.95], [560, 100, 41.55], [606, 83.33, 104.76], [651, 66.67, 34.52],
  [697, 61.53, 25.78], [742, 42.43, 48.38], [788, 30.85, 30.61], [834, 25.87, 26.92], [879, 9.05, 46.76],
];
// Denser chart: one even grid at half the Figma spacing. The 20 Figma candles keep
// their shapes and slots; generated candles fill the gaps between them, run in from
// the left screen edge (history) and continue past the tag to the right edge.
// Everything is drawn at CANDLE_SX width so the busier row stays readable.
const STEP = 45.56 / 2;
const CANDLE_SX = 0.55;
/** Candle silhouette like Figma's: 20px body, 4px wick, 2px rounding. */
const candleD = (h, bt, bb) => {
  const T = r2(h * bt), B = r2(h * bb), H = r2(h);
  return `M10 0C11.1046 0 12 0.8954 12 2V${T}H18C19.1046 ${T} 20 ${r2(T + 0.8954)} 20 ${r2(T + 2)}V${r2(B - 2)}C20 ${r2(B - 0.8954)} 19.1046 ${B} 18 ${B}H12V${r2(H - 2)}C12 ${r2(H - 0.8954)} 11.1046 ${H} 10 ${H}C8.8954 ${H} 8 ${r2(H - 0.8954)} 8 ${r2(H - 2)}V${B}H2C0.8954 ${B} 0 ${r2(B - 0.8954)} 0 ${r2(B - 2)}V${r2(T + 2)}C0 ${r2(T + 0.8954)} 0.8954 ${T} 2 ${T}H8V2C8 0.8954 8.8954 0 10 0Z`;
};
// Seeded random so every run writes the same chart.
let seed = 7;
const rand = (lo, hi) => {
  seed = (seed + 0x6d2b79f5) | 0;
  let x = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
  return lo + (((x ^ (x >>> 14)) >>> 0) / 4294967296) * (hi - lo);
};
const clampN = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const gen = (bx, cy) => {
  const h = rand(18, 44), bt = rand(0.16, 0.3), bb = rand(0.68, 0.8);
  return { box: [r2(bx), r2(cy - h / 2), r2(h)], d: candleD(h, bt, bb), fill: "#F4F9EE", glowBlur: 14, generated: true };
};
const centerOf = ([, by, bh]) => by + bh / 2;
const figma = CANDLES.map((c, i) => ({ ...c, box: CANDLE_BOX[i], figmaIndex: i }));
// Left history: walk backwards from the first Figma candle (price lower further back).
const left = [];
for (let bx = 13 - STEP, cy = centerOf(CANDLE_BOX[0]); CHART.x + bx + 10 > 8; bx -= STEP) {
  cy = clampN(cy + rand(-6, 13), 20, 140);
  left.unshift(gen(bx, cy));
}
// Gap fillers between neighbouring Figma candles.
const fill = CANDLE_BOX.slice(0, -1).map((b, i) => {
  const n = CANDLE_BOX[i + 1];
  return gen((b[0] + n[0]) / 2, (centerOf(b) + centerOf(n)) / 2 + rand(-9, 9));
});
// Right: keeps chopping upward past the last Figma candle to the screen edge.
const right = [];
for (let bx = CANDLE_BOX.at(-1)[0] + STEP, cy = centerOf(CANDLE_BOX.at(-1)); CHART.x + bx + 10 < 1912; bx += STEP) {
  cy = clampN(cy + rand(-8, 6.5), 0, 70);
  right.push(gen(bx, cy));
}
const ALL_CANDLES = [...left, ...figma.flatMap((c, i) => (fill[i] ? [c, fill[i]] : [c])), ...right];
// Generated candles: rising ones bright, falling ones dim (like the Figma ones).
ALL_CANDLES.forEach((c, i) => {
  if (!c.generated) return;
  const up = i > 0 && centerOf(c.box) < centerOf(ALL_CANDLES[i - 1].box);
  Object.assign(c, { opacity: up ? 1 : 0.45, glowOpacity: up ? 0.8 : 0.35 });
});
const SWEEP_I = ALL_CANDLES.findIndex((c) => c.figmaIndex === 13);

// ---------- timeline (frames @60) ----------
// One drag: the grab hand pulls the Indicator card in from off-screen right and the
// Chart card trails it a few frames behind, like a stack sliding apart.
const DRAG = { t0: 4, drop: 50 };
const STAGGER = 7; // frames the Chart card lags behind the Indicator card
const EXIT_LEN = 24; // hand lifts off and leaves after the drop
// Typing starts while the cards are still settling.
const CARET_IN = DRAG.drop - 18;
const TYPE_START = DRAG.drop - 2;
// Uneven keystrokes: 2–3 frames, a beat before some words, like a person typing.
const PAUSE_BEFORE = new Set([4, 8, 13, 21, 28]); // char indices that start "ist", "mein", "Edge", "dieser", "Situation"
const typed = [];
for (let i = 0, fr = TYPE_START; i < PROMPT.length; i++) {
  fr += (i === 0 ? 0 : 2 + (Math.sin(i * 12.9898) * 43758.5453 % 1 > 0 ? 1 : 0)) + (PAUSE_BEFORE.has(i) ? 5 : 0);
  typed.push(fr);
}
const TYPE_END = typed.at(-1);
const HAND_IN = TYPE_END - 20, HAND_LAND = TYPE_END + 16;
const PRESS = HAND_LAND + 8;
const PROMPT_OUT = PRESS + 14;
const ANSWER = PRESS + 30;
// Impact beats: the stat steps in hard hits and slams onto 64 % / 1,8R.
const BEATS = [ANSWER + 10, ANSWER + 18, ANSWER + 26, ANSWER + 34, ANSWER + 44];
const BEAT_PCT = [10, 24, 41, 58, 64], BEAT_R = [0.4, 0.9, 1.3, 1.6, 1.8];
const LAND = BEATS.at(-1);
const CHART_IN = LAND + 8;
const BUILD = 72; // frames for the whole chart to build left → right
const candleIn = (i) => CHART_IN + 6 + Math.round((i * BUILD) / ALL_CANDLES.length);
const SWEEP = candleIn(SWEEP_I);
const TAG_IN = candleIn(ALL_CANDLES.length - 1) + 6;
const DURATION = TAG_IN + 120;
const promptEnd = f(PROMPT_OUT + 30);

// ---------- helpers ----------
const text = (id, name, parent, props, extra = {}) => ({
  id, name, type: "text", parent,
  ...extra,
  props: { fontFamily: "Geist", align: "left", anchorX: 0, anchorY: 0, ...props },
});
/** Fade + rise in (figmaSlow), with a little defocus. */
const riseIn = (fr, dy = 28, y0 = 0, len = 36) => ({
  y: [k(fr, y0 + dy, "figmaSlow"), k(fr + len, y0)],
  opacity: [k(fr, 0, "easeOut"), k(fr + 20, 1)],
  blur: [k(fr, 8, "easeOut"), k(fr + 24, 0)],
});

const dashes = (len, on, off, axis) => {
  const seg = [];
  for (let a = 0; a < len; a += on + off) seg.push(axis === "x" ? `M${r2(a)} 0.5H${r2(Math.min(len, a + on))}` : `M0.5 ${r2(a)}V${r2(Math.min(len, a + on))}`);
  return seg.join("");
};

// ---------- layers (first = on top) ----------
const hand = {
  id: "hand", name: "Hand cursor", type: "image", label: "#e6d3a3",
  start: f(HAND_IN), end: f(PROMPT_OUT + 40),
  props: { src: "hand-cursor.png", width: 160, anchorX: 0.32, anchorY: 0.16, shadowColor: "rgba(0,0,0,0.35)", shadowBlur: 24, shadowY: 12 },
};
const sendAt = (n) => ROW.x + PREFIX[n] + SEND_OFF;
const tip = { x: sendAt(PROMPT.length) + TIP.dx, y: ROW.y + TIP.dy };
hand.keyframes = {
  x: [k(HAND_IN, tip.x + 220, "figmaSlow"), k(HAND_LAND, tip.x), k(PRESS + 10, tip.x, "figmaSlowIn"), k(PROMPT_OUT + 34, tip.x + 160)],
  y: [k(HAND_IN, tip.y + 300, "figmaSlow"), k(HAND_LAND, tip.y), k(PRESS + 10, tip.y, "figmaSlowIn"), k(PROMPT_OUT + 34, tip.y + 260)],
  rotation: [k(HAND_IN, 12, "figmaSlow"), k(HAND_LAND + 6, 0)],
  opacity: [k(HAND_IN, 0, "easeOut"), k(HAND_IN + 10, 1), k(PROMPT_OUT + 18, 1, "easeIn"), k(PROMPT_OUT + 34, 0)],
  scale: [k(PRESS - 4, 1, "quadIn"), k(PRESS, 0.86, "figmaBouncy"), k(PRESS + 24, 0.92)],
  shadowY: [k(PRESS - 4, 12, "quadIn"), k(PRESS, 4, "easeOut"), k(PRESS + 20, 8)],
};

const prompt = [
  {
    id: "prompt", name: "Prompt row (group)", type: "null", label: "#D9F9B9", end: promptEnd,
    props: { x: ROW.x, y: ROW.y },
    keyframes: {
      y: [k(PROMPT_OUT, ROW.y, "figmaSlowIn"), k(PROMPT_OUT + 30, ROW.y - 60)],
      opacity: [k(PROMPT_OUT, 1, "easeIn"), k(PROMPT_OUT + 26, 0)],
      blur: [k(PROMPT_OUT, 0, "easeIn"), k(PROMPT_OUT + 26, 12)],
    },
  },
  {
    id: "send", name: "Send", type: "image", parent: "prompt", end: promptEnd,
    props: { src: "send.svg", width: 72, height: 72, y: 0 },
    keyframes: {
      // Rides along with the caret while typing.
      x: [k(TYPE_START - 1, PREFIX[0] + SEND_OFF, "hold"), ...typed.map((fr, i) => k(fr, r2(PREFIX[i + 1] + SEND_OFF), "easeOut"))],
      opacity: [k(TYPE_START, 0, "easeOut"), k(TYPE_START + 10, 1)],
      scale: [
        k(TYPE_START, 0.5, "figmaBouncy"), k(TYPE_START + 30, 1),
        k(PRESS - 3, 1, "quadIn"), k(PRESS, 0.88, "figmaBouncy"), k(PRESS + 30, 1),
      ],
      shadowColor: [k(PRESS - 1, "rgba(210,255,164,0)", "easeOut"), k(PRESS + 2, "rgba(210,255,164,0.9)", "easeOut"), k(PRESS + 30, "rgba(210,255,164,0)")],
      shadowBlur: [k(PRESS, 36)],
    },
  },
  {
    id: "caret", name: "Caret", type: "rect", parent: "prompt", end: promptEnd,
    props: { anchorX: 0, y: 0, width: 4, height: 56, fill: "#d2ffa4" },
    keyframes: {
      x: [k(TYPE_START - 1, CARET_GAP, "hold"), ...typed.map((fr, i) => k(fr, r2(PREFIX[i + 1] + CARET_GAP), "hold"))],
      // Blink while idle, solid while typing, gone on send.
      opacity: [
        k(0, 0, "hold"), k(CARET_IN, 1, "hold"), k(CARET_IN + 16, 0, "hold"), k(CARET_IN + 28, 1, "hold"),
        k(TYPE_END + 16, 0, "hold"), k(TYPE_END + 30, 1, "hold"), k(PRESS, 0, "hold"),
      ],
    },
  },
  text("prompt-text", "Prompt text", "prompt", {
    text: PROMPT, fontWeight: 500, fontSize: 54, letterSpacing: -0.54, lineHeight: 70 / 54, fill: "#ffffff", x: 0, y: -35,
  }, {
    end: promptEnd,
    keyframes: { reveal: [k(TYPE_START - 1, 0, "hold"), ...typed.map((fr, i) => k(fr, +((i + 1) / PROMPT.length).toFixed(4), "hold"))] },
  }),
];

// ---------- drag & drop ----------
// The grab hand pinches each card near its right end; card and hand share the
// same path (hand = card + grip offset). Cards are lifted while carried (bigger,
// tilted, soft shadow) and settle with a little bounce on the drop.
const GRAB = { anchorX: 0.235, anchorY: 0.47, width: 170 }; // pinch point in hand-grab.png
const slotX = (x, w) => x + w / 2;
const SLOT0 = slotX(424, 206), SLOTS = [SLOT0, slotX(650, 223)];
const carry = (n) => {
  const t0 = DRAG.t0 + n * STAGGER, drop = DRAG.drop + n * STAGGER, tx = SLOTS[n];
  // Same path for both cards, offset by their slot spacing (off-screen right, a bit low).
  const sx = 1920 + 103 + 60 + (tx - SLOT0), sy = CHIP_Y + 150;
  return {
    card: {
      x: [k(t0, sx, "figmaSlow"), k(drop, tx)],
      // Arc: rise above the slot, then set down onto it.
      y: [k(t0, sy, "sineOut"), k(drop - 10, CHIP_Y - 22, "quadIn"), k(drop, CHIP_Y)],
      // The trailing card swings a little more.
      rotation: [k(t0, 9 + n * 4, "figmaSlow"), k(drop - 8, 2 + n, "quadIn"), k(drop, 0, "figmaBouncy"), k(drop + 30, 0)],
      scale: [k(t0, 1.07, "hold"), k(drop - 8, 1.07, "quadIn"), k(drop, 0.97, "figmaBouncy"), k(drop + 30, 1)],
    },
    t0, drop, tx,
  };
};
const trips = [carry(0), carry(1)];

// The hand pinches the leading card near its right end (hand = card + grip offset).
const GRIP = { x: 206 / 2 - 28, y: 6 };
const lead = trips[0], off = (arr, d) => arr.map((kf) => ({ ...kf, v: r2(kf.v + d) }));
const { drop } = DRAG, gx = lead.tx + GRIP.x, gy = CHIP_Y + GRIP.y;
const grabHand = {
  id: "hand-grab", name: "Hand · grab (drag cards)", type: "image", label: "#e6d3a3",
  start: f(DRAG.t0), end: f(drop + STAGGER + EXIT_LEN + 1),
  props: { src: "hand-grab.png", ...GRAB, shadowColor: "rgba(0,0,0,0.4)", shadowBlur: 30, shadowY: 18 },
  keyframes: {
    x: [...off(lead.card.x, GRIP.x).slice(0, -1), k(drop, gx, "easeOut"), k(drop + 6, gx + 6, "figmaSlowIn"), k(drop + STAGGER + EXIT_LEN, 2140)],
    y: [...off(lead.card.y, GRIP.y).slice(0, -1), k(drop, gy, "easeOut"), k(drop + 6, gy - 26, "figmaSlowIn"), k(drop + STAGGER + EXIT_LEN, gy - 240)],
    rotation: [k(DRAG.t0, 8, "figmaSlow"), k(drop, 0, "easeOut"), k(drop + STAGGER + EXIT_LEN, -10)],
    // Press down on the drop, open up as it lets go.
    scale: [k(drop - 6, 1, "quadIn"), k(drop, 0.93, "easeOut"), k(drop + 8, 1.04)],
    shadowY: [k(drop - 6, 18, "quadIn"), k(drop, 6, "easeOut"), k(drop + 10, 18)],
  },
};

const chip = (n, id, x, w, icon, label, value) => {
  const out = PROMPT_OUT - 4 + n * 2, c = trips[n];
  return [
    {
      id, name: `Chip · ${value} (group)`, type: "null", label: "#9fdcc6", start: f(c.t0), end: promptEnd,
      props: { x: x + w / 2, y: CHIP_Y },
      keyframes: {
        x: c.card.x,
        y: [...c.card.y, k(out, CHIP_Y, "figmaSlowIn"), k(out + 30, CHIP_Y - 60)],
        rotation: c.card.rotation,
        scale: c.card.scale,
        opacity: [k(out, 1, "easeIn"), k(out + 26, 0)],
        blur: [k(out, 0, "easeIn"), k(out + 26, 12)],
      },
    },
    text(`${id}-value`, `${value}`, id, { text: value, fontWeight: 500, fontSize: 30, letterSpacing: -0.3, lineHeight: 1.3, fill: "#ffffff", x: -w / 2 + 81, y: -89 / 2 + 35 }, { end: promptEnd }),
    text(`${id}-label`, `${label}`, id, { text: label, fontWeight: 500, fontSize: 14, letterSpacing: 1.12, lineHeight: 18 / 14, fill: "rgba(255,255,255,0.45)", x: -w / 2 + 81, y: -89 / 2 + 15 }, { end: promptEnd }),
    { id: `${id}-icon`, name: "Icon", type: "image", parent: id, end: promptEnd, props: { src: icon, width: 48, height: 48, x: -w / 2 + 41, y: 0 } },
    {
      id: `${id}-bg`, name: "Chip surface", type: "rect", parent: id, end: promptEnd,
      props: { width: w, height: 89, radius: 8, fill: "rgba(255,255,255,0.06)", stroke: "rgba(255,255,255,0.12)", strokeWidth: 1, backdropBlur: 14.75 },
    },
    {
      id: `${id}-lift`, name: "Lift shadow", type: "rect", parent: id, end: f(c.drop + 12),
      props: { width: w - 24, height: 64, radius: 32, fill: "rgba(0,0,0,0.6)", blur: 22 },
      keyframes: {
        y: [k(c.drop - 8, 30, "quadIn"), k(c.drop, 8)],
        opacity: [k(c.drop - 8, 1, "quadIn"), k(c.drop + 10, 0)],
      },
    },
  ];
};

// ---------- BRN-08 · answer ----------
const tag = [
  {
    id: "tag", name: "Price tag 85.870 (group)", type: "null", label: "#D9F9B9", start: f(TAG_IN),
    props: { x: 1440, y: 717 },
    keyframes: {
      x: [k(TAG_IN, 1480, "figmaSlow"), k(TAG_IN + 40, 1440)],
      opacity: [k(TAG_IN, 0, "easeOut"), k(TAG_IN + 16, 1)],
    },
  },
  text("tag-text", "85.870", "tag", { text: "85.870", fontWeight: 600, fontSize: 24, letterSpacing: -0.12, lineHeight: 1.3, fill: "#070909", x: -40.5, y: -15.5 }),
  { id: "tag-bg", name: "Tag surface", type: "path", parent: "tag", props: { d: "M0 0H104L112 8V40H0V0Z", fill: "#F4F9EE", stroke: "rgba(0,0,0,0)", strokeWidth: 0 } },
];

const sweepNotes = [
  text("sweep-sub", "Gesweept und zurückerobert", undefined, {
    text: "Gesweept und zurückerobert", fontWeight: 400, fontSize: 24, letterSpacing: -0.12, lineHeight: 1.3, fill: "rgba(244,249,238,0.6)", y: 785,
  }, {
    start: f(SWEEP + 26),
    keyframes: { x: [k(SWEEP + 26, 1052, "figmaSlow"), k(SWEEP + 62, 1064)], opacity: [k(SWEEP + 26, 0, "easeOut"), k(SWEEP + 44, 1)] },
  }),
  text("sweep-label", "LIQUIDITY SWEEP", undefined, {
    text: "LIQUIDITY SWEEP", fontWeight: 500, fontSize: 16, letterSpacing: 1.92, lineHeight: 1.3, fill: "#d2ffa4", y: 760,
  }, {
    start: f(SWEEP + 22),
    keyframes: { x: [k(SWEEP + 22, 1052, "figmaSlow"), k(SWEEP + 58, 1064)], opacity: [k(SWEEP + 22, 0, "easeOut"), k(SWEEP + 40, 1)] },
  }),
  {
    id: "sweep-marker", name: "Sweep marker", type: "rect", start: f(SWEEP + 18),
    props: { x: 1040, y: 800.1, width: 8, height: 8, fill: "#d2ffa4", shadowColor: "rgba(210,255,164,0.8)", shadowBlur: 12 },
    keyframes: { scale: [k(SWEEP + 18, 0, "figmaBouncy"), k(SWEEP + 48, 1)] },
  },
  {
    id: "crosshair", name: "Crosshair", type: "path", start: f(SWEEP + 4),
    props: {
      d: dashes(248, 3.968, 5.952, "y"), pathOrigin: "zero", x: 1039.5, y: 576,
      fill: "rgba(0,0,0,0)", stroke: "rgba(244,249,238,0.3)", strokeWidth: 1,
    },
    keyframes: { trimEnd: [k(SWEEP + 4, 0, "figmaSlow"), k(SWEEP + 40, 1)] },
  },
];

// The extra candles fade out toward both screen edges (0 at the edge → full by the
// Figma candles on the left, and from just past the tag on the right).
const FADE = { from: 0, to: 560, rightFrom: 1380, rightTo: 1920 };
const smooth = (a, b, v) => {
  const u = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return u * u * (3 - 2 * u);
};
const fadeAt = (sx) => Math.min(smooth(FADE.from, FADE.to, sx), 1 - smooth(FADE.rightFrom, FADE.rightTo, sx));
const candles = ALL_CANDLES.flatMap((c, i) => {
  const [bx, by, bh] = c.box;
  const x = r2(bx + 10), y = r2(by + bh / 2), fr = candleIn(i), sweep = i === SWEEP_I;
  const fade = fadeAt(CHART.x + x);
  const pop = sweep
    // The sweep candle drops its wick through support, then flares.
    ? { scaleY: [k(fr, 0.15, "figmaSlow"), k(fr + 30, 1)], y: [k(fr, y - bh * 0.42, "figmaSlow"), k(fr + 30, y)] }
    : { scaleY: [k(fr, 0.3, "figmaSlow"), k(fr + 24, 1)], y: [k(fr, y + 10, "figmaSlow"), k(fr + 24, y)] };
  return [
    {
      id: `candle-${i}`, name: sweep ? "Candle · sweep" : `Candle ${i + 1}`, type: "path", parent: "chart", start: f(fr),
      props: { d: c.d, fill: c.fill, stroke: "rgba(0,0,0,0)", strokeWidth: 0, x, scaleX: CANDLE_SX },
      keyframes: { ...pop, opacity: [k(fr, 0, "easeOut"), k(fr + 8, r2(c.opacity * fade))] },
    },
    {
      id: `candle-${i}-glow`, name: sweep ? "Candle glow · sweep" : `Candle glow ${i + 1}`, type: "path", parent: "chart", start: f(fr),
      props: { d: c.d, fill: c.fill, stroke: "rgba(0,0,0,0)", strokeWidth: 0, x, scaleX: CANDLE_SX, blur: c.glowBlur },
      keyframes: {
        ...pop,
        opacity: sweep
          ? [k(fr + 6, 0, "easeOut"), k(fr + 24, 1, "sineInOut"), k(fr + 34, 1, "sineInOut"), k(fr + 70, 0.75, "sineInOut"), k(fr + 110, 1)]
          : [k(fr + 4, 0, "easeOut"), k(fr + 14, r2(Math.min(1, c.glowOpacity * 1.4) * fade), "sineOut"), k(fr + 40, r2(c.glowOpacity * fade))],
      },
    },
  ];
});

const chart = [
  {
    id: "chart", name: "Chart (group)", type: "null", label: "#9fdcc6", start: f(CHART_IN),
    props: { x: CHART.x, y: CHART.y },
  },
  ...candles,
];

const support = [
  {
    id: "support-line", name: "Support 85,870", type: "path", start: f(CHART_IN),
    props: { d: dashes(1920, 8, 8, "x").replace(/^M0 0.5H8/, "M0 0.5H4"), pathOrigin: "zero", x: 0, y: 716, fill: "rgba(0,0,0,0)", stroke: "rgba(244,249,238,0.5)", strokeWidth: 1 },
    keyframes: { trimEnd: [k(CHART_IN, 0, "figmaSlow"), k(CHART_IN + 60, 1)] },
  },
  {
    id: "support-zone", name: "Support zone", type: "rect", start: f(CHART_IN),
    props: {
      x: 960, y: 715.5, width: 1920, height: 31, fill: "#ffffff",
      fillType: "linear", gradientAngle: 90, gradientStops: "rgba(244,249,238,0.02) 0, rgba(244,249,238,0.14) 0.5, rgba(244,249,238,0.02) 1",
    },
    keyframes: {
      scaleX: [k(CHART_IN, 0.2, "figmaSlow"), k(CHART_IN + 60, 1)],
      opacity: [k(CHART_IN, 0, "easeOut"), k(CHART_IN + 30, 1)],
    },
  },
  {
    id: "band-glow", name: "Band glow", type: "ellipse", start: f(CHART_IN),
    props: { x: 960, y: 715.5, width: 1700, height: 72, fill: "rgba(210,255,164,0.22)", blur: 24 },
    keyframes: {
      opacity: [k(CHART_IN, 0, "easeOut"), k(CHART_IN + 50, 1), k(SWEEP + 20, 1, "sineOut"), k(SWEEP + 30, 1.0), k(DURATION, 0.85)],
      scaleX: [k(CHART_IN, 0.4, "figmaSlow"), k(CHART_IN + 60, 1)],
    },
  },
];

// ---------- stat with impact frames ----------
// One "big" null (centered on the number, so punches scale in place) holds three
// copies of the three text pieces, all in the brand lime: a lime tint flash on top,
// the gradient original, and a soft lime echo (screen) that swells out and fades
// on each hit.
const CX = r2(AX + 1050.26 / 2), CY = r2(BIG_Y + 88);
const hitKeys = (peak, rest, len, landPeak, landLen, ease = "expoOut") =>
  BEATS.flatMap((b, i) => {
    const last = i === BEATS.length - 1;
    return [k(b, last ? landPeak : peak, ease), k(b + (last ? landLen : len), rest, "hold")];
  });
const bigPieces = (suffix, parent, style) => [
  ["64", "64 (counter)", "{counter}", AX + BIG_64, 1, { counter: BEAT_PCT[0], counterDecimals: 0 }, BEAT_PCT],
  ["mid", " % bei ", " % bei ", AX + BIG_64, 0, {}, null],
  ["r", "1,8R (counter)", "{counter}R", AX + BIG_MID, 0, { counter: BEAT_R[0], counterDecimals: 1, counterSeparator: "," }, BEAT_R],
].map(([id, name, t, x, ax, extra, steps]) => text(`big-${id}${suffix}`, name, parent, {
  text: t, fontWeight: 600, fontSize: 176, letterSpacing: -3.52, lineHeight: 1, x: r2(x - CX), y: r2(BIG_Y - CY),
  anchorX: ax, align: ax ? "right" : "left", ...style, ...extra,
}, {
  // The count steps on the beats (hold) instead of rolling.
  keyframes: steps ? { counter: BEATS.map((b, i) => k(b, steps[i], "hold")) } : undefined,
}));
const GRADIENT = { fill: "#f4f9ee", fillType: "linear", gradientAngle: 180, gradientStops: "#f4f9ee 0.1, #d2ffa4 1" };
const echo = [
  {
    id: "big-echo", name: "Echo (lime)", type: "null", parent: "big", props: { opacity: 0, blur: 6 },
    keyframes: {
      opacity: hitKeys(0.4, 0, 10, 0.6, 24, "easeOut"),
      scale: hitKeys(1, 1.06, 10, 1, 24, "figmaSlow"),
    },
  },
  ...bigPieces("-echo", "big-echo", { fill: "#d2ffa4", blend: "screen" }),
];
// Landing echo swells further.
echo[0].keyframes.scale.at(-1).v = 1.1;

const answer = [
  {
    id: "big", name: "Stat · 64 % bei 1,8R (group)", type: "null", label: "#D9F9B9", start: f(BEATS[0] - 2),
    props: { x: CX, y: CY },
    keyframes: {
      opacity: [k(BEATS[0] - 2, 0, "easeOut"), k(BEATS[0] + 2, 1)],
      y: [k(BEATS[0] - 2, CY + 30, "expoOut"), k(BEATS[0] + 10, CY)],
      // Punch on every beat; the landing overshoots and wobbles out.
      scale: [k(BEATS[0] - 2, 0.9, "expoOut"), ...BEATS.flatMap((b, i) => i === BEATS.length - 1
        ? [k(b, 1.06, "figmaBouncy"), k(b + 36, 1)]
        : [k(b, 1.025, "expoOut"), k(b + 7, 1, "hold")])],
      // A touch of smear on the hit frames.
      blur: [k(BEATS[0] - 2, 8, "expoOut"), ...hitKeys(1.5, 0, 4, 3, 8)],
    },
  },
  { id: "big-flash", name: "Flash (lime tint)", type: "null", parent: "big", props: { opacity: 0 }, keyframes: { opacity: hitKeys(0.3, 0, 8, 0.5, 18, "easeOut") } },
  ...bigPieces("-flash", "big-flash", { fill: "#d2ffa4" }),
  { id: "big-main", name: "Stat (gradient)", type: "null", parent: "big", props: {} },
  ...bigPieces("", "big-main", GRADIENT),
  ...echo,
  text("sub", "über 42 Trades", undefined, {
    text: "über 42 Trades", fontWeight: 400, fontSize: 32, letterSpacing: -0.16, lineHeight: 1.3, fill: "rgba(244,249,238,0.5)", x: AX,
  }, { start: f(ANSWER + 16), keyframes: riseIn(ANSWER + 16, 24, BIG_Y + 176 + 8) }),
  text("line1", "Deine Longs nach einem 1h-Liquidity-Sweep gewinnen", undefined, {
    text: "Deine Longs nach einem 1h-Liquidity-Sweep gewinnen", fontWeight: 400, fontSize: 40, letterSpacing: -0.2, lineHeight: 1.3, fill: "rgba(244,249,238,0.72)", x: AX,
  }, { start: f(ANSWER + 4), keyframes: riseIn(ANSWER + 4, 24, 248.67) }),
  {
    id: "speaker", name: "Speaker (group)", type: "null", label: "#9fdcc6", start: f(ANSWER),
    props: { x: AX },
    keyframes: riseIn(ANSWER, 24, 160),
  },
  text("speaker-name", "Trademania AI", "speaker", { text: "Trademania AI", fontWeight: 400, fontSize: 24, letterSpacing: -0.12, lineHeight: 1.3, fill: "rgba(244,249,238,0.6)", x: 44, y: 0.83 }),
  { id: "brain", name: "Brain symbol", type: "image", parent: "speaker", props: { src: "brain.svg", width: 32, height: 32.67, x: 16, y: 16.33 } },
  {
    id: "hero-glow", name: "Hero glow", type: "ellipse", start: f(ANSWER + 10),
    props: { x: 893, y: 405.47, width: 844.2, height: 123.2, fill: "rgba(210,255,164,0.2)", blur: 48 },
    keyframes: { // Builds up with the count and blooms on each beat.
      opacity: [k(ANSWER + 10, 0, "easeOut"), ...BEATS.flatMap((b, i) => {
        const lvl = 0.6 * (i + 1) / BEATS.length, last = i === BEATS.length - 1;
        return [k(b, last ? 1 : lvl + 0.25, "expoOut"), k(b + (last ? 40 : 7), last ? 0.6 : lvl, "hold")];
      })], scaleX: [k(ANSWER + 10, 0.6, "figmaSlow"), k(ANSWER + 70, 1)] },
  },
];

const backdrop = {
  id: "bg", name: "Backdrop", type: "generator", label: "#c5b9ee",
  props: {
    generator: "tmBackdrop", x: 960.18, y: 540, width: 1932.35, height: 1080,
    // Figma: rgba(210,255,164,0.89) over #020203, one dark #0F0F12 ellipse (blur 308).
    baseColor: "#bbe392", darkColor: "#0F0F12", blobBlur: 308.11,
    b1x: 1034.33, b1rx: 1710.57, b1ry: 851.99, b1a: 1, b2a: 0,
    ringX: 943.5, ringY: 541,
  },
  keyframes: {
    opacity: [k(0, 0, "easeOut"), k(30, 1)],
    glyphReveal: [k(0, 0, "easeOut"), k(72, 1)],
    // BRN-07 → BRN-08: the dark mass lifts from the bottom to the top.
    b1y: [k(0, 831, "sineOut"), k(PRESS, 811, "figmaSlow"), k(PRESS + 80, 181, "sineInOut"), k(DURATION, 171)],
    // Click: rings ripple outward and the glyphs re-roll. Then the rings recenter on
    // the stat and every beat kicks a shockwave out of it; the landing kicks hardest.
    ringX: [k(PRESS + 20, 943.5, "sineInOut"), k(BEATS[0] - 2, CX - 960.18 + 966.18)],
    ringY: [k(PRESS + 20, 541, "sineInOut"), k(BEATS[0] - 2, CY)],
    ringShift: [
      k(0, -0.02, "linear"), k(PRESS - 1, 0, "expoOut"), k(BEATS[0], 0.06, "expoOut"),
      ...BEATS.slice(1).map((b, i) => k(b, r2(0.06 + 0.02 * (i + 1)), "expoOut")),
      k(LAND + 40, 0.18, "sineOut"), k(DURATION, 0.22),
    ],
    scramble: [
      k(PRESS - 1, 0.04, "linear"), k(PRESS + 2, 0.45, "sineOut"), k(PRESS + 30, 0.05, "hold"),
      ...hitKeys(0.14, 0.05, 7, 0.28, 20, "sineOut"),
    ],
    glyphAlpha: [
      k(PRESS - 1, 1, "expoOut"), k(PRESS + 4, 1.5, "sineInOut"), k(PRESS + 30, 1, "hold"),
      ...hitKeys(1.15, 1, 8, 1.4, 28, "expoOut"),
    ],
  },
};

// Camera: everything but the backdrop sits on a null that shakes on the beats.
const shake = (b, amp, n) => Array.from({ length: n + 1 }, (_, j) => {
  const a = j === n ? 0 : amp * (1 - j / n) * (j % 2 ? -1 : 1);
  return [k(b + j * 2, r2(a), "linear"), r2(a * -0.7)];
});
const camKeys = { x: [], y: [] };
BEATS.forEach((b, i) => {
  const last = i === BEATS.length - 1;
  for (const [kx, vy] of shake(b, last ? 5 : 1.5, last ? 5 : 2)) { camKeys.x.push(kx); camKeys.y.push({ ...kx, v: vy }); }
});
const cam = { id: "cam", name: "Camera (shake)", type: "null", label: "#c5b9ee", props: { x: 0, y: 0 }, keyframes: camKeys };

const layers = [
  cam,
  grabHand,
  hand,
  ...prompt,
  ...chip(0, "chip-anchor", 424, 206, "icon-indicator.svg", "INDIKATOR", "Anchor"),
  ...chip(1, "chip-btc", 650, 223, "icon-chart.svg", "CHART", "BTCUSD"),
  ...tag,
  ...sweepNotes,
  ...chart,
  ...support,
  ...answer,
  backdrop,
];
for (const l of layers) if (!l.parent && l.id !== "cam" && l.id !== "bg") l.parent = "cam";

const shot = {
  name: "BRN-07→08 · Prompt → Answer",
  note: "Denser chart: ~2× candles (gap fillers between the Figma ones, more history from the left edge, new candles past the tag), thinner bodies, fading out at both edges; same ~1.2s build",
  width: 1920,
  height: 1080,
  fps: FPS,
  duration: f(DURATION),
  background: "#020203",
  layers,
};

const dir = new URL("../shots/brn-07-prompt-answer/", import.meta.url);
mkdirSync(dir, { recursive: true });
writeFileSync(new URL("v004.json", dir), JSON.stringify(shot, null, 2) + "\n");
console.log(`wrote v004.json — ${shot.duration}s, ${layers.length} layers (type ${TYPE_START}–${TYPE_END}, press ${PRESS}, sweep ${SWEEP})`);
