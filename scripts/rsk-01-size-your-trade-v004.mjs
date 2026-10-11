// RSK-01 → RSK-02 v004 (Trademania V3). Adds the platform: what the menus change.
// Figma: RSK frames in "Section 11" (16081:27838); platform frames "Risk Calculator"
// (10620:34602) and "Economic Calendar · Filtered" (12877:77920).
//
// Same calm, continuous v003 language (no camera shake, no overshoot), plus two
// "click → it shows up on the chart" payoffs, each a single slow dolly:
//  1. RSK-01 as before (rise, headline, live stop-loss recalculation, selection). A
//     cursor clicks "Copy to Order" → the zoomed menu pulls back into its real place
//     as the platform's side menu (the whole app fades in around it as one card)
//     and the ENTRY / STOP lines draw onto the chart.
//  2. The platform pushes back in to RSK-02 (menu on the right, cross-fading to the
//     Economic Calendar, rows settling in, headline, FOMC selection). The cursor flips
//     "Show on chart" on → pull back to the platform and the US / EU / UK event
//     markers drop onto the chart (the ENTRY / STOP lines from beat 1 stay).
//
// Rig: `plat` null = the platform frame (Figma px, origin top-left); its x/y/scale
// are baked per frame. The side menu is our zoomed window content (local px of the
// 2.09× side-menu instance) under `win` (scale 1/2.09), so at plat scale 2.09 it is
// 1:1 with the RSK frames, and at 0.82 it is the platform's side menu.
//
//   node scripts/rsk-01-size-your-trade-v004.mjs [vNNN]   (default v004)

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
const EASE = "figmaSlow";
const slow = EASES.figmaSlow;

// ---------- beats (frames) ----------
// Beat 1 · RSK-01
const RISE = 0, RISE_END = 50;             // window rises in
const H1 = 10, HEADER1_IN = 28;            // headline 1, header 1
const DRAG = 50, DRAG_END = 74;            // stop loss dragged → numbers recalculate
const SEL1 = 76, SEL1_END = 92;            // selection over POSITION SIZE
const CUR1 = 90, CLICK1 = 108;             // cursor travels → clicks Copy to Order
const OUT1 = 108, OUT1_END = 122;          // headline/header 1 + selection fade out
const PULL1 = 114, PULL1_END = 158;        // dolly out to the platform
const LINE_ENTRY = 150, LINE_STOP = 158;   // lines draw on (22f each)
// Beat 2 · RSK-02
const PUSH = 188, PUSH_END = 230;          // dolly back in, menu to the right
const SWAP = 196, SWAP_END = 216;          // menu cross-fades to the calendar
const CASCADE = 208;                       // event rows settle in (2f stagger)
const H2 = 218, HEADER2_IN = 234;
const SEL2 = 240, SEL2_END = 256;          // selection over FOMC
const CUR2 = 252, CLICK2 = 270;            // cursor → "Show on chart" toggle
const OUT2 = 270, OUT2_END = 284;
const PULL2 = 278, PULL2_END = 320;        // dolly out to the platform again
const MARKERS = 314;                       // markers drop (6f stagger)
const DURATION = 356;

// ---------- layout ----------
const MENU_SCALE = 2.09;                   // side-menu instance scale in the RSK frames
const WIN = { w: 744.8, h: 1797.4, full: 2495.46, r: 22.8 };
const PANEL_W = 744.04;
// Platform states: plat scale + screen position of its origin.
const Z1 = { s: MENU_SCALE, x: 118, y: -750 };      // RSK-01 (menu left)
const Z2 = { s: MENU_SCALE, x: 1075, y: -667 };     // RSK-02 (menu right)
const PS = 0.82;                                    // platform card 1920×1202 → 1574×986, centered
const P = { s: PS, x: r2((1920 - 1920 * PS) / 2), y: r2((1080 - 1202 * PS) / 2) };
const ANCHOR = [178, 597];                          // plat point the dolly is "about" (side menu center)

const HEAD1 = { x: 933, y: 309 };          // +8: engine line box sits higher than Figma's
const HEAD2 = { x: 118, y: 309 };
const HEADER1 = { x: 933, y: 561 };
const HEADER2 = { x: 118, y: 561 };

