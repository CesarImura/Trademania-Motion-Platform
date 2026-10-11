// RSK-01 → RSK-02 v002 (Trademania V3, Figma "Section 11", node 16081:27838).
// Same two compositions as v001, now staged with a camera, live numbers, depth and
// a whip-pan between the beats. Still 120 + 80 frames.
//
// Beat 1 (RSK-01): the camera opens tight on the headline while it builds; the
// Risk Calculator window rises in out of a blur with a slight tilt. The camera
// travels to the panel (headline softens = rack focus) as the stop loss is dragged
// 85,520 → 85,760 — POSITION SIZE and MARGIN recalculate live (size = risk /
// (entry − stop), margin = size × entry / leverage), flashing lime while they
// change. The camera pushes in as a selection is dragged over POSITION SIZE, then
// pulls out to the full Figma frame.
// Beat 2 (RSK-02): a whip-pan (camera motion blur) to the second layout, built
// 2100px to the right. The calendar's event rows cascade in, the headline builds,
// then the camera pushes onto FOMC Rate Decision as it's selected (panel sharpens,
// headline softens) and settles back on the exact Figma frame.
//
// Everything hangs off a root `camera` null baked per frame from a focus point +
// zoom (pos = C − z·(F − C), zoom monotone-cubic in log space).
//
//   node scripts/rsk-01-size-your-trade-v002.mjs [vNNN]   (default v002)

import { mkdirSync, writeFileSync } from "node:fs";
import { EASES } from "../src/lib/easing.ts";
import { decimate } from "./lib/card-physics.mjs";

const FPS = 30;
const f = (n) => +(n / FPS).toFixed(4); // frame → seconds
const k = (frame, v, ease) => (ease ? { t: f(frame), v, ease } : { t: f(frame), v });
const r2 = (v) => +v.toFixed(2);
const r4 = (v) => +v.toFixed(4);

const PAPER = "#F4F9EE";
const INK = "#0a1a1d";
const LIME = "#D9F9B9";
const CARD = "rgb(27,27,30)";            // order-preview card + input fill (sampled from the export)
const EASE = "figmaSlow";
const C = [960, 540];

// ---------- beats (frames) ----------
const B2 = 120, DURATION = 200;

// Beat 1
const H1 = 4;                              // headline 1 build
const HEADER1_IN = 22;
const RISE = 18, RISE_END = 62;            // window rises in (tilt + blur clear)
const SOFT1 = 44, SOFT1_END = 64;          // headline softens as the camera reaches the panel
const DRAG = 62, DRAG_END = 88;            // stop loss dragged → numbers recalculate
const SEL1 = 86, SEL1_END = 102;           // selection over POSITION SIZE
const SHARP1 = 98, SHARP1_END = 116;      // headline sharpens for the full frame

// Beat 2
const WHIP = B2, WHIP_END = B2 + 18;       // whip-pan to page 2
const CASCADE = B2 + 10;                   // calendar rows cascade in (2.5f stagger)
const HEADER2_IN = B2 + 12;
const H2 = B2 + 8;                         // headline 2 build (words rise as the whip lands)
const RACK2 = B2 + 36, RACK2_END = B2 + 50;// panel sharpens / headline softens on the push
const SEL2 = B2 + 44, SEL2_END = B2 + 60;  // selection over FOMC
const SHARP2 = B2 + 60, SHARP2_END = B2 + 78;

// ---------- layout (Figma px; page 2 sits PAGE2 px to the right) ----------
const PAGE2 = 2100;
const WIN = { w: 744.8, h: 1797.4, r: 22.8 };
const WIN1 = { x: 118, y: -750 };
const WIN2 = { x: PAGE2 + 1075, y: -667 };
const PANEL_W = 744.04;
// Window groups pivot at their visible center: the group's motion blur is measured
// at its origin, and the top-left corner sits far above the frame (zooms would
// swing it a long way and smear the whole window).
const PIVOT1 = { x: WIN.w / 2, y: 540 - WIN1.y };
const PIVOT2 = { x: WIN.w / 2, y: 540 - WIN2.y };
const HEAD1 = { x: 933, y: 309 };          // +8: engine line box sits higher than Figma's
const HEAD2 = { x: PAGE2 + 118, y: 309 };
const HEADER1 = { x: 933, y: 561 };
const HEADER2 = { x: PAGE2 + 118, y: 561 };

