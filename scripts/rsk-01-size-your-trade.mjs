// RSK-01 → RSK-02 (Trademania V3, Figma "Section 11", node 16081:27838):
// "Stimm { Risiko } auf dein Kapital ab" next to the Risk Calculator window →
// "Erkenne, was den Kurs { bewegt }." next to the Economic Calendar.
//
// Beat 1 (RSK-01, 120f): the app window rises from below the frame and keeps
// travelling in one curve until the Order preview lands; the headline builds like
// VOL-01 (words rise, braces pop open, "Risiko" tracks in between them); the
// market header follows; a selection is dragged over POSITION SIZE.
// Beat 2 (RSK-02, 80f): the selection lets go, the headline blurs out, the window
// glides to the right while its panel swaps to the Economic Calendar and scrolls
// up to the events, the header crosses to the left under it, the second
// headline builds and the selection is dragged over FOMC Rate Decision.
//
// Panels are Figma exports of the side-menu instances (2×, unclipped), clipped
// by the window shape as a matte.
//
//   node scripts/rsk-01-size-your-trade.mjs [vNNN]   (default v001)

import { mkdirSync, writeFileSync } from "node:fs";

const FPS = 30;
const f = (n) => +(n / FPS).toFixed(4); // frame → seconds
const k = (frame, v, ease) => (ease ? { t: f(frame), v, ease } : { t: f(frame), v });
const r2 = (v) => +v.toFixed(2);

const PAPER = "#F4F9EE";
const INK = "#0a1a1d";
const LIME = "#D9F9B9";
const EASE = "figmaSlow";

// ---------- beats (frames) ----------
const B2 = 120;                              // RSK-02 starts
const DURATION = 200;                        // [120] + [80]

// Beat 1
const RISE = 0, RISE_END = 72;               // window: below the frame → Order preview in place
const H1 = 8;                                // headline 1 build starts
const HEADER_IN = 34, HEADER_IN_END = 54;
const SEL1 = 84, SEL1_END = 102;             // selection dragged over POSITION SIZE

// Beat 2
const OUT = B2, OUT_END = B2 + 18;           // selection lets go, headline 1 blurs out
const GLIDE = B2 + 2, GLIDE_END = B2 + 42;   // window glides right
const SWAP = B2 + 10, SWAP_END = B2 + 26;    // panel cross-fades to the calendar
const SCROLL = B2 + 8, SCROLL_END = B2 + 50; // calendar scrolls up to the events
const HEADER_X = B2 + 4, HEADER_X_END = B2 + 42;
const H2 = B2 + 26;                          // headline 2 build starts
const SEL2 = B2 + 56, SEL2_END = B2 + 72;    // selection over FOMC Rate Decision

// ---------- layout (Figma px) ----------
const WIN = { w: 744.8, h: 1797.4, r: 22.8 };
const WIN1 = { x: 118, y: -750 };            // RSK-01 window
const WIN2 = { x: 1075, y: -667 };           // RSK-02 window
const PANEL_W = 744.04;                      // side-menu instance width (exports are 2×)
const CAL_SCROLL_FROM = -560;                // calendar content offset before it scrolls up (max −698)

const HEAD1 = { x: 933, y: 309 };               // +8: engine line box sits higher than Figma's
const HEAD2 = { x: 118, y: 309 };
const HEADER1 = { x: 933, y: 561 };
const HEADER2 = { x: 118, y: 561 };

const HEAD_TYPE = {
  fontFamily: "Geist", fontWeight: 500, fontSize: 96, letterSpacing: -1.92,
  lineHeight: 1.08, align: "left", fill: INK, anchorX: 0, anchorY: 0,
};
const UI_TYPE = {
  fontFamily: "Geist", fontWeight: 500, fontSize: 36.4, letterSpacing: -0.364,
  lineHeight: 1.29, align: "left", fill: INK, anchorX: 0, anchorY: 0,
};

const nul = (id, name, parent, props, keyframes, label = "#D9F9B9") => ({
  id, name, type: "null", label, ...(parent ? { parent } : {}), props, ...(keyframes ? { keyframes } : {}),
});
const text = (id, name, parent, props, keyframes, label = "#c5b9ee") => ({
  id, name, type: "text", label, parent, props, ...(keyframes ? { keyframes } : {}),
});

