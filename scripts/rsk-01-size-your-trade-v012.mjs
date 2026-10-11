// RSK-01 → RSK-02 v012 (Trademania V3). v011 + a second event that tanks the price:
// after the FOMC breakout, price chops at the highs while the chart auto-scrolls (live),
// the ECB marker (EU 06:10) drops, and the ECB candle dumps it back to the entry with
// red follow-through (red glow, price tag turns red). Then a pull back to the full
// platform: both events, up and down, in one frame. 14s.
//
// v011: v010 with the chart visibly live in beat 1:
// six candles form and close while the platform is on screen (v010: barely one), with
// livelier tick paths and a steady (non-blinking) column shine.
//
// v010: v009 with realistic live candles: each
// candle forms along one tick path (random walk pinned to its open/close); wicks are
// the running extremes and only ever extend, and closed candles keep exactly the
// wicks they traded — no more jittering last candle next to a frozen history.
//
// v009: v008 with a TradingView "Long Position"
// drawing instead of Figma's ENTRY/STOP lines (green target zone / red stop zone,
// Target · Entry · R:R · Stop labels; drawn by `eventChart`), slow live ticks with the
// forming candle's column glowing green/red, and an 18f push-in on the drawing.
// Beat 2 is 12f later; the drawing stays on the chart (the breakout runs through
// its target). 11.2s.
//
// v008: v007 + the FOMC breakout: the platform
// chart is rebuilt live (`eventChart` generator over the Figma image's plot area,
// time axis 5:40–6:10, prices calibrated to the ENTRY/STOP lines). After "Show on
// chart", the FOMC marker drops on 06:05 near the live edge, candles keep forming
// up to it, the event candle rips up with follow-through, and the camera pushes in
// (18f) with a warm glow on the tag and the price tag turning green. 10.8s.
//
// v007: v006 with the selection boxes fitted to
// their rows (no more spill over the sidebar / card edges).
//
// v006: v005 with the house 3D hand cursor
// (hand-cursor.png, as in brn-07 / ses scenes) instead of the vector arrow.
//
// v005: same story as v004, Apple-snappy timing.
// Figma: RSK frames in "Section 11" (16081:27838); platform frames "Risk Calculator"
// (10620:34602) and "Economic Calendar · Filtered" (12877:77920).
//
// What changed vs v004 ("too dynamic"):
//  - Fast-attack curves everywhere: `appleOut` (iOS sheet: fast start, smooth
//    settle, no overshoot) for things arriving, `appleInOut` for things that travel
//    (cursor, dolly, stop-loss drag). No more slow-start springs.
//  - Short moves: press/toggle 6–8f, selection 10f, cursor 12f, text 14f, draw-ons
//    14–16f, rise 20f, pull-backs 24f (v004: 40–50f).
//  - One thing at a time, with holds: click → beat → pull back → hold → lines draw → hold.
//  - No sweep into RSK-02: a 10f cross-dissolve from the platform to the calendar
//    composition (two rigs). The two pull-backs stay as the payoffs.
//  - Text: 12px rise out of a light blur, quick staggers; braces open in 10f.
//  9.4s (v004: 11.9s).
//
// Rigs: `plat1` / `plat2` = the platform frame (Figma px, origin top-left); x/y/scale
// baked per frame. Each side menu is the zoomed window content (local px of the 2.09×
// side-menu instance) under `win1` / `win2` (scale 1/2.09).
//
//   node scripts/rsk-01-size-your-trade-v012.mjs [vNNN]   (default v012)

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
const CARD = "rgb(27,27,30)";            // order-preview card + input fill
const PANEL_BG = "#0F0F12";
const IN = "appleOut";                    // arrivals
const MOVE = "appleInOut";                // travel
const moveFn = EASES[MOVE];

// ---------- beats (frames) ----------
// Beat 1 · RSK-01
const RISE = 0, RISE_END = 20;             // window rises in
const H1 = 6, HEADER1_IN = 18;             // headline 1, header 1
const DRAG = 36, DRAG_END = 54;            // stop loss dragged → numbers recalculate
const SEL1 = 58, SEL1_END = 68;            // selection over POSITION SIZE
const CUR1 = 76, CLICK1 = 90;              // cursor → Copy to Order
const OUT1 = 92, OUT1_END = 100;           // headline/header 1 + selection out
const PULL1 = 94, PULL1_END = 118;         // pull back to the platform
const POS = 122, POS_END = 142;            // TradingView Long Position draws on (20f)
const PUSH1 = 138, PUSH1_END = 156;        // push in on the drawing (18f)
// Beat 2 · RSK-02 (all +12f vs v008 for the position drawing)
const DISSOLVE = 168, DISSOLVE_END = 178;  // platform → calendar composition
const CASCADE = 170;                       // event rows settle in (1f stagger)
const H2 = 176, HEADER2_IN = 188;
const SEL2 = 198, SEL2_END = 208;          // selection over FOMC
const CUR2 = 210, CLICK2 = 224;            // cursor → "Show on chart"
const OUT2 = 226, OUT2_END = 234;
const PULL2 = 228, PULL2_END = 252;        // pull back to the platform again
const MARKERS = 256;                       // FOMC marker drops (14f)
// FOMC breakout: candles form live up to the marker, then the event candle rips up.
const LIVE = 248;                          // candles start ticking (from CANDLES_FROM)
const EVENT = 286;                         // event candle opens on the FOMC line
const EVENT_END = 294;                     // event candle done (8f)
const FOLLOW_END = 318;                    // follow-through candles (4f each)
const PUSH3 = 286, PUSH3_END = 304;        // snappy push-in on the breakout
// ECB dump: price chops at the highs while the chart auto-scrolls, the EU marker drops
// on 06:10, the event candle tanks it back to the entry, red follow-through.
const MARKER2 = 322;                       // EU marker drops (14f)
const EVENT2 = 339;                        // ECB candle opens (consolidation: 3f per candle)
const EVENT2_END = 347;                    // ECB candle done (8f)
const FOLLOW2_END = 367;                   // red follow-through (4f each)
const PULL3 = 372, PULL3_END = 394;        // pull back: both events in one frame
const DURATION = 420;

