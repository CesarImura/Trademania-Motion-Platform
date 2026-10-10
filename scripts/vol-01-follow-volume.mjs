// VOL-01 → VOL-03 (Trademania V3, Figma "Motion test 5", node 15834:31041):
// "Folge dem { Volumen }" over a blurred order book → the headline blurs out as
// the book pulls into focus and the best-ask depth band wipes in → the volume
// drains: band shrinks, size + notional count down, the ladder whips up behind
// the focus row (price falling) and the red glow swings to the top-right.
//
// v002 motion follows the reference screen recording: the notional counts up as
// the band lands, then the ladder whips — slow start, a fast middle where rows
// smear into vertical streaks (generator motion blur from real scroll velocity),
// and a long soft landing ~14 rows later.
//
// v003: the depth band starts at 100% width and shrinks gradually from the
// moment it appears through the end of the whip (like the reference).
// v004: nothing settles after the whip — scroll cruises on, band keeps shrinking,
// size/notional/price keep draining at a steady rate through the last frame.
// v005: 9s. The volume runs all the way out (band 0, size 0.000) at 8.5s while
// the book keeps cruising; both background glows wander continuously and the
// dither rings ripple.
// v006: ONE motion. Everything after the book focuses — scroll, price, band,
// size, notional, both glows, the ring ripple — runs as a single figmaSlow move
// from MOVE to the last frame (same start, same end, same ease). No count-up,
// whip, cruise or wander loops: nothing restarts, so nothing feels choppy.
// v007: the move's easing is inverted (figmaSlowIn) — slow start, fastest at the end.
// v008: reference pacing. 4s shot. The one move follows the reference curve
// (quick build, early peak with motion-blur streaks, soft landing) over 1.8s.
// The headline builds word by word: "Folge" and "dem" rise in, the braces pop
// open from the middle and "Volumen" tracks in between them.
// v009: the green glow mirrors the red — crosses bottom-right → bottom-left while
// the red swings top-left → top-right.
//
// The ladder is the `orderLadder` generator, split into asks/bids halves so each
// sits in its own isolated group with a blur ramp running away from the center
// (Figma blurs rows 1.5 → 10.5 px by distance).
//
//   node scripts/vol-01-follow-volume.mjs [vNNN]   (default v009)

import { mkdirSync, writeFileSync } from "node:fs";

const FPS = 30;
const f = (n) => +(n / FPS).toFixed(4); // frame → seconds
const k = (frame, v, ease) => (ease ? { t: f(frame), v, ease } : { t: f(frame), v });
const r2 = (v) => +v.toFixed(2);

const PAPER = "#F4F9EE";
const STAGE = "#0F0F12";
const ASK = "#f97474";
const EASE = "figmaSlow";

// ---------- beats (frames) ----------
const W_FOLGE = 0, W_DEM = 4;             // words rise in…
const BRACES = 8, BRACES_END = 28;        // …braces pop open from the middle…
const WORD = 12, WORD_END = 32;           // …"Volumen" tracks in between them
const HEAD_OUT = 48, HEAD_OUT_END = 66;   // headline blurs out…
const FOCUS = 52, FOCUS_END = 72;         // …while the book pulls into focus
const BAND_IN = 58, BAND_IN_END = 66;     // depth band fades in at 100% width
const MOVE = 64;                          // the one motion: MOVE → DURATION
const DURATION = 120;

// ---------- layout (Figma px) ----------
const ROW_H = 104, CENTER_Y = 540;
const COLS = [690, 1170, 1650];           // right edges of price / notional / size
const BAND = { y: 478, h: 124, start: 1920, full: 1391, drained: 723 };
const SCROLL_ROWS = 20;                   // ladder travel over the move
const SHUTTER = 1 / FPS;                  // motion blur window (360° shutter)

// Best ask: the price ticks down one tick per row the ladder scrolls (asks above
// always stay above it) while the band, size and notional drain to zero.
const PRICE = 85974.65, TICK = 1.3;
const PRICE_TO = r2(PRICE - SCROLL_ROWS * TICK);
const SIZE_FROM = 10;
const NOTIONAL_FROM = r2(PRICE * SIZE_FROM);