// Calendar event rows (window-local, from Figma): first row top, pitch; sidebar width.
const ROW0 = 968, ROW_PITCH = 103.62, ROWS = 8, SIDEBAR = 121.22;

// Risk panel values (window-local, from Figma).
const ENTRY = 85880, RISK = 100, LEV = 19;
const SL_FROM = 85520, SL_TO = 85760;
const VAL_RIGHT = 685.52;
// Text y is Figma's + 2.5 (engine line box sits a little higher at this size).
const ROW_Y = { size: 1290.61, margin: 1449.67 };
const SL_TEXT = { x: 451.44, y: 964.51 };
const INPUT = { x: 426.36, y: 939.2, w: 284.24, h: 83.6, r: 8.36 };

const HEAD_TYPE = {
  fontFamily: "Geist", fontWeight: 500, fontSize: 96, letterSpacing: -1.92,
  lineHeight: 1.08, align: "left", fill: INK, anchorX: 0, anchorY: 0,
};
const UI_TYPE = {
  fontFamily: "Geist", fontWeight: 500, fontSize: 36.4, letterSpacing: -0.364,
  lineHeight: 1.29, align: "left", fill: INK, anchorX: 0, anchorY: 0,
};
const PANEL_TYPE = {
  fontFamily: "Geist", fontWeight: 400, fontSize: 29.26, lineHeight: 1.5, fill: "#ffffff", anchorY: 0,
};
const MB = 0.7; // per-layer motion blur (shutter, frames)

const layers = [];
const add = (...ls) => layers.push(...ls);
const nul = (id, name, parent, props, keyframes, label = "#D9F9B9") => ({
  id, name, type: "null", label, ...(parent ? { parent } : {}), props, ...(keyframes ? { keyframes } : {}),
});
const text = (id, name, parent, props, keyframes, label = "#c5b9ee") => ({
  id, name, type: "text", label, parent, props, ...(keyframes ? { keyframes } : {}),
});
// Camera children use frame coordinates minus the center.
const cam = (x, y) => ({ x: r2(x - C[0]), y: r2(y - C[1]) });

