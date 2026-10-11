// RSK-01 → RSK-02 v003 (Trademania V3, Figma "Section 11", node 16081:27838).
// "Apple feel": calm, continuous, premium. v002's camera did too much (travel,
// push-ins, whip). Now:
//  - Camera: ONE slow dolly per beat — beat 1 settles from a slight close-up to the
//    full Figma frame over ~4s; beat 2 holds while the window moves, then drifts in
//    a hair toward the selected event. No focus jumps, no whip, no shake.
//  - The window is a shared element: it rises in on a long soft curve, then glides
//    from left to right between the beats while its panel cross-fades to the
//    Economic Calendar and the event rows settle in one after another.
//  - Headlines/header fade + rise out of a light blur (no overshoot, no bounce).
//  - Kept from v002: stop loss drag with POSITION SIZE / MARGIN recalculating live,
//    selections dragged over the rows.
//
//   node scripts/rsk-01-size-your-trade-v003.mjs [vNNN]   (default v003)

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
const RISE = 4, RISE_END = 58;             // window rises in (long soft landing)
const H1 = 14;                             // headline 1 build
const HEADER1_IN = 34;
const DRAG = 58, DRAG_END = 84;            // stop loss dragged → numbers recalculate
const SEL1 = 86, SEL1_END = 102;           // selection over POSITION SIZE

// Beat 2
const OUT = B2 - 6, OUT_END = B2 + 8;      // headline/header 1 + selection fade out (clear before the window arrives)
const GLIDE = B2 + 2, GLIDE_END = B2 + 42; // window glides right (shared element)
const SWAP = B2 + 10, SWAP_END = B2 + 28;  // panel cross-fades to the calendar
const CASCADE = B2 + 22;                   // event rows settle in (2f stagger)
const H2 = B2 + 20;                        // headline 2 build
const HEADER2_IN = B2 + 38;
const SEL2 = B2 + 56, SEL2_END = B2 + 72;  // selection over FOMC

// ---------- layout (Figma px) ----------
const WIN = { w: 744.8, h: 1797.4, r: 22.8 };
const WIN1 = { x: 118, y: -750 };
const WIN2 = { x: 1075, y: -667 };
const PANEL_W = 744.04;
// The window pivots near its visible center (its group motion blur is measured there).
const PIVOT = { x: WIN.w / 2, y: 1250 };
const HEAD1 = { x: 933, y: 309 };          // +8: engine line box sits higher than Figma's
const HEAD2 = { x: 118, y: 309 };
const HEADER1 = { x: 933, y: 561 };
const HEADER2 = { x: 118, y: 561 };

// Calendar event rows (window-local, from Figma): first row top, pitch; sidebar width.
const ROW0 = 968, ROW_PITCH = 103.62, ROWS = 8, SIDEBAR = 121.22;

// Risk panel values (window-local, from Figma; text y +2.5 for the engine's line box).
const ENTRY = 85880, RISK = 100, LEV = 19;
const SL_FROM = 85520, SL_TO = 85760;
const VAL_RIGHT = 685.52;
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

const layers = [];
const add = (...ls) => layers.push(...ls);
const nul = (id, name, parent, props, keyframes, label = "#D9F9B9") => ({
  id, name, type: "null", label, ...(parent ? { parent } : {}), props, ...(keyframes ? { keyframes } : {}),
});
const text = (id, name, parent, props, keyframes, label = "#c5b9ee") => ({
  id, name, type: "text", label, parent, props, ...(keyframes ? { keyframes } : {}),
});
const cam = (x, y) => ({ x: r2(x - C[0]), y: r2(y - C[1]) });

