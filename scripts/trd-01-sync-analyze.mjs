// TRD-01 → TRD-07 (Trademania V3, Figma section "Section 4", node 15834:41942):
// trade cards drop onto the paper grid one by one → they make room for the
// "Sync and Analyze your trades" headline (word stagger, icon pops) → parallax
// push into the Analyze icon (grid slow, headline mid, cards fast + defocused).
//
// Geometry comes from the Figma frames (1920×1080). Every depth group is a null
// pivoting on the Analyze icon's center, so the zoom is a single scale per group.
//
//   node scripts/trd-01-sync-analyze.mjs

import { mkdirSync, writeFileSync } from "node:fs";
import { getEase } from "../src/lib/easing.ts";

const FPS = 30;
const f = (n) => +(n / FPS).toFixed(4); // frame → seconds
const k = (frame, v, ease) => (ease ? { t: f(frame), v, ease } : { t: f(frame), v });
const r2 = (n) => +n.toFixed(2);

const INK = "#0a1a1d";
const PAPER = "#f4f9ee";
const TILE = "#e2ead9";
const UP = "#16b26b";
const DOWN = "#e5484d";

// Camera pivot = Analyze icon center in TRD-05 (headline 390,428 + icon 622,4 + 52).
const PIV = { x: 1064, y: 484 };

// ---------- timing ----------
// Cards pop like the chat bubbles in assets/ref-pop.mov: each new card springs
// in next to the pile near the middle and, as it grows, physically shoves the
// cards it touches (which shove others in turn). Then the headline grows out of
// the middle and pushes them all out of its way. Nothing ever overlaps: the
// positions are simulated frame by frame.
const CARD_IN = [6, 26, 46, 64]; // BTC, ETH, SOL, XRP
const POP = 14, POP_S0 = 0.3; // a card springs in from 30% over 14 frames (figmaBouncy)
const HEAD = 82; // headline starts growing from the middle
const ZOOM = 128, ZOOM_END = 170;
const DURATION = 180;

// Zoom end scales, from the TRD-07 depth frames (grid 2.329, headline 5.425).
// Cards get a bit more than Figma's 5.41 so they read as the near plane.
const GRID_END = 2.329, HEAD_END = 5.425, CARDS_END = 6.2;

// ---------- grid (TRD-05 "Grid", offset +6px) ----------
const cols = Array.from({ length: 12 }, (_, i) => 80.5 + 160 * i);
const rows = [77.6429, 231.929, 386.214, 540.5, 694.786, 849.072, 1003.36];
const GRID_D = [
  ...cols.map((x) => `M${x} 0V1080`),
  ...rows.map((y) => `M0 ${y}H1920`),
].join("");

// ---------- trade cards (600-wide card; SOL is the same card at 0.75) ----------
const CARD_W = 600, CARD_H = 164.23;
const PAD_L = 28.846, PAD_R = 34.615, GAP = 20.192, COIN = 63.462;
const GRID_OPACITY = 0.1;
const CARD_OPACITY = 0.4; // whole card layer, applied once (cards don't see through each other)
const LH = 1.2915; // Geist "normal" line height (Market column 103.65 = 3 lines + 2 gaps)
const L1 = 33.173, L2 = 21.635, L3 = 18.75, LGAP = 4.327;
const COIN_X = -CARD_W / 2 + PAD_L + COIN / 2;
const MARKET_X = -CARD_W / 2 + PAD_L + COIN + GAP;
const RESULT_X = CARD_W / 2 - PAD_R;
const MARKET_TOP = -(L1 * LH + L2 * LH + L3 * LH + 2 * LGAP) / 2;
const RESULT_TOP = -(L1 * LH + L2 * LH + LGAP) / 2;

// `spawn` = where each card wants to pop in (moved out to the nearest free spot).
const CARDS = [
  { id: "btc", pair: "BTCUSDT", meta: "Long · 10× · Bitunix", date: "Oct 8, 14:32", pnl: "+2.41%", usd: "+$1,240.50", up: true, coin: "#f7931a", letter: "B", rot: -5, scale: 1, spawn: [960, 540] },
  { id: "eth", pair: "ETHUSDT", meta: "Short · 5× · Blofin", date: "Oct 8, 11:05", pnl: "−0.82%", usd: "−$312.40", up: false, coin: "#627eea", letter: "E", rot: 3, scale: 1, spawn: [1130, 610] },
  { id: "sol", pair: "SOLUSDT", meta: "Long · 20× · Kraken", date: "Oct 7, 22:48", pnl: "+5.12%", usd: "+$860.00", up: true, coin: "#9945ff", letter: "S", rot: -4, scale: 0.75, spawn: [800, 620] },
  { id: "xrp", pair: "XRPUSDT", meta: "Long · 3× · Bitunix", date: "Oct 7, 09:16", pnl: "+1.07%", usd: "+$95.30", up: true, coin: "#23292f", letter: "X", rot: -4, scale: 1, spawn: [1060, 470] },
];

