// SES-09 → OBK-01 (Trademania V3, Figma "Motion test 3", node 15834:30534):
// Live window builds in, camera pushes into the newest candles → swoosh out to the
// whole canvas while Replay, timeline and props arrive one by one → swoosh into
// Replay, hand cursor hits play, camera pushes in and rides the playhead → one
// swoosh straight to "Orderbuch { Heatmap }" → slot-machine roulette.
//
// One camera over one canvas (the SES-10 layout, 1:1 shot px). Window PNGs are
// 2.5× exports of the SES-10 nodes with the paper keyed out and the header +
// caption erased; those are rebuilt as layers so every piece can enter on its own.
// Charts are the `productChart` generator; props are tile + photo on separate
// parallax planes.
//
//   node scripts/ses-09-live-replay.mjs [vNNN]   (default v015)

import { mkdirSync, writeFileSync } from "node:fs";

const FPS = 30;
const f = (n) => +(n / FPS).toFixed(4); // frame → seconds
const k = (frame, v, ease) => (ease ? { t: f(frame), v, ease } : { t: f(frame), v });
const r2 = (v) => +v.toFixed(2);

const INK = "#0a1a1d";
const LIME = "#D9F9B9";
const TILE = "#e2ead9";
const PAPER = "#F4F9EE";
const PLAYER_BG = "#0b0c0d";
const SWOOSH = [0.75, 0, 0.15, 1]; // slow start, whip, soft landing
const PUSH = [0.45, 0, 0.2, 1];
const playEase = [0.3, 0, 0.7, 1];

// ---------- beats (frames) ----------
const CURSOR_IN = 124, CURSOR_AT = 144, PRESS = 148, RELEASE = 153;
const PLAY_START = 152, PLAY_END = 222;
const FINAL_FROM = 222, FINAL_TO = 246; // last swoosh → Orderbuch
const SPIN = 228, LAND = 290, SETTLE = 298;
// OBK-02 · Money: dive into the landed Heatmap thumb, cut (hidden behind the
// full-screen heat) to the money scene zoomed 5× on the wall, pull back, build.
const DIVE_FROM = 326, CUT = 344, PULL_TO = 372;
// OBK-03 → OBK-07: punch into the wall (3 steps), pull back through the heatmap,
// the selection hands off to the candle.
const HOLD2_END = 470;
// OBK-07a/b: push into the green candle (sliced into $4 levels), then it opens
// into the footprint delta ladder.
// One motion: from the Money layout straight into the green candle (2.5s, Figma Slow).
// Everything else (wall lets go, band extends, heat dims, candle gets selected,
// HUD) happens while the camera is travelling.
const CANDLE_ZOOM_FROM = HOLD2_END, CANDLE_ZOOM_TO = HOLD2_END + 75;
const DIVE_TO = CANDLE_ZOOM_TO;
const WHIP_FROM = HOLD2_END + 8, WHIP_TO = HOLD2_END + 48; // handover window inside the move
const FLAT_FROM = CANDLE_ZOOM_TO + 40;
const DURATION = FLAT_FROM + 110;

// ---------- grid ----------
// The grid is part of the canvas (it moves with the camera). Lines sit where the
// Figma frames have them: columns every 160 from 86.5, rows every 154.29 from 77.64.
const GRID = { x0: 86.5, dx: 160, y0: 77.6429, dy: 154.2857 };
// End framing for OBK-01 at zoom 1: focus offsets that are whole grid steps from
// (960, 540), so the screen grid lands exactly on the Figma grid; far enough right
// that the stage is off screen.
const GRID_END = { x: 960 + 12 * GRID.dx, y: 540 + GRID.dy };

// Dive pivot: the hot spot of the landed Heatmap thumb (OBK-01 screen coords),
// where it sits at the end of the roulette push.
const OBK_PUSH = 1.035;                       // OBK-01 / camera zoom when the dive starts
const BLOB = { x: 1077 - 960, y: 526 - 540 }; // blob relative to the OBK-01 group origin
const DIVE_PIVOT = { x: 960 + OBK_PUSH * BLOB.x, y: 540 + OBK_PUSH * BLOB.y };
const DIVE_SCALE = 24;
// OBK-02 lands on the grid one screen further right; the wall is the pull-back pivot.
const MONEY_END = { x: GRID_END.x + 12 * GRID.dx, y: GRID_END.y };
const WALL = { x: 1356, y: 970 };             // wall selection center (OBK-02 screen)
const MONEY_SCALE = 5;
// Camera focus that keeps a canvas point fixed under the dive pivot while zooming.
const diveFocus = (() => {
  const cB = { x: GRID_END.x + (DIVE_PIVOT.x - 960) / OBK_PUSH, y: GRID_END.y + (DIVE_PIVOT.y - 540) / OBK_PUSH };
  return { x: r2(cB.x - (DIVE_PIVOT.x - 960) / DIVE_SCALE), y: r2(cB.y - (DIVE_PIVOT.y - 540) / DIVE_SCALE) };
})();
// At the cut the wall sits where the dive pivot was; pull-back carries it home.
const cutFocus = (() => {
  const cW = { x: MONEY_END.x + (WALL.x - 960), y: MONEY_END.y + (WALL.y - 540) };
  return { x: r2(cW.x - (DIVE_PIVOT.x - 960) / MONEY_SCALE), y: r2(cW.y - (DIVE_PIVOT.y - 540) / MONEY_SCALE) };
})();
const EXPO_OUT = [0.16, 1, 0.3, 1];

// ---------- wall zoom (OBK-03 … OBK-07) ----------
// Each row: frame, zoom of the OBK-02 layout, where the wall center sits on screen,
// ease leaving the row. Framings measured from the Figma frames (selection width / 96).
const ZIN = [0.7, 0, 0.18, 1], ZOUT = [0.6, 0, 0.25, 1];
// One motion into the wall (OBK-03 → 05), Figma's "Slow" spring curve.
const DIVE_EASE = "figmaSlow";
// OBK-07a framing: 20 px per $ (= 11.76 × the 1.7 px/$ chart), the green candle's
// center (85,890.5) at (1180, 537.6) — lines up with Figma's 85,908 … 85,872 slices.
const PX_PER_USD = 20, CANDLE_S = PX_PER_USD / 1.7;
const priceY = (p) => 613 + (86069.7 - p) * 1.7; // OBK-02 layout y of a price
const CANDLE_C = { x: 1407.2, y: priceY(85890.5) };
const CANDLE_SCREEN = { x: 1180, y: 537.6 };
const CANDLE_W = {
  x: r2(CANDLE_SCREEN.x - CANDLE_S * (CANDLE_C.x - WALL.x)),
  y: r2(CANDLE_SCREEN.y - CANDLE_S * (CANDLE_C.y - WALL.y)),
};
const screenY = (p) => r2(CANDLE_SCREEN.y + CANDLE_S * (priceY(p) - CANDLE_C.y)); // in the candle shot
const WHIP = [0.8, 0, 0.12, 1];   // hard start, long glide
const PUSH_IN = [0.7, 0, 0.1, 1];
const ZK = [
  [HOLD2_END, 1.035, 960 + 1.035 * (WALL.x - 960), 540 + 1.035 * (WALL.y - 540), DIVE_EASE],
  [CANDLE_ZOOM_TO, CANDLE_S, CANDLE_W.x, CANDLE_W.y, "linear"], // lands on the candle (OBK-07a)
  [DURATION, CANDLE_S, CANDLE_W.x, CANDLE_W.y],
];
// Motion blur on the pull-backs; the dive gets its own gentle blur peak at full speed.
const ZOOM_PUNCHES = ZK.flatMap((r, i) => (Array.isArray(r[4]) && ZK[i + 1][0] - r[0] <= 30 ? [[r[0], ZK[i + 1][0]]] : []));
const DIVE_BLUR = [k(HOLD2_END, 0, "quadIn"), k(HOLD2_END + 14, 4, "quadOut"), k(HOLD2_END + 50, 0)]; // blur rides the speed
// Screen position of an OBK-02 point c while zooming: W + s · (c − WALL).
const zk = (fn) => ZK.map(([fr, sc, wx, wy, e]) => k(fr, r2(fn(sc, wx, wy)), e));

// ---------- camera ----------
// camera (screen center, zoom, handheld sway) → pan (x/y = −focus) → canvas.
// Screen position = center + zoom · (canvas − focus). Each channel has its own
// keys so the camera can push in while it pans along with the replay playhead.
const ZOOM = [
  [0, 1.62, "sineOut"],       // Live window builds in
  [22, 1.7, PUSH],            // push toward the newest candles
  [54, 2.3, SWOOSH],          // ── swoosh out
  [72, 0.97, "linear"],       // whole canvas; Replay + props arrive
  [108, 1.0, SWOOSH],         // ── swoosh in
  [126, 1.5, "linear"],       // Replay, cursor taps play
  [150, 1.52, [0.5, 0, 0.25, 1]],
  [174, 2.1, "linear"],       // pushed into the replay chart
  [FINAL_FROM, 2.2, SWOOSH],  // ── swoosh to Orderbuch (pulls back to 1:1 so the grid matches Figma)
  [FINAL_TO, 1, "sineInOut"],
  [DIVE_FROM, OBK_PUSH, "expoIn"], // slow push through the roulette hold, then dive
  [CUT - 1, DIVE_SCALE, "hold"],
  [CUT, MONEY_SCALE, EXPO_OUT],    // cut: money scene, pulled back from the wall
  [PULL_TO, 1, "sineInOut"],
  ...ZK.map(([fr, sc, , , e]) => [fr, sc, e]),
];
const FOCUS_X = [
  [0, 486, "sineOut"], [22, 486, PUSH], [54, 620, SWOOSH], [72, 935, "linear"], [108, 960, SWOOSH],
  [126, 1432, "linear"],
  [PLAY_START, 1430, playEase],  // rides the playhead…
  [FINAL_FROM, 1540, SWOOSH],    // …to here
  [FINAL_TO, GRID_END.x, "linear"], [DIVE_FROM, GRID_END.x, "expoIn"], [CUT - 1, diveFocus.x, "hold"],
  [CUT, cutFocus.x, EXPO_OUT], [PULL_TO, MONEY_END.x, "linear"],
  ...ZK.map(([fr, sc, wx, , e]) => [fr, MONEY_END.x + (WALL.x - 960) - (wx - 960) / sc, e]),
];
const FOCUS_Y = [
  [0, 372, "sineOut"], [22, 368, PUSH], [54, 300, SWOOSH], [72, 486, "linear"], [108, 492, SWOOSH],
  [126, 700, "linear"], [150, 698, [0.5, 0, 0.25, 1]], [174, 640, "linear"], [FINAL_FROM, 636, SWOOSH],
  [FINAL_TO, GRID_END.y, "linear"], [DIVE_FROM, GRID_END.y, "expoIn"], [CUT - 1, diveFocus.y, "hold"],
  [CUT, cutFocus.y, EXPO_OUT], [PULL_TO, MONEY_END.y, "linear"],
  ...ZK.map(([fr, sc, , wy, e]) => [fr, MONEY_END.y + (WALL.y - 540) - (wy - 540) / sc, e]),
];
const keys = (table, map = (v) => v) => table.map(([fr, v, e]) => k(fr, +map(v).toFixed(4), e));
const SWOOSHES = [[54, 72], [108, 126], [FINAL_FROM, FINAL_TO]];
// Dive + pull-back blur peaks at the cut, where the two scenes swap.
const cutBlur = (peak = 12) => [k(DIVE_FROM, 0, "expoIn"), k(CUT - 1, peak, "hold"), k(CUT, peak, EXPO_OUT), k(PULL_TO - 6, 0)];
const swooshBlur = ([a, b], peak = 5) => [k(a, 0, "quadIn"), k(Math.round(a + (b - a) * 0.45), peak, "quadOut"), k(b, 0)];
// Handheld: a slow, uneven sway (never quite still).
const SWAY = [];
for (let fr = 0, i = 0; fr <= FINAL_FROM; fr += 26 + (i % 3) * 6, i++) SWAY.push(k(fr, [0.28, -0.22, 0.18, -0.3][i % 4], "sineInOut"));