// The one motion: `from` → `to` over MOVE → DURATION, on the reference's curve:
// quick build, early peak (rows streak), soft landing on the last frame.
const MOVE_EASE = [0.45, 0, 0.1, 1];
const move = (from, to) => [k(MOVE, from, MOVE_EASE), k(DURATION, to)];

// Red glow (Figma "Vector 743"): a blurred #FF6479 blob, rotated, at the box center.
const GLOW_D = "M1961.04 1385.05L1469.44 872.081L1921.21 763.933L2745.41 673.835L2841.41 492.972H2408.41L1430.11 609.909L778.91 492.972L1176.87 977.251L645.41 1261.48L492.972 1508L1242.59 1345.72L1670.2 1492.03L1961.04 1385.05Z";
const GLOW_BOX = { w: 3334.38, h: 2000.98 };
const GLOW_A = { x: r2(-935 + 2357.739 / 2), y: r2(-1696 + 2397.849 / 2), r: -46.22 }; // VOL-01/02
const GLOW_B = { x: r2(558 + 2352.748 / 2), y: r2(-1425 + 2402.275 / 2), r: 46.51 };    // VOL-03

// Headline (Figma "Headline": x 461.5, y 484, 1081 × 112), positioned from its center.
const HEAD_C = { x: 461.5 + 1081 / 2, y: 484 + 112 / 2 };
// Glyph widths measured in the browser (Geist 600, 104 px, −2.08 tracking).
const HEAD_W = { folgeSp: 288.91, volumen: 422.86, brace: 39.62 };
const VOL_CX = 461.5 + 593 + HEAD_W.volumen / 2; // "Volumen" center
const HEAD_TYPE = {
  fontFamily: "Geist", fontWeight: 600, fontSize: 104, letterSpacing: -2.08,
  lineHeight: 1.08, align: "left", fill: PAPER, anchorX: 0, anchorY: 0.5,
};
const BOOK_TYPE = {
  fontFamily: "Geist", fontWeight: 500, fontSize: 60, lineHeight: 1.3, align: "right",
  fill: PAPER, anchorX: 1, anchorY: 0.5,
};

const nul = (id, name, parent, props, keyframes, label = "#D9F9B9") => ({
  id, name, type: "null", label, ...(parent ? { parent } : {}), props, ...(keyframes ? { keyframes } : {}),
});
const text = (id, name, parent, props, keyframes, label = "#c5b9ee") => ({
  id, name, type: "text", label, parent, props, ...(keyframes ? { keyframes } : {}),
});

// Ladder half: isolated group (blur ramp away from the center) + generator.
function ladder(side) {
  const up = side === "asks";
  const ramp = up ? { rampStart: 520, rampEnd: 0 } : { rampStart: 560, rampEnd: 1080 };
  return [
    nul(`${side}-group`, up ? "Asks (ramp up)" : "Bids (ramp down)", "book", { x: 0, y: 0, isolate: "yes", ...ramp }, {
      rampBlur: [k(FOCUS, 0, EASE), k(FOCUS_END, 10.5)],
    }),
    {
      id: `${side}-ladder`, name: up ? "Ask rows" : "Bid rows", type: "generator", label: "#9fdcc6", parent: `${side}-group`,
      props: {
        generator: "orderLadder", side, x: 0, y: 0, anchorX: 0, anchorY: 0, width: 1920, height: 1080,
        centerY: CENTER_Y, rowHeight: ROW_H, col1: COLS[0], col2: COLS[1], col3: COLS[2], rowAlpha: 0.32, basePrice: PRICE, tick: TICK,
        shutter: SHUTTER,
      },
      keyframes: {
        // VOL-01: every row blurred 14 px.
        blur: [k(FOCUS, 14, EASE), k(FOCUS_END, 0)],
        scroll: move(0, SCROLL_ROWS),
      },
    },
  ];
}