// ---------- camera ----------
// Keys: [frame, focusX, focusY, zoom]. Within a beat the path is one monotone cubic
// (no stop/start between keys); the whip is its own eased segment.
const BEAT1_KEYS = [
  [0, 1300, 430, 1.42],
  [26, 1250, 440, 1.47],                 // drift in while the headline builds
  [60, 520, 600, 1.5],                   // travel to the panel (stop loss + preview)
  [84, 500, 640, 1.56],
  [96, 490, 570, 1.7],                   // push in on the selection
  [117, 960, 540, 1],                    // full Figma frame
  [WHIP, 960, 540, 1],
];
const BEAT2_KEYS = [
  [WHIP_END, PAGE2 + 960, 540, 1],
  [B2 + 30, PAGE2 + 620, 460, 1.12],     // headline 2
  [B2 + 48, PAGE2 + 1450, 560, 1.3],     // push onto FOMC
  [B2 + 58, PAGE2 + 1430, 560, 1.33],
  [DURATION - 4, PAGE2 + 960, 540, 1],   // exact Figma frame (lands early, holds)
  [DURATION, PAGE2 + 960, 540, 1],
];
// Monotone cubic (Fritsch–Carlson) through (x, y) points: no overshoot between keys.
function monotone(xs, ys) {
  const n = xs.length, d = [], m = new Array(n).fill(0);
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (3 * (xs[i + 1] - xs[i - 1])) / ((2 * xs[i + 1] - xs[i] - xs[i - 1]) / d[i - 1] + (xs[i + 1] - 2 * xs[i] + xs[i - 1]) / d[i]);
  return (x) => {
    let i = 0;
    while (i < n - 2 && x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i], u = Math.max(0, Math.min(1, (x - xs[i]) / h));
    const h00 = 2 * u ** 3 - 3 * u ** 2 + 1, h10 = u ** 3 - 2 * u ** 2 + u, h01 = -2 * u ** 3 + 3 * u ** 2, h11 = u ** 3 - u ** 2;
    return h00 * ys[i] + h10 * h * m[i] + h01 * ys[i + 1] + h11 * h * m[i + 1];
  };
}
const path = (keys) => {
  const xs = keys.map((q) => q[0]);
  const [fx, fy, lz] = [1, 2, 3].map((c) => monotone(xs, keys.map((q) => (c === 3 ? Math.log(q[3]) : q[c]))));
  return (fr) => ({ fx: fx(fr), fy: fy(fr), z: Math.exp(lz(fr)) });
};
const beat1 = path(BEAT1_KEYS), beat2 = path(BEAT2_KEYS);
const whipEase = EASES.expoInOut;
function camAt(fr) {
  if (fr <= WHIP) return beat1(fr);
  if (fr >= WHIP_END) return beat2(fr);
  const u = (fr - WHIP) / (WHIP_END - WHIP), e = whipEase(u);
  return { fx: 960 + PAGE2 * e, fy: 540, z: 1 - 0.07 * Math.sin(Math.PI * u) }; // breathe out mid-whip
}
const camFrames = [];
for (let fr = 0; fr <= DURATION; fr += 0.5) camFrames.push({ fr, ...camAt(fr) });
const camTrack = (fn, tol) => decimate(camFrames.map((c) => ({ t: r4(c.fr / FPS), v: r4(fn(c)) })), tol);
add(nul("camera", "Camera", null, {}, {
  x: camTrack((c) => C[0] - c.z * (c.fx - C[0]), 0.05),
  y: camTrack((c) => C[1] - c.z * (c.fy - C[1]), 0.05),
  scale: camTrack((c) => c.z, 0.0005),
}, "#c5b9ee"));

// ---------- headline build (VOL-01 style) ----------
function headline(pre, parent, start, words, key) {
  for (const [id, word, x, y, fr] of words) {
    add(text(`${pre}-${id}`, word, parent, { ...HEAD_TYPE, text: word, x, y, motionBlur: MB }, {
      y: [k(start + fr, y + 46, EASE), k(start + fr + 20, y)],
      opacity: [k(start + fr, 0, "easeOut"), k(start + fr + 10, 1)],
      blur: [k(start + fr, 14, EASE), k(start + fr + 16, 0)],
    }));
  }
  const B = start + key.fr, BE = B + 20, W = B + 4, WE = W + 20;
  const cx = key.x + key.w / 2;
  add(text(`${pre}-open`, "{", parent, { ...HEAD_TYPE, text: "{", x: key.open, y: key.y, motionBlur: MB }, {
    x: [k(B, r2(cx - 38 - 6), EASE), k(BE, key.open)],
    opacity: [k(B, 0, "easeOut"), k(B + 6, 1)],
    scale: [k(B, 0.6, "backOut"), k(B + 14, 1)],
  }));
  add(text(`${pre}-close`, key.closeText, parent, { ...HEAD_TYPE, text: key.closeText, x: key.close, y: key.y, motionBlur: MB }, {
    x: [k(B, r2(cx + 6), EASE), k(BE, key.close)],
    opacity: [k(B, 0, "easeOut"), k(B + 6, 1)],
    scale: [k(B, 0.6, "backOut"), k(B + 14, 1)],
  }));
  add(text(`${pre}-word`, key.word, parent, { ...HEAD_TYPE, text: key.word, anchorX: 0.5, x: r2(cx), y: key.y, motionBlur: MB }, {
    letterSpacing: [k(W, 22, EASE), k(WE, -1.92)],
    opacity: [k(W, 0, "easeOut"), k(W + 10, 1)],
    blur: [k(W, 16, EASE), k(WE - 4, 0)],
    scale: [k(W, 0.94, EASE), k(WE, 1)],
  }));
}