// Value of a keyed channel at frame `fr` (linear between keys is fine for parallax refs).
const REF = { zoom: 0.97, x: 935, y: 486 }; // the wide shot: props sit exactly where Figma has them
const DEPTH = { tile: 0.05, object: 0.14 };
// Parallax offsets follow the focus keys (same frames, same eases).
const parallaxX = (x, p) => FOCUS_X.map(([fr, v, e]) => k(fr, r2(x - p * (v - REF.x)), e));
const parallaxY = (y, p) => FOCUS_Y.map(([fr, v, e]) => k(fr, r2(y - p * (v - REF.y)), e));
const parallaxS = (p) => ZOOM.map(([fr, v, e]) => k(fr, +(1 + p * (v - REF.zoom)).toFixed(4), e));

// ---------- canvas measurements (SES-10 layout) ----------
const LIVE_C = { x: 31 + 909.2 / 2, y: 79 + 606.8 / 2 };          // live-window.png center
const REPLAY_C = { x: 971.6 + 922 / 2, y: 379 + 618.4 / 2 };      // replay-window.png center
const REPLAY_OFFSET = [1044 - 97, 379 - 79];                      // Replay window = Live window + this
const CHART = { x: 288.6, y: 224.6, w: 580, h: 159.6 };           // chart plot + axis in the Live window
const TOOLTIP = { x: 531.6, y: 384.6, w: 49, h: 10 };             // static crosshair tooltip (covered)
const TIMELINE = { x: 468.66, y: 731, w: 488.4, h: 111.6 };
const VHS = { tile: [1471.8, -23.77, 289.2, 278.35], photo: [1617, 101, 244] };
const WATCH = { tile: [253, 856, 144.6, 139.18], photo: [325.3, 925.6, 115.68] };

// Headers (erased from the window PNGs, rebuilt here).
const HEAD = {
  live: { market: [97, 85.3], clock: [655.8, 88], chip: [769.9, 79, 104.3, 48.9] },
  replay: { market: [1044, 385.3], clock: [1529, 388], chip: [1675.1, 379, 146.1, 48.9] },
};
const LIVE_PIXEL = { x: 785.3, y: 96.6, s: 13.77 };

// Replay player (pulled out).
const PLAYER = { x: 1044 - 27.11, y: 379 + 468.47 };
const PROGRESS = { x: PLAYER.x + 205.1, y: PLAYER.y + 28, w: 248.9, h: 10.845 };
const PLAY_BTN = { x: PLAYER.x + 19 + 124.7, y: PLAYER.y + 15.4, s: 36.15 };
const KERZEN = { x: PLAYER.x + 673.8, y: PLAYER.y + 22.9 };
const P_FROM = 0.25, P_TO = 268 / 380;
const MINI = { x: 1255.6, y: 707, w: 409.2, h: 1.44, textX: 1767.6, textY: 708 };

// ---------- type ----------
const DISPLAY = {
  fontFamily: "Geist", fontWeight: 500, fontSize: 104, letterSpacing: -2.08,
  lineHeight: 1.08, align: "left", fill: INK, anchorX: 0, anchorY: 0,
};
const CAPTION = {
  fontFamily: "Geist", fontWeight: 500, fontSize: 43.379, letterSpacing: -0.6507,
  lineHeight: 1.291, align: "left", fill: INK, anchorX: 0, anchorY: 0,
};
const HEADER_TEXT = {
  fontFamily: "Geist", fontWeight: 500, fontSize: 23.497, letterSpacing: -0.235, lineHeight: 1.319,
  align: "left", fill: INK, anchorX: 0, anchorY: 0,
};

// Grid path covering everything the camera sees (canvas coords, drawn from its own origin).
const GB = { x0: -300, x1: 4200, y0: -400, y1: 1400 };
const gridCols = [], gridRows = [];
for (let x = GRID.x0 - 3 * GRID.dx; x <= GB.x1; x += GRID.dx) if (x >= GB.x0) gridCols.push(x);
for (let y = GRID.y0 - 3 * GRID.dy; y <= GB.y1; y += GRID.dy) if (y >= GB.y0) gridRows.push(y);
const GRID_D = [
  ...gridCols.map((x) => `M${r2(x - GB.x0)} 0V${GB.y1 - GB.y0}`),
  ...gridRows.map((y) => `M0 ${r2(y - GB.y0)}H${GB.x1 - GB.x0}`),
].join("");

// ---------- roulette ----------
const SLOT_Y = 472;
const REEL_X = 1004, WORD_DX = 161;
const ROW_H = 162;
const SPIN_ROWS = 14;
const KIND = {
  Heatmap: "heatmap", Footprint: "footprint", Volumen: "volume", Delta: "delta", VWAP: "vwap",
  Spread: "spread", Profil: "profile", Tape: "tape", DOM: "dom",
};
const CYCLE = ["DOM", "VWAP", "Tape", "Delta", "Spread", "Profil", "Footprint", "Volumen", "Heatmap"];
const BELOW = ["Footprint", "Volumen", "Delta"];
const reelRows = [];
for (let n = -(SPIN_ROWS + 3); n <= BELOW.length; n++) {
  const word = n === 0 ? "Heatmap" : n > 0 ? BELOW[n - 1] : CYCLE[(-n - 1) % CYCLE.length];
  reelRows.push({ n, word, y: n * ROW_H });
}
const MASK = { x: 980, y: 40, w: 780, h: 980 };
const at = (y) => +((y - MASK.y) / MASK.h).toFixed(4);
const MASK_STOPS = [
  ["rgba(0,0,0,0)", 40], ["rgba(0,0,0,0.12)", 204], ["rgba(0,0,0,0.3)", 366], ["rgba(0,0,0,1)", 466],
  ["rgba(0,0,0,1)", 590], ["rgba(0,0,0,0.3)", 690], ["rgba(0,0,0,0.12)", 852], ["rgba(0,0,0,0)", 1016],
].map(([c, y]) => `${c} ${at(y)}`).join(", ");

// OBK-01 is screen-space, grouped under one null that rides in on the last
// swoosh exactly as if it were canvas (same start zoom / focus as the camera).
const OBK_C = { x: 960, y: 540 };
const Z0 = 2.2, F0 = { x: 1540, y: 636 }, Z1 = 1, F1 = GRID_END;
const OBK_START = { x: r2(960 + Z0 * (F1.x - F0.x)), y: r2(540 + Z0 * (F1.y - F0.y)), s: +(Z0 / Z1).toFixed(4) };

// ---------- helpers ----------
// Idle loop: alternate through `values` every `step` frames (sine in/out) until the end.
const loop = (from, values, step, base = 0) => {
  const out = [];
  for (let fr = from, i = 0; fr <= DURATION; fr += step, i++) out.push(k(fr, r2(base + values[i % values.length]), "sineInOut"));
  return out;
};
const ent = (fr, from, to, ease, dur) => [k(fr, from, ease), k(fr + dur, to)];
const hiddenUntil = (fr, dur = 6, ease = "easeOut") => [k(fr, 0, ease), k(fr + dur, 1)];
const rel = (c) => (x, y) => [r2(x - c.x), r2(y - c.y)];
function rect(id, name, parent, x, y, w, h, fill, extra = {}) {
  return {
    id, name, type: "rect", label: extra.label ?? "#D9F9B9", ...(parent ? { parent } : {}),
    ...(extra.start !== undefined ? { start: extra.start } : {}),
    props: { x, y, width: w, height: h, anchorX: 0, anchorY: 0, fill, ...extra.props },
    ...(extra.keyframes ? { keyframes: extra.keyframes } : {}),
  };
}
const nul = (id, name, parent, x, y, keyframes, label = "#D9F9B9") => ({
  id, name, type: "null", label, ...(parent ? { parent } : {}), props: { x, y }, ...(keyframes ? { keyframes } : {}),
});

// Window group: null at the window center (entrance lives there), window + overlays inside.
function chartLayers(id, name, parent, toLocal, dx, dy, params, keyframes) {
  const [cx, cy] = toLocal(CHART.x + dx, CHART.y + dy);
  const [tx, ty] = toLocal(TOOLTIP.x + dx, TOOLTIP.y + dy);
  return [
    {
      id, name, type: "generator", label: "#9fdcc6", parent,
      props: { generator: "productChart", x: cx, y: cy, anchorX: 0, anchorY: 0, width: CHART.w, height: CHART.h, ...params },
      ...(keyframes ? { keyframes } : {}),
    },
    rect(`${id}-tooltip-cover`, `${name} · tooltip cover`, parent, tx, ty, TOOLTIP.w, TOOLTIP.h, "#0F0F12"),
  ];
}

// Caption word by word. Each part: [text, left x, width, style] where style picks the entrance.
function caption(prefix, parent, top, parts, order) {
  const out = [];
  parts.forEach(([text, x, w, style], i) => {
    const fr = order[i];
    const id = `${prefix}-${i}`;
    const base = { id, name: `Caption · ${text}`, type: "text", label: "#c5b9ee", parent, start: f(fr) };
    if (style === "key") {
      // Keyword: pops from the middle with a lime highlight sweeping in behind it.
      out.push({
        ...base,
        props: { ...CAPTION, text, anchorX: 0.5, anchorY: 0.5, x: r2(x + w / 2), y: r2(top + 28) },
        keyframes: { scale: ent(fr, 0.55, 1, "backOut", 14), opacity: hiddenUntil(fr, 4) },
      });
      out.push(rect(`${id}-hl`, `Caption · ${text} highlight`, parent, x - 5, top + 5, w + 10, 46, LIME, {
        label: "#c5b9ee", start: f(fr + 2),
        props: { radius: 5 },
        keyframes: { scaleX: ent(fr + 2, 0, 1, "expoOut", 14) },
      }));
    } else if (style === "open" || style === "close") {
      // Braces spring apart from the keyword.
      const d = style === "open" ? 46 : -46;
      out.push({
        ...base, props: { ...CAPTION, text, y: top },
        keyframes: { x: ent(fr, x + d, x, "expoOut", 16), opacity: hiddenUntil(fr, 5) },
      });
    } else {
      // Plain words rise in; `dir` sets the side they come from.
      const dx = style === "left" ? -36 : style === "right" ? 36 : 0, dy = style === "rise" ? 22 : 0;
      out.push({
        ...base, props: { ...CAPTION, text, y: top },
        keyframes: {
          x: ent(fr, x + dx, x, "expoOut", 16), y: ent(fr, top + dy, top, "expoOut", 16),
          opacity: hiddenUntil(fr, 7), blur: ent(fr, 6, 0, "easeOut", 10),
        },
      });
    }
  });
  return out;
}

// Caption parts restyled at headline size (104px), with a taller highlight.
const bigCaption = (l) => {
  if (l.type !== "text") return { ...l, props: { ...l.props, y: l.props.y + 8, height: 98 } };
  const big = { ...l.props, ...DISPLAY, text: l.props.text, x: l.props.x, y: l.props.y };
  if (l.props.anchorX === 0.5) big.anchorX = big.anchorY = 0.5, big.y = l.props.y - 28 + 56;
  return { ...l, props: big };
};