const layers = [
  // ---- red glow (top of the stack, like Figma) ----
  {
    id: "red-glow-shape", name: "Red glow blob", type: "path", label: "#e6d3a3", parent: "red-glow",
    props: { d: GLOW_D, pathOrigin: "zero", x: -GLOW_BOX.w / 2, y: -GLOW_BOX.h / 2, fill: "#FF6479", strokeWidth: 0, blur: 246.486 },
  },
  nul("red-glow", "Red glow", null, { x: GLOW_A.x, y: GLOW_A.y, rotation: GLOW_A.r }, {
    x: move(GLOW_A.x, GLOW_B.x),
    y: move(GLOW_A.y, GLOW_B.y),
    rotation: move(GLOW_A.r, GLOW_B.r),
    scale: move(1, 1.08),
  }, "#e6d3a3"),

  // ---- headline ----
  // Words rise in from below out of a blur, 4 frames apart.
  ...[["head-folge", "Folge", W_FOLGE, 461.5], ["head-dem", "dem", W_DEM, 461.5 + HEAD_W.folgeSp]].map(([id, word, fr, x]) =>
    text(id, word, "headline", { ...HEAD_TYPE, text: word, x: r2(x - HEAD_C.x), y: 0 }, {
      y: [k(fr, 46, EASE), k(fr + 20, 0)],
      opacity: [k(fr, 0, "easeOut"), k(fr + 10, 1)],
      blur: [k(fr, 14, EASE), k(fr + 16, 0)],
    })),
  // Braces start together in the middle and pop open around the word…
  text("head-open", "{", "headline", { ...HEAD_TYPE, text: "{", x: r2(461.5 + 530 - HEAD_C.x), y: 0 }, {
    x: [
      k(BRACES, r2(VOL_CX - HEAD_W.brace - 6 - HEAD_C.x), EASE), k(BRACES_END, r2(461.5 + 530 - HEAD_C.x)),
      k(HEAD_OUT, r2(461.5 + 530 - HEAD_C.x), EASE), k(HEAD_OUT_END, r2(461.5 + 530 - HEAD_C.x - 36)),
    ],
    opacity: [k(BRACES, 0, "easeOut"), k(BRACES + 6, 1)],
    scale: [k(BRACES, 0.6, "backOut"), k(BRACES + 14, 1)],
  }),
  text("head-close", "}", "headline", { ...HEAD_TYPE, text: "}", x: r2(461.5 + 1039 - HEAD_C.x), y: 0 }, {
    x: [
      k(BRACES, r2(VOL_CX + 6 - HEAD_C.x), EASE), k(BRACES_END, r2(461.5 + 1039 - HEAD_C.x)),
      k(HEAD_OUT, r2(461.5 + 1039 - HEAD_C.x), EASE), k(HEAD_OUT_END, r2(461.5 + 1039 - HEAD_C.x + 36)),
    ],
    opacity: [k(BRACES, 0, "easeOut"), k(BRACES + 6, 1)],
    scale: [k(BRACES, 0.6, "backOut"), k(BRACES + 14, 1)],
  }),
  // …while "Volumen" tracks in (letter spacing closes up) out of a blur, centered.
  text("head-word", "Volumen", "headline", { ...HEAD_TYPE, text: "Volumen", anchorX: 0.5, x: r2(VOL_CX - HEAD_C.x), y: 0 }, {
    letterSpacing: [k(WORD, 22, EASE), k(WORD_END, -2.08)],
    opacity: [k(WORD, 0, "easeOut"), k(WORD + 10, 1)],
    blur: [k(WORD, 16, EASE), k(WORD_END - 4, 0)],
    scale: [k(WORD, 0.94, EASE), k(WORD_END, 1)],
  }),
  nul("headline", "Headline", null, { x: HEAD_C.x, y: HEAD_C.y }, {
    opacity: [k(HEAD_OUT, 1, EASE), k(HEAD_OUT_END, 0)],
    blur: [k(HEAD_OUT, 0, EASE), k(HEAD_OUT_END, 24)],
    scale: [k(0, 0.99, "sineOut"), k(HEAD_OUT, 1.025, EASE), k(HEAD_OUT_END, 1.07)],
  }, "#c5b9ee"),

  // ---- best-ask row (the focus) ----
  text("focus-price", "Best ask price", "focus-row", {
    ...BOOK_TYPE, text: "{counter}", counter: PRICE, counterDecimals: 2, counterGrouping: ",", fill: ASK, x: COLS[0], y: CENTER_Y,
  }, { counter: move(PRICE, PRICE_TO) }),
  text("focus-notional", "Best ask notional", "focus-row", {
    ...BOOK_TYPE, text: "≈ {counter}", counter: NOTIONAL_FROM, counterDecimals: 2, counterGrouping: ",", x: COLS[1], y: CENTER_Y,
  }, { counter: move(NOTIONAL_FROM, 0) }),
  text("focus-size", "Best ask size", "focus-row", {
    ...BOOK_TYPE, text: "{counter}", counter: SIZE_FROM, counterDecimals: 3, x: COLS[2], y: CENTER_Y,
  }, { counter: move(SIZE_FROM, 0) }),
  nul("focus-row", "Focus row", "book", { x: 0, y: 0 }, {
    opacity: [k(FOCUS, 0.35, EASE), k(FOCUS_END, 1)],
    blur: [k(FOCUS, 14, EASE), k(FOCUS_END, 0)],
  }),

  // ---- depth band + track ----
  {
    id: "depth-band", name: "Depth band", type: "rect", label: "#f97474", parent: "book",
    props: { x: 0, y: BAND.y, width: BAND.start, height: BAND.h, anchorX: 0, anchorY: 0, fill: "rgba(249,116,116,0.26)" },
    keyframes: {
      opacity: [k(BAND_IN, 0, "easeOut"), k(BAND_IN_END, 1)],
      width: move(BAND.start, 0),
    },
  },
  {
    id: "depth-track", name: "Depth track", type: "rect", label: "#F4F9EE", parent: "book",
    props: { x: 0, y: BAND.y, width: 1920, height: BAND.h, anchorX: 0, anchorY: 0, fill: "rgba(244,249,238,0.04)" },
    keyframes: { opacity: [k(FOCUS, 0.35, EASE), k(FOCUS_END, 1)] },
  },

  // ---- ladder ----
  ...ladder("asks"),
  ...ladder("bids"),
  nul("book", "Order book", null, { x: 0, y: 0 }),

  // ---- backdrop ----
  {
    id: "green-glow", name: "Green glow", type: "ellipse", label: "#9fdcc6",
    props: { x: 1100 + 750, y: 620 + 450, width: 1500, height: 900, fill: "#1F5A43", opacity: 0.45, blur: 160 },
    // Mirrors the red glow diagonally: starts bottom-right (red top-left) and
    // crosses to bottom-left as the red swings top-right — same move, same curve.
    keyframes: { x: move(1850, 1920 - 1850), y: move(1070, 1040), scale: move(1, 1.12), opacity: move(0.45, 0.55) },
  },
  {
    id: "dither", name: "Dither", type: "generator", label: "#9fdcc6",
    props: { generator: "asciiRings", x: 0, y: 0, anchorX: 0, anchorY: 0, width: 1920, height: 1080, blend: "overlay" },
    keyframes: { ringShift: move(0, 0.18) },
  },
];

const version = process.argv[2] ?? "v009";
const shot = {
  name: "VOL-01 · Folge dem Volumen",
  note: "Green glow now mirrors the red: crosses bottom-right → bottom-left while the red swings top-left → top-right.",
  width: 1920, height: 1080, fps: FPS, duration: +(DURATION / FPS).toFixed(4),
  background: STAGE,
  layers,
};
const dir = new URL("../shots/vol-01-follow-volume/", import.meta.url);
mkdirSync(dir, { recursive: true });
writeFileSync(new URL(`${version}.json`, dir), JSON.stringify(shot, null, 2) + "\n");
console.log(`wrote shots/vol-01-follow-volume/${version}.json (${layers.length} layers)`);