// Calendar event rows (window-local): first row top, pitch; sidebar width.
const ROW0 = 968, ROW_PITCH = 103.62, ROWS = 10, SIDEBAR = 121.22;

// Risk panel values (window-local; text y +2.5 for the engine's line box).
const ENTRY = 85880, RISK = 100, LEV = 19;
const SL_FROM = 85520, SL_TO = 85760;
const VAL_RIGHT = 685.52;
const ROW_Y = { size: 1290.61, margin: 1449.67 };
const SL_TEXT = { x: 451.44, y: 964.51 };
const INPUT = { x: 426.36, y: 939.2, w: 284.24, h: 83.6, r: 8.36 };
const COPY_BTN = { x: 155, y: 1632, w: 555, h: 82, r: 8.36 };        // "Copy to Order"
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

// ---------- platform transform (baked) ----------
// Between two states the zoom eases in log space and the anchor point travels in
// a straight line on screen — one smooth dolly.
const screenOf = (st) => [st.x + st.s * ANCHOR[0], st.y + st.s * ANCHOR[1]];
function between(a, b, u) {
  const e = slow(Math.max(0, Math.min(1, u)));
  const s = Math.exp(Math.log(a.s) + (Math.log(b.s) - Math.log(a.s)) * e);
  const [ax, ay] = screenOf(a), [bx, by] = screenOf(b);
  const sx = ax + (bx - ax) * e, sy = ay + (by - ay) * e;
  return { s, x: sx - s * ANCHOR[0], y: sy - s * ANCHOR[1] };
}
function platAt(fr) {
  if (fr <= RISE_END) {
    const e = slow(Math.max(0, (fr - RISE) / (RISE_END - RISE)));
    return { ...Z1, y: Z1.y + 420 * (1 - e) };
  }
  if (fr <= PULL1) return Z1;
  if (fr <= PULL1_END) return between(Z1, P, (fr - PULL1) / (PULL1_END - PULL1));
  if (fr <= PUSH) return P;
  if (fr <= PUSH_END) return between(P, Z2, (fr - PUSH) / (PUSH_END - PUSH));
  if (fr <= PULL2) return Z2;
  if (fr <= PULL2_END) return between(Z2, P, (fr - PULL2) / (PULL2_END - PULL2));
  return P;
}
const platFrames = [];
for (let fr = 0; fr <= DURATION; fr += 0.5) platFrames.push({ fr, ...platAt(fr) });
const platTrack = (key, tol) => decimate(platFrames.map((p) => ({ t: r4(p.fr / FPS), v: r4(p[key]) })), tol);

// ---------- headline build (soft rise, braces open, word tracks in) ----------
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
  y: [k(fr, y0 + 22, EASE), k(fr + 26, y0)],
  opacity: [k(fr, 0, "sineOut"), k(fr + 16, 1)],
  blur: [k(fr, 8, EASE), k(fr + 20, 0)],
});
const fadeOut = (a, b, y0) => ({
  y: [k(a, y0, "figmaSlowIn"), k(b, y0 - 18)],
  opacity: [k(a, 1, "sineIn"), k(b, 0)],
  blur: [k(a, 0, "sineIn"), k(b, 8)],
});
const both = (i, o) => ({ y: [...i.y, ...o.y], opacity: [...i.opacity, ...o.opacity], blur: [...i.blur, ...o.blur] });

// ---------- cursor (screen space) ----------
// macOS-style arrow, tip at the path origin.
const ARROW = "M0 0 L0 25.5 L6.6 19.4 L10.9 29.4 L14.6 27.8 L10.4 18 L19 18 Z";
function cursor(pre, from, to, start, click) {
  add(
    { id: `${pre}-ripple`, name: "Click ripple", type: "ellipse", label: "#D9F9B9",
      props: { x: to[0], y: to[1], width: 0, height: 0, fill: "rgba(0,0,0,0)", stroke: LIME, strokeWidth: 3, opacity: 0 },
      keyframes: {
        width: [k(click, 10, "expoOut"), k(click + 18, 110)], height: [k(click, 10, "expoOut"), k(click + 18, 110)],
        opacity: [k(click - 1, 0), k(click, 0.9, "sineOut"), k(click + 18, 0)],
      } },
    { id: pre, name: "Cursor", type: "path", label: "#ffffff",
      props: { d: ARROW, pathOrigin: "zero", x: from[0], y: from[1], scale: 1.7, fill: "#ffffff", stroke: "#0a1a1d", strokeWidth: 1.4,
        shadowColor: "rgba(10,26,29,0.35)", shadowBlur: 10, shadowY: 3, opacity: 0 },
      keyframes: {
        x: [k(start, from[0], EASE), k(click - 2, to[0])],
        y: [k(start, from[1], EASE), k(click - 2, to[1])],
        opacity: [k(start, 0, "sineOut"), k(start + 8, 1), k(click + 8, 1, "sineIn"), k(click + 18, 0)],
        scale: [k(click - 1, 1.7, "sineOut"), k(click + 2, 1.45, EASE), k(click + 14, 1.7)],
      } },
  );
}