// Prop: two entrance nulls (tile, photo) at the prop center; parallax lives on the children.
function prop(id, name, src, { tile: [tx, ty, tw, th], photo: [px, py, pw] }, tileIn, photoIn) {
  const tc = { x: tx + tw / 2, y: ty + th / 2 }, pc = { x: px, y: py };
  return [
    {
      id: `${id}-photo`, name, type: "image", label: "#e6d3a3", parent: `${id}-photo-in`,
      props: { src, width: pw, x: 0, y: 0 },
      keyframes: {
        x: parallaxX(px, DEPTH.object).map((kf) => ({ ...kf, v: r2(kf.v - pc.x) })),
        y: parallaxY(py, DEPTH.object).map((kf) => ({ ...kf, v: r2(kf.v - pc.y) })),
        scale: parallaxS(DEPTH.object),
      },
    },
    nul(`${id}-photo-in`, `${name} · photo (entrance)`, "stage", pc.x, pc.y, photoIn(pc), "#e6d3a3"),
    rect(`${id}-tile`, `${name} · tile`, `${id}-tile-in`, -tw / 2, -th / 2, tw, th, TILE, {
      label: "#e6d3a3",
      keyframes: {
        x: parallaxX(tx, DEPTH.tile).map((kf) => ({ ...kf, v: r2(kf.v - tc.x) })),
        y: parallaxY(ty, DEPTH.tile).map((kf) => ({ ...kf, v: r2(kf.v - tc.y) })),
      },
    }),
    nul(`${id}-tile-in`, `${name} · tile (entrance)`, "stage", tc.x, tc.y, tileIn(tc), "#e6d3a3"),
  ];
}

// Header for a window: market pill, clock text, status chip — each with its own entrance.
function header(which, t0, clockText, clockKeys) {
  const H = HEAD[which];
  const [mx, my] = H.market, [kx, ky] = H.clock, [chx, chy, chw, chh] = H.chip;
  const chipC = { x: chx + chw / 2, y: chy + chh / 2 };
  const chipLayers = [
    {
      id: `${which}-chip`, name: `${which} · status chip`, type: "image", label: "#ff6479", parent: `${which}-chip-in`,
      props: { src: `chip-${which}.png`, width: chw, x: 0, y: 0 },
    },
    nul(`${which}-chip-in`, `${which} · chip (entrance)`, "stage", chipC.x, chipC.y, {
      scale: ent(t0 + 7, 0.3, 1, "backOut", 16), opacity: hiddenUntil(t0 + 7, 4),
      rotation: ent(t0 + 7, which === "live" ? -10 : 10, 0, "backOut", 16),
    }, "#ff6479"),
  ];
  if (which === "live") {
    // Blinking pixel sits on the chip (the exported chip's own pixel is covered).
    const [px, py] = [LIVE_PIXEL.x - chipC.x, LIVE_PIXEL.y - chipC.y];
    const blink = [];
    for (let fr = 0; fr <= FINAL_FROM; fr += 15) blink.push(k(fr, (fr / 15) % 2 ? 0.2 : 1, "hold"));
    chipLayers.unshift(
      rect("live-pixel", "Live pixel (blink)", "live-chip-in", px, py, LIVE_PIXEL.s, LIVE_PIXEL.s, "#ff6479", { keyframes: { opacity: blink } }),
      rect("live-pixel-cover", "Live pixel · cover", "live-chip-in", px - 0.5, py - 0.5, LIVE_PIXEL.s + 1, LIVE_PIXEL.s + 1, "#000000"),
    );
  }
  return [
    ...chipLayers,
    {
      id: `${which}-clock`, name: `${which} · clock`, type: "text", label: "#ff6479", parent: "stage", start: f(t0 + 4),
      props: { ...HEADER_TEXT, text: clockText, x: kx, y: ky },
      keyframes: {
        ...(clockKeys ? { text: clockKeys } : {}),
        y: ent(t0 + 4, ky - 14, ky, "expoOut", 14), opacity: hiddenUntil(t0 + 4, 6),
      },
    },
    {
      id: `${which}-market`, name: `${which} · market pill`, type: "image", label: "#ff6479", parent: "stage", start: f(t0),
      props: { src: "header-market.png", width: 324.9, x: mx, y: my, anchorX: 0, anchorY: 0 },
      keyframes: { x: ent(t0, mx + (which === "live" ? -48 : 48), mx, "expoOut", 18), opacity: hiddenUntil(t0, 7) },
    },
  ];
}

// ---------- choreography ----------
// Live: window first, then header left → right, then caption; the push starts as it settles.
const LIVE_IN = 0;
// Wide: everything else arrives during / right after the swoosh out, each in its own way.
const REPLAY_IN = 58, REPLAY_HEAD = 66, REPLAY_CAP = 74;
const TIMELINE_IN = 62;
const VHS_TILE = 60, VHS_PHOTO = 67;
const WATCH_TILE = 70, WATCH_PHOTO = 75;

const clockKeys = [];
for (let s = 0; s * FPS <= FINAL_FROM; s++) clockKeys.push(k(s * FPS, `14:36:${String(8 + s).padStart(2, "0")}`));

const toLive = rel(LIVE_C), toReplay = rel(REPLAY_C);
const replayPlayKeys = (a, b) => [k(PLAY_START, a, playEase), k(PLAY_END, b)];


// ================= OBK-02 · Money (after the cut) =================
// Screen-space layout (Figma OBK-02) under one null that pulls back from 5× on the wall.
const M = { x: 960, y: 540 }; // group origin
const m = (x, y) => [r2(x - M.x), r2(y - M.y)];
const MONEY_START = { x: r2(DIVE_PIVOT.x - MONEY_SCALE * (WALL.x - M.x)), y: r2(DIVE_PIVOT.y - MONEY_SCALE * (WALL.y - M.y)) };
const MB = {
  window: [137, 500.5, 1646],                 // money-window.png top-left + width (2× export, shadow incl.)
  heat: [626, 613, 990, 467],                 // heatmap plot inside it
  market: [210, 440.06, 502.6], clock: [1371.58, 444.26],
  chip: [1548.58, 430, 161.42, 75.52], pixel: [1572.43, 457.09, 21.33],
  eye: [1126, 154, 88],
  cash: { tile: [1526, -77, 320, 308], photo: [1686, 77, 288] },
  gold: { tile: [1206, 231, 160, 154], photo: [1286, 308, 128] },
  sel: [1308, 949, 96, 42], leader: [1355.5, 879, 65], label: [1209.5, 821, 293, 58],
};
// Builds (frames)
const MB_T = {
  head: CUT + 18, clock: CUT + 22, chip: CUT + 24,
  line1: CUT + 14, braces: CUT + 22, geld: CUT + 25, wartet: CUT + 30,
  eye: CUT + 30, cashTile: CUT + 20, cashPhoto: CUT + 27, goldTile: CUT + 25, goldPhoto: CUT + 31,
  cursorIn: CUT + 40, grab: CUT + 56, release: CUT + 72, label: CUT + 80,
};
// Interface build: body unfolds, then axis → tools → toolbar → ticker bar → rail →
// Orderflow panel section by section.
const UI_T = { body: CUT + 5, axis: CUT + 10, tools: CUT + 12, toolbar: CUT + 14, topbar: CUT + 17, rail: CUT + 19, panel: CUT + 21 };
const UI_PIECES = [
  // id, name, canvas x, y, width, start frame, entrance
  ["mw-axis", "Window · price axis", 1616, 613, 94, UI_T.axis, { dx: 60 }],
  ["mw-tools", "Window · drawing tools", 567.5, 613, 58.5, UI_T.tools, { dx: -40 }],
  ["mw-toolbar", "Window · toolbar", 567.5, 574, 1142.5, UI_T.toolbar, { dy: -26 }],
  ["mw-topbar", "Window · ticker bar", 567.5, 533.5, 1142.5, UI_T.topbar, { dy: -30 }],
  ["mw-rail", "Window · icon rail", 210, 533.5, 44, UI_T.rail, { dx: -36 }],
  ...[[533.5, 89], [578, 176], [666, 206], [769, 140], [839, 164], [921, 246], [1044, 72]].map(([y], i) =>
    [`mw-panel-${i}`, `Window · Orderflow panel ${i + 1}`, 254, y, 313.5, UI_T.panel + i * 3, { dy: 22, blur: 4 }]),
];
const WALL_HEAT = [k(CUT, 0.7, "linear"), k(MB_T.grab, 0.8, "easeInOut"), k(MB_T.release + 6, 1.18, "sineInOut"),
  k(HOLD2_END, 1.05, "sineInOut"), k(DIVE_TO, 1.22, "sineInOut"), k(DURATION, 1.1)];
const MONEY_HEADLINE = { top1: 86, top2: 202 };
const SEL_END = { x: MB.sel[0] + MB.sel[2], y: MB.sel[1] + MB.sel[3] };
const dragKeys = (a, b) => [k(MB_T.grab + 2, a, [0.45, 0, 0.25, 1]), k(MB_T.release, b)];
const moneyBlink = [];
for (let fr = CUT; fr <= DURATION; fr += 15) moneyBlink.push(k(fr, ((fr - CUT) / 15) % 2 ? 0.2 : 1, "hold"));