// ---------- layout: push apart so nothing overlaps ----------
const unit = (dx, dy) => {
  const d = Math.hypot(dx, dy) || 1;
  return [dx / d, dy / d, d];
};
const GAP_PX = 24;
const box = (c) => {
  const w = CARD_W * c.scale, h = CARD_H * c.scale, a = (Math.abs(c.rot) * Math.PI) / 180;
  return [w * Math.cos(a) + h * Math.sin(a), w * Math.sin(a) + h * Math.cos(a)]; // rotated bounds
};
// Shove overlapping boxes apart along the line between their centers, just far
// enough to clear. `fixed` ones don't move (the card that just popped, the
// headline); the rest get shoved, which can chain.
function relax(items) {
  for (let iter = 0; iter < 400; iter++) {
    let moved = false;
    for (let a = 0; a < items.length; a++) {
      for (let b = a + 1; b < items.length; b++) {
        const A = items[a], B = items[b];
        if (A.fixed && B.fixed) continue;
        const dx = B.p[0] - A.p[0], dy = B.p[1] - A.p[1];
        const ox = (A.w + B.w) / 2 + GAP_PX - Math.abs(dx);
        const oy = (A.h + B.h) / 2 + GAP_PX - Math.abs(dy);
        if (ox <= 0 || oy <= 0) continue;
        moved = true;
        const [ux, uy] = unit(dx, dy);
        const d = Math.min(ox / Math.max(Math.abs(ux), 1e-3), oy / Math.max(Math.abs(uy), 1e-3)) + 0.5;
        const shareA = A.fixed ? 0 : B.fixed ? 1 : 0.5;
        A.p[0] -= ux * d * shareA;
        A.p[1] -= uy * d * shareA;
        B.p[0] += ux * d * (1 - shareA);
        B.p[1] += uy * d * (1 - shareA);
      }
    }
    if (!moved) break;
  }
}
// ---------- push simulation ----------
const HEAD_C = [960.5, 540]; // headline center (shot space)
const HEAD_W = 1141, HEAD_H = 224; // TRD-05 headline box (icons included)
const GROW = 16; // headline growth, frames
const BUNCH = 0.3; // headline start scale
const ease = (name, a, b, t0, dur, f) => a + (b - a) * getEase(name)(Math.min(1, Math.max(0, (f - t0) / dur)));
const SIM_END = DURATION;
const PULL = 0.05; // per-frame pull toward the middle, so the pile stays packed
const EDGE = 48; // keep cards this far inside the frame
const sizeOf = (c, i, f) => {
  const s = c.scale * ease("figmaBouncy", POP_S0, 1, CARD_IN[i], POP, f);
  const a = (Math.abs(ease("figmaBouncy", c.rot * 2.5, c.rot, CARD_IN[i], POP, f)) * Math.PI) / 180;
  const w = CARD_W * s, h = CARD_H * s;
  return [w * Math.cos(a) + h * Math.sin(a), w * Math.sin(a) + h * Math.cos(a)];
};
const overlaps = (A, B) =>
  (A.w + B.w) / 2 + GAP_PX - Math.abs(B.p[0] - A.p[0]) > 0 && (A.h + B.h) / 2 + GAP_PX - Math.abs(B.p[1] - A.p[1]) > 0;