// =====================================================================
// Screen-space text (on top)
// =====================================================================
cursor("cur2", [1560, 330], [1263, 60], CUR2, CLICK2);
cursor("cur1", [860, 1140], [552, 925], CUR1, CLICK1);

headline("h2", "head2", H2, [
  ["l1", "Erkenne, was", 0, 0, 0],
  ["kurs", "den Kurs", 0, 108, 4],
], { word: "bewegt", x: 405 + 57, w: 328, y: 108, open: 405, close: 405 + 404, closeText: "}.", fr: 8 });
add(nul("head2", "Headline · RSK-02", null, { x: HEAD2.x, y: HEAD2.y }, fadeOut(OUT2, OUT2_END, HEAD2.y), "#c5b9ee"));
header("hdr2", HEADER2, both(fadeIn(HEADER2_IN, HEADER2.y), fadeOut(OUT2, OUT2_END, HEADER2.y)));

headline("h1", "head1", H1, [
  ["stimm", "Stimm", 0, 0, 0],
  ["l2", "auf dein Kapital ab", 0, 108, 4],
], { word: "Risiko", x: 310 + 57, w: 263, y: 0, open: 310, close: 310 + 339, closeText: "}", fr: 6 });
add(nul("head1", "Headline · RSK-01", null, { x: HEAD1.x, y: HEAD1.y }, fadeOut(OUT1, OUT1_END, HEAD1.y), "#c5b9ee"));
header("hdr1", HEADER1, both(fadeIn(HEADER1_IN, HEADER1.y), fadeOut(OUT1, OUT1_END, HEADER1.y)));

// =====================================================================
// Side menu = the zoomed window (window-local px)
// =====================================================================
selection("sel2", "Selection · FOMC", "win", { x: 20.6, y: 1196.01, w: 703.6, h: 62 }, 16, 16, 3, SEL2, SEL2_END, {
  opacity: [k(OUT2, 1, "sineIn"), k(OUT2 + 10, 0)],
});
selection("sel1", "Selection · Position size", "win", { x: 141.59, y: 1268.62, w: 580.41, h: 81.76 }, 13.2, 19.24, 2.475, SEL1, SEL1_END, {
  opacity: [k(OUT1, 1, "sineIn"), k(OUT1 + 10, 0)],
});

// "Show on chart" toggle: drawn OFF over the export, flips ON with the click.
const calFade = { opacity: [k(SWAP, 0, "sineInOut"), k(SWAP_END, 1)] };
const calLayer = { start: f(SWAP) };
const TOG_ON = CLICK2 + 1, TOG_ON_END = CLICK2 + 13;
add(
  { id: "tog-knob", name: "Toggle · knob", type: "ellipse", label: "#D9F9B9", parent: "win", ...calLayer,
    props: { x: TOGGLE.offX, y: TOGGLE.cy, width: TOGGLE.knob * 2, height: TOGGLE.knob * 2, fill: "rgba(255,255,255,0.55)" },
    keyframes: { ...calFade, x: [k(TOG_ON, TOGGLE.offX, EASE), k(TOG_ON_END, TOGGLE.onX)], fill: [k(TOG_ON, "rgba(255,255,255,0.55)", "sineInOut"), k(TOG_ON_END - 4, LIME)] } },
  { id: "tog-pill", name: "Toggle · track", type: "rect", label: "#D9F9B9", parent: "win", ...calLayer,
    props: { x: TOGGLE.cx, y: TOGGLE.cy, width: TOGGLE.w, height: TOGGLE.h, radius: TOGGLE.h / 2, fill: "rgba(255,255,255,0.06)", stroke: "rgba(255,255,255,0.22)", strokeWidth: 2.5 },
    keyframes: { ...calFade,
      stroke: [k(TOG_ON, "rgba(255,255,255,0.22)", "sineInOut"), k(TOG_ON_END - 4, LIME)],
      fill: [k(TOG_ON, "rgba(255,255,255,0.06)", "sineInOut"), k(TOG_ON_END - 4, "rgba(217,249,185,0.10)")] } },
  { id: "tog-patch", name: "Toggle · patch", type: "rect", label: "#8c958a", parent: "win", ...calLayer,
    props: { x: 150, y: 702, anchorX: 0, anchorY: 0, width: 77, height: 48, fill: PANEL_BG }, keyframes: calFade },
);