// ---------- zoom overlays (screen-space, so strokes and handles stay crisp) ----------
const LS = [1.035, 1, 1]; // label scale per ZK row
const SEL_FADE = [k(WHIP_FROM + 4, 1, "easeIn"), k(WHIP_FROM + 16, 0)]; // the wall's selection lets go mid-whip
const ZSTART = f(HOLD2_END);
// Selected candle (hero, in OBK-02 coords) and its box.
const CANDLE = { x: 1394.2, y: 882, w: 26, h: 83 };
const CANDLE_IN = WHIP_TO - 8; // the candle's selection catches as the whip lands
const zoomLayers = [
  {
    id: "zoom-hud-time", name: "HUD · 14:32", type: "text", label: LIME, start: f(WHIP_TO + 10),
    props: { text: "14:32", fontFamily: "Geist", fontWeight: 500, fontSize: 22, lineHeight: 1.4, fill: LIME, x: 360, y: 56, anchorX: 0, anchorY: 0 },
    keyframes: { opacity: [...hiddenUntil(WHIP_TO + 10, 6), k(CANDLE_ZOOM_TO - 6, 1, "easeIn"), k(CANDLE_ZOOM_TO + 2, 0)] },
  },
  {
    id: "zoom-hud", name: "HUD · Footprint · BTCUSDT · 1m", type: "text", label: LIME, start: f(WHIP_TO - 2),
    props: {
      text: "Footprint · BTCUSDT · 1m", fontFamily: "Geist", fontWeight: 500, fontSize: 22, lineHeight: 1.4,
      fill: "rgba(255,255,255,0.86)", x: 64, y: 56, anchorX: 0, anchorY: 0,
    },
    keyframes: { reveal: [k(WHIP_TO - 2, 0, "linear"), k(WHIP_TO + 10, 1)], opacity: [k(CANDLE_ZOOM_TO - 6, 1, "easeIn"), k(CANDLE_ZOOM_TO + 2, 0)] },
  },
  // Candle selection (appears as the wall's fades).
  ...[[0, 0], [1, 0], [0, 1], [1, 1]].map(([ix, iy], i) => rect(`zoom-candle-handle-${i}`, `Candle · handle ${i + 1}`, null, 0, 0, 10, 10, "#ffffff", {
    label: LIME, start: f(CANDLE_IN + 4 + i * 2),
    props: { anchorX: 0.5, anchorY: 0.5, stroke: LIME, strokeWidth: 2 },
    keyframes: {
      x: zk((sc, wx) => wx + sc * (CANDLE.x + ix * CANDLE.w - WALL.x)),
      y: zk((sc, wx, wy) => wy + sc * (CANDLE.y + iy * CANDLE.h - WALL.y)),
      scale: ent(CANDLE_IN + 4 + i * 2, 0, 1, "backOut", 9),
      opacity: [k(FLAT_FROM, 1, "easeIn"), k(FLAT_FROM + 10, 0)],
    },
  })),
  rect("zoom-candle-sel", "Candle · selection", null, 0, 0, 0, 0, "rgba(217,249,185,0.06)", {
    label: LIME, start: f(CANDLE_IN), props: { stroke: LIME, strokeWidth: 2 },
    keyframes: {
      x: zk((sc, wx) => wx + sc * (CANDLE.x - WALL.x)), y: zk((sc, wx, wy) => wy + sc * (CANDLE.y - WALL.y)),
      width: zk((sc) => sc * CANDLE.w), height: zk((sc) => sc * CANDLE.h),
      opacity: [...hiddenUntil(CANDLE_IN, 8), k(FLAT_FROM, 1, "easeIn"), k(FLAT_FROM + 10, 0)],
    },
  }),
  // Wall label: follows the wall, sits just above the selection, grows a little with each punch.
  {
    id: "zoom-label-btc", name: "Wall label · 412 BTC (zoom)", type: "text", label: LIME, parent: "zoom-label",
    props: { text: "412 BTC", fontFamily: "Geist", fontWeight: 500, fontSize: 26, lineHeight: 1.31, fill: "#ffffff", x: -146.5 + 42, y: -29 + 12, anchorX: 0, anchorY: 0 },
  },
  {
    id: "zoom-label-at", name: "Wall label · at 85,860 (zoom)", type: "text", label: LIME, parent: "zoom-label",
    props: { text: "at 85,860", fontFamily: "Geist", fontWeight: 500, fontSize: 26, lineHeight: 1.31, fill: "rgba(255,255,255,0.6)", x: -146.5 + 153, y: -29 + 12, anchorX: 0, anchorY: 0 },
  },
  rect("zoom-label-pixel", "Wall label · pixel (zoom)", "zoom-label", -146.5 + 18, -29 + 23, 12, 12, LIME, { label: LIME }),
  rect("zoom-label-box", "Wall label · box (zoom)", "zoom-label", -146.5, -29, 293, 58, "#000000", {
    label: LIME, props: { radius: 4, stroke: "rgba(255,255,255,0.24)", strokeWidth: 2 },
  }),
  {
    id: "zoom-label", name: "Wall label (zoom)", type: "null", label: LIME, start: ZSTART, props: {},
    keyframes: {
      x: zk((sc, wx) => wx),
      y: ZK.map(([fr, sc, wx, wy, e], i) => k(fr, r2(i === 0 ? wy - 120 * sc : wy - 21 * sc - 48 * LS[i]), e)),
      scale: ZK.map(([fr, , , , e], i) => k(fr, LS[i], e)),
      // Hidden until the zoom starts (a null's start doesn't hide its children; its opacity does).
      opacity: [k(HOLD2_END - 1, 0, "hold"), k(HOLD2_END, 1, "linear"), ...SEL_FADE],
    },
  },
  // Leader shrinks into the selection as the label drops onto it.
  rect("zoom-leader", "Wall · leader (zoom)", null, 0, 0, 1, 0, LIME, {
    label: LIME, start: ZSTART, end: f(HOLD2_END + 14), props: { anchorY: 1 },
    keyframes: {
      x: zk((sc, wx) => wx - 0.5), y: zk((sc, wx, wy) => wy - 21 * sc),
      height: [k(HOLD2_END, 65 * 1.035, ZIN), k(HOLD2_END + 14, 0)],
    },
  }),
  ...[[0, 0], [1, 0], [0, 1], [1, 1]].map(([ix, iy], i) => rect(`zoom-handle-${i}`, `Wall · handle ${i + 1} (zoom)`, null, 0, 0, 10, 10, "#ffffff", {
    label: LIME, start: ZSTART, props: { anchorX: 0.5, anchorY: 0.5, stroke: LIME, strokeWidth: 2 },
    keyframes: {
      x: zk((sc, wx) => wx + sc * (ix ? 48 : -48)), y: zk((sc, wx, wy) => wy + sc * (iy ? 21 : -21)),
      opacity: SEL_FADE,
    },
  })),
  rect("zoom-selection", "Wall · selection (zoom)", null, 0, 0, 0, 0, "rgba(217,249,185,0.12)", {
    label: LIME, start: ZSTART, props: { stroke: LIME, strokeWidth: 2 },
    keyframes: {
      x: zk((sc, wx) => wx - 48 * sc), y: zk((sc, wx, wy) => wy - 21 * sc),
      width: zk((sc) => 96 * sc), height: zk((sc) => 42 * sc),
      opacity: SEL_FADE,
    },
  }),
  // Crosshair through the wall.
  rect("zoom-cross-h", "Crosshair · horizontal", null, 0, 0, 1920, 1.5, "rgba(255,255,255,0.22)", {
    label: LIME, start: ZSTART,
    keyframes: { y: zk((sc, wx, wy) => wy), opacity: [k(HOLD2_END, 0, "easeOut"), k(HOLD2_END + 8, 0.8, "easeIn"), k(HOLD2_END + 26, 0)] },
  }),
  rect("zoom-cross-v", "Crosshair · vertical", null, 0, 0, 1.5, 1080, "rgba(255,255,255,0.22)", {
    label: LIME, start: ZSTART,
    keyframes: { x: zk((sc, wx) => wx), opacity: [k(HOLD2_END, 0, "easeOut"), k(HOLD2_END + 8, 0.8, "easeIn"), k(HOLD2_END + 26, 0)] },
  }),
];