// ---------- selection (dragged on from the left edge) ----------
function selection(pre, name, parent, box, hw, hh, sw, fr, end) {
  const L = box.x, T = box.y, R = box.x + box.w, B = box.y + box.h;
  const handle = (id, x, y, right) => ({
    id: `${pre}-${id}`, name: `Handle ${id}`, type: "rect", label: "#D9F9B9", parent: pre,
    props: { x, y, width: hw, height: hh, fill: "#ffffff", stroke: LIME, strokeWidth: sw },
    keyframes: right
      ? { x: [k(fr, L, EASE), k(end, R)], opacity: [k(fr, 0, "easeOut"), k(fr + 4, 1)] }
      : { scale: [k(fr, 0, "backOut"), k(fr + 10, 1)] },
  });
  add(
    handle("tl", L, T, false), handle("bl", L, B, false),
    handle("tr", R, T, true), handle("br", R, B, true),
    {
      id: `${pre}-box`, name: "Selection", type: "rect", label: "#D9F9B9", parent: pre,
      props: { x: L, y: T, anchorX: 0, anchorY: 0, width: box.w, height: box.h, fill: "rgba(217,249,185,0.12)", stroke: LIME, strokeWidth: sw },
      keyframes: { width: [k(fr, 0, EASE), k(end, box.w)], opacity: [k(fr, 0, "easeOut"), k(fr + 4, 1)] },
    },
    nul(pre, name, parent, { x: 0, y: 0 }),
  );
}

// ---------- market header ----------
const clock = [];
for (let s = 0; s * FPS < DURATION; s++) clock.push(k(s * FPS, `14:36:${String(2 + s).padStart(2, "0")}`, "hold"));
function header(pre, at, inFr, blurKeys) {
  add(
    { id: `${pre}-market`, name: "Market · BTCUSDT", type: "image", label: "#ff6479", parent: pre,
      props: { src: "market.png", width: 502.6, x: 0, y: 10.3, anchorX: 0, anchorY: 0, motionBlur: MB } },
    text(`${pre}-clock`, "Clock", pre, { ...UI_TYPE, text: "14:36:02", x: 561.58, y: 14.5, motionBlur: MB }, { text: clock }),
    { id: `${pre}-chip`, name: "Chip · Live", type: "image", label: "#ff6479", parent: pre,
      props: { src: "chip-live.png", width: 161.42, x: 738.58, y: 0.24, anchorX: 0, anchorY: 0, motionBlur: MB } },
    nul(pre, "Header", "camera", cam(at.x, at.y), {
      y: [k(inFr, at.y - C[1] + 30, EASE), k(inFr + 20, at.y - C[1])],
      opacity: [k(inFr, 0, "easeOut"), k(inFr + 12, 1)],
      blur: [k(inFr, 10, EASE), k(inFr + 16, 0), ...blurKeys],
    }, "#ff6479"),
  );
}

// ---------- window shell ----------
function shell(pre) {
  add(
    { id: `${pre}-shell`, name: "Window", type: "rect", label: "#e6d3a3", parent: pre,
      props: { x: 0, y: 0, anchorX: 0, anchorY: 0, width: WIN.w, height: WIN.h, radius: WIN.r,
        fill: "#020203", stroke: "rgba(10,26,29,0.12)", strokeWidth: 1.9,
        shadowColor: "rgba(10,26,29,0.08)", shadowBlur: 60.8, shadowY: 30.4 } },
    { id: `${pre}-farshadow`, name: "Window · far shadow", type: "rect", label: "#e6d3a3", parent: pre,
      props: { x: 0, y: 0, anchorX: 0, anchorY: 0, width: WIN.w, height: WIN.h, radius: WIN.r,
        fill: "#020203", shadowColor: "rgba(10,26,29,0.08)", shadowBlur: 152, shadowY: 76 } },
  );
}