// Calendar: top + sidebar cross-fade in; each event row settles in on its own.
for (let i = 0; i < ROWS; i++) {
  const top = ROW0 + i * ROW_PITCH, fr = CASCADE + i * 2;
  add(
    img(`cal-row${i}-img`, `Row ${i + 1}`, `cal-row${i}`, "panel-calendar.png", 0, 0, PANEL_W, { layer: { matte: `cal-row${i}-mask` } }),
    { id: `cal-row${i}-mask`, name: `Row ${i + 1} mask`, type: "rect", label: "#e6d3a3", parent: `cal-row${i}`,
      props: { x: SIDEBAR, y: top, anchorX: 0, anchorY: 0, width: WIN.w - SIDEBAR, height: ROW_PITCH, fill: "#fff" } },
    nul(`cal-row${i}`, `Calendar row ${i + 1}`, "win", { x: 0, y: 0 }, {
      y: [k(fr, 30, EASE), k(fr + 24, 0)],
      opacity: [k(fr, 0, "sineOut"), k(fr + 14, 1)],
    }, "#9fdcc6"),
  );
}
add(
  img("cal-top", "Calendar · top", "win", "panel-calendar.png", 0, 0, PANEL_W, { layer: { matte: "cal-top-mask", ...calLayer } }, calFade),
  { id: "cal-top-mask", name: "Calendar · top mask", type: "rect", label: "#e6d3a3", parent: "win",
    props: { x: 0, y: 0, anchorX: 0, anchorY: 0, width: WIN.w, height: ROW0, fill: "#fff" } },
  img("cal-side", "Calendar · sidebar", "win", "panel-calendar.png", 0, 0, PANEL_W, { layer: { matte: "cal-side-mask", ...calLayer } }, calFade),
  { id: "cal-side-mask", name: "Calendar · sidebar mask", type: "rect", label: "#e6d3a3", parent: "win",
    props: { x: 0, y: ROW0, anchorX: 0, anchorY: 0, width: SIDEBAR, height: WIN.full - ROW0, fill: "#fff" } },
  { id: "cal-rows-bg", name: "Calendar · rows bg", type: "rect", label: "#e6d3a3", parent: "win", ...calLayer,
    props: { x: SIDEBAR, y: ROW0, anchorX: 0, anchorY: 0, width: WIN.w - SIDEBAR, height: WIN.full - ROW0, fill: PANEL_BG }, keyframes: calFade },
);