// ---------- layout ----------
const MENU_SCALE = 2.09;                   // side-menu instance scale in the RSK frames
const WIN = { w: 744.8, h: 1797.4, full: 2495.46, r: 22.8 };
const PANEL_W = 744.04;
const Z1 = { s: MENU_SCALE, x: 118, y: -750 };      // RSK-01 (menu left)
const Z2 = { s: MENU_SCALE, x: 1075, y: -667 };     // RSK-02 (menu right)
const PS = 0.82;                                    // platform card 1920×1202 → 1574×986, centered
const P = { s: PS, x: r2((1920 - 1920 * PS) / 2), y: r2((1080 - 1202 * PS) / 2) };
const ANCHOR = [178, 597];                          // plat point the dolly is "about" (side menu center)
// Event chart: the plot box of the Figma "Chart" instance (plot + price axis + time
// row) in platform px; FOMC 06:05 sits on the 6th time label (axis 5:40 … 6:10).
const PLOT = { x: 426, y: 211, w: 1482, h: 480 };
const EVENT_INDEX = 68, CANDLES = 75;               // event candle → local x 34.9 + 68 × 16.84 = 1180 (6:05)
const EVENT2_INDEX = 82, CANDLES_TOTAL = 88;        // ECB candle ≈ 6:10; series end
const SCROLL_FROM = CANDLES;                        // live edge stays at candle 75's x once it scrolls
const ECB_X = PLOT.x + 16 + 6 * 232.5;              // 6:10 grid line (platform px)
const CANDLES_FROM = 57;                            // candles already on the chart when beat 2 pulls back
// Price action: lively walk around the ENTRY/STOP band (axis is calibrated to those
// lines: 0.297 px per $), then a +$700 breakout that tops out near 59,250 (headroom
// under the plot top).
const CHART = { seed: 11, base: 58360, vol: 78, spike: 700, spike2: -700 }; // spike2: ECB dump back to ~entry
const FOMC_X = PLOT.x + 16 + 5 * 232.5;             // 6:05 grid line (platform px)
const BREAKOUT = [FOMC_X, 361];                     // what the push-in is "about"
// Push-in framing: zoom 1.3 with the card's right edge (price axis) still in view.
const QS = 1.3, QF = [1185, 415];
// TradingView Long Position (generator-local x; prices): starts a few candles back from
// the live edge so its labels clear the FOMC line (6:05) in beat 2.
const POS_TOOL = { posX: 900, posW: 290, posEntry: 58640, posStop: 58408, posTarget: 59104, posRisk: 100 };
const POS_CENTER = [PLOT.x + POS_TOOL.posX + POS_TOOL.posW / 2, 379];
// Beat-1 push-in framing: zoom 1.2, the drawing right of center, card edge in view.
const Q1S = 1.2, Q1F = [1115, 450];
const Q1 = { s: Q1S, x: r2(960 - Q1S * Q1F[0]), y: r2(540 - Q1S * Q1F[1]) };
const Q = { s: QS, x: r2(960 - QS * QF[0]), y: r2(540 - QS * QF[1]) };

const HEAD1 = { x: 933, y: 309 };          // +8: engine line box sits higher than Figma's
const HEAD2 = { x: 118, y: 309 };
const HEADER1 = { x: 933, y: 561 };
const HEADER2 = { x: 118, y: 561 };

const ROW0 = 968, ROW_PITCH = 103.62, ROWS = 10, SIDEBAR = 121.22;
// Selection boxes fitted to their rows (window-local, from Figma): FOMC row
// x 121.22 w 622.82 y 1177.29 h 99.44 (minus the scrollbar); POSITION SIZE row
// x 179.74 w 505.78 y 1271.39 h 79.53, padded 12px inside the card.
const FOMC_BOX = { x: 129.2, y: 1181.3, w: 592, h: 91.4 };
const SIZE_BOX = { x: 167.74, y: 1273.4, w: 529.78, h: 75.5 };