// ---------- headline build (VOL-01 style) ----------
// words: [id, text, x, y, frame]; key: the braced word { x, w, close: {x, text} } (headline-local).
function headline(pre, parent, start, words, key) {
  const layers = [];
  for (const [id, word, x, y, fr] of words) {
    layers.push(text(`${pre}-${id}`, word, parent, { ...HEAD_TYPE, text: word, x, y }, {
      y: [k(start + fr, y + 46, EASE), k(start + fr + 20, y)],
      opacity: [k(start + fr, 0, "easeOut"), k(start + fr + 10, 1)],
      blur: [k(start + fr, 14, EASE), k(start + fr + 16, 0)],
    }));
  }
  const B = start + key.fr, BE = B + 20, W = B + 4, WE = W + 20;
  const cx = key.x + key.w / 2;
  // Braces start together over the word's center and pop open around it…
  layers.push(text(`${pre}-open`, "{", parent, { ...HEAD_TYPE, text: "{", x: key.open, y: key.y }, {
    x: [k(B, r2(cx - 38 - 6), EASE), k(BE, key.open)],
    opacity: [k(B, 0, "easeOut"), k(B + 6, 1)],
    scale: [k(B, 0.6, "backOut"), k(B + 14, 1)],
  }));
  layers.push(text(`${pre}-close`, key.closeText, parent, { ...HEAD_TYPE, text: key.closeText, x: key.close, y: key.y }, {
    x: [k(B, r2(cx + 6), EASE), k(BE, key.close)],
    opacity: [k(B, 0, "easeOut"), k(B + 6, 1)],
    scale: [k(B, 0.6, "backOut"), k(B + 14, 1)],
  }));
  // …while the word tracks in (letter spacing closes up) out of a blur, centered.
  layers.push(text(`${pre}-word`, key.word, parent, { ...HEAD_TYPE, text: key.word, anchorX: 0.5, x: r2(cx), y: key.y }, {
    letterSpacing: [k(W, 22, EASE), k(WE, -1.92)],
    opacity: [k(W, 0, "easeOut"), k(W + 10, 1)],
    blur: [k(W, 16, EASE), k(WE - 4, 0)],
    scale: [k(W, 0.94, EASE), k(WE, 1)],
  }));
  return layers;
}

// ---------- selection (dragged on from the left edge) ----------
// box: rect top-left/size in window space; handle size; stroke width.
function selection(pre, name, box, hw, hh, sw, fr, end, outKeys) {
  const L = box.x, T = box.y, R = box.x + box.w, B = box.y + box.h;
  const handle = (id, x, y, right) => ({
    id: `${pre}-${id}`, name: `Handle ${id}`, type: "rect", label: "#D9F9B9", parent: pre,
    props: { x, y, width: hw, height: hh, fill: "#ffffff", stroke: LIME, strokeWidth: sw },
    keyframes: right
      ? { x: [k(fr, L, EASE), k(end, R)], opacity: [k(fr, 0, "easeOut"), k(fr + 4, 1)] }
      : { scale: [k(fr, 0, "backOut"), k(fr + 10, 1)] },
  });
  return [
    handle("tl", L, T, false), handle("bl", L, B, false),
    handle("tr", R, T, true), handle("br", R, B, true),
    {
      id: `${pre}-box`, name: "Selection", type: "rect", label: "#D9F9B9", parent: pre,
      props: { x: L, y: T, anchorX: 0, anchorY: 0, width: box.w, height: box.h, fill: "rgba(217,249,185,0.12)", stroke: LIME, strokeWidth: sw },
      keyframes: { width: [k(fr, 0, EASE), k(end, box.w)], opacity: [k(fr, 0, "easeOut"), k(fr + 4, 1)] },
    },
    nul(pre, name, "window", { x: 0, y: 0 }, outKeys),
  ];
}

// Clock ticks once a second (14:36:02 at frame 0 → 14:36:08 by the end, as in Figma).
const clock = [];
for (let s = 0; s * FPS < DURATION; s++) clock.push(k(s * FPS, `14:36:${String(2 + s).padStart(2, "0")}`, "hold"));