// Risk panel + live numbers (patched over the export) + Copy to Order press.
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
  { id: "copy-press", name: "Copy to Order · press", type: "rect", label: "#D9F9B9", parent: "win", end: riskEnd,
    props: { x: COPY_BTN.x, y: COPY_BTN.y, anchorX: 0, anchorY: 0, width: COPY_BTN.w, height: COPY_BTN.h, radius: COPY_BTN.r, fill: "#ffffff", opacity: 0 },
    keyframes: { opacity: [k(CLICK1 - 1, 0), k(CLICK1 + 2, 0.32, "sineOut"), k(CLICK1 + 16, 0)] } },
  { ...text("val-size", "Position size", "win", {
    ...PANEL_TYPE, text: "{counter} BTC", counter: live[0].size, counterDecimals: 4, align: "right", anchorX: 1, x: VAL_RIGHT, y: ROW_Y.size,
  }, { counter: track("size", 0.00003), fill: flash }, "#ffffff"), end: riskEnd },
  patch("val-size-patch", 470, ROW_Y.size + 2, 222, 40),
  { ...text("val-margin", "Margin required", "win", {
    ...PANEL_TYPE, text: "${counter}", counter: live[0].margin, counterDecimals: 0, counterGrouping: ",", align: "right", anchorX: 1, x: VAL_RIGHT - 2, y: ROW_Y.margin,
  }, { counter: track("margin", 0.2), fill: flash }, "#ffffff"), end: riskEnd },
  patch("val-margin-patch", 540, ROW_Y.margin + 2, 152, 40),
  { ...text("val-sl", "Stop loss", "win", {
    ...PANEL_TYPE, fontWeight: 500, lineHeight: 1.3, opacity: 0.9, text: "{counter}", counter: SL_FROM, counterDecimals: 2,
    align: "left", anchorX: 0, x: SL_TEXT.x, y: SL_TEXT.y,
  }, { counter: track("sl", 0.004) }, "#ffffff"), end: riskEnd },
  patch("val-sl-patch", SL_TEXT.x - 4, SL_TEXT.y - 2, 160, 42),
  { id: "sl-ring", name: "Stop loss · active", type: "rect", label: "#D9F9B9", parent: "win", end: riskEnd,
    props: { x: INPUT.x, y: INPUT.y, anchorX: 0, anchorY: 0, width: INPUT.w, height: INPUT.h, radius: INPUT.r, fill: "rgba(0,0,0,0)", stroke: LIME, strokeWidth: 2.5, opacity: 0 },
    keyframes: { opacity: [k(DRAG - 8, 0, "sineOut"), k(DRAG, 1), k(DRAG_END, 1, "sineInOut"), k(DRAG_END + 14, 0)] } },
  img("panel-risk", "Panel · Risk Calculator", "win", "panel-risk.png", 0, 0, PANEL_W, { layer: { matte: "win-mask", end: riskEnd } }),
);
// Window shape: grows to the full side-menu height while it docks into the platform.
const fullH = [
  k(PULL1, WIN.h, EASE), k(PULL1_END, WIN.full),
  k(PUSH, WIN.full, EASE), k(PUSH_END, WIN.h),
  k(PULL2, WIN.h, EASE), k(PULL2_END, WIN.full),
];
add(
  { id: "win-mask", name: "Window mask", type: "rect", label: "#e6d3a3", parent: "win",
    props: { x: 0, y: 0, anchorX: 0, anchorY: 0, width: WIN.w, height: WIN.h, radius: WIN.r, fill: "#ffffff" }, keyframes: { height: fullH } },
  { id: "win-shell", name: "Window", type: "rect", label: "#e6d3a3", parent: "win",
    props: { x: 0, y: 0, anchorX: 0, anchorY: 0, width: WIN.w, height: WIN.h, radius: WIN.r,
      fill: "#020203", stroke: "rgba(10,26,29,0.12)", strokeWidth: 1.9,
      shadowColor: "rgba(10,26,29,0.08)", shadowBlur: 60.8, shadowY: 30.4 }, keyframes: { height: fullH } },
  { id: "win-farshadow", name: "Window · far shadow", type: "rect", label: "#e6d3a3", parent: "win",
    props: { x: 0, y: 0, anchorX: 0, anchorY: 0, width: WIN.w, height: WIN.h, radius: WIN.r,
      fill: "#020203", shadowColor: "rgba(10,26,29,0.08)", shadowBlur: 152, shadowY: 76 }, keyframes: { height: fullH } },
  // Side menu: window-local px → platform px (1 / 2.09). Rises in out of a light blur.
  nul("win", "Side menu (window)", "plat", { x: 0, y: 0, scale: r4(1 / MENU_SCALE), isolate: "yes" }, {
    opacity: [k(RISE, 0, "sineOut"), k(RISE + 16, 1)],
    blur: [k(RISE, 10, EASE), k(RISE + 30, 0)],
  }, "#e6d3a3"),
);