const ENTRY = 85880, RISK = 100, LEV = 19;
const SL_FROM = 85520, SL_TO = 85760;
const VAL_RIGHT = 685.52;
const ROW_Y = { size: 1290.61, margin: 1449.67 };
const SL_TEXT = { x: 451.44, y: 964.51 };
const INPUT = { x: 426.36, y: 939.2, w: 284.24, h: 83.6, r: 8.36 };
const COPY_BTN = { x: 155, y: 1632, w: 555, h: 82, r: 8.36 };
const TOGGLE = { cx: 188.1, cy: 725.6, w: 66.25, h: 36.25, knob: 12.5, offX: 173.75, onX: 202.5 };

const HEAD_TYPE = {
  fontFamily: "Geist", fontWeight: 500, fontSize: 96, letterSpacing: -1.92,
  lineHeight: 1.08, align: "left", fill: INK, anchorX: 0, anchorY: 0,
};
const UI_TYPE = {
  fontFamily: "Geist", fontWeight: 500, fontSize: 36.4, letterSpacing: -0.364,
  lineHeight: 1.29, align: "left", fill: INK, anchorX: 0, anchorY: 0,
};
const PANEL_TYPE = { fontFamily: "Geist", fontWeight: 400, fontSize: 29.26, lineHeight: 1.5, fill: "#ffffff", anchorY: 0 };

const layers = [];
const add = (...ls) => layers.push(...ls);
const nul = (id, name, parent, props, keyframes, label = "#D9F9B9") => ({
  id, name, type: "null", label, ...(parent ? { parent } : {}), props, ...(keyframes ? { keyframes } : {}),
});
const text = (id, name, parent, props, keyframes, label = "#c5b9ee") => ({
  id, name, type: "text", label, ...(parent ? { parent } : {}), props, ...(keyframes ? { keyframes } : {}),
});
const img = (id, name, parent, src, x, y, w, extra = {}, keyframes) => ({
  id, name, type: "image", label: "#9fdcc6", parent, ...extra.layer,
  props: { src, width: w, x, y, anchorX: 0, anchorY: 0, ...extra.props }, ...(keyframes ? { keyframes } : {}),
});
const rect = (id, name, parent, props, keyframes, extra = {}) => ({
  id, name, type: "rect", label: "#e6d3a3", parent, ...extra, props: { anchorX: 0, anchorY: 0, ...props }, ...(keyframes ? { keyframes } : {}),
});

// ---------- platform transform (baked) ----------
// Between two states the zoom eases in log space and the anchor point travels in a
// straight line on screen — one decisive dolly.
const screenOf = (st) => [st.x + st.s * ANCHOR[0], st.y + st.s * ANCHOR[1]];
function between(a, b, u, anchor = ANCHOR) {
  const e = moveFn(Math.max(0, Math.min(1, u)));
  const s = Math.exp(Math.log(a.s) + (Math.log(b.s) - Math.log(a.s)) * e);
  const on = (st) => [st.x + st.s * anchor[0], st.y + st.s * anchor[1]];
  const [ax, ay] = on(a), [bx, by] = on(b);
  return { s, x: ax + (bx - ax) * e - s * anchor[0], y: ay + (by - ay) * e - s * anchor[1] };
}
const rig1At = (fr) => {
  if (fr <= RISE_END) return { ...Z1, y: Z1.y + 160 * (1 - EASES[IN](Math.max(0, (fr - RISE) / (RISE_END - RISE)))) };
  if (fr <= PULL1) return Z1;
  if (fr <= PULL1_END) return between(Z1, P, (fr - PULL1) / (PULL1_END - PULL1));
  if (fr <= PUSH1) return P;
  if (fr <= PUSH1_END) return between(P, Q1, (fr - PUSH1) / (PUSH1_END - PUSH1), POS_CENTER);
  return Q1;
};
const rig2At = (fr) => {
  if (fr <= PULL2) return Z2;
  if (fr <= PULL2_END) return between(Z2, P, (fr - PULL2) / (PULL2_END - PULL2));
  if (fr <= PUSH3) return P;
  if (fr <= PUSH3_END) return between(P, Q, (fr - PUSH3) / (PUSH3_END - PUSH3), BREAKOUT);
  if (fr <= PULL3) return Q;
  if (fr <= PULL3_END) return between(Q, P, (fr - PULL3) / (PULL3_END - PULL3), BREAKOUT);
  return P;
};
function rigTracks(at) {
  const fr = [];
  for (let i = 0; i <= DURATION; i += 0.5) fr.push({ i, ...at(i) });
  const tr = (key, tol) => decimate(fr.map((p) => ({ t: r4(p.i / FPS), v: r4(p[key]) })), tol);
  return { x: tr("x", 0.03), y: tr("y", 0.03), scale: tr("s", 0.0003) };
}