// ---------- camera: one slow dolly per beat ----------
const slow = EASES.figmaSlow, sine = EASES.sineInOut;
function camAt(fr) {
  if (fr <= B2) {
    // Settle from a slight close-up (favoring the headline) to the full frame.
    const e = slow(Math.min(1, fr / 116));
    const z = Math.exp(Math.log(1.075) * (1 - e));
    return { fx: 1060 + (960 - 1060) * e, fy: 520 + (540 - 520) * e, z };
  }
  // Hold through the glide, then drift in a hair toward the selected event.
  const u = Math.max(0, Math.min(1, (fr - (B2 + 36)) / (DURATION - (B2 + 36)))), e = sine(u);
  return { fx: 960 + (1000 - 960) * e, fy: 540 + (550 - 540) * e, z: Math.exp(Math.log(1.02) * e) }; // keeps the headline in frame
}
const camFrames = [];
for (let fr = 0; fr <= DURATION; fr += 0.5) camFrames.push({ fr, ...camAt(fr) });
const camTrack = (fn, tol) => decimate(camFrames.map((c) => ({ t: r4(c.fr / FPS), v: r4(fn(c)) })), tol);
add(nul("camera", "Camera", null, {}, {
  x: camTrack((c) => C[0] - c.z * (c.fx - C[0]), 0.03),
  y: camTrack((c) => C[1] - c.z * (c.fy - C[1]), 0.03),
  scale: camTrack((c) => c.z, 0.0002),
}, "#c5b9ee"));

// ---------- headline build: soft rise out of a light blur, braces open, word tracks in ----------
function headline(pre, parent, start, words, key) {
  for (const [id, word, x, y, fr] of words) {
    add(text(`${pre}-${id}`, word, parent, { ...HEAD_TYPE, text: word, x, y }, {
      y: [k(start + fr, y + 28, EASE), k(start + fr + 26, y)],
      opacity: [k(start + fr, 0, "sineOut"), k(start + fr + 16, 1)],
      blur: [k(start + fr, 10, EASE), k(start + fr + 20, 0)],
    }));
  }
  const B = start + key.fr, BE = B + 26, W = B + 4, WE = W + 26;
  const cx = key.x + key.w / 2;
  for (const [id, ch, to, from] of [["open", "{", key.open, cx - 38 - 6], ["close", key.closeText, key.close, cx + 6]]) {
    add(text(`${pre}-${id}`, ch, parent, { ...HEAD_TYPE, text: ch, x: to, y: key.y }, {
      x: [k(B, r2(from), EASE), k(BE, to)],
      opacity: [k(B, 0, "sineOut"), k(B + 10, 1)],
    }));
  }
  add(text(`${pre}-word`, key.word, parent, { ...HEAD_TYPE, text: key.word, anchorX: 0.5, x: r2(cx), y: key.y }, {
    letterSpacing: [k(W, 10, EASE), k(WE, -1.92)],
    opacity: [k(W, 0, "sineOut"), k(W + 16, 1)],
    blur: [k(W, 10, EASE), k(WE - 6, 0)],
  }));
}

// ---------- selection (dragged on from the left edge, no overshoot) ----------
function selection(pre, name, parent, box, hw, hh, sw, fr, end, outKeys) {
  const L = box.x, T = box.y, R = box.x + box.w, B = box.y + box.h;
  const handle = (id, x, y, right) => ({
    id: `${pre}-${id}`, name: `Handle ${id}`, type: "rect", label: "#D9F9B9", parent: pre,
    props: { x, y, width: hw, height: hh, fill: "#ffffff", stroke: LIME, strokeWidth: sw },
    keyframes: right
      ? { x: [k(fr, L, EASE), k(end, R)], opacity: [k(fr, 0, "sineOut"), k(fr + 6, 1)] }
      : { scale: [k(fr, 0.4, EASE), k(fr + 12, 1)], opacity: [k(fr, 0, "sineOut"), k(fr + 6, 1)] },
  });
  add(
    handle("tl", L, T, false), handle("bl", L, B, false),
    handle("tr", R, T, true), handle("br", R, B, true),
    {
      id: `${pre}-box`, name: "Selection", type: "rect", label: "#D9F9B9", parent: pre,
      props: { x: L, y: T, anchorX: 0, anchorY: 0, width: box.w, height: box.h, fill: "rgba(217,249,185,0.12)", stroke: LIME, strokeWidth: sw },
      keyframes: { width: [k(fr, 0, EASE), k(end, box.w)], opacity: [k(fr, 0, "sineOut"), k(fr + 6, 1)] },
    },
    nul(pre, name, parent, { x: 0, y: 0 }, outKeys),
  );
}

