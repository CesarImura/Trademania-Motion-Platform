// SES-01 → SES-02 (Trademania V3, Figma "Motion test 2", node 15834:20020):
// browser opens on trademania.app → pixel wipe → "Neue Trading-Session erstellen"
// button builds in → hand cursor clicks it and holds on the pressed state.
//
// Geometry comes from the Figma frames (1920×1080). The gradient/noise/dither
// backgrounds are the `tmBackdrop` generator; the transition is `pixelWipe`.
//
//   node scripts/ses-01-create-session.mjs

import { mkdirSync, writeFileSync } from "node:fs";

const FPS = 30;
const f = (n) => +(n / FPS).toFixed(4); // frame → seconds
const k = (frame, v, ease) => (ease ? { t: f(frame), v, ease } : { t: f(frame), v });

// ---------- SES-01 measurements ----------
const BAR_W = 824.04, BAR_H = 126.15, BAR_PAD = 45.05;
const TEXT_X = -BAR_W / 2 + BAR_PAD; // left edge of the URL, relative to the bar center
// Prefix widths of "trademania.app" in Geist 400 58.571px / -1.1714 tracking (measured in Chrome).
const URL_TEXT = "trademania.app";
const PREFIX = [0, 21.79, 43.11, 71.87, 105.19, 136.29, 185.9, 216.42, 249.04, 261.81, 292.32, 304.1, 335.2, 368.64, 401.73];
// Frames between keystrokes — uneven, like a person typing (pause before ".app").
const GAPS = [0, 3, 2, 2, 3, 2, 2, 3, 2, 2, 4, 3, 2, 2];
const TYPE_START = 33;
const typed = [];
GAPS.reduce((acc, g) => (typed.push(acc + g), acc + g), TYPE_START);
const TYPE_END = typed.at(-1);
const ENTER = TYPE_END + 9; // "press enter": search icon pulses, bar dips

// ---------- SES-02 measurements ----------
const BTN = { x: 592.38 + 820.24 / 2, y: 482.5 + 114.74 / 2, w: 820.24, h: 114.74 };
const FINGERTIP = { x: 1242 + 200 * 0.33, y: 542 + 200 * 0.13 };

const WIPE_IN = ENTER + 8, WIPE_OUT = WIPE_IN + 18;
const BTN_IN = WIPE_OUT + 2;
const HAND_IN = BTN_IN + 26, HAND_LAND = HAND_IN + 26;
const PRESS = HAND_LAND + 6;
const DURATION = PRESS + 30;

const ses01End = f(WIPE_OUT + 1);

const SEARCH_D =
  "M56.1875 53.4477L41.5553 38.8155C45.0713 34.5944 46.8246 29.1802 46.4505 23.6994C46.0763 18.2185 43.6035 13.0928 39.5465 9.3887C35.4894 5.68457 30.1605 3.68715 24.6683 3.81196C19.1761 3.93676 13.9434 6.17418 10.0588 10.0588C6.17418 13.9434 3.93676 19.1761 3.81196 24.6683C3.68715 30.1605 5.68457 35.4894 9.3887 39.5465C13.0928 43.6035 18.2185 46.0763 23.6994 46.4505C29.1802 46.8246 34.5944 45.0713 38.8155 41.5553L53.4477 56.1875L56.1875 53.4477ZM7.75002 25.1875C7.75002 21.7387 8.77271 18.3673 10.6888 15.4998C12.6048 12.6322 15.3282 10.3972 18.5145 9.07737C21.7008 7.75756 25.2069 7.41224 28.5894 8.08507C31.9719 8.7579 35.079 10.4187 37.5177 12.8573C39.9564 15.296 41.6171 18.4031 42.29 21.7856C42.9628 25.1682 42.6175 28.6743 41.2977 31.8606C39.9779 35.0468 37.7429 37.7702 34.8753 39.6863C32.0077 41.6023 28.6363 42.625 25.1875 42.625C20.5644 42.6199 16.1321 40.7811 12.863 37.512C9.59395 34.243 7.75514 29.8107 7.75002 25.1875Z";