// ---------- headline build (snappy) ----------
function headline(pre, parent, start, words, key) {
  for (const [id, word, x, y, fr] of words) {
    add(text(`${pre}-${id}`, word, parent, { ...HEAD_TYPE, text: word, x, y }, {
      y: [k(start + fr, y + 12, IN), k(start + fr + 14, y)],
      opacity: [k(start + fr, 0, IN), k(start + fr + 8, 1)],
      blur: [k(start + fr, 4, IN), k(start + fr + 10, 0)],
    }));
  }
  const B = start + key.fr, BE = B + 10, W = B + 2, WE = W + 12;
  const cx = key.x + key.w / 2;
  for (const [id, ch, to, from] of [["open", "{", key.open, cx - 38 - 6], ["close", key.closeText, key.close, cx + 6]]) {
    add(text(`${pre}-${id}`, ch, parent, { ...HEAD_TYPE, text: ch, x: to, y: key.y }, {
      x: [k(B, r2(from), IN), k(BE, to)],
      opacity: [k(B, 0, IN), k(B + 5, 1)],
    }));
  }
  add(text(`${pre}-word`, key.word, parent, { ...HEAD_TYPE, text: key.word, anchorX: 0.5, x: r2(cx), y: key.y }, {
    letterSpacing: [k(W, 6, IN), k(WE, -1.92)],
    opacity: [k(W, 0, IN), k(W + 8, 1)],
    blur: [k(W, 4, IN), k(W + 10, 0)],
  }));
}

// ---------- selection (dragged from the left edge) ----------
function selection(pre, name, parent, box, hw, hh, sw, fr, end, outKeys) {
  const L = box.x, T = box.y, R = box.x + box.w, B = box.y + box.h;
  const handle = (id, x, y, right) => ({
    id: `${pre}-${id}`, name: `Handle ${id}`, type: "rect", label: "#D9F9B9", parent: pre,
    props: { x, y, width: hw, height: hh, fill: "#ffffff", stroke: LIME, strokeWidth: sw },
    keyframes: right
      ? { x: [k(fr, L, IN), k(end, R)], opacity: [k(fr, 0, IN), k(fr + 3, 1)] }
      : { scale: [k(fr, 0.6, IN), k(fr + 8, 1)], opacity: [k(fr, 0, IN), k(fr + 3, 1)] },
  });
  add(
    handle("tl", L, T, false), handle("bl", L, B, false),
    handle("tr", R, T, true), handle("br", R, B, true),
    {
      id: `${pre}-box`, name: "Selection", type: "rect", label: "#D9F9B9", parent: pre,
      props: { x: L, y: T, anchorX: 0, anchorY: 0, width: box.w, height: box.h, fill: "rgba(217,249,185,0.12)", stroke: LIME, strokeWidth: sw },
      keyframes: { width: [k(fr, 0, IN), k(end, box.w)], opacity: [k(fr, 0, IN), k(fr + 3, 1)] },
    },
    nul(pre, name, parent, { x: 0, y: 0 }, outKeys),
  );
}

// ---------- header ----------
const clock = [];
for (let s = 0; s * FPS < DURATION; s++) clock.push(k(s * FPS, `14:36:${String(2 + s).padStart(2, "0")}`, "hold"));
function header(pre, at, keys) {
  add(
    { id: `${pre}-market`, name: "Market · BTCUSDT", type: "image", label: "#ff6479", parent: pre,
      props: { src: "market.png", width: 502.6, x: 0, y: 10.3, anchorX: 0, anchorY: 0 } },
    text(`${pre}-clock`, "Clock", pre, { ...UI_TYPE, text: "14:36:02", x: 561.58, y: 14.5 }, { text: clock }),
    { id: `${pre}-chip`, name: "Chip · Live", type: "image", label: "#ff6479", parent: pre,
      props: { src: "chip-live.png", width: 161.42, x: 738.58, y: 0.24, anchorX: 0, anchorY: 0 } },
    nul(pre, "Header", null, { x: at.x, y: at.y }, keys, "#ff6479"),
  );
}
const fadeIn = (fr, y0) => ({
  y: [k(fr, y0 + 10, IN), k(fr + 14, y0)],
  opacity: [k(fr, 0, IN), k(fr + 8, 1)],
  blur: [k(fr, 4, IN), k(fr + 10, 0)],
});
const fadeOut = (a, b, y0) => ({
  y: [k(a, y0, "quadIn"), k(b, y0 - 10)],
  opacity: [k(a, 1, "quadIn"), k(b, 0)],
  blur: [k(a, 0, "quadIn"), k(b, 4)],
});
const both = (i, o) => ({ y: [...i.y, ...o.y], opacity: [...i.opacity, ...o.opacity], blur: [...i.blur, ...o.blur] });

// ---------- cursor (screen space) ----------
// The house 3D hand cursor (same asset as brn-07 / ses scenes), anchored at the
// fingertip. Glides in from bottom-right with a slight tilt, presses (scale + shadow
// tighten), then eases away.
function cursor(pre, to, start, click) {
  const from = [to[0] + 200, to[1] + 260];
  add(
    { id: `${pre}-ripple`, name: "Click ripple", type: "ellipse", label: "#D9F9B9",
      props: { x: to[0], y: to[1], width: 0, height: 0, fill: "rgba(0,0,0,0)", stroke: LIME, strokeWidth: 2.5, opacity: 0 },
      keyframes: {
        width: [k(click, 8, IN), k(click + 12, 76)], height: [k(click, 8, IN), k(click + 12, 76)],
        opacity: [k(click - 1, 0), k(click, 0.9, "quadOut"), k(click + 12, 0)],
      } },
    { id: pre, name: "Hand cursor", type: "image", label: "#e6d3a3",
      props: { src: "hand-cursor.png", width: 160, anchorX: 0.32, anchorY: 0.16, x: from[0], y: from[1], opacity: 0,
        shadowColor: "rgba(0,0,0,0.30)", shadowBlur: 24, shadowY: 12 },
      keyframes: {
        x: [k(start, from[0], IN), k(start + 14, to[0]), k(click + 4, to[0], "quadIn"), k(click + 12, to[0] + 50)],
        y: [k(start, from[1], IN), k(start + 14, to[1]), k(click + 4, to[1], "quadIn"), k(click + 12, to[1] + 64)],
        rotation: [k(start, 10, IN), k(start + 16, 0)],
        opacity: [k(start, 0, IN), k(start + 5, 1), k(click + 4, 1, "quadIn"), k(click + 12, 0)], // gone before the pull-back gets going
        scale: [k(click - 3, 1, "quadIn"), k(click, 0.88, IN), k(click + 10, 0.95)],
        shadowY: [k(click - 3, 12, "quadIn"), k(click, 4, IN), k(click + 10, 8)],
      } },
  );
}