const moneyLayers = [
  // Cursor drags the selection over the wall.
  {
    id: "money-cursor", name: "Hand cursor · wall", type: "image", label: "#e6d3a3", parent: "money",
    start: f(MB_T.cursorIn), end: f(MB_T.release + 30),
    props: { src: "hand-cursor.png", width: 200, anchorX: 0.33, anchorY: 0.13, shadowColor: "rgba(10,26,29,0.22)", shadowBlur: 22 },
    keyframes: {
      x: [k(MB_T.cursorIn, m(MB.sel[0] + 330, 0)[0], "expoOut"), k(MB_T.grab - 2, m(MB.sel[0], 0)[0], "linear"),
        ...dragKeys(m(MB.sel[0], 0)[0], m(SEL_END.x, 0)[0]), k(MB_T.release + 6, m(SEL_END.x, 0)[0], "quadIn"), k(MB_T.release + 28, m(SEL_END.x + 320, 0)[0])],
      y: [k(MB_T.cursorIn, m(0, MB.sel[1] + 220)[1], "expoOut"), k(MB_T.grab - 2, m(0, MB.sel[1])[1], "linear"),
        ...dragKeys(m(0, MB.sel[1])[1], m(0, SEL_END.y)[1]), k(MB_T.release + 6, m(0, SEL_END.y)[1], "quadIn"), k(MB_T.release + 28, m(0, SEL_END.y + 200)[1])],
      rotation: [k(MB_T.cursorIn, 16, "expoOut"), k(MB_T.grab, 0, "linear"), k(MB_T.release + 6, 0, "quadIn"), k(MB_T.release + 28, 12)],
      scale: [k(MB_T.grab - 2, 1, "quadIn"), k(MB_T.grab + 1, 0.88, "linear"), k(MB_T.release, 0.88, "backOut"), k(MB_T.release + 5, 1)],
      opacity: [k(MB_T.cursorIn, 0, "easeOut"), k(MB_T.cursorIn + 5, 1), k(MB_T.release + 18, 1, "easeIn"), k(MB_T.release + 28, 0)],
    },
  },
  // Wall label: pops above the leader, 412 counts up.
  {
    id: "money-label-btc", name: "Wall label · 412 BTC", type: "text", label: LIME, parent: "money-label",
    props: {
      text: "{counter} BTC", counterDecimals: 0, fontFamily: "Geist", fontWeight: 500, fontSize: 26, lineHeight: 1.31,
      align: "left", fill: "#ffffff", x: -146.5 + 42, y: -29 + 12, anchorX: 0, anchorY: 0,
    },
    keyframes: { counter: [k(MB_T.label, 0, [0.2, 0.6, 0.3, 1]), k(MB_T.label + 18, 412)] },
  },
  {
    id: "money-label-at", name: "Wall label · at 85,860", type: "text", label: LIME, parent: "money-label",
    props: {
      text: "at 85,860", fontFamily: "Geist", fontWeight: 500, fontSize: 26, lineHeight: 1.31, align: "left",
      fill: "rgba(255,255,255,0.6)", x: -146.5 + 153, y: -29 + 12, anchorX: 0, anchorY: 0,
    },
    keyframes: { opacity: [k(MB_T.label + 8, 0, "easeOut"), k(MB_T.label + 16, 1)], x: ent(MB_T.label + 8, -146.5 + 153 + 14, -146.5 + 153, "expoOut", 14) },
  },
  rect("money-label-pixel", "Wall label · pixel", "money-label", -146.5 + 18, -29 + 23, 12, 12, LIME, { label: LIME }),
  rect("money-label-box", "Wall label · box", "money-label", -146.5, -29, 293, 58, "#000000", {
    label: LIME, props: { radius: 4, stroke: "rgba(255,255,255,0.24)", strokeWidth: 2 },
  }),
  nul("money-label", "Wall label (entrance)", "money", ...m(MB.label[0] + 146.5, MB.label[1] + 29), {
    scale: ent(MB_T.label, 0.5, 1, "backOut", 14), opacity: hiddenUntil(MB_T.label, 4),
    y: ent(MB_T.label, m(0, MB.label[1] + 29 + 24)[1], m(0, MB.label[1] + 29)[1], "expoOut", 16),
  }, LIME),
  // Leader grows up from the selection.
  rect("money-leader", "Wall · leader", "money", ...m(MB.leader[0], MB.leader[1] + MB.leader[2]), 1, MB.leader[2], LIME, {
    label: LIME, start: f(MB_T.release + 2), props: { anchorY: 1 },
    keyframes: { scaleY: ent(MB_T.release + 2, 0, 1, "expoOut", 10) },
  }),
  // Handles snap on after release (staggered corners).
  ...[[MB.sel[0] - 5, MB.sel[1] - 5], [SEL_END.x - 5, MB.sel[1] - 5], [MB.sel[0] - 5, SEL_END.y - 5], [SEL_END.x - 5, SEL_END.y - 5]].map(([hx, hy], i) =>
    rect(`money-handle-${i}`, `Wall · handle ${i + 1}`, "money", ...m(hx + 5, hy + 5), 10, 10, "#ffffff", {
      label: LIME, start: f(MB_T.release + i * 2),
      props: { anchorX: 0.5, anchorY: 0.5, stroke: LIME, strokeWidth: 2 },
      keyframes: { scale: ent(MB_T.release + i * 2, 0, 1, "backOut", 9) },
    })),
  // Selection follows the drag.
  rect("money-selection", "Wall · selection", "money", ...m(MB.sel[0], MB.sel[1]), MB.sel[2], MB.sel[3], "rgba(217,249,185,0.12)", {
    label: LIME, start: f(MB_T.grab + 2), props: { stroke: LIME, strokeWidth: 2 },
    keyframes: { width: dragKeys(0, MB.sel[2]), height: dragKeys(0, MB.sel[3]) },
  }),

  // Headline: "Sieh, wo das" rises, braces spring, Geld pops with lime, "wartet" slides in.
  ...caption("money-h1", "money", m(0, MONEY_HEADLINE.top1)[1], [["Sieh, wo das", m(118, 0)[0], 584, "rise"]], [MB_T.line1])
    .map((l) => ({ ...l, props: { ...l.props, ...DISPLAY, text: l.props.text, x: l.props.x, y: l.props.y } })),
  ...caption("money-h2", "money", m(0, MONEY_HEADLINE.top2)[1], [
    ["{", m(118, 0)[0], 42, "open"],
    ["Geld", m(181, 0)[0], 221, "key"],
    ["}", m(423, 0)[0], 42, "close"],
    ["wartet", m(489, 0)[0], 309, "right"],
  ], [MB_T.braces, MB_T.geld, MB_T.braces, MB_T.wartet]).map(bigCaption),

  // Eye: pops in, then blinks.
  {
    id: "money-eye", name: "Icon · eye", type: "image", label: "#c5b9ee", parent: "money", start: f(MB_T.eye),
    props: { src: "icon-eye.png", width: MB.eye[2], x: m(MB.eye[0], 0)[0], y: m(0, MB.eye[1])[1] },
    keyframes: {
      scale: ent(MB_T.eye, 0.3, 1, "backOut", 14), opacity: hiddenUntil(MB_T.eye, 4),
      scaleY: [k(MB_T.eye + 40, 1, "quadIn"), k(MB_T.eye + 43, 0.08, "quadOut"), k(MB_T.eye + 47, 1, "linear"),
        k(MB_T.eye + 92, 1, "quadIn"), k(MB_T.eye + 95, 0.08, "quadOut"), k(MB_T.eye + 99, 1)],
    },
  },
  // Props: tile + photo, each with its own entrance and a slow float.
  {
    id: "money-cash-photo", name: "Cash stack", type: "image", label: "#e6d3a3", parent: "money", start: f(MB_T.cashPhoto),
    props: { src: "cash-stack.png", width: MB.cash.photo[2], x: m(MB.cash.photo[0], 0)[0] },
    keyframes: {
      y: [k(MB_T.cashPhoto, m(0, MB.cash.photo[1] - 160)[1], "backOut"), ...loop(MB_T.cashPhoto + 20, [0, -8, -1, -10], 28, m(0, MB.cash.photo[1])[1])],
      rotation: [k(MB_T.cashPhoto, 18, "backOut"), ...loop(MB_T.cashPhoto + 22, [0, -2, 1.5, -2.5], 33)],
      opacity: hiddenUntil(MB_T.cashPhoto, 4),
    },
  },
  rect("money-cash-tile", "Cash stack · tile", "money", ...m(MB.cash.tile[0], MB.cash.tile[1]), MB.cash.tile[2], MB.cash.tile[3], TILE, {
    label: "#e6d3a3", start: f(MB_T.cashTile),
    keyframes: { y: ent(MB_T.cashTile, m(0, MB.cash.tile[1] - 200)[1], m(0, MB.cash.tile[1])[1], "expoOut", 18) },
  }),
  {
    id: "money-gold-photo", name: "Gold bars", type: "image", label: "#e6d3a3", parent: "money", start: f(MB_T.goldPhoto),
    props: { src: "gold-bars.png", width: MB.gold.photo[2], x: m(MB.gold.photo[0], 0)[0], y: m(0, MB.gold.photo[1])[1] },
    keyframes: {
      scale: [k(MB_T.goldPhoto, 0.2, "backOut"), ...loop(MB_T.goldPhoto + 18, [1, 1.04, 1.01, 1.05], 24)],
      rotation: [k(MB_T.goldPhoto, -120, "expoOut"), ...loop(MB_T.goldPhoto + 22, [0, 3, -2, 2], 30)],
      opacity: hiddenUntil(MB_T.goldPhoto, 4),
    },
  },
  rect("money-gold-tile", "Gold bars · tile", "money", ...m(MB.gold.tile[0], MB.gold.tile[1]), MB.gold.tile[2], MB.gold.tile[3], TILE, {
    label: "#e6d3a3", start: f(MB_T.goldTile),
    keyframes: {
      x: ent(MB_T.goldTile, m(MB.gold.tile[0] - 90, 0)[0], m(MB.gold.tile[0], 0)[0], "expoOut", 16),
      opacity: hiddenUntil(MB_T.goldTile, 6),
    },
  }),

  // Header: market pill from the left, clock drops, Live chip pops (pixel blinks).
  rect("money-pixel", "Money · Live pixel (blink)", "money-chip-in", MB.pixel[0] - (MB.chip[0] + MB.chip[2] / 2), MB.pixel[1] - (MB.chip[1] + MB.chip[3] / 2), MB.pixel[2], MB.pixel[2], "#ff6479", {
    label: "#ff6479", keyframes: { opacity: moneyBlink },
  }),
  rect("money-pixel-cover", "Money · Live pixel cover", "money-chip-in", MB.pixel[0] - (MB.chip[0] + MB.chip[2] / 2) - 0.5, MB.pixel[1] - (MB.chip[1] + MB.chip[3] / 2) - 0.5, MB.pixel[2] + 1, MB.pixel[2] + 1, "#000000", { label: "#ff6479" }),
  {
    id: "money-chip", name: "Money · Live chip", type: "image", label: "#ff6479", parent: "money-chip-in",
    props: { src: "money-chip-live.png", width: MB.chip[2], x: 0, y: 0 },
  },
  nul("money-chip-in", "Money · Live chip (entrance)", "money", ...m(MB.chip[0] + MB.chip[2] / 2, MB.chip[1] + MB.chip[3] / 2), {
    scale: ent(MB_T.chip, 0.3, 1, "backOut", 16), opacity: hiddenUntil(MB_T.chip, 4), rotation: ent(MB_T.chip, -10, 0, "backOut", 16),
  }, "#ff6479"),
  {
    id: "money-clock", name: "Money · clock", type: "text", label: "#ff6479", parent: "money", start: f(MB_T.clock),
    props: {
      ...HEADER_TEXT, fontSize: 36.4, letterSpacing: -0.364, lineHeight: 1.291, text: "14:36:08",
      x: m(MB.clock[0], 0)[0], y: m(0, MB.clock[1])[1],
    },
    keyframes: {
      text: (() => { const out = []; for (let s = 0; MB_T.clock + s * FPS <= DURATION; s++) out.push(k(MB_T.clock + s * FPS, `14:36:${String(8 + s).padStart(2, "0")}`)); return out; })(),
      y: ent(MB_T.clock, m(0, MB.clock[1] - 20)[1], m(0, MB.clock[1])[1], "expoOut", 14), opacity: hiddenUntil(MB_T.clock, 6),
    },
  },
  {
    id: "money-market", name: "Money · market pill", type: "image", label: "#ff6479", parent: "money", start: f(MB_T.head),
    props: { src: "money-market.png", width: MB.market[2], y: m(0, MB.market[1])[1], anchorX: 0, anchorY: 0 },
    keyframes: { x: ent(MB_T.head, m(MB.market[0] - 70, 0)[0], m(MB.market[0], 0)[0], "expoOut", 18), opacity: hiddenUntil(MB_T.head, 7) },
  },

  // Interface pieces assemble around the plot (each its own move).
  ...UI_PIECES.map(([id, name, x, y, w, t, from]) => ({
    id, name, type: "image", label: "#c5b9ee", parent: "money", start: f(t),
    props: { src: `${id}.png`, width: w, x: m(x, 0)[0], y: m(0, y)[1], anchorX: 0, anchorY: 0 },
    keyframes: {
      opacity: hiddenUntil(t, 6),
      ...(from.dx ? { x: ent(t, m(x + from.dx, 0)[0], m(x, 0)[0], "expoOut", 16) } : {}),
      ...(from.dy ? { y: ent(t, m(0, y + from.dy)[1], m(0, y)[1], "expoOut", 16) } : {}),
      ...(from.blur ? { blur: ent(t, from.blur, 0, "easeOut", 10) } : {}),
    },
  })),
  // The window we dove into: live heatmap (the chrome above assembles around it).
  {
    id: "money-heatmap", name: "Liquidity heatmap", type: "generator", label: "#c5b9ee", parent: "money",
    props: {
      generator: "liquidityHeatmap", x: m(MB.heat[0], 0)[0], y: m(0, MB.heat[1])[1], anchorX: 0, anchorY: 0,
      // Plot + its own axis column, running down to the window's real bottom (1309.5)
      // so the zoomed shots are full-bleed.
      width: MB.heat[2] + 93.5, height: 1309.5 - MB.heat[1], axisW: 93.5, hero: 26,
    },
    keyframes: {
      wall: WALL_HEAT,
      reveal: [k(CUT + 6, 0.08, [0.4, 0, 0.3, 1]), k(CUT + 40, 1)],
      legendIn: [k(CUT + 24, 0, "easeOut"), k(CUT + 34, 1)],
      axisIn: [k(HOLD2_END, 0, "easeOut"), k(HOLD2_END + 12, 1)],
      // All of the wall → candle handover happens inside the whip.
      wallFade: [k(WHIP_FROM, 0, "sineInOut"), k(WHIP_TO, 0.55)],
      wallExtend: [k(WHIP_FROM + 2, 0, [0.4, 0, 0.2, 1]), k(WHIP_TO + 4, 1)],
      dim: [k(WHIP_FROM + 6, 0, "sineInOut"), k(WHIP_TO + 6, 0.88, "sineInOut"), k(CANDLE_ZOOM_TO, 0.95)],
      candleDim: [k(WHIP_FROM + 10, 0, "sineInOut"), k(WHIP_TO + 8, 1)],
    },

  },
  // Window body: unfolds from the plot out to the full window.
  rect("money-window-body", "Heatmap window · body", "money", ...m(MB.heat[0], MB.heat[1]), MB.heat[2], MB.heat[3], "#0F0F12", {
    label: "#c5b9ee",
    props: { radius: 9, shadowColor: "rgba(10,26,29,0.16)", shadowBlur: 60, shadowY: 24 },
    keyframes: {
      x: ent(UI_T.body, m(MB.heat[0], 0)[0], m(210, 0)[0], "expoOut", 18),
      y: ent(UI_T.body, m(0, MB.heat[1])[1], m(0, 533.5)[1], "expoOut", 18),
      width: ent(UI_T.body, MB.heat[2], 1500, "expoOut", 18),
      height: ent(UI_T.body, MB.heat[3], 776, "expoOut", 18),
    },
  }),
  nul("money", "OBK-02 layout (pull-back from the wall)", null, M.x, M.y, {
    x: [k(CUT, MONEY_START.x, EXPO_OUT), k(PULL_TO, M.x, "sineInOut"), ...zk((sc, wx) => wx - sc * (WALL.x - M.x))],
    y: [k(CUT, MONEY_START.y, EXPO_OUT), k(PULL_TO, M.y, "sineInOut"), ...zk((sc, wx, wy) => wy - sc * (WALL.y - M.y))],
    scale: [k(CUT, MONEY_SCALE, EXPO_OUT), k(PULL_TO, 1, "sineInOut"), ...zk((sc) => sc)],
    blur: [k(CUT, 12, EXPO_OUT), k(PULL_TO - 6, 0), ...DIVE_BLUR, ...ZOOM_PUNCHES.flatMap((p) => swooshBlur(p, 3))],
    opacity: [k(CUT - 1, 0, "hold"), k(CUT, 1)],
  }, "#c5b9ee"),
];