const layers = [
  // ---- headline 2 (RSK-02) ----
  ...headline("h2", "head2", H2, [
    ["l1", "Erkenne, was", 0, 0, 0],
    ["kurs", "den Kurs", 0, 108, 4],
  ], { word: "bewegt", x: 405 + 57, w: 328, y: 108, open: 405, close: 405 + 404, closeText: "}.", fr: 8 }),
  nul("head2", "Headline · RSK-02", null, { x: HEAD2.x, y: HEAD2.y }, null, "#c5b9ee"),

  // ---- headline 1 (RSK-01) ----
  ...headline("h1", "head1", H1, [
    ["stimm", "Stimm", 0, 0, 0],
    ["l2", "auf dein Kapital ab", 0, 108, 4],
  ], { word: "Risiko", x: 310 + 57, w: 263, y: 0, open: 310, close: 310 + 339, closeText: "}", fr: 6 }),
  nul("head1", "Headline · RSK-01", null, { x: HEAD1.x, y: HEAD1.y }, {
    opacity: [k(OUT, 1, EASE), k(OUT_END, 0)],
    blur: [k(OUT, 0, EASE), k(OUT_END, 24)],
    scale: [k(OUT, 1, EASE), k(OUT_END, 1.04)],
  }, "#c5b9ee"),

  // ---- window (isolated group: matte-clipped panels, motion blur from its own travel) ----
  ...selection("sel2", "Selection · FOMC", { x: 20.6, y: 1196.01, w: 703.6, h: 62 }, 16, 16, 3, SEL2, SEL2_END),
  ...selection("sel1", "Selection · Position size", { x: 141.59, y: 1268.62, w: 580.41, h: 81.76 }, 13.2, 19.24, 2.475, SEL1, SEL1_END, {
    opacity: [k(OUT, 1, "easeOut"), k(OUT + 8, 0)],
  }),
  {
    id: "panel-calendar", name: "Panel · Economic Calendar", type: "image", label: "#9fdcc6", parent: "window", matte: "win-mask",
    start: f(SWAP),
    props: { src: "panel-calendar.png", width: PANEL_W, x: 0, y: CAL_SCROLL_FROM, anchorX: 0, anchorY: 0 },
    keyframes: {
      opacity: [k(SWAP, 0, "sineInOut"), k(SWAP_END, 1)],
      y: [k(SCROLL, CAL_SCROLL_FROM, EASE), k(SCROLL_END, 0)],
    },
  },
  {
    id: "panel-risk", name: "Panel · Risk Calculator", type: "image", label: "#9fdcc6", parent: "window", matte: "win-mask",
    end: f(SWAP_END),
    props: { src: "panel-risk.png", width: PANEL_W, x: 0, y: 0, anchorX: 0, anchorY: 0 },
  },
  {
    id: "win-mask", name: "Window mask", type: "rect", label: "#e6d3a3", parent: "window",
    props: { x: 0, y: 0, anchorX: 0, anchorY: 0, width: WIN.w, height: WIN.h, radius: WIN.r, fill: "#ffffff" },
  },
  {
    id: "win-shell", name: "Window", type: "rect", label: "#e6d3a3", parent: "window",
    props: {
      x: 0, y: 0, anchorX: 0, anchorY: 0, width: WIN.w, height: WIN.h, radius: WIN.r,
      fill: "#020203", stroke: "rgba(10,26,29,0.12)", strokeWidth: 1.9,
      shadowColor: "rgba(10,26,29,0.08)", shadowBlur: 60.8, shadowY: 30.4,
    },
  },
  {
    id: "win-shadow", name: "Window · far shadow", type: "rect", label: "#e6d3a3", parent: "window",
    props: {
      x: 0, y: 0, anchorX: 0, anchorY: 0, width: WIN.w, height: WIN.h, radius: WIN.r,
      fill: "#020203", shadowColor: "rgba(10,26,29,0.08)", shadowBlur: 152, shadowY: 76,
    },
  },
  nul("window", "Window", null, { x: WIN1.x, y: WIN1.y, isolate: "yes", motionBlur: 0.8 }, {
    // One curve: rises from just below the frame and keeps travelling until the
    // Order preview is in place (gentle start, long settle).
    y: [k(RISE, 1080, EASE), k(RISE_END, WIN1.y), k(GLIDE, WIN1.y, EASE), k(GLIDE_END, WIN2.y)],
    x: [k(GLIDE, WIN1.x, EASE), k(GLIDE_END, WIN2.x)],
  }, "#e6d3a3"),

  // ---- market header (crosses to the left under the window) ----
  {
    id: "hdr-market", name: "Market · BTCUSDT", type: "image", label: "#ff6479", parent: "header",
    props: { src: "market.png", width: 502.6, x: 0, y: 10.3, anchorX: 0, anchorY: 0 },
  },
  text("hdr-clock", "Clock", "header", { ...UI_TYPE, text: "14:36:02", x: 561.58, y: 14.5 }, { text: clock }),
  {
    id: "hdr-chip", name: "Chip · Live", type: "image", label: "#ff6479", parent: "header",
    props: { src: "chip-live.png", width: 161.42, x: 738.58, y: 0.24, anchorX: 0, anchorY: 0 },
  },
  nul("header", "Header", null, { x: HEADER1.x, y: HEADER1.y }, {
    y: [k(HEADER_IN, HEADER1.y + 30, EASE), k(HEADER_IN_END, HEADER1.y)],
    opacity: [k(HEADER_IN, 0, "easeOut"), k(HEADER_IN + 12, 1)],
    blur: [k(HEADER_IN, 10, EASE), k(HEADER_IN_END - 4, 0)],
    x: [k(HEADER_X, HEADER1.x, EASE), k(HEADER_X_END, HEADER2.x)],
  }, "#ff6479"),
];

const version = process.argv[2] ?? "v001";
const shot = {
  name: "RSK-01 → RSK-02 · Size your trade / Know what moves",
  note: "First pass from Figma Section 11: window rises and travels to the Order preview, headline builds (VOL-01 style), selection dragged over Position size; then the window glides right, swaps to the Economic Calendar and scrolls to the events, header crosses left, second headline builds, selection over FOMC.",
  width: 1920, height: 1080, fps: FPS, duration: +(DURATION / FPS).toFixed(4),
  background: PAPER,
  layers,
};
const dir = new URL("../shots/rsk-01-size-your-trade/", import.meta.url);
mkdirSync(dir, { recursive: true });
writeFileSync(new URL(`${version}.json`, dir), JSON.stringify(shot, null, 2) + "\n");
console.log(`wrote shots/rsk-01-size-your-trade/${version}.json (${layers.length} layers)`);