// ---------- shared pieces ----------
const shell = (pre, parent, hKeys) => {
  const h = hKeys ? { height: hKeys } : null;
  add(
    rect(`${pre}-shell`, "Window", parent, { x: 0, y: 0, width: WIN.w, height: WIN.h, radius: WIN.r,
      fill: "#020203", stroke: "rgba(10,26,29,0.12)", strokeWidth: 1.9,
      shadowColor: "rgba(10,26,29,0.08)", shadowBlur: 60.8, shadowY: 30.4 }, h),
    rect(`${pre}-farshadow`, "Window · far shadow", parent, { x: 0, y: 0, width: WIN.w, height: WIN.h, radius: WIN.r,
      fill: "#020203", shadowColor: "rgba(10,26,29,0.08)", shadowBlur: 152, shadowY: 76 }, h),
  );
};
function platform(pre, parent, { markers, chart }) {
  // Markers: the line drops from the tag down to the pointer.
  if (markers) {
    // FOMC (US 06:05) and ECB (EU 06:10) — near the live edge; each one moves the price.
    // Markers ride a group that scrolls with the chart.
    [["us", "US 06:05 · FOMC", FOMC_X - 12.5, markers], ["eu", "EU 06:10 · ECB", ECB_X - 12.5, MARKER2]].forEach(([id, name, x, fr]) => {
      const y = 211;
      add(
        img(`${pre}-mk-${id}`, `Marker · ${name}`, `${pre}-mk`, `marker-${id}.png`, x, y, 25, { layer: { matte: `${pre}-mk-${id}-mask` }, props: { blend: "screen" } }, {
          opacity: [k(fr, 0, IN), k(fr + 4, 1)],
        }),
        rect(`${pre}-mk-${id}-mask`, `Marker ${id} mask`, `${pre}-mk`, { x: x - 4, y, width: 33, height: 0, fill: "#fff" }, {
          height: [k(fr, 18, IN), k(fr + 14, 452)],
        }),
      );
    });
    // Each event fires: a warm glow blooms on its tag.
    for (const [id, x, at] of [["us", FOMC_X, EVENT], ["eu", ECB_X, EVENT2]]) {
      add({ id: `${pre}-mk-glow-${id}`, name: `${id.toUpperCase()} · glow`, type: "ellipse", label: "#e6d3a3", parent: `${pre}-mk`,
        props: { x, y: 219, width: 90, height: 90, fill: "#FFB947", blur: 22, blend: "screen", opacity: 0 },
        keyframes: { opacity: [k(at - 1, 0), k(at + 2, 0.85, IN), k(at + 26, 0.35)], scale: [k(at, 0.4, IN), k(at + 12, 1)] } });
    }
    add(nul(`${pre}-mk`, "Event markers (scroll)", parent, { x: 0, y: 0 }, { x: chart.scroll.map((q) => ({ ...q, v: r2(-q.v * 16.84) })) }, "#e6d3a3"));
  }
  add(
    img(`${pre}-menu`, "Platform · tabs", parent, "plat-menu.png", 360, 0, 1560),
    img(`${pre}-asset`, "Platform · asset bar", parent, "plat-asset.png", 360, 60, 1560),
    { id: `${pre}-candles`, name: "Chart · candles (live)", type: "generator", label: "#9fdcc6", parent,
      props: { generator: "eventChart", x: PLOT.x, y: PLOT.y, anchorX: 0, anchorY: 0, width: PLOT.w, height: PLOT.h,
        count: CANDLES_TOTAL, eventAt: EVENT_INDEX, eventAt2: EVENT2_INDEX, spike2: CHART.spike2, follow: CANDLES - EVENT_INDEX - 1, ...POS_TOOL, seed: CHART.seed, base: CHART.base, volatility: CHART.vol, spike: CHART.spike, progress: chart.progress[0].v },
      keyframes: chart },
    img(`${pre}-chart`, "Platform · chart", parent, "plat-chart.png", 360, 119, 1560),
    img(`${pre}-journal`, "Platform · journal", parent, "plat-journal.png", 360, 763, 1560),
    rect(`${pre}-card`, "Platform · card", parent, { x: 0, y: 0, width: 1920, height: 1202, radius: 24, fill: "#020203",
      shadowColor: "rgba(10,26,29,0.16)", shadowBlur: 120, shadowY: 50 }),
  );
}