// =====================================================================
// Platform around the side menu (platform px) — fades in as one card
// =====================================================================
// Markers: the line drops from the tag down to the pointer.
const MARKER_LIST = [["us", "US 06:05", 0], ["eu", "EU 06:10", 233], ["uk", "UK 06:25", 930]];
MARKER_LIST.forEach(([id, name, mx], i) => {
  const fr = MARKERS + i * 6, x = 662 + mx, y = 211;
  add(
    img(`mk-${id}`, `Marker · ${name}`, "app", `marker-${id}.png`, x, y, 25, { layer: { matte: `mk-${id}-mask` }, props: { blend: "screen" } }, {
      opacity: [k(fr, 0, "sineOut"), k(fr + 8, 1)],
    }),
    { id: `mk-${id}-mask`, name: `Marker ${id} mask`, type: "rect", label: "#e6d3a3", parent: "app",
      props: { x: x - 4, y, anchorX: 0, anchorY: 0, width: 33, height: 0, fill: "#fff" },
      keyframes: { height: [k(fr, 18, EASE), k(fr + 24, 452)] } },
  );
});
// The line/marker exports have a black frame fill: screen-blend them over the dark chart.
// ENTRY / STOP lines draw on left → right (label first).
for (const [id, name, src, y, fr] of [["entry", "ENTRY line", "line-entry.png", 404, LINE_ENTRY], ["stop", "STOP line", "line-stop.png", 473, LINE_STOP]]) {
  add(
    img(`ln-${id}`, name, "app", src, 439, y, 1397, { layer: { matte: `ln-${id}-mask` }, props: { blend: "screen" } }, {
      opacity: [k(fr, 0, "sineOut"), k(fr + 6, 1)],
    }),
    { id: `ln-${id}-mask`, name: `${name} mask`, type: "rect", label: "#e6d3a3", parent: "app",
      props: { x: 439, y: y - 2, anchorX: 0, anchorY: 0, width: 0, height: 26, fill: "#fff" },
      keyframes: { width: [k(fr, 60, EASE), k(fr + 26, 1397)] } },
  );
}
add(
  img("app-menu", "Platform · tabs", "app", "plat-menu.png", 360, 0, 1560),
  img("app-asset", "Platform · asset bar", "app", "plat-asset.png", 360, 60, 1560),
  img("app-chart", "Platform · chart", "app", "plat-chart.png", 360, 119, 1560),
  img("app-journal", "Platform · journal", "app", "plat-journal.png", 360, 763, 1560),
  { id: "app-card", name: "Platform · card", type: "rect", label: "#e6d3a3", parent: "app",
    props: { x: 0, y: 0, anchorX: 0, anchorY: 0, width: 1920, height: 1202, radius: 24, fill: "#020203",
      shadowColor: "rgba(10,26,29,0.16)", shadowBlur: 120, shadowY: 50 } },
  nul("app", "Platform", "plat", { x: 0, y: 0, isolate: "yes" }, {
    opacity: [
      k(PULL1 + 6, 0, "sineInOut"), k(PULL1 + 30, 1),
      k(PUSH, 1, "sineInOut"), k(PUSH + 20, 0),
      k(PULL2 + 6, 0, "sineInOut"), k(PULL2 + 30, 1),
    ],
  }, "#e6d3a3"),
  nul("plat", "Platform rig", null, { x: Z1.x, y: Z1.y, scale: Z1.s }, {
    x: platTrack("x", 0.03), y: platTrack("y", 0.03), scale: platTrack("s", 0.0003),
  }, "#c5b9ee"),
);

const version = process.argv[2] ?? "v004";
const shot = {
  name: "RSK-01 → RSK-02 · Size your trade / Know what moves",
  note: "Adds the platform: click Copy to Order → the menu pulls back into the full platform and ENTRY/STOP draw on the chart; push back in to the calendar (RSK-02); click Show on chart → pull back and the US/EU/UK event markers drop onto the chart. Same calm v003 motion, 11.9s.",
  width: 1920, height: 1080, fps: FPS, duration: +(DURATION / FPS).toFixed(4),
  background: PAPER,
  layers,
};
const dir = new URL("../shots/rsk-01-size-your-trade/", import.meta.url);
mkdirSync(dir, { recursive: true });
writeFileSync(new URL(`${version}.json`, dir), JSON.stringify(shot, null, 2) + "\n");
console.log(`wrote shots/rsk-01-size-your-trade/${version}.json (${layers.length} layers)`);