const layers = [
  // ================= SES-02 · create session (on top) =================
  {
    id: "hand",
    name: "Hand cursor",
    type: "image",
    label: "#e6d3a3",
    start: f(HAND_IN),
    props: {
      src: "hand-cursor.png", width: 200,
      anchorX: 0.33, anchorY: 0.13, // fingertip
      shadowColor: "rgba(10,26,29,0.22)", shadowBlur: 28,
    },
    keyframes: {
      x: [k(HAND_IN, FINGERTIP.x + 260, "expoOut"), k(HAND_LAND, FINGERTIP.x)],
      y: [k(HAND_IN, FINGERTIP.y + 330, "expoOut"), k(HAND_LAND, FINGERTIP.y)],
      rotation: [k(HAND_IN, 14, "expoOut"), k(HAND_LAND + 4, 0)],
      opacity: [k(HAND_IN, 0, "easeOut"), k(HAND_IN + 6, 1)],
      scale: [k(PRESS - 3, 1, "quadIn"), k(PRESS, 0.86, "easeOut"), k(PRESS + 5, 0.89)],
      shadowY: [k(PRESS - 3, 14, "quadIn"), k(PRESS, 4)],
    },
  },
  {
    id: "btn",
    name: "Button (group)",
    type: "null",
    label: "#D9F9B9",
    start: f(BTN_IN),
    props: { x: BTN.x, y: BTN.y },
    keyframes: {
      opacity: [k(BTN_IN, 0, "easeOut"), k(BTN_IN + 3, 1)],
      scale: [k(BTN_IN, 0.94, "backOut"), k(BTN_IN + 16, 1), k(PRESS - 2, 1, "quadOut"), k(PRESS + 2, 0.965)],
    },
  },
  {
    id: "plus",
    name: "Plus tile (group)",
    type: "null",
    parent: "btn",
    label: "#D9F9B9",
    props: { x: -BTN.w / 2 + 23.62 + 67.5 / 2, y: 0 },
    keyframes: {
      scale: [k(BTN_IN + 1, 0, "backOut"), k(BTN_IN + 13, 1)],
      rotation: [k(BTN_IN + 1, -90, "expoOut"), k(BTN_IN + 15, 0)],
    },
  },
  { id: "plus-h", name: "Plus stroke H", type: "rect", parent: "plus", props: { width: 30.37, height: 5.06, fill: "#0a1a1d" } },
  { id: "plus-v", name: "Plus stroke V", type: "rect", parent: "plus", props: { width: 5.06, height: 30.37, fill: "#0a1a1d" } },
  { id: "plus-tile", name: "Plus tile", type: "rect", parent: "plus", props: { width: 67.5, height: 67.5, radius: 4, fill: "#b6de9e" } },
  {
    id: "btn-label",
    name: "Label",
    type: "text",
    parent: "btn",
    matte: "btn-shape",
    props: {
      text: "Neue Trading-Session erstellen",
      fontFamily: "Geist", fontWeight: 500, fontSize: 47.248, letterSpacing: -0.945, lineHeight: 1.1,
      align: "left", fill: "#ffffff", anchorX: 0, y: 0,
    },
    keyframes: {
      x: [k(BTN_IN + 6, -BTN.w / 2 + 114.74 - 36, "expoOut"), k(BTN_IN + 22, -BTN.w / 2 + 114.74)],
      opacity: [k(BTN_IN + 6, 0, "easeOut"), k(BTN_IN + 16, 1)],
    },
  },
  {
    id: "btn-bg",
    name: "Button backdrop",
    type: "generator",
    parent: "btn",
    matte: "btn-shape",
    props: {
      generator: "tmBackdrop", width: BTN.w, height: BTN.h,
      baseColor: "#b6de9e", blobBlur: 100,
      b1x: 432, b1y: -219.8, b1rx: 412.7, b1ry: 209.5, b1a: 1,
      b2x: 42.2, b2y: 150.9, b2rx: 412.7, b2ry: 209.5, b2a: 1,
      ringX: 409.8, ringY: 57.6, tilt: 0.1,
    },
    keyframes: {
      glyphReveal: [k(BTN_IN + 2, 0, "easeOut"), k(BTN_IN + 22, 1)],
      // Click: rings ripple outward and the glyphs re-roll.
      ringShift: [k(PRESS - 1, 0, "expoOut"), k(DURATION, 0.12)],
      scramble: [k(PRESS - 1, 0.04, "linear"), k(PRESS + 1, 0.55, "sineOut"), k(PRESS + 22, 0.06)],
      glyphAlpha: [k(PRESS - 1, 1, "expoOut"), k(PRESS + 2, 1.6, "sineInOut"), k(PRESS + 24, 1.15)],
    },
  },
  {
    id: "btn-shape",
    name: "Button shape (matte)",
    type: "rect",
    parent: "btn",
    label: "#9fdcc6",
    props: { anchorX: 0, x: -BTN.w / 2, y: 0, height: BTN.h, radius: 8, fill: "#ffffff" },
    keyframes: {
      // The pill grows out from the plus tile.
      width: [k(BTN_IN, BTN.h, "expoOut"), k(BTN_IN + 18, BTN.w)],
    },
  },

  // ================= transition =================
  {
    id: "wipe",
    name: "Pixel wipe",
    type: "generator",
    label: "#c5b9ee",
    start: f(WIPE_IN),
    props: { generator: "pixelWipe", x: 960, y: 540, width: 2080, height: 1234.29, cols: 13, rows: 8 },
    keyframes: { progress: [k(WIPE_IN, 0, "sineInOut"), k(WIPE_OUT, 1)] },
  },

  // ================= SES-01 · browser opens =================
  {
    id: "page",
    name: "SES-01 (group)",
    type: "null",
    label: "#c5b9ee",
    end: ses01End,
    props: { x: 960, y: 540 },
    keyframes: {
      scale: [k(0, 1.06, "expoOut"), k(ENTER, 1, "easeIn"), k(WIPE_OUT, 1.03)],
    },
  },
  {
    id: "addr",
    name: "Address bar (group)",
    type: "null",
    parent: "page",
    label: "#D9F9B9",
    end: ses01End,
    props: { x: 0 },
    keyframes: {
      y: [k(12, 46, "expoOut"), k(34, 0)],
      opacity: [k(12, 0, "easeOut"), k(24, 1)],
      scale: [k(12, 0.95, "expoOut"), k(34, 1), k(ENTER - 2, 1, "quadOut"), k(ENTER + 2, 0.985, "easeInOut"), k(ENTER + 9, 1)],
    },
  },
  {
    id: "caret",
    name: "Caret",
    type: "rect",
    parent: "addr",
    end: ses01End,
    props: { anchorX: 0, y: 0, width: 3, height: 60, radius: 1.5, fill: "#ffffff" },
    keyframes: {
      x: [
        k(TYPE_START - 1, TEXT_X + 2, "hold"),
        ...typed.map((fr, i) => k(fr, +(TEXT_X + PREFIX[i + 1] + 3).toFixed(2), "hold")),
      ],
      // Blink while idle, solid while typing, gone on enter.
      opacity: [
        k(0, 0, "hold"), k(24, 1, "hold"), k(32, 0, "hold"), k(TYPE_START, 1, "hold"),
        k(TYPE_END + 8, 0, "hold"), k(TYPE_END + 16, 1, "hold"), k(ENTER, 0, "hold"),
      ],
    },
  },
  {
    id: "url",
    name: "URL",
    type: "text",
    parent: "addr",
    end: ses01End,
    props: {
      text: URL_TEXT, fontFamily: "Geist", fontWeight: 400, fontSize: 58.571, letterSpacing: -1.1714, lineHeight: 1.1,
      align: "left", fill: "#ffffff", anchorX: 0, x: TEXT_X, y: 0,
    },
    keyframes: {
      reveal: [k(TYPE_START - 1, 0, "hold"), ...typed.map((fr, i) => k(fr, +((i + 1) / URL_TEXT.length).toFixed(4), "hold"))],
    },
  },
  {
    id: "search",
    name: "Search icon",
    type: "path",
    parent: "addr",
    end: ses01End,
    props: { d: SEARCH_D, stroke: "rgba(0,0,0,0)", strokeWidth: 0, x: BAR_W / 2 - BAR_PAD - 31, y: 0 },
    keyframes: {
      scale: [k(ENTER - 1, 1, "quadOut"), k(ENTER + 3, 1.18, "easeInOut"), k(ENTER + 10, 1)],
      fill: [k(ENTER - 1, "rgba(255,255,255,0.56)", "easeOut"), k(ENTER + 3, "rgba(255,255,255,1)")],
    },
  },
  {
    id: "bar",
    name: "Address bar",
    type: "rect",
    parent: "addr",
    end: ses01End,
    props: { width: BAR_W, height: BAR_H, radius: 16, fill: "rgba(255,255,255,0.24)" },
  },
  {
    id: "page-bg",
    name: "Page backdrop",
    type: "generator",
    parent: "page",
    end: ses01End,
    props: {
      generator: "tmBackdrop", x: 0.18, width: 1932.35, height: 1080,
      baseColor: "#a3c890", blobBlur: 200,
      b1x: 1034.3, b1rx: 1711, b1ry: 852, b1a: 1, b2a: 0,
      ringX: 943.5, ringY: 541,
    },
    keyframes: {
      opacity: [k(0, 0, "easeOut"), k(18, 1)],
      glyphReveal: [k(0, 0, "easeOut"), k(36, 1)],
      // The dark mass slowly lifts off the top, rings drift outward.
      b1y: [k(0, -40, "sineOut"), k(WIPE_OUT, -101)],
      ringShift: [k(0, -0.03, "linear"), k(WIPE_OUT, 0.05)],
    },
  },
];

const shot = {
  name: "SES-01→02 · Browser opens → Create session",
  note: "First pass from Figma (Motion test 2): type URL, pixel wipe, button builds in, hand clicks and holds",
  width: 1920,
  height: 1080,
  fps: FPS,
  duration: f(DURATION),
  background: "#0a1a1d",
  layers,
};

const dir = new URL("../shots/ses-01-create-session/", import.meta.url);
mkdirSync(dir, { recursive: true });
writeFileSync(new URL("v001.json", dir), JSON.stringify(shot, null, 2) + "\n");
console.log(`wrote v001.json — ${shot.duration}s, ${layers.length} layers`);