// ---------- market header ----------
const clock = [];
for (let s = 0; s * FPS < DURATION; s++) clock.push(k(s * FPS, `14:36:${String(2 + s).padStart(2, "0")}`, "hold"));
function header(pre, at, keys) {
  add(
    { id: `${pre}-market`, name: "Market · BTCUSDT", type: "image", label: "#ff6479", parent: pre,
      props: { src: "market.png", width: 502.6, x: 0, y: 10.3, anchorX: 0, anchorY: 0 } },
    text(`${pre}-clock`, "Clock", pre, { ...UI_TYPE, text: "14:36:02", x: 561.58, y: 14.5 }, { text: clock }),
    { id: `${pre}-chip`, name: "Chip · Live", type: "image", label: "#ff6479", parent: pre,
      props: { src: "chip-live.png", width: 161.42, x: 738.58, y: 0.24, anchorX: 0, anchorY: 0 } },
    nul(pre, "Header", "camera", cam(at.x, at.y), keys, "#ff6479"),
  );
}
const fadeIn = (fr, y0) => ({
  y: [k(fr, y0 + 22, EASE), k(fr + 26, y0)],
  opacity: [k(fr, 0, "sineOut"), k(fr + 16, 1)],
  blur: [k(fr, 8, EASE), k(fr + 20, 0)],
});
const fadeOut = (y0) => ({
  y: [k(OUT, y0, "figmaSlowIn"), k(OUT_END, y0 - 18)],
  opacity: [k(OUT, 1, "sineIn"), k(OUT_END, 0)],
  blur: [k(OUT, 0, "sineIn"), k(OUT_END, 8)],
});

// ---------- headlines + headers ----------
headline("h2", "head2", H2, [
  ["l1", "Erkenne, was", 0, 0, 0],
  ["kurs", "den Kurs", 0, 108, 4],
], { word: "bewegt", x: 405 + 57, w: 328, y: 108, open: 405, close: 405 + 404, closeText: "}.", fr: 8 });
add(nul("head2", "Headline · RSK-02", "camera", cam(HEAD2.x, HEAD2.y), null, "#c5b9ee"));
header("hdr2", HEADER2, fadeIn(HEADER2_IN, HEADER2.y - C[1]));

headline("h1", "head1", H1, [
  ["stimm", "Stimm", 0, 0, 0],
  ["l2", "auf dein Kapital ab", 0, 108, 4],
], { word: "Risiko", x: 310 + 57, w: 263, y: 0, open: 310, close: 310 + 339, closeText: "}", fr: 6 });
add(nul("head1", "Headline · RSK-01", "camera", cam(HEAD1.x, HEAD1.y), fadeOut(HEAD1.y - C[1]), "#c5b9ee"));
{
  const y0 = HEADER1.y - C[1], i = fadeIn(HEADER1_IN, y0), o = fadeOut(y0);
  header("hdr1", HEADER1, { y: [...i.y, ...o.y], opacity: [...i.opacity, ...o.opacity], blur: [...i.blur, ...o.blur] });
}

// ---------- window (shared element) ----------
// Selections on top.
selection("sel2", "Selection · FOMC", "win", { x: 20.6, y: 1196.01, w: 703.6, h: 62 }, 16, 16, 3, SEL2, SEL2_END);
selection("sel1", "Selection · Position size", "win", { x: 141.59, y: 1268.62, w: 580.41, h: 81.76 }, 13.2, 19.24, 2.475, SEL1, SEL1_END, {
  opacity: [k(OUT, 1, "sineIn"), k(OUT + 10, 0)],
});