// =====================================================================
// Screen-space: cursors, headlines, headers (top of the stack)
// =====================================================================
cursor("cur2", [1263, 60], CUR2 - 2, CLICK2);
cursor("cur1", [552, 925], CUR1 - 2, CLICK1);

headline("h2", "head2", H2, [
  ["l1", "Erkenne, was", 0, 0, 0],
  ["kurs", "den Kurs", 0, 108, 3],
], { word: "bewegt", x: 405 + 57, w: 328, y: 108, open: 405, close: 405 + 404, closeText: "}.", fr: 6 });
add(nul("head2", "Headline · RSK-02", null, { x: HEAD2.x, y: HEAD2.y }, fadeOut(OUT2, OUT2_END, HEAD2.y), "#c5b9ee"));
header("hdr2", HEADER2, both(fadeIn(HEADER2_IN, HEADER2.y), fadeOut(OUT2, OUT2_END, HEADER2.y)));

headline("h1", "head1", H1, [
  ["stimm", "Stimm", 0, 0, 0],
  ["l2", "auf dein Kapital ab", 0, 108, 3],
], { word: "Risiko", x: 310 + 57, w: 263, y: 0, open: 310, close: 310 + 339, closeText: "}", fr: 5 });
add(nul("head1", "Headline · RSK-01", null, { x: HEAD1.x, y: HEAD1.y }, fadeOut(OUT1, OUT1_END, HEAD1.y), "#c5b9ee"));
header("hdr1", HEADER1, both(fadeIn(HEADER1_IN, HEADER1.y), fadeOut(OUT1, OUT1_END, HEADER1.y)));