// ================= OBK-07a/b · Jede Kerze von { innen } =================
const LEVELS = [85908, 85904, 85900, 85896, 85892, 85888, 85884, 85880, 85876, 85872];
const LADDER = {
  axisX: 1180, rowY: (i) => 152 + 80 * i, rowH: 56,
  bid: [[1173.4, 6.6, 6], [1160.2, 19.8, 18], [1133.8, 46.2, 42], [1097.5, 82.5, 75], [1048, 132, 120],
    [995.2, 184.8, 168], [920.4, 259.6, 236], [830.2, 349.8, 318], [737.8, 442.2, 402], [863.2, 316.8, 288]],
  ask: [[24.2, 22], [70.4, 64], [171.6, 156], [272.8, 248], [376.2, 342], [451, 410], [387.2, 352], [235.4, 214], [138.6, 126], [44, 40]],
  bidText: [1147.4, 1125.2, 1092.8, 1109.5, 1060, 1007.2, 932.4, 842.2, 749.8, 875.2],
  askText: [1214.2, 1207.4, 1298.6, 1395.8, 1498.2, 1578, 1509.2, 1363.4, 1266.6, 1234],
  poc: 6,
};
const BID = "#f0667b", ASK = "#78f2c4", DEEP = "#0c1a1d";
const SLICE_IN = CANDLE_ZOOM_TO - 14, LABELS_IN = CANDLE_ZOOM_TO - 8, HEAD3_IN = CANDLE_ZOOM_TO + 4;
const BAR_IN = FLAT_FROM + 6, POC_IN = FLAT_FROM + 44, DELTA_IN = FLAT_FROM + 22;
const fromMid = (i) => Math.abs(i - LADDER.poc); // bars open outward from the POC row
const HEAD3 = { fontFamily: "Geist", fontWeight: 500, fontSize: 96, letterSpacing: -1.92, lineHeight: 1.08, fill: "#ffffff", anchorX: 0, anchorY: 0 };
const UI_TXT = (size, fill, extra = {}) => ({ fontFamily: "Geist", fontWeight: 500, fontSize: size, lineHeight: 1.3, fill, anchorX: 0, anchorY: 0, ...extra });
// Same grid as every Figma frame (columns from 86.5 every 160, rows from 77.64 every 154.29).
const SCREEN_GRID_D = [
  ...Array.from({ length: 12 }, (_, i) => `M${r2(GRID.x0 + i * GRID.dx)} 0V1080`),
  ...Array.from({ length: 7 }, (_, i) => `M0 ${r2(GRID.y0 + i * GRID.dy)}H1920`),
].join("");

const candleLayers = [
  // Headline (white, over the dark chart): "Jede Kerze" rises, then "von { innen }." builds.
  {
    id: "c-h-1", name: "Headline · Jede Kerze", type: "text", label: "#c5b9ee", start: f(HEAD3_IN),
    props: { ...HEAD3, text: "Jede Kerze", x: 118, y: 778 },
    keyframes: { y: ent(HEAD3_IN, 800, 778, "expoOut", 18), opacity: hiddenUntil(HEAD3_IN, 7), blur: ent(HEAD3_IN, 6, 0, "easeOut", 10) },
  },
  {
    id: "c-h-von", name: "Headline · von", type: "text", label: "#c5b9ee", start: f(HEAD3_IN + 6),
    props: { ...HEAD3, text: "von", x: 118, y: 882 },
    keyframes: { y: ent(HEAD3_IN + 6, 904, 882, "expoOut", 18), opacity: hiddenUntil(HEAD3_IN + 6, 7), blur: ent(HEAD3_IN + 6, 6, 0, "easeOut", 10) },
  },
  {
    id: "c-h-open", name: "Headline · {", type: "text", label: "#c5b9ee", start: f(HEAD3_IN + 11),
    props: { ...HEAD3, text: "{", y: 882 },
    keyframes: { x: ent(HEAD3_IN + 11, 346, 300, "expoOut", 16), opacity: hiddenUntil(HEAD3_IN + 11, 5) },
  },
  {
    id: "c-h-innen", name: "Headline · innen", type: "text", label: "#c5b9ee", start: f(HEAD3_IN + 14),
    props: { ...HEAD3, text: "innen", x: 358 + 120, y: 882 + 52, anchorX: 0.5, anchorY: 0.5 },
    keyframes: { scale: ent(HEAD3_IN + 14, 0.55, 1, "backOut", 14), opacity: hiddenUntil(HEAD3_IN + 14, 4) },
  },
  {
    id: "c-h-close", name: "Headline · }.", type: "text", label: "#c5b9ee", start: f(HEAD3_IN + 11),
    props: { ...HEAD3, text: "}.", y: 882 },
    keyframes: { x: ent(HEAD3_IN + 11, 571, 617, "expoOut", 16), opacity: hiddenUntil(HEAD3_IN + 11, 5) },
  },

  // Delta read-out: label, counter, totals.
  {
    id: "c-delta-ask", name: "Delta · Ask 1,974", type: "text", label: ASK, start: f(DELTA_IN + 14),
    props: { ...UI_TXT(28, "rgba(120,242,196,0.9)"), text: "Ask {counter}", counterDecimals: 0, x: 110, y: 282 },
    keyframes: { counter: [k(DELTA_IN + 14, 0, [0.2, 0.6, 0.3, 1]), k(DELTA_IN + 40, 1974)], opacity: hiddenUntil(DELTA_IN + 14, 6) },
  },
  {
    id: "c-delta-bid", name: "Delta · Bid 1,673", type: "text", label: BID, start: f(DELTA_IN + 18),
    props: { ...UI_TXT(28, "rgba(240,102,123,0.9)"), text: "Bid {counter}", counterDecimals: 0, x: 262, y: 282 },
    keyframes: { counter: [k(DELTA_IN + 18, 0, [0.2, 0.6, 0.3, 1]), k(DELTA_IN + 44, 1673)], opacity: hiddenUntil(DELTA_IN + 18, 6) },
  },
  {
    id: "c-delta-value", name: "Delta · +301", type: "text", label: ASK, start: f(DELTA_IN + 4),
    props: { ...UI_TXT(112, ASK), text: "+{counter}", counterDecimals: 0, x: 110, y: 144 },
    keyframes: {
      counter: [k(DELTA_IN + 4, 0, [0.2, 0.6, 0.3, 1]), k(DELTA_IN + 40, 301)],
      opacity: hiddenUntil(DELTA_IN + 4, 6), y: ent(DELTA_IN + 4, 170, 144, "expoOut", 18),
    },
  },
  {
    id: "c-delta-label", name: "Delta · label", type: "text", label: ASK, start: f(DELTA_IN),
    props: { ...UI_TXT(28, "rgba(255,255,255,0.6)"), text: "Delta", x: 110, y: 110 },
    keyframes: { opacity: hiddenUntil(DELTA_IN, 8) },
  },

  // POC selection on 85,884.
  ...[[904.4, 618], [1571.2, 618], [904.4, 690], [1571.2, 690]].map(([hx, hy], i) =>
    rect(`c-poc-handle-${i}`, `POC · handle ${i + 1}`, null, hx + 6, hy + 6, 12, 12, "#ffffff", {
      label: LIME, start: f(POC_IN + 6 + i * 2), props: { anchorX: 0.5, anchorY: 0.5, stroke: LIME, strokeWidth: 2 },
      keyframes: { scale: ent(POC_IN + 6 + i * 2, 0, 1, "backOut", 9) },
    })),
  rect("c-poc-box", "POC · box", null, 910.4 + 333.4, 624, 0, 72, "rgba(217,249,185,0.08)", {
    label: LIME, start: f(POC_IN), props: { anchorX: 0.5, anchorY: 0, x: 910.4 + 333.4, stroke: LIME, strokeWidth: 2 },
    keyframes: { width: ent(POC_IN, 0, 666.8, "expoOut", 14) },
  }),

  // Values: inside a bar → dark text; outside → bar color.
  ...LEVELS.flatMap((_, i) => {
    const [bx, bw, bv] = LADDER.bid[i], [aw, av] = LADDER.ask[i];
    const y = LADDER.rowY(i) + 12.5, t = BAR_IN + 10 + fromMid(i) * 2;
    const bidInside = LADDER.bidText[i] >= bx, askInside = LADDER.askText[i] < LADDER.axisX + aw;
    return [
      { id: `c-bidv-${i}`, name: `Bid value · ${LEVELS[i]}`, type: "text", label: BID, start: f(t),
        props: { ...UI_TXT(23, bidInside ? DEEP : BID, { lineHeight: 1.35 }), text: String(bv), x: LADDER.bidText[i], y },
        keyframes: { opacity: hiddenUntil(t, 6) } },
      { id: `c-askv-${i}`, name: `Ask value · ${LEVELS[i]}`, type: "text", label: ASK, start: f(t + 1),
        props: { ...UI_TXT(23, askInside ? DEEP : ASK, { lineHeight: 1.35 }), text: String(av), x: LADDER.askText[i], y },
        keyframes: { opacity: hiddenUntil(t + 1, 6) } },
    ];
  }),
  // Bars grow out of the candle's axis, POC row first, then outward.
  ...LEVELS.flatMap((_, i) => {
    const [bx, bw] = LADDER.bid[i], [aw] = LADDER.ask[i];
    const y = LADDER.rowY(i), t = BAR_IN + fromMid(i) * 2;
    return [
      rect(`c-bid-${i}`, `Bid · ${LEVELS[i]}`, null, LADDER.axisX, y, bw, LADDER.rowH, BID, {
        label: BID, start: f(t), props: { anchorX: 1 }, keyframes: { scaleX: ent(t, 0, 1, "expoOut", 18) },
      }),
      rect(`c-ask-${i}`, `Ask · ${LEVELS[i]}`, null, LADDER.axisX, y, aw, LADDER.rowH, ASK, {
        label: ASK, start: f(t), keyframes: { scaleX: ent(t, 0, 1, "expoOut", 18) },
      }),
    ];
  }),
  rect("c-axis", "Candle axis", null, 1177, 540, 6, 844, ASK, {
    label: ASK, start: f(FLAT_FROM), props: { anchorY: 0.5, y: 540 },
    keyframes: { scaleY: ent(FLAT_FROM, 0.7, 1, "expoOut", 16), opacity: hiddenUntil(FLAT_FROM, 5) },
  }),

  // Price column + slices (OBK-07a), staggered top → bottom.
  ...LEVELS.map((pr, i) => ({
    id: `c-price-${i}`, name: `Price · ${pr.toLocaleString("en-US")}`, type: "text", label: "#e6d3a3", start: f(LABELS_IN + i),
    props: {
      ...UI_TXT(19, i === LADDER.poc ? LIME : "rgba(255,255,255,0.55)", { lineHeight: 1.37 }),
      text: pr.toLocaleString("en-US"), x: 1690, y: screenY(pr) - 13,
    },
    keyframes: { opacity: hiddenUntil(LABELS_IN + i, 6), x: ent(LABELS_IN + i, 1716, 1690, "expoOut", 14) },
  })),
  ...Array.from({ length: 11 }, (_, i) => rect(`c-slice-${i}`, `Slice line ${i}`, null, 0, screenY(85910 - 4 * i), 1920, 1,
    i === 0 || i === 10 ? "rgba(217,249,185,0.35)" : "rgba(255,255,255,0.1)", {
      label: "#e6d3a3", start: f(SLICE_IN + i),
      props: { anchorX: 0 },
      keyframes: { scaleX: ent(SLICE_IN + i, 0, 1, [0.6, 0, 0.2, 1], 18), opacity: [...hiddenUntil(SLICE_IN + i, 4), k(FLAT_FROM, 1, "easeIn"), k(FLAT_FROM + 14, 0)] },
    })),

  // Flat footprint backdrop: deep teal + the grid (fades in as the heatmap leaves).
  {
    id: "c-grid", name: "Footprint · grid", type: "path", label: "#e6d3a3", start: f(FLAT_FROM),
    props: { d: SCREEN_GRID_D, x: 0, y: 0, anchorX: 0, anchorY: 0, fill: "rgba(0,0,0,0)", stroke: "rgba(255,255,255,0.05)", strokeWidth: 1 },
    keyframes: { opacity: hiddenUntil(FLAT_FROM, 18) },
  },
  rect("c-bg", "Footprint · background", null, 0, 0, 1920, 1080, DEEP, {
    label: "#e6d3a3", start: f(FLAT_FROM),
    keyframes: { opacity: [k(FLAT_FROM, 0, "sineInOut"), k(FLAT_FROM + 18, 1)] },
  }),
];