// Calendar: top + sidebar cross-fade in; each event row is the same export behind
// its own strip matte, settling in one after another.
for (let i = 0; i < ROWS; i++) {
  const top = ROW0 + i * ROW_PITCH, fr = CASCADE + i * 2;
  add(
    { id: `cal-row${i}-img`, name: `Row ${i + 1}`, type: "image", label: "#9fdcc6", parent: `cal-row${i}`, matte: `cal-row${i}-mask`,
      props: { src: "panel-calendar.png", width: PANEL_W, x: 0, y: 0, anchorX: 0, anchorY: 0 } },
    { id: `cal-row${i}-mask`, name: `Row ${i + 1} mask`, type: "rect", label: "#e6d3a3", parent: `cal-row${i}`,
      props: { x: SIDEBAR, y: top, anchorX: 0, anchorY: 0, width: WIN.w - SIDEBAR, height: ROW_PITCH, fill: "#fff" } },
    nul(`cal-row${i}`, `Calendar row ${i + 1}`, "win", { x: 0, y: 0 }, {
      y: [k(fr, 30, EASE), k(fr + 24, 0)],
      opacity: [k(fr, 0, "sineOut"), k(fr + 14, 1)],
    }, "#9fdcc6"),
  );
}
const calFade = { opacity: [k(SWAP, 0, "sineInOut"), k(SWAP_END, 1)] };
add(
  { id: "cal-top", name: "Calendar · top", type: "image", label: "#9fdcc6", parent: "win", matte: "cal-top-mask", start: f(SWAP),
    props: { src: "panel-calendar.png", width: PANEL_W, x: 0, y: 0, anchorX: 0, anchorY: 0 }, keyframes: calFade },
  { id: "cal-top-mask", name: "Calendar · top mask", type: "rect", label: "#e6d3a3", parent: "win",
    props: { x: 0, y: 0, anchorX: 0, anchorY: 0, width: WIN.w, height: ROW0, fill: "#fff" } },
  { id: "cal-side", name: "Calendar · sidebar", type: "image", label: "#9fdcc6", parent: "win", matte: "cal-side-mask", start: f(SWAP),
    props: { src: "panel-calendar.png", width: PANEL_W, x: 0, y: 0, anchorX: 0, anchorY: 0 }, keyframes: calFade },
  { id: "cal-side-mask", name: "Calendar · sidebar mask", type: "rect", label: "#e6d3a3", parent: "win",
    props: { x: 0, y: ROW0, anchorX: 0, anchorY: 0, width: SIDEBAR, height: WIN.h - ROW0, fill: "#fff" } },
  { id: "cal-rows-bg", name: "Calendar · rows bg", type: "rect", label: "#e6d3a3", parent: "win", start: f(SWAP),
    props: { x: SIDEBAR, y: ROW0, anchorX: 0, anchorY: 0, width: WIN.w - SIDEBAR, height: WIN.h - ROW0, fill: "#0F0F12" }, keyframes: calFade },
);