// =====================================================================
// RIG 2 · Economic Calendar (dissolves in over rig 1)
// =====================================================================
// Fitted to the FOMC row (Figma's box spans the whole menu, sidebar included).
selection("sel2", "Selection · FOMC", "win2", FOMC_BOX, 16, 16, 3, SEL2, SEL2_END, {
  opacity: [k(OUT2, 1, "quadIn"), k(OUT2 + 6, 0)],
});
// "Show on chart" toggle: drawn OFF over the export, flips ON with the click.
const TOG_ON = CLICK2 + 1, TOG_ON_END = CLICK2 + 9;
add(
  { id: "tog-knob", name: "Toggle · knob", type: "ellipse", label: "#D9F9B9", parent: "win2",
    props: { x: TOGGLE.offX, y: TOGGLE.cy, width: TOGGLE.knob * 2, height: TOGGLE.knob * 2, fill: "rgba(255,255,255,0.55)" },
    keyframes: { x: [k(TOG_ON, TOGGLE.offX, IN), k(TOG_ON_END, TOGGLE.onX)], fill: [k(TOG_ON, "rgba(255,255,255,0.55)", IN), k(TOG_ON_END - 2, LIME)] } },
  rect("tog-pill", "Toggle · track", "win2", { anchorX: 0.5, anchorY: 0.5, x: TOGGLE.cx, y: TOGGLE.cy, width: TOGGLE.w, height: TOGGLE.h, radius: TOGGLE.h / 2,
    fill: "rgba(255,255,255,0.06)", stroke: "rgba(255,255,255,0.22)", strokeWidth: 2.5 }, {
    stroke: [k(TOG_ON, "rgba(255,255,255,0.22)", IN), k(TOG_ON_END - 2, LIME)],
    fill: [k(TOG_ON, "rgba(255,255,255,0.06)", IN), k(TOG_ON_END - 2, "rgba(217,249,185,0.10)")],
  }),
  rect("tog-patch", "Toggle · patch", "win2", { x: 150, y: 702, width: 77, height: 48, fill: PANEL_BG }),
);
// Event rows settle in right after the dissolve (1f stagger).
for (let i = 0; i < ROWS; i++) {
  const top = ROW0 + i * ROW_PITCH, fr = CASCADE + i;
  add(
    img(`cal-row${i}-img`, `Row ${i + 1}`, `cal-row${i}`, "panel-calendar.png", 0, 0, PANEL_W, { layer: { matte: `cal-row${i}-mask` } }),
    rect(`cal-row${i}-mask`, `Row ${i + 1} mask`, `cal-row${i}`, { x: SIDEBAR, y: top, width: WIN.w - SIDEBAR, height: ROW_PITCH, fill: "#fff" }),
    nul(`cal-row${i}`, `Calendar row ${i + 1}`, "win2", { x: 0, y: 0 }, {
      y: [k(fr, 16, IN), k(fr + 12, 0)],
      opacity: [k(fr, 0, IN), k(fr + 8, 1)],
    }, "#9fdcc6"),
  );
}
add(
  img("cal-top", "Calendar · top", "win2", "panel-calendar.png", 0, 0, PANEL_W, { layer: { matte: "cal-top-mask" } }),
  rect("cal-top-mask", "Calendar · top mask", "win2", { x: 0, y: 0, width: WIN.w, height: ROW0, fill: "#fff" }),
  img("cal-side", "Calendar · sidebar", "win2", "panel-calendar.png", 0, 0, PANEL_W, { layer: { matte: "cal-side-mask" } }),
  rect("cal-side-mask", "Calendar · sidebar mask", "win2", { x: 0, y: ROW0, width: SIDEBAR, height: WIN.full - ROW0, fill: "#fff" }),
  rect("cal-rows-bg", "Calendar · rows bg", "win2", { x: SIDEBAR, y: ROW0, width: WIN.w - SIDEBAR, height: WIN.full - ROW0, fill: PANEL_BG }),
);
shell("w2", "win2", [k(PULL2, WIN.h, MOVE), k(PULL2_END, WIN.full)]);
add(nul("win2", "Side menu · Calendar", "plat2", { x: 0, y: 0, scale: r4(1 / MENU_SCALE), isolate: "yes" }, {
  opacity: [k(DISSOLVE, 0, "quadInOut"), k(DISSOLVE_END, 1)],
}, "#e6d3a3"));
// Candles tick live up to the FOMC line, the event candle rips, follow-through runs.
platform("p2", "app2", { markers: MARKERS, chart: {
  progress: [
    k(LIVE, CANDLES_FROM, "linear"), k(EVENT, EVENT_INDEX),
    k(EVENT, EVENT_INDEX, "linear"), k(EVENT_END, EVENT_INDEX + 1),
    k(EVENT_END, EVENT_INDEX + 1, "linear"), k(FOLLOW_END, CANDLES),
    k(FOLLOW_END, CANDLES, "linear"), k(EVENT2, EVENT2_INDEX),
    k(EVENT2, EVENT2_INDEX, "linear"), k(EVENT2_END, EVENT2_INDEX + 1),
    k(EVENT2_END, EVENT2_INDEX + 1, "linear"), k(FOLLOW2_END, CANDLES_TOTAL),
  ],
  // Auto-scroll = candles beyond SCROLL_FROM (same segments as progress).
  scroll: [
    k(FOLLOW_END, 0, "linear"), k(EVENT2, EVENT2_INDEX - SCROLL_FROM),
    k(EVENT2, EVENT2_INDEX - SCROLL_FROM, "linear"), k(EVENT2_END, EVENT2_INDEX + 1 - SCROLL_FROM),
    k(EVENT2_END, EVENT2_INDEX + 1 - SCROLL_FROM, "linear"), k(FOLLOW2_END, CANDLES_TOTAL - SCROLL_FROM),
  ],
  hot: [k(EVENT, 0, IN), k(EVENT + 10, 1)],
  hot2: [k(EVENT2, 0, IN), k(EVENT2 + 10, 1)],
  pos: [k(0, 1)], ticks: [k(0, 0)], glow: [k(0, 1)],   // fast pre-event candles glide along their tick paths
} });   // the position drawing stays from beat 1
add(
  nul("app2", "Platform · calendar", "plat2", { x: 0, y: 0, isolate: "yes" }, {
    opacity: [k(PULL2 + 4, 0, "quadInOut"), k(PULL2 + 16, 1)],
  }, "#e6d3a3"),
  nul("plat2", "Platform rig · beat 2", null, { x: Z2.x, y: Z2.y, scale: Z2.s }, rigTracks(rig2At), "#c5b9ee"),
  // Paper that dissolves in over rig 1 (everything above it belongs to beat 2).
  rect("dissolve", "Dissolve · paper", null, { x: 0, y: 0, width: 1920, height: 1080, fill: PAPER }, {
    opacity: [k(DISSOLVE, 0, "quadInOut"), k(DISSOLVE_END, 1)],
  }, { start: f(DISSOLVE) }),
);