// tracks[i][f] = card i's center at frame f (from its pop on).
const tracks = CARDS.map(() => []);
{
  const live = [];
  for (let f = 0; f <= SIM_END; f++) {
    CARDS.forEach((c, i) => {
      if (CARD_IN[i] !== f) return;
      const [w, h] = sizeOf(c, i, f);
      const it = { i, p: [...c.spawn], w, h };
      // Pop into the nearest free spot: slide out from the pile's middle until clear.
      const n = live.length;
      const mid = n ? [live.reduce((a, o) => a + o.p[0], 0) / n, live.reduce((a, o) => a + o.p[1], 0) / n] : c.spawn;
      const [ux, uy] = unit(c.spawn[0] - mid[0] || 1, c.spawn[1] - mid[1]);
      while (live.some((o) => overlaps(o, it))) it.p = [it.p[0] + ux * 2, it.p[1] + uy * 2];
      live.push(it);
    });
    // The newest card is growing: it pushes, it doesn't get pushed.
    const newest = Math.max(-1, ...live.map((o) => o.i));
    const items = live.map((it) => {
      const [w, h] = sizeOf(CARDS[it.i], it.i, f);
      return { p: [...it.p], w, h, fixed: it.i === newest && f < CARD_IN[it.i] + POP };
    });
    if (f >= HEAD) {
      const s = ease("figmaSlow", BUNCH, 1, HEAD, GROW, f);
      items.push({ p: [...HEAD_C], w: HEAD_W * s, h: HEAD_H * s, fixed: true });
    }
    // Settle: drift toward the middle, then get pushed back out by whatever is in
    // the way (other cards, the headline, the frame edges).
    for (const it of items) {
      if (it.fixed) continue;
      it.p[0] += (HEAD_C[0] - it.p[0]) * PULL;
      it.p[1] += (HEAD_C[1] - it.p[1]) * PULL;
    }
    for (let pass = 0; pass < 4; pass++) {
      relax(items);
      for (const it of items) {
        if (it.fixed) continue;
        it.p[0] = Math.min(1920 - EDGE - it.w / 2, Math.max(EDGE + it.w / 2, it.p[0]));
        it.p[1] = Math.min(1080 - EDGE - it.h / 2, Math.max(EDGE + it.h / 2, it.p[1]));
      }
    }
    live.forEach((it, n) => {
      it.p = items[n].p;
      tracks[it.i][f] = [r2(it.p[0]), r2(it.p[1])];
    });
  }
}
// Per-frame track → linear keys, only where the card is moving.
function trackKeys(track, axis, off) {
  const keys = [];
  track.forEach((p, f) => {
    if (!p) return;
    const v = r2(p[axis] - off);
    const differs = (q) => q && r2(q[axis] - off) !== v;
    if (!keys.length || differs(track[f - 1]) || differs(track[f + 1])) keys.push(k(f, v, "linear"));
  });
  return keys;
}

const txt = (size, weight, extra) => ({
  fontFamily: "Geist", fontWeight: weight, fontSize: size, letterSpacing: r2(-size / 100),
  lineHeight: LH, anchorY: 0, fill: INK, ...extra,
});

function card(c, i) {
  const t0 = CARD_IN[i];
  const rel = ([x, y]) => [r2(x - PIV.x), r2(y - PIV.y)];
  const g = `card-${c.id}`;
  const xs = trackKeys(tracks[i], 0, PIV.x), ys = trackKeys(tracks[i], 1, PIV.y);
  const [lx, ly] = [xs.at(-1).v, ys.at(-1).v];

  return [
    {
      id: g,
      name: `Card · ${c.pair}`,
      type: "null",
      parent: "cards",
      label: "#D9F9B9",
      props: { x: lx, y: ly, rotation: c.rot, scale: c.scale },
      keyframes: {
        x: xs,
        y: ys,
        rotation: [k(t0, r2(c.rot * 2.5), "figmaBouncy"), k(t0 + POP, c.rot)],
        scale: [k(t0, r2(c.scale * POP_S0), "figmaBouncy"), k(t0 + POP, c.scale)],
        opacity: [k(t0, 0, "easeOut"), k(t0 + 4, 1)],
      },
    },
    { id: `${g}-pnl`, name: "PnL %", type: "text", parent: g, props: txt(L1, 600, { text: c.pnl, fill: c.up ? UP : DOWN, align: "right", anchorX: 1, x: r2(RESULT_X), y: r2(RESULT_TOP) }) },
    { id: `${g}-usd`, name: "PnL", type: "text", parent: g, props: txt(L2, 500, { text: c.usd, align: "right", anchorX: 1, x: r2(RESULT_X), y: r2(RESULT_TOP + L1 * LH + LGAP) }) },
    { id: `${g}-pair`, name: "Pair", type: "text", parent: g, props: txt(L1, 600, { text: c.pair, align: "left", anchorX: 0, x: r2(MARKET_X), y: r2(MARKET_TOP) }) },
    { id: `${g}-meta`, name: "Meta", type: "text", parent: g, props: txt(L2, 500, { text: c.meta, align: "left", anchorX: 0, x: r2(MARKET_X), y: r2(MARKET_TOP + L1 * LH + LGAP) }) },
    { id: `${g}-date`, name: "Date", type: "text", parent: g, props: txt(L3, 500, { text: c.date, align: "left", anchorX: 0, x: r2(MARKET_X), y: r2(MARKET_TOP + (L1 + L2) * LH + 2 * LGAP) }) },
    { id: `${g}-letter`, name: "Coin letter", type: "text", parent: g, props: { text: c.letter, fontFamily: "Geist", fontWeight: 600, fontSize: 31.731, letterSpacing: -0.317, lineHeight: 1, align: "center", fill: "#ffffff", x: r2(COIN_X), y: 0 } },
    { id: `${g}-coin`, name: "Coin", type: "ellipse", parent: g, props: { width: COIN, height: COIN, fill: c.coin, x: r2(COIN_X), y: 0 } },
    { id: `${g}-bg`, name: "Card", type: "rect", parent: g, props: { width: CARD_W, height: CARD_H, radius: 5.769, fill: "#ffffff", stroke: INK, strokeWidth: 1.442 } },
  ];
}