// ---------- layers (first = on top) ----------
const layers = [
  ...candleLayers,
  ...zoomLayers,
  ...moneyLayers.map((l) =>
    // The in-layout wall overlays hand over to the screen-space ones when the zoom starts.
    /^money-(label|leader|handle|selection)/.test(l.id) ? { ...l, end: ZSTART }
    // The chrome's axis hands over to the heatmap's own axis column.
    : l.id === "mw-axis" ? { ...l, keyframes: { ...l.keyframes, opacity: [...l.keyframes.opacity, k(HOLD2_END, 1, "easeIn"), k(HOLD2_END + 12, 0)] } }
    : l),
  // Hand cursor above everything (it lives in the Replay group's space).
  {
    id: "cursor", name: "Hand cursor", type: "image", label: "#e6d3a3", parent: "replay-in",
    start: f(CURSOR_IN), end: f(RELEASE + 26),
    props: {
      src: "hand-cursor.png", width: 132, anchorX: 0.33, anchorY: 0.13,
      shadowColor: "rgba(10,26,29,0.22)", shadowBlur: 18,
    },
    keyframes: (() => {
      const [bx, by] = toReplay(PLAY_BTN.x + 18, PLAY_BTN.y + 18);
      return {
        x: [k(CURSOR_IN, bx + 260, "expoOut"), k(CURSOR_AT, bx, "linear"), k(RELEASE + 3, bx, "quadIn"), k(RELEASE + 24, bx + 330)],
        y: [k(CURSOR_IN, by + 190, "expoOut"), k(CURSOR_AT, by, "linear"), k(RELEASE + 3, by, "quadIn"), k(RELEASE + 24, by + 260)],
        rotation: [k(CURSOR_IN, 14, "expoOut"), k(CURSOR_AT + 4, 0, "quadIn"), k(RELEASE + 24, 10)],
        opacity: [k(CURSOR_IN, 0, "easeOut"), k(CURSOR_IN + 5, 1), k(RELEASE + 14, 1, "easeIn"), k(RELEASE + 24, 0)],
        scale: [k(PRESS - 3, 1, "quadIn"), k(PRESS, 0.86, "easeOut"), k(RELEASE, 1)],
        shadowY: [k(PRESS - 3, 10, "quadIn"), k(PRESS, 3, "easeOut"), k(RELEASE, 10)],
      };
    })(),
  },
  // ================= OBK-01 · Orderbuch { roulette } =================
  {
    id: "icon-volume", name: "Icon · volume", type: "image", label: "#c5b9ee", parent: "obk", start: f(FINAL_TO),
    props: { src: "icon-volume.png", width: 88, x: 1606 - OBK_C.x, y: 174 - OBK_C.y },
    keyframes: {
      y: [k(FINAL_TO, 174 - OBK_C.y - 50, "backOut"), ...loop(FINAL_TO + 16, [0, -6, 0, -5], 22, 174 - OBK_C.y)],
      rotation: [k(FINAL_TO, -24, "backOut"), ...loop(FINAL_TO + 18, [0, 4, -3, 3], 22)],
      opacity: hiddenUntil(FINAL_TO, 5),
    },
  },
  {
    id: "brace-open", name: "Bracket {", type: "text", label: "#c5b9ee", parent: "obk", start: f(FINAL_TO - 8),
    props: { ...DISPLAY, text: "{", y: SLOT_Y - OBK_C.y },
    keyframes: { x: ent(FINAL_TO - 8, 941 - OBK_C.x + 70, 941 - OBK_C.x, "expoOut", 16), opacity: hiddenUntil(FINAL_TO - 8, 5) },
  },
  {
    id: "brace-close", name: "Bracket }", type: "text", label: "#c5b9ee", parent: "obk", start: f(FINAL_TO - 8),
    props: { ...DISPLAY, text: "}", y: SLOT_Y - OBK_C.y },
    keyframes: { x: ent(FINAL_TO - 8, 1619 - OBK_C.x - 70, 1619 - OBK_C.x, "expoOut", 16), opacity: hiddenUntil(FINAL_TO - 8, 5) },
  },
  ...reelRows.flatMap(({ n, word, y }) => {
    const common = { label: "#9fdcc6", parent: "reel", matte: "reel-mask", start: f(FINAL_FROM) };
    const thumb = n === 0
      ? {
        id: "thumb-heatmap", name: "Thumb · Heatmap (lands)", type: "image", ...common,
        props: { src: "heatmap-thumb.png", width: 140, x: 70, y: y + 8 + 48 },
        keyframes: { scale: [k(LAND - 2, 1, "quadOut"), k(LAND + 4, 1.12, "easeInOut"), ...loop(LAND + 16, [1, 1.05], 18)] },
      }
      : {
        id: `thumb-${n}`, name: `Thumb · ${word} (${n})`, type: "generator", ...common,
        props: {
          generator: "chartThumb", kind: KIND[word], seed: 100 + n, radius: 4,
          width: 140, height: 96, x: 0, y: y + 8, anchorX: 0, anchorY: 0,
        },
      };
    const text = {
      id: n === 0 ? "word-heatmap" : `word-${n}`,
      name: `Word · ${word}${n === 0 ? " (lands)" : ` (${n})`}`,
      type: "text", ...common,
      props: { ...DISPLAY, text: word, x: WORD_DX, y },
    };
    return [text, thumb];
  }),
  {
    id: "reel", name: "Reel (spin)", type: "null", label: "#9fdcc6", parent: "obk", start: f(FINAL_FROM),
    props: { x: REEL_X - OBK_C.x },
    keyframes: {
      y: [
        k(FINAL_FROM, SLOT_Y - OBK_C.y + SPIN_ROWS * ROW_H, "linear"),
        k(SPIN, SLOT_Y - OBK_C.y + SPIN_ROWS * ROW_H, [0.3, 0, 0.12, 1]),
        k(LAND, SLOT_Y - OBK_C.y - 12, "easeInOut"),
        k(SETTLE, SLOT_Y - OBK_C.y),
      ],
      blur: [k(SPIN, 0, "quadIn"), k(SPIN + 12, 5, "linear"), k(SPIN + 26, 5, "quadOut"), k(LAND - 8, 0)],
    },
  },
  rect("reel-mask", "Reel mask (fade by distance)", "obk", MASK.x - OBK_C.x, MASK.y - OBK_C.y, MASK.w, MASK.h, "#000", {
    props: { fillType: "linear", gradientAngle: 180, gradientStops: MASK_STOPS },
  }),
  {
    id: "lead", name: "Lead · Orderbuch", type: "text", label: "#D9F9B9", parent: "obk", start: f(FINAL_FROM),
    props: { ...DISPLAY, text: "Orderbuch", x: 347 - OBK_C.x, y: 484 - OBK_C.y },
  },
  {
    // Nearer plane: leads the group in and lands with a little bounce.
    id: "ledger-photo", name: "Ledger book", type: "image", label: "#e6d3a3", parent: "obk", start: f(FINAL_FROM),
    props: { src: "ledger-book.png", width: 288, shadowColor: "rgba(10,26,29,0.28)" },
    keyframes: {
      x: [k(FINAL_FROM, 406 - OBK_C.x + 520, SWOOSH), k(FINAL_TO, 406 - OBK_C.x)],
      // Lands with a bounce, then floats above its tile.
      y: [
        k(FINAL_TO - 4, 1003.5 - OBK_C.y, "quadOut"), k(FINAL_TO + 4, 1003.5 - OBK_C.y - 16, "backOut"),
        ...loop(FINAL_TO + 16, [0, -11, -2, -13, -1, -9], 26, 1003.5 - OBK_C.y),
      ],
      rotation: [k(FINAL_FROM, -12, SWOOSH), ...loop(FINAL_TO + 8, [0, 2.4, -1.6, 2.8, -1.2, 2], 31)],
      // Shadow spreads as the book lifts, tightens as it settles.
      shadowBlur: [k(FINAL_TO, 10), ...loop(FINAL_TO + 16, [14, 30, 16, 32, 15, 28], 26)],
      shadowY: [k(FINAL_TO, 4), ...loop(FINAL_TO + 16, [8, 20, 9, 22, 8, 18], 26)],
      scale: loop(FINAL_TO + 16, [1, 1.025, 1.005, 1.03, 1, 1.02], 26),
    },
  },
  rect("ledger-tile", "Ledger book · tile", "obk", 246 - OBK_C.x, 849 - OBK_C.y, 320, 309, TILE, {
    label: "#e6d3a3", start: f(FINAL_FROM),
    keyframes: {
      x: [k(FINAL_FROM, 246 - OBK_C.x + 180, SWOOSH), k(FINAL_TO, 246 - OBK_C.x)],
      y: loop(FINAL_TO + 10, [0, 3, 0, 4], 39, 849 - OBK_C.y), // slow counter-drift under the book
    },
  }),
  nul("obk", "OBK-01 layout (rides in)", null, OBK_C.x, OBK_C.y, {
    // Rides in, slow push (same as the camera), then dives into the Heatmap thumb's hot spot.
    x: [k(FINAL_FROM, OBK_START.x, SWOOSH), k(FINAL_TO, OBK_C.x, "linear"), k(DIVE_FROM, OBK_C.x, "expoIn"),
      k(CUT - 1, r2(DIVE_PIVOT.x - DIVE_SCALE * BLOB.x))],
    y: [k(FINAL_FROM, OBK_START.y, SWOOSH), k(FINAL_TO, OBK_C.y, "linear"), k(DIVE_FROM, OBK_C.y, "expoIn"),
      k(CUT - 1, r2(DIVE_PIVOT.y - DIVE_SCALE * BLOB.y))],
    scale: [k(FINAL_FROM, OBK_START.s, SWOOSH), k(FINAL_TO, 1, "sineInOut"), k(DIVE_FROM, OBK_PUSH, "expoIn"), k(CUT - 1, DIVE_SCALE)],
    blur: [...swooshBlur([FINAL_FROM, FINAL_TO]), ...cutBlur()],
    opacity: [k(CUT - 1, 1, "hold"), k(CUT, 0)],
  }),

  // ================= Replay (window group + header + caption) =================
  ...caption("replay-cap", "stage", 941.25, [
    ["Und was", 1044, 171, "left"],
    ["{", 1227.7, 18, "open"],
    ["davor", 1254.7, 112, "key"],
    ["}", 1375.7, 18, "close"],
    ["passiert ist.", 1397.3, 229, "right"],
  ], [REPLAY_CAP + 10, REPLAY_CAP, REPLAY_CAP + 4, REPLAY_CAP, REPLAY_CAP + 13]),
  ...header("replay", REPLAY_HEAD, "Vor 3 Tagen"),
  rect("play-flash", "Play button · pressed", "replay-in", ...toReplay(PLAY_BTN.x, PLAY_BTN.y), PLAY_BTN.s, PLAY_BTN.s,
    "rgba(255,185,71,0.35)", {
      props: { radius: 3.6 },
      keyframes: { opacity: [k(0, 0, "hold"), k(PRESS, 1, "easeOut"), k(PRESS + 14, 0.25)] },
    }),
  {
    id: "kerzen", name: "Kerzen counter", type: "text", label: "#9fdcc6", parent: "replay-in",
    props: {
      text: "{counter} / 380 Kerzen", counterDecimals: 0,
      fontFamily: "Geist", fontWeight: 500, fontSize: 16.267, lineHeight: 1.29, align: "left",
      fill: "rgba(255,255,255,0.6)", x: toReplay(KERZEN.x, 0)[0], y: toReplay(0, KERZEN.y)[1], anchorX: 0, anchorY: 0,
    },
    keyframes: { counter: replayPlayKeys(Math.round(P_FROM * 380), 268) },
  },
  rect("kerzen-cover", "Kerzen counter · cover", "replay-in", ...toReplay(KERZEN.x - 2, KERZEN.y - 1), 140, 24, PLAYER_BG),
  rect("playhead", "Progress · playhead", "replay-in", ...toReplay(PROGRESS.x - 5.03, PROGRESS.y), 10.06, PROGRESS.h, "#ffb947", {
    keyframes: {
      x: replayPlayKeys(
        toReplay(PROGRESS.x + P_FROM * PROGRESS.w - 5.03, 0)[0],
        toReplay(PROGRESS.x + P_TO * PROGRESS.w - 5.03, 0)[0]),
    },
  }),
  rect("played", "Progress · played", "replay-in", ...toReplay(PROGRESS.x, PROGRESS.y + 3.615), 0, 3.615, "#ffb947", {
    keyframes: { width: replayPlayKeys(P_FROM * PROGRESS.w, P_TO * PROGRESS.w) },
  }),
  rect("track", "Progress · track", "replay-in", ...toReplay(PROGRESS.x, PROGRESS.y + 3.615), PROGRESS.w, 3.615, "rgba(255,255,255,0.12)"),
  rect("progress-cover", "Progress · cover", "replay-in", ...toReplay(PROGRESS.x - 3, PROGRESS.y - 1), PROGRESS.w + 8, PROGRESS.h + 2, PLAYER_BG),
  {
    id: "mini-kerzen", name: "Mini player · Kerzen", type: "text", label: "#9fdcc6", parent: "replay-in",
    props: {
      text: "{counter} / 380 Kerzen", counterDecimals: 0,
      fontFamily: "Geist", fontWeight: 500, fontSize: 5, lineHeight: 1.2, align: "left",
      fill: "rgba(255,255,255,0.55)", x: toReplay(MINI.textX, 0)[0], y: toReplay(0, MINI.textY)[1], anchorX: 0, anchorY: 0.5,
    },
    keyframes: { counter: replayPlayKeys(Math.round(P_FROM * 380), 268) },
  },
  rect("mini-kerzen-cover", "Mini player · Kerzen cover", "replay-in", ...toReplay(MINI.textX - 1.5, MINI.textY - 4.5), 46, 9, "#0e0f12"),
  rect("mini-played", "Mini player · played", "replay-in", ...toReplay(MINI.x, MINI.y), 0, MINI.h, "#ffac48", {
    keyframes: { width: replayPlayKeys(P_FROM * MINI.w, P_TO * MINI.w) },
  }),
  rect("mini-track", "Mini player · track", "replay-in", ...toReplay(MINI.x, MINI.y), MINI.w, MINI.h, "#27272a"),
  rect("mini-cover", "Mini player · cover", "replay-in", ...toReplay(MINI.x - 2, MINI.y - 1), MINI.w + 4, MINI.h + 2, "#0e0f12"),
  ...chartLayers("replay-chart", "Replay chart", "replay-in", toReplay, REPLAY_OFFSET[0], REPLAY_OFFSET[1],
    { reveal: P_FROM, playhead: 1, seed: 11, count: 40, volatility: 1.4 },
    { reveal: replayPlayKeys(P_FROM, P_TO) }),
  {
    id: "replay", name: "Session · Replay (window)", type: "image", label: "#D9F9B9", parent: "replay-in",
    props: { src: "replay-window.png", width: 922, x: 0, y: 0 },
  },
  // Replay window rises up into place as the camera lands on the wide shot.
  nul("replay-in", "Replay window (entrance)", "stage", REPLAY_C.x, REPLAY_C.y, {
    y: ent(REPLAY_IN, REPLAY_C.y + 110, REPLAY_C.y, "expoOut", 22),
    opacity: hiddenUntil(REPLAY_IN, 8),
    scale: ent(REPLAY_IN, 0.92, 1, "expoOut", 22),
  }),

  // ================= Live (window group + header + caption) =================
  ...caption("live-cap", "stage", 601.5, [
    ["Was gerade", 97, 234, "rise"],
    ["{", 343.7, 18, "open"],
    ["passiert", 370.7, 161, "key"],
    ["}", 540.7, 18, "close"],
    [".", 562.3, 10, "rise"],
  ], [LIVE_IN + 12, LIVE_IN + 18, LIVE_IN + 21, LIVE_IN + 18, LIVE_IN + 27]),
  ...header("live", LIVE_IN + 5, "14:36:08", clockKeys),
  ...chartLayers("live-chart", "Live chart", "live-in", toLive, 0, 0,
    { rate: 1.3, seed: 7, count: 30, volatility: 1.7, glow: 1 }),
  {
    id: "live", name: "Session · Live (window)", type: "image", label: "#D9F9B9", parent: "live-in",
    props: { src: "live-window.png", width: 909.2, x: 0, y: 0 },
  },
  nul("live-in", "Live window (entrance)", "stage", LIVE_C.x, LIVE_C.y, {
    y: ent(LIVE_IN, LIVE_C.y + 40, LIVE_C.y, "expoOut", 20),
    scale: ent(LIVE_IN, 0.9, 1, "expoOut", 22),
    opacity: hiddenUntil(LIVE_IN, 7),
  }),

  // ================= canvas props + timeline =================
  // VHS: tile pops, then the tape drops onto it with a spin.
  ...prop("vhs", "VHS tape", "vhs-tape.png", VHS,
    (c) => ({ scale: ent(VHS_TILE, 0.4, 1, "backOut", 16), opacity: hiddenUntil(VHS_TILE, 5) }),
    (c) => ({
      y: ent(VHS_PHOTO, c.y - 120, c.y, "backOut", 20), rotation: ent(VHS_PHOTO, -28, 0, "backOut", 22),
      opacity: hiddenUntil(VHS_PHOTO, 5),
    })),
  // Timeline draws on left → right (matte wipe).
  {
    id: "timeline", name: "Timeline · Jetzt → −3T", type: "image", label: "#D9F9B9", parent: "stage", matte: "timeline-wipe",
    props: { src: "timeline.png", width: TIMELINE.w, anchorX: 0, anchorY: 0, x: TIMELINE.x, y: TIMELINE.y },
  },
  rect("timeline-wipe", "Timeline · wipe", "stage", TIMELINE.x - 8, TIMELINE.y - 8, 0, TIMELINE.h + 16, "#000", {
    keyframes: { width: ent(TIMELINE_IN, 0, TIMELINE.w + 16, [0.6, 0, 0.2, 1], 26) },
  }),
  // Stopwatch: tile slides up, then the watch spins in (behind the windows — its
  // path crosses the Live caption on the way out).
  ...prop("stopwatch", "Stopwatch", "stopwatch-photo.png", WATCH,
    (c) => ({ y: ent(WATCH_TILE, c.y + 70, c.y, "expoOut", 16), opacity: hiddenUntil(WATCH_TILE, 6) }),
    () => ({
      rotation: ent(WATCH_PHOTO, 140, 0, "expoOut", 24), scale: ent(WATCH_PHOTO, 0.3, 1, "backOut", 20),
      opacity: hiddenUntil(WATCH_PHOTO, 4),
    })),

  // ================= camera rig =================
  {
    id: "stage", name: "Pan (focus)", type: "null", label: "#D9F9B9", parent: "camera", props: {},
    keyframes: {
      x: keys(FOCUS_X, (v) => -v), y: keys(FOCUS_Y, (v) => -v),
      blur: [...SWOOSHES.flatMap((s) => swooshBlur(s)), ...cutBlur()],
    },
  },
  {
    id: "camera", name: "Camera (zoom + sway)", type: "null", label: "#D9F9B9", props: { x: 960, y: 540 },
    keyframes: { scale: keys(ZOOM), rotation: SWAY },
  },

  // ================= grid =================
  {
    id: "grid", name: "Grid (moves with the canvas)", type: "path", label: "#F4F9EE", locked: true, parent: "stage",
    props: {
      d: GRID_D, x: GB.x0, y: GB.y0, anchorX: 0, anchorY: 0,
      fill: "rgba(0,0,0,0)", stroke: "rgba(10,26,29,0.08)", strokeWidth: 1,
    },
  },
];