// ---- risk panel + live numbers (patched over the export) ----
const slEase = EASES[EASE];
const live = [];
for (let fr = DRAG; fr <= DRAG_END; fr += 0.5) {
  const sl = SL_FROM + (SL_TO - SL_FROM) * slEase((fr - DRAG) / (DRAG_END - DRAG));
  const size = RISK / (ENTRY - sl);
  live.push({ t: r4(fr / FPS), sl, size, margin: (size * ENTRY) / LEV });
}
const track = (key, tol) => decimate(live.map((q) => ({ t: q.t, v: r4(q[key]) })), tol);
const flash = [k(DRAG, "#ffffff", "sineOut"), k(DRAG + 8, LIME), k(DRAG_END - 2, LIME, "sineInOut"), k(DRAG_END + 14, "#ffffff")];
const riskEnd = f(SWAP_END);
const patch = (id, x, y, w, h) => ({
  id, name: "Patch", type: "rect", label: "#8c958a", parent: "win", end: riskEnd,
  props: { x, y, anchorX: 0, anchorY: 0, width: w, height: h, fill: CARD },
});
add(
  text("val-size", "Position size", "win", {
    ...PANEL_TYPE, text: "{counter} BTC", counter: live[0].size, counterDecimals: 4, align: "right", anchorX: 1, x: VAL_RIGHT, y: ROW_Y.size,
  }, { counter: track("size", 0.00003), fill: flash }, "#ffffff"),
  patch("val-size-patch", 470, ROW_Y.size + 2, 222, 40),
  text("val-margin", "Margin required", "win", {
    ...PANEL_TYPE, text: "${counter}", counter: live[0].margin, counterDecimals: 0, counterGrouping: ",", align: "right", anchorX: 1, x: VAL_RIGHT - 2, y: ROW_Y.margin,
  }, { counter: track("margin", 0.2), fill: flash }, "#ffffff"),
  patch("val-margin-patch", 540, ROW_Y.margin + 2, 152, 40),
  text("val-sl", "Stop loss", "win", {
    ...PANEL_TYPE, fontWeight: 500, lineHeight: 1.3, opacity: 0.9, text: "{counter}", counter: SL_FROM, counterDecimals: 2,
    align: "left", anchorX: 0, x: SL_TEXT.x, y: SL_TEXT.y,
  }, { counter: track("sl", 0.004) }, "#ffffff"),
  patch("val-sl-patch", SL_TEXT.x - 4, SL_TEXT.y - 2, 160, 42),
  { id: "sl-ring", name: "Stop loss · active", type: "rect", label: "#D9F9B9", parent: "win", end: riskEnd,
    props: { x: INPUT.x, y: INPUT.y, anchorX: 0, anchorY: 0, width: INPUT.w, height: INPUT.h, radius: INPUT.r, fill: "rgba(0,0,0,0)", stroke: LIME, strokeWidth: 2.5, opacity: 0 },
    keyframes: { opacity: [k(DRAG - 8, 0, "sineOut"), k(DRAG, 1), k(DRAG_END, 1, "sineInOut"), k(DRAG_END + 14, 0)] } },
  { id: "panel-risk", name: "Panel · Risk Calculator", type: "image", label: "#9fdcc6", parent: "win", matte: "win-mask", end: riskEnd,
    props: { src: "panel-risk.png", width: PANEL_W, x: 0, y: 0, anchorX: 0, anchorY: 0 } },
  { id: "win-mask", name: "Window mask", type: "rect", label: "#e6d3a3", parent: "win",
    props: { x: 0, y: 0, anchorX: 0, anchorY: 0, width: WIN.w, height: WIN.h, radius: WIN.r, fill: "#ffffff" } },
  { id: "win-shell", name: "Window", type: "rect", label: "#e6d3a3", parent: "win",
    props: { x: 0, y: 0, anchorX: 0, anchorY: 0, width: WIN.w, height: WIN.h, radius: WIN.r,
      fill: "#020203", stroke: "rgba(10,26,29,0.12)", strokeWidth: 1.9,
      shadowColor: "rgba(10,26,29,0.08)", shadowBlur: 60.8, shadowY: 30.4 } },
  { id: "win-farshadow", name: "Window · far shadow", type: "rect", label: "#e6d3a3", parent: "win",
    props: { x: 0, y: 0, anchorX: 0, anchorY: 0, width: WIN.w, height: WIN.h, radius: WIN.r,
      fill: "#020203", shadowColor: "rgba(10,26,29,0.08)", shadowBlur: 152, shadowY: 76 } },
  nul("win", "Window (local)", "win-pivot", { x: -PIVOT.x, y: -PIVOT.y }, null, "#e6d3a3"),
  // Rises in on one long soft curve (out of a light blur), later glides to the right.
  nul("win-pivot", "Window", "camera", { ...cam(WIN1.x + PIVOT.x, WIN1.y + PIVOT.y), isolate: "yes", motionBlur: 0.35 }, {
    y: [
      k(RISE, WIN1.y + PIVOT.y - C[1] + 420, EASE), k(RISE_END, WIN1.y + PIVOT.y - C[1]),
      k(GLIDE, WIN1.y + PIVOT.y - C[1], EASE), k(GLIDE_END, WIN2.y + PIVOT.y - C[1]),
    ],
    x: [k(GLIDE, WIN1.x + PIVOT.x - C[0], EASE), k(GLIDE_END, WIN2.x + PIVOT.x - C[0])],
    opacity: [k(RISE, 0, "sineOut"), k(RISE + 16, 1)],
    blur: [k(RISE, 10, EASE), k(RISE + 30, 0)],
    scale: [k(RISE, 0.96, EASE), k(RISE_END, 1)],
  }, "#e6d3a3"),
);

// Live-number overlays end with the risk panel.
for (const l of layers) if (["val-size", "val-margin", "val-sl"].includes(l.id)) l.end = riskEnd;

layers.push(layers.shift()); // camera null to the bottom of the stack (draws nothing)

const version = process.argv[2] ?? "v003";
const shot = {
  name: "RSK-01 → RSK-02 · Size your trade / Know what moves",
  note: "Apple feel: no camera shake — one slow dolly per beat (settle to the full frame; then a hair of drift in). Window is a shared element: rises in on a long soft curve, glides right while the panel cross-fades to the calendar and the event rows settle in. Soft fades/rises, no overshoot. Live stop-loss recalculation and selections kept.",
  width: 1920, height: 1080, fps: FPS, duration: +(DURATION / FPS).toFixed(4),
  background: PAPER,
  layers,
};
const dir = new URL("../shots/rsk-01-size-your-trade/", import.meta.url);
mkdirSync(dir, { recursive: true });
writeFileSync(new URL(`${version}.json`, dir), JSON.stringify(shot, null, 2) + "\n");
console.log(`wrote shots/rsk-01-size-your-trade/${version}.json (${layers.length} layers)`);