// ---------- headline (TRD-05 "Headline" at 390,428; 104px Geist SemiBold) ----------
const HX = 390 - PIV.x, HY = 428 - PIV.y;
// The headline grows out of its center as one piece: every word and icon starts
// at 30% scale, bunched toward the middle.
const MID = { x: HEAD_C[0] - PIV.x, y: HEAD_C[1] - PIV.y };
const emerge = (cx, cy) => {
  const t = HEAD; // grows as one piece, so the push simulation's headline box is exact
  const sx = MID.x + (cx - MID.x) * BUNCH, sy = MID.y + (cy - MID.y) * BUNCH;
  return {
    x: [k(t, r2(sx), "figmaSlow"), k(t + GROW, r2(cx))],
    y: [k(t, r2(sy), "figmaSlow"), k(t + GROW, r2(cy))],
    scale: [k(t, BUNCH, "figmaSlow"), k(t + GROW, 1)],
    opacity: [k(t, 0, "easeOut"), k(t + 5, 1)],
  };
};
// Words are centered on their Figma boxes (Row 1 widths: Sync 240, and 182, Analyze 383).
const word = (id, text, cx, cy) => ({
  id: `w-${id}`,
  name: `Word · ${text}`,
  type: "text",
  parent: "headline",
  props: {
    text, fontFamily: "Geist", fontWeight: 600, fontSize: 104, letterSpacing: -2.08, lineHeight: 1.08,
    align: "center", anchorX: 0.5, anchorY: 0.5, fill: INK, x: r2(cx), y: r2(cy),
  },
  keyframes: emerge(cx, cy),
});
const iconGroup = (id, name, cx, cy) => ({
  id,
  name,
  type: "null",
  parent: "headline",
  label: "#c5b9ee",
  props: { x: r2(cx), y: r2(cy) },
  keyframes: emerge(cx, cy),
});

const SYNC_C = { x: HX + 52, y: HY + 4 + 52 };
const ANA_C = { x: HX + 622 + 52, y: HY + 4 + 52 }; // == 0,0 (the pivot)
const BARS = [
  { x: 28, top: 57 },
  { x: 44, top: 45 },
  { x: 60, top: 53 },
  { x: 76, top: 29 },
];