const shot = {
  name: "SES-09→OBK-01 · Live, replay → Orderbuch roulette",
  note: "Ending is ONE camera move (2.5s, Figma Slow) from the Money layout straight into the candle; the wall → candle handover happens during it. Before: three moves: Figma-Slow dive into the wall → one whip to the candle (band/dim/selection handover inside it) → push into the candle → ladder. ~5s tighter. Wall dive uses Figma's Slow spring. Adds OBK-07a/b at the end: push into the green candle sliced into $4 levels ('Jede Kerze von { innen }.'), then it opens into the footprint delta ladder (+301, POC 85,884). Wall zoom is a single keyframed move (1× → 15×). Adds OBK-03→07 at the end: pull back as the wall band extends, heatmap dims and the selection hands off to the green candle, Footprint HUD. OBK-02 heatmap window now assembles: body unfolds from the plot, axis/tools/toolbar/ticker/rail slide in, Orderflow panel builds section by section, candles draw on, legend fades in. Adds OBK-02 · Money at the end: dive through the Heatmap thumb into the live heatmap window, pull back from the wall, headline/header/props build, cursor drags the 412 BTC wall selection. Orderbuch hold comes alive: book floats/tilts with a breathing shadow, tile counter-drifts, slow camera push, icon bob, Heatmap thumb breathes. Cursor on top of everything; grid now moves with the camera (last swoosh pulls back to 1:1 on the grid). Choreographed builds (window → header → caption; Replay, timeline, VHS, stopwatch each enter differently), camera pushes into the live candles and rides the replay playhead, louder live chart, handheld sway",
  width: 1920,
  height: 1080,
  fps: FPS,
  duration: f(DURATION),
  background: PAPER,
  layers,
};

const dir = new URL("../shots/ses-09-live-replay/", import.meta.url);
mkdirSync(dir, { recursive: true });
const VERSION = process.argv[2] ?? "v015";
writeFileSync(new URL(`${VERSION}.json`, dir), JSON.stringify(shot, null, 2) + "\n");
console.log(`wrote shots/ses-09-live-replay/${VERSION}.json (${layers.length} layers, ${f(DURATION)}s)`);