// =====================================================================
// RIG 1 · Risk Calculator
// =====================================================================
// Fitted to the POSITION SIZE row inside the Order preview card.
selection("sel1", "Selection · Position size", "win1", SIZE_BOX, 13.2, 19.24, 2.475, SEL1, SEL1_END, {
  opacity: [k(OUT1, 1, "quadIn"), k(OUT1 + 6, 0)],
});
const live = [];
for (let fr = DRAG; fr <= DRAG_END; fr += 0.5) {
  const sl = SL_FROM + (SL_TO - SL_FROM) * moveFn((fr - DRAG) / (DRAG_END - DRAG));
  const size = RISK / (ENTRY - sl);
  live.push({ t: r4(fr / FPS), sl, size, margin: (size * ENTRY) / LEV });
}
const track = (key, tol) => decimate(live.map((q) => ({ t: q.t, v: r4(q[key]) })), tol);
const flash = [k(DRAG, "#ffffff", IN), k(DRAG + 4, LIME), k(DRAG_END, LIME, "quadInOut"), k(DRAG_END + 10, "#ffffff")];
const patch = (id, x, y, w, h) => rect(id, "Patch", "win1", { x, y, width: w, height: h, fill: CARD });
add(
  rect("copy-press", "Copy to Order · press", "win1", { x: COPY_BTN.x, y: COPY_BTN.y, width: COPY_BTN.w, height: COPY_BTN.h, radius: COPY_BTN.r, fill: "#ffffff", opacity: 0 }, {
    opacity: [k(CLICK1 - 1, 0), k(CLICK1 + 1, 0.32, "quadOut"), k(CLICK1 + 10, 0)],
  }),
  text("val-size", "Position size", "win1", {
    ...PANEL_TYPE, text: "{counter} BTC", counter: live[0].size, counterDecimals: 4, align: "right", anchorX: 1, x: VAL_RIGHT, y: ROW_Y.size,
  }, { counter: track("size", 0.00003), fill: flash }, "#ffffff"),
  patch("val-size-patch", 470, ROW_Y.size + 2, 222, 40),
  text("val-margin", "Margin required", "win1", {
    ...PANEL_TYPE, text: "${counter}", counter: live[0].margin, counterDecimals: 0, counterGrouping: ",", align: "right", anchorX: 1, x: VAL_RIGHT - 2, y: ROW_Y.margin,
  }, { counter: track("margin", 0.2), fill: flash }, "#ffffff"),
  patch("val-margin-patch", 540, ROW_Y.margin + 2, 152, 40),
  text("val-sl", "Stop loss", "win1", {
    ...PANEL_TYPE, fontWeight: 500, lineHeight: 1.3, opacity: 0.9, text: "{counter}", counter: SL_FROM, counterDecimals: 2,
    align: "left", anchorX: 0, x: SL_TEXT.x, y: SL_TEXT.y,
  }, { counter: track("sl", 0.004) }, "#ffffff"),
  patch("val-sl-patch", SL_TEXT.x - 4, SL_TEXT.y - 2, 160, 42),
  rect("sl-ring", "Stop loss · active", "win1", { x: INPUT.x, y: INPUT.y, width: INPUT.w, height: INPUT.h, radius: INPUT.r, fill: "rgba(0,0,0,0)", stroke: LIME, strokeWidth: 2.5, opacity: 0 }, {
    opacity: [k(DRAG - 4, 0, IN), k(DRAG, 1), k(DRAG_END, 1, "quadIn"), k(DRAG_END + 8, 0)],
  }),
  img("panel-risk", "Panel · Risk Calculator", "win1", "panel-risk.png", 0, 0, PANEL_W, { layer: { matte: "win1-mask" } }),
);
const grow1 = [k(PULL1, WIN.h, MOVE), k(PULL1_END, WIN.full)];
add(rect("win1-mask", "Window mask", "win1", { x: 0, y: 0, width: WIN.w, height: WIN.h, radius: WIN.r, fill: "#ffffff" }, { height: grow1 }));
shell("w1", "win1", grow1);
add(nul("win1", "Side menu · Risk", "plat1", { x: 0, y: 0, scale: r4(1 / MENU_SCALE), isolate: "yes" }, {
  opacity: [k(RISE, 0, IN), k(RISE + 8, 1)],
  blur: [k(RISE, 6, IN), k(RISE + 12, 0)],
}, "#e6d3a3"));
// Beat 1: the same chart, a couple of candles still forming (it's live).
// Beat 1: the chart visibly runs — six new candles (~14f each, 8 price updates per
// candle along its tick path) from the pull-back to the dissolve, ending where beat 2
// picks up; the live column shines green/red; the Long Position draws on after Copy to Order.
platform("p1", "app1", { chart: {
  progress: [k(PULL1, CANDLES_FROM - 6, "linear"), k(DISSOLVE_END, CANDLES_FROM)], scroll: [k(0, 0)],
  ticks: [k(0, 8)], glow: [k(0, 1)],
  pos: [k(POS, 0, "linear"), k(POS_END, 1)],
} });
add(
  nul("app1", "Platform · risk", "plat1", { x: 0, y: 0, isolate: "yes" }, {
    opacity: [k(PULL1 + 4, 0, "quadInOut"), k(PULL1 + 16, 1)],
  }, "#e6d3a3"),
  nul("plat1", "Platform rig · beat 1", null, { x: Z1.x, y: Z1.y, scale: Z1.s }, rigTracks(rig1At), "#c5b9ee"),
);
// Rig 1 is fully covered once the dissolve lands.
const coveredAt = f(DISSOLVE_END);
const rig1 = new Set(["plat1"]);
for (let changed = true; changed;) {
  changed = false;
  for (const l of layers) if (l.parent && rig1.has(l.parent) && !rig1.has(l.id)) { rig1.add(l.id); changed = true; }
}
for (const l of layers) if (rig1.has(l.id) && l.type !== "null" && !layers.some((m) => m.matte === l.id)) l.end = coveredAt;

const version = process.argv[2] ?? "v012";
const shot = {
  name: "RSK-01 → RSK-02 · Size your trade / Know what moves",
  note: "Second event: after the FOMC breakout the chart auto-scrolls, the ECB marker (EU 06:10) drops and the ECB candle dumps the price back to the entry (red glow, red price tag); pull back to show both events. 14s.",
  width: 1920, height: 1080, fps: FPS, duration: +(DURATION / FPS).toFixed(4),
  background: PAPER,
  layers,
};
const dir = new URL("../shots/rsk-01-size-your-trade/", import.meta.url);
mkdirSync(dir, { recursive: true });
writeFileSync(new URL(`${version}.json`, dir), JSON.stringify(shot, null, 2) + "\n");
console.log(`wrote shots/rsk-01-size-your-trade/${version}.json (${layers.length} layers)`);