const headline = [
  word("sync", "Sync", HX + 136 + 120, HY + 56),
  word("and", "and", HX + 408 + 91, HY + 56),
  word("analyze", "Analyze", HX + 758 + 191.5, HY + 56),
  word("trades", "your trades", MID.x, HY + 112 + 56), // Row 2 is centered under Row 1
  // Sync icon: tile pops, arrows spin once.
  iconGroup("icon-sync", "Icon · Sync", SYNC_C.x, SYNC_C.y),
  {
    id: "sync-glyph-spin",
    name: "Sync glyph spin",
    type: "null",
    parent: "icon-sync",
    props: { x: 0, y: 0 },
    keyframes: { rotation: [k(HEAD + 10, -180, "figmaSlow"), k(HEAD + 40, 0)] },
  },
  {
    id: "sync-glyph",
    name: "Sync glyph",
    type: "path",
    parent: "sync-glyph-spin",
    props: {
      d: "M30 46C34 34 46 26 58 28C66 29 72 33 76 39M63 39H76V26M74 58C70 70 58 78 46 76C38 75 32 71 28 65M41 65H28V78",
      pathOrigin: "zero", x: -52, y: -52, fill: "rgba(0,0,0,0)", stroke: INK, strokeWidth: 7, lineCap: "butt",
    },
  },
  { id: "sync-tile", name: "Sync tile", type: "rect", parent: "icon-sync", props: { width: 104, height: 104, radius: 8, fill: TILE } },
  // Analyze icon: tile pops, bars grow up in a stagger. Its center is the camera pivot.
  iconGroup("icon-analyze", "Icon · Analyze", ANA_C.x, ANA_C.y),
  ...BARS.map((b, i) => {
    const t = HEAD + 8 + i * 2;
    const h = 75 - b.top;
    return {
      id: `bar-${i + 1}`,
      name: `Bar ${i + 1}`,
      type: "rect",
      parent: "icon-analyze",
      props: { x: b.x - 52, y: 75 - 52, anchorY: 1, width: 7, height: h, fill: INK },
      keyframes: { height: [k(t, 0, "figmaSlow"), k(t + 14, h)] },
    };
  }),
  { id: "analyze-tile", name: "Analyze tile", type: "rect", parent: "icon-analyze", props: { width: 104, height: 104, radius: 8, fill: TILE } },
];

// ---------- depth groups (all pivot on the Analyze icon) ----------
const zoom = (end) => [k(ZOOM, 1, "figmaSlow"), k(ZOOM_END, end)];
// Figma keeps the grid at 1px hairlines while it zooms: counter-scale the
// stroke, sampled every 2 frames along the same figmaSlow curve.
const slow = getEase("figmaSlow");
const hairline = [];
for (let fr = ZOOM; fr <= ZOOM_END; fr += 2) {
  const s = 1 + (GRID_END - 1) * slow((fr - ZOOM) / (ZOOM_END - ZOOM));
  hairline.push(k(fr, +(1 / s).toFixed(4), "linear"));
}

const layers = [
  {
    id: "cards",
    name: "Depth · near (cards)",
    type: "null",
    label: "#D9F9B9",
    props: { x: PIV.x, y: PIV.y, isolate: "yes", opacity: CARD_OPACITY },
    keyframes: {
      scale: zoom(CARDS_END),
      // Near plane passes the lens: defocus as it grows.
      blur: [k(ZOOM + 8, 0, "figmaSlow"), k(ZOOM_END, 12)],
    },
  },
  ...CARDS.map(card).reverse().flat(), // newest card on top
  {
    id: "headline",
    name: "Depth · mid (headline)",
    type: "null",
    label: "#c5b9ee",
    props: { x: PIV.x, y: PIV.y },
    keyframes: { scale: zoom(HEAD_END) },
  },
  ...headline,
  {
    id: "grid-depth",
    name: "Depth · far (grid)",
    type: "null",
    label: "#9fdcc6",
    props: { x: PIV.x, y: PIV.y },
    keyframes: { scale: zoom(GRID_END) },
  },
  {
    id: "grid",
    name: "Grid",
    type: "path",
    parent: "grid-depth",
    props: { d: GRID_D, pathOrigin: "zero", x: 6 - PIV.x, y: -PIV.y, fill: "rgba(0,0,0,0)", stroke: INK, strokeWidth: 1, opacity: GRID_OPACITY },
    keyframes: { strokeWidth: hairline },
  },
];

const shot = {
  name: "TRD-01 · Sync and analyze",
  note: "Real pushing, no overlaps on any frame: each card grows in next to the pile and shoves the cards it touches (chain pushes, 24px gaps); the headline grows from the middle and shoves them all out of its way. Positions simulated per frame.",
  width: 1920,
  height: 1080,
  fps: FPS,
  duration: f(DURATION),
  background: PAPER,
  layers,
};

const dir = new URL("../shots/trd-01-sync-analyze/", import.meta.url);
mkdirSync(dir, { recursive: true });
writeFileSync(new URL("v006.json", dir), JSON.stringify(shot, null, 2) + "\n");
console.log(`wrote shots/trd-01-sync-analyze/v006.json (${layers.length} layers, ${f(DURATION)}s)`);