// =====================================================================
// PAGE 2 (RSK-02) — listed first so it renders on top during the whip
// =====================================================================
headline("h2", "head2", H2, [
  ["l1", "Erkenne, was", 0, 0, 0],
  ["kurs", "den Kurs", 0, 108, 4],
], { word: "bewegt", x: 405 + 57, w: 328, y: 108, open: 405, close: 405 + 404, closeText: "}.", fr: 8 });
add(nul("head2", "Headline · RSK-02", "camera", cam(HEAD2.x, HEAD2.y), {
  blur: [k(RACK2, 0, EASE), k(RACK2_END, 6), k(SHARP2, 6, EASE), k(SHARP2_END, 0)],
}, "#c5b9ee"));

selection("sel2", "Selection · FOMC", "win2", { x: 20.6, y: 1196.01, w: 703.6, h: 62 }, 16, 16, 3, SEL2, SEL2_END);
// Calendar: the top (toggle + day strip) and the sidebar stay put; each event row
// is the same export behind its own strip matte, so it can cascade in on its own.
for (let i = 0; i < ROWS; i++) {
  const top = ROW0 + i * ROW_PITCH, fr = CASCADE + i * 2.5;
  add(
    { id: `cal-row${i}-img`, name: `Row ${i + 1}`, type: "image", label: "#9fdcc6", parent: `cal-row${i}`, matte: `cal-row${i}-mask`,
      props: { src: "panel-calendar.png", width: PANEL_W, x: 0, y: 0, anchorX: 0, anchorY: 0 } },
    { id: `cal-row${i}-mask`, name: `Row ${i + 1} mask`, type: "rect", label: "#e6d3a3", parent: `cal-row${i}`,
      props: { x: SIDEBAR, y: top, anchorX: 0, anchorY: 0, width: WIN.w - SIDEBAR, height: ROW_PITCH, fill: "#fff" } },
    nul(`cal-row${i}`, `Calendar row ${i + 1}`, "win2", { x: 0, y: 0 }, {
      y: [k(fr, 56, EASE), k(fr + 18, 0)],
      opacity: [k(fr, 0, "easeOut"), k(fr + 10, 1)],
    }, "#9fdcc6"),
  );
}
add(
  { id: "cal-top", name: "Calendar · top", type: "image", label: "#9fdcc6", parent: "win2", matte: "cal-top-mask",
    props: { src: "panel-calendar.png", width: PANEL_W, x: 0, y: 0, anchorX: 0, anchorY: 0 } },
  { id: "cal-top-mask", name: "Calendar · top mask", type: "rect", label: "#e6d3a3", parent: "win2",
    props: { x: 0, y: 0, anchorX: 0, anchorY: 0, width: WIN.w, height: ROW0, fill: "#fff" } },
  { id: "cal-side", name: "Calendar · sidebar", type: "image", label: "#9fdcc6", parent: "win2", matte: "cal-side-mask",
    props: { src: "panel-calendar.png", width: PANEL_W, x: 0, y: 0, anchorX: 0, anchorY: 0 } },
  { id: "cal-side-mask", name: "Calendar · sidebar mask", type: "rect", label: "#e6d3a3", parent: "win2",
    props: { x: 0, y: ROW0, anchorX: 0, anchorY: 0, width: SIDEBAR, height: WIN.h - ROW0, fill: "#fff" } },
  { id: "cal-rows-bg", name: "Calendar · rows bg", type: "rect", label: "#e6d3a3", parent: "win2",
    props: { x: SIDEBAR, y: ROW0, anchorX: 0, anchorY: 0, width: WIN.w - SIDEBAR, height: WIN.h - ROW0, fill: "#0F0F12" } },
);
shell("win2");
add(
  nul("win2", "Window · Calendar (local)", "win2-pivot", { x: -PIVOT2.x, y: -PIVOT2.y }, null, "#e6d3a3"),
  nul("win2-pivot", "Window · Calendar", "camera", { ...cam(WIN2.x + PIVOT2.x, WIN2.y + PIVOT2.y), isolate: "yes", motionBlur: 0.6 }, {
    // Soft while the headline builds; sharpens as the camera pushes onto the event.
    blur: [k(WHIP_END - 4, 5, EASE), k(RACK2_END, 0)],
  }, "#e6d3a3"),
);

header("hdr2", HEADER2, HEADER2_IN, [k(RACK2, 0, EASE), k(RACK2_END, 6), k(SHARP2, 6, EASE), k(SHARP2_END, 0)]);

// =====================================================================
// PAGE 1 (RSK-01)
// =====================================================================
headline("h1", "head1", H1, [
  ["stimm", "Stimm", 0, 0, 0],
  ["l2", "auf dein Kapital ab", 0, 108, 4],
], { word: "Risiko", x: 310 + 57, w: 263, y: 0, open: 310, close: 310 + 339, closeText: "}", fr: 6 });
add(nul("head1", "Headline · RSK-01", "camera", cam(HEAD1.x, HEAD1.y), {
  blur: [k(SOFT1, 0, EASE), k(SOFT1_END, 8), k(SHARP1, 8, EASE), k(SHARP1_END, 0)],
}, "#c5b9ee"));

selection("sel1", "Selection · Position size", "win1", { x: 141.59, y: 1268.62, w: 580.41, h: 81.76 }, 13.2, 19.24, 2.475, SEL1, SEL1_END);
// ---- live numbers (patched over the export) ----
// Stop loss is dragged; size and margin are recomputed from it every half frame.
const slEase = EASES[EASE];
const live = [];
for (let fr = DRAG; fr <= DRAG_END; fr += 0.5) {
  const sl = SL_FROM + (SL_TO - SL_FROM) * slEase((fr - DRAG) / (DRAG_END - DRAG));
  const size = RISK / (ENTRY - sl);
  live.push({ t: r4(fr / FPS), sl, size, margin: (size * ENTRY) / LEV });
}
const track = (key, tol) => decimate(live.map((q) => ({ t: q.t, v: r4(q[key]) })), tol);
const flash = [k(DRAG, "#ffffff", "easeOut"), k(DRAG + 6, LIME), k(DRAG_END - 2, LIME, "easeInOut"), k(DRAG_END + 10, "#ffffff")];
const patch = (id, x, y, w, h) => ({
  id, name: "Patch", type: "rect", label: "#8c958a", parent: "win1",
  props: { x, y, anchorX: 0, anchorY: 0, width: w, height: h, fill: CARD },
});
add(
  text("val-size", "Position size", "win1", {
    ...PANEL_TYPE, text: "{counter} BTC", counter: live[0].size, counterDecimals: 4, align: "right", anchorX: 1, x: VAL_RIGHT, y: ROW_Y.size,
  }, { counter: track("size", 0.00003), fill: flash }, "#ffffff"),
  patch("val-size-patch", 470, ROW_Y.size + 2, 222, 40),
  text("val-margin", "Margin required", "win1", {
    ...PANEL_TYPE, text: "${counter}", counter: live[0].margin, counterDecimals: 0, counterGrouping: ",", align: "right", anchorX: 1, x: VAL_RIGHT - 2, y: ROW_Y.margin, // −2: matches Figma's "$3,767"
  }, { counter: track("margin", 0.2), fill: flash }, "#ffffff"),
  patch("val-margin-patch", 540, ROW_Y.margin + 2, 152, 40),
  text("val-sl", "Stop loss", "win1", {
    ...PANEL_TYPE, fontWeight: 500, lineHeight: 1.3, opacity: 0.9, text: "{counter}", counter: SL_FROM, counterDecimals: 2,
    align: "left", anchorX: 0, x: SL_TEXT.x, y: SL_TEXT.y,
  }, { counter: track("sl", 0.004) }, "#ffffff"),
  patch("val-sl-patch", SL_TEXT.x - 4, SL_TEXT.y - 2, 160, 42),
  // Input ring while the stop loss is being dragged.
  { id: "sl-ring", name: "Stop loss · active", type: "rect", label: "#D9F9B9", parent: "win1",
    props: { x: INPUT.x, y: INPUT.y, anchorX: 0, anchorY: 0, width: INPUT.w, height: INPUT.h, radius: INPUT.r, fill: "rgba(0,0,0,0)", stroke: LIME, strokeWidth: 2.5, opacity: 0 },
    keyframes: { opacity: [k(DRAG - 6, 0, "easeOut"), k(DRAG, 1), k(DRAG_END, 1, "easeInOut"), k(DRAG_END + 12, 0)] } },
);
add(
  { id: "panel-risk", name: "Panel · Risk Calculator", type: "image", label: "#9fdcc6", parent: "win1", matte: "win1-mask",
    props: { src: "panel-risk.png", width: PANEL_W, x: 0, y: 0, anchorX: 0, anchorY: 0 } },
  { id: "win1-mask", name: "Window mask", type: "rect", label: "#e6d3a3", parent: "win1",
    props: { x: 0, y: 0, anchorX: 0, anchorY: 0, width: WIN.w, height: WIN.h, radius: WIN.r, fill: "#ffffff" } },
);
shell("win1");
// Rises in out of a blur with a slight tilt around its visible center, then holds.
add(nul("win1", "Window · Risk Calculator (local)", "win1-pivot", { x: -PIVOT1.x, y: -PIVOT1.y }, null, "#e6d3a3"));
add(nul("win1-pivot", "Window · Risk Calculator", "camera", { ...cam(WIN1.x + PIVOT1.x, WIN1.y + PIVOT1.y), isolate: "yes", motionBlur: 0.6 }, {
  y: [k(RISE, 1180 + PIVOT1.y - C[1], EASE), k(RISE_END, WIN1.y + PIVOT1.y - C[1])],
  rotation: [k(RISE, -3, EASE), k(RISE_END + 4, 0)],
  scale: [k(RISE, 0.94, EASE), k(RISE_END + 4, 1)],
  blur: [k(RISE, 12, EASE), k(RISE_END - 8, 0)],
}, "#e6d3a3"));

header("hdr1", HEADER1, HEADER1_IN, [k(SOFT1, 0, EASE), k(SOFT1_END, 8), k(SHARP1, 8, EASE), k(SHARP1_END, 0)]);

// The camera null was added first; keep it at the end of the stack (it draws nothing).
layers.push(layers.shift());

const version = process.argv[2] ?? "v002";
const shot = {
  name: "RSK-01 → RSK-02 · Size your trade / Know what moves",
  note: "Staged: camera opens on the headline, travels to the panel (rack focus) as the stop loss is dragged and POSITION SIZE / MARGIN recalculate live, pushes in on the selection, then whip-pans to RSK-02 where the calendar rows cascade in and the camera pushes onto FOMC before settling on the Figma frame.",
  width: 1920, height: 1080, fps: FPS, duration: +(DURATION / FPS).toFixed(4),
  background: PAPER,
  layers,
};
const dir = new URL("../shots/rsk-01-size-your-trade/", import.meta.url);
mkdirSync(dir, { recursive: true });
writeFileSync(new URL(`${version}.json`, dir), JSON.stringify(shot, null, 2) + "\n");
console.log(`wrote shots/rsk-01-size-your-trade/${version}.json (${layers.length} layers)`);
