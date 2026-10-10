// TRD-01b v010 · v009 + end transition: push into the Analyze meme (Figma TRD-06/07 zooms).
//  1. 0–2.5s   big memes: Sync opens big; Analyze pops in big on the right (leaning
//              right) while Sync tucks into the top-left corner.
//  2. 2.5–3.4s both memes shrink into their line-1 slots as "Sync / und / analysieren"
//              rise; the camera eases out just enough to frame the whole line.
//  3. 3.7s →   line 2 lands, then the cards slide straight out of the text band into
//              two lanes (center-out, accelerating). The top lane runs left and the bottom
//              lane runs right, with a kick that settles into a steady drift; the PnL counts
//              up and stays live. The camera pulls back to the full canvas.
// Cards in a lane keep a fixed gap and never rotate, so they can't overlap.
//
//   node --no-warnings scripts/trd-01b-type-first-v010.mjs  →  shots/trd-01b-type-first/v010.json

import { mkdirSync, writeFileSync } from "node:fs";
import { EASES, getEase } from "../src/lib/easing.ts";
import { decimate } from "./lib/card-physics.mjs";

const r4 = (v) => +v.toFixed(4);
const FPS = 60, W = 1920, H = 1080, C = [960, 540];
const INK = "#0A1A1D", PAPER = "#F4F9EE";
const DEG = Math.PI / 180;
// v007: Apple-style ease-out (quick start, long soft settle, no overshoot) for every move —
// figmaSlow's gentle start made the long moves read as linear. Used baked and in keyframes.
const APPLE = [0.22, 1, 0.36, 1];
const slow = getEase(APPLE), quick = EASES.figmaQuick;
const clamp01 = (u) => Math.max(0, Math.min(1, u));
const lerp = (a, b, e) => a + (b - a) * e;
const SCALE = 0.75;

// Card data (template + mock trades) and the card template, from v010.
const CARDS = {
  btc: { pair: "BTCUSDT", meta: "Long · 10× · Bitunix", date: "8. Okt., 14:32", pnl: "+2.41%", usd: "+$1,240.50", up: true, coin: "#F7931A", letter: "B" },
  eth: { pair: "ETHUSDT", meta: "Short · 5× · Blofin", date: "8. Okt., 11:05", pnl: "−0.82%", usd: "−$312.40", up: false, coin: "#627EEA", letter: "E" },
  sol: { pair: "SOLUSDT", meta: "Long · 20× · Kraken", date: "7. Okt., 22:48", pnl: "+5.12%", usd: "+$860.00", up: true, coin: "#9945FF", letter: "S" },
  xrp: { pair: "XRPUSDT", meta: "Long · 3× · Bitunix", date: "7. Okt., 09:16", pnl: "+1.07%", usd: "+$95.30", up: true, coin: "#23292F", letter: "X", ring: true },
  // Mock trades on the same template.
  doge: { pair: "DOGEUSDT", meta: "Long · 25× · Bybit", date: "8. Okt., 09:41", pnl: "+7.85%", usd: "+$412.70", up: true, coin: "#C2A633", letter: "D" },
  bnb: { pair: "BNBUSDT", meta: "Short · 8× · OKX", date: "7. Okt., 18:20", pnl: "−1.34%", usd: "−$188.90", up: false, coin: "#F3BA2F", letter: "B" },
  avax: { pair: "AVAXUSDT", meta: "Long · 12× · Bitunix", date: "7. Okt., 15:02", pnl: "+3.66%", usd: "+$527.40", up: true, coin: "#E84142", letter: "A" },
  link: { pair: "LINKUSDT", meta: "Short · 4× · Kraken", date: "6. Okt., 21:37", pnl: "+0.94%", usd: "+$74.10", up: true, coin: "#2A5ADA", letter: "L" },
};

// ---------- cards ----------
// Designed card: 600 × 164.23, padding 28.846 / 34.615, gap 20.192, radius 5.769.
const CW = 600, CH = 164.23, LH = 1.3; // Geist "normal" line height ≈ 1.3
function cardLayers(id, d) {
  const g = (dx, dy) => ({ x: r4(dx - CW / 2), y: r4(dy - CH / 2) }); // card-space → centered
  const font = (size, weight, fill, extra = {}) => ({ fontFamily: "Geist", fontSize: size, fontWeight: weight, letterSpacing: r4(-size / 100), lineHeight: LH, fill, anchorX: 0, anchorY: 0, align: "left", ...extra });
  const colTop = 28.846 + (CH - 2 * 28.846 - (33.173 + 21.635 + 18.75) * LH - 2 * 4.327) / 2;
  const resTop = (CH - (33.173 + 21.635) * LH - 4.327) / 2;
  const mx = 28.846 + 63.462 + 20.192, rx = CW - 34.615;
  return [
    { id: `${id}-pnl`, name: `${d.pair} PnL %`, type: "text", parent: id, props: { ...g(rx, resTop), ...font(33.173, 600, d.up ? "#00D16F" : "#FF6479", { anchorX: 1, align: "right" }), text: d.pnl } },
    { id: `${id}-usd`, name: `${d.pair} PnL $`, type: "text", parent: id, props: { ...g(rx, resTop + 33.173 * LH + 4.327), ...font(21.635, 500, "rgba(255,255,255,0.56)", { anchorX: 1, align: "right" }), text: d.usd } },
    { id: `${id}-pair`, name: d.pair, type: "text", parent: id, props: { ...g(mx, colTop), ...font(33.173, 600, "#FFFFFF"), text: d.pair } },
    { id: `${id}-meta`, name: `${d.pair} meta`, type: "text", parent: id, props: { ...g(mx, colTop + 33.173 * LH + 4.327), ...font(21.635, 500, "rgba(255,255,255,0.56)"), text: d.meta } },
    { id: `${id}-date`, name: `${d.pair} date`, type: "text", parent: id, props: { ...g(mx, colTop + (33.173 + 21.635) * LH + 2 * 4.327), ...font(18.75, 500, "rgba(255,255,255,0.38)"), text: d.date } },
    { id: `${id}-letter`, name: `${d.pair} coin letter`, type: "text", parent: id, props: { ...g(28.846 + 31.731, CH / 2), fontFamily: "Geist", fontSize: 31.731, fontWeight: 600, letterSpacing: -0.317, lineHeight: 1.2, fill: "#FFFFFF", text: d.letter } },
    {
      id: `${id}-coin`, name: `${d.pair} coin`, type: "ellipse", parent: id,
      props: { ...g(28.846 + 31.731, CH / 2), width: 63.462, height: 63.462, fill: d.coin, stroke: d.ring ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0)", strokeWidth: d.ring ? 1.5 : 0 },
    },
    { id: `${id}-bg`, name: `${d.pair} card`, type: "rect", parent: id, props: { x: 0, y: 0, width: CW, height: CH, radius: 5.769, fill: "#0F0F12", stroke: "rgba(255,255,255,0.1)", strokeWidth: 1.442 } },
  ];
}


const layers = [];
const add = (...ls) => layers.push(...ls);

// ---------- timeline ----------
const T = {
  sync: 0.0, analyze: 1.2, // big memes
  toSlots: 2.5, // memes shrink into line 1 while the words rise
  words: { Sync: 2.62, und: 2.7, analysieren: 2.78 },
  line2: 3.7, trades: 3.86, pullEnd: 5.0,
  zoom: 6.4, zoomEnd: 8.0, end: 8.1, // push into the Analyze meme until it fills the frame (transition)
};
const DURATION = T.end;

// ---------- headline geometry ----------
const HEAD = { fontFamily: "Geist", fontSize: 104, fontWeight: 600, letterSpacing: -2.08, lineHeight: 1.08, fill: INK, anchorX: 0, align: "left" };
const ROW_H = 104 * 1.08, GAPX = 32;
const WORD_W = { Sync: 237.64, und: 181.56, analysieren: 547.04 };
const TILE = { w: 166, h: 104 };
const row1Items = [["tile", "sync"], ["word", "Sync"], ["word", "und"], ["tile", "analyze"], ["word", "analysieren"]];
const row1W = row1Items.reduce((s, [k, v]) => s + (k === "tile" ? TILE.w : WORD_W[v]), 0) + GAPX * (row1Items.length - 1);
const ROW1_Y_SOLO = 540, ROW1_Y_FINAL = 540 - ROW_H / 2, ROW2_Y = ROW1_Y_FINAL + ROW_H;
const itemX = {};
{ let cx = 960 - row1W / 2; for (const [k, v] of row1Items) { const w = k === "tile" ? TILE.w : WORD_W[v]; itemX[v] = cx + w / 2; cx += w + GAPX; } }
const row1Y = (t) => (t < T.line2 - 0.02 ? ROW1_Y_SOLO : lerp(ROW1_Y_SOLO, ROW1_Y_FINAL, slow(clamp01((t - (T.line2 - 0.02)) / 0.42))));

// ---------- trades: a four-lane live feed ----------
// Four conveyor lanes, two above and two below the headline, running in alternating
// directions at different speeds. The inner lanes slide straight out of the text band;
// the outer lanes drop in from the frame edges a beat later (they never cross the inner
// ones). Each lane starts with a kick and settles into a quick, steady drift; cards
// further out scroll in from the edges, so the feed never ends.
// Cards in a lane keep a fixed gap and never rotate, so they can never overlap.
const COINS = {
  btc: "#F7931A", eth: "#627EEA", sol: "#9945FF", xrp: "#23292F", doge: "#C2A633", bnb: "#F3BA2F",
  avax: "#E84142", link: "#2A5ADA", ada: "#0033AD", dot: "#E6007A", ltc: "#BFBBBB", trx: "#EF0027",
};
const EXCH = ["Bitunix", "Blofin", "Kraken", "Bybit", "OKX"], LEV = [3, 4, 5, 8, 10, 12, 15, 20, 25];
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const money = (n) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function mockTrade(coin, i) {
  const up = rnd() < 0.78, pct = up ? 0.6 + rnd() * 7.4 : 0.2 + rnd() * 1.8, usd = pct * (40 + rnd() * 460);
  const day = 8 - Math.floor(i / 9), hh = String(Math.floor(rnd() * 24)).padStart(2, "0"), mm = String(Math.floor(rnd() * 60)).padStart(2, "0");
  return {
    pair: `${coin.toUpperCase()}USDT`, meta: `${rnd() < 0.68 ? "Long" : "Short"} · ${LEV[Math.floor(rnd() * LEV.length)]}× · ${EXCH[Math.floor(rnd() * EXCH.length)]}`,
    date: `${day}. Okt., ${hh}:${mm}`, pnl: `${up ? "+" : "−"}${pct.toFixed(2)}%`, usd: `${up ? "+" : "−"}$${money(usd)}`, up, coin: COINS[coin], logo: coin,
  };
}
const LANE_SCALE = 0.9, CARD_W = CW * LANE_SCALE, CARD_H = CH * LANE_SCALE, LANE_GAP = 28, PITCH = CARD_W + LANE_GAP;
const BAND_HALF = ROW_H + 14; // the headline's two rows + a little padding
const INNER = BAND_HALF + 36 + CARD_H / 2, OUTER = INNER + CARD_H + 26; // lane distance from the frame center
const PER_LANE = 7;
// Top to bottom; directions alternate. `phase` staggers the lanes into a brick pattern.
const LANES = {
  top2: { y: 540 - OUTER, dir: 1, v: 120, phase: 0.25, from: "edge" },
  top1: { y: 540 - INNER, dir: -1, v: 95, phase: 0, from: "band" },
  bottom1: { y: 540 + INNER, dir: 1, v: 105, phase: 0.5, from: "band" },
  bottom2: { y: 540 + OUTER, dir: -1, v: 135, phase: 0.75, from: "edge" },
};
const CARDS2 = {}, SLOT = {}, SPAWN = {};
{
  const coins = Object.keys(COINS);
  let n = 0;
  for (const [lane, Ln] of Object.entries(LANES)) {
    Ln.ids = [];
    for (let k = 0; k < PER_LANE; k++) {
      const id = `t${String(++n).padStart(2, "0")}`, coin = coins[(n * 5 + Math.floor(n / 12)) % coins.length];
      CARDS2[id] = mockTrade(coin, n);
      SLOT[id] = { lane, x: 960 + (k - (PER_LANE - 1) / 2 + Ln.phase - 0.25) * PITCH };
      Ln.ids.push(id);
    }
  }
}
const ORDER = Object.values(LANES).flatMap((Ln) => Ln.ids);
// Lane travel: a kick that settles into a steady drift (integral of v·(1 + KICK·e^(−t/τ))).
const KICK = 3.2, TAU = 1.1; // v007: a longer, continuous slow-down (never a flat linear drift)
const travel = (t, v, t0) => { const u = Math.max(0, t - t0); return v * (u + KICK * TAU * (1 - Math.exp(-u / TAU))); };
// Emergence: center-out by distance. Inner lanes out of the text first, outer lanes ~0.25s later.
const SLIDE = 0.7, EDGE_DELAY = 0.25, LANE_T0 = {};
{
  for (const [band, delay] of [["band", 0], ["edge", EDGE_DELAY]]) {
    const ids = Object.entries(LANES).filter(([, Ln]) => Ln.from === band).flatMap(([, Ln]) => Ln.ids);
    ids.sort((a, b) => Math.abs(SLOT[a].x - 960) - Math.abs(SLOT[b].x - 960));
    let t = T.trades + delay;
    ids.forEach((id, i) => { SPAWN[id] = r4(Math.round(t * FPS) / FPS); t += Math.max(0.035, 0.1 - i * 0.006); });
  }
  for (const [lane, Ln] of Object.entries(LANES)) LANE_T0[lane] = Math.min(...Ln.ids.map((id) => SPAWN[id]));
}

// Impact when the Analyze meme lands (shared by the camera and the memes).
const HIT = T.analyze + 0.24; // Analyze reaches its spot and knocks Sync aside
const SHAKE = false; // v006: calm, Apple-like — no impact shake
const shake = (t) => {
  if (!SHAKE) return [0, 0, 0];
  const u = t - HIT;
  if (u < 0 || u > 0.45) return [0, 0, 0];
  const a = Math.exp(-u * 9);
  return [a * 14 * Math.sin(u * 62), a * 9 * Math.sin(u * 47 + 1), a * 1.2 * Math.sin(u * 55)];
};

// ---------- camera ----------
// End transition target: the Analyze meme in its slot, scaled until the tile covers 1920×1080.
const PUSH_AT = [itemX.analyze, ROW1_Y_FINAL], Z_FULL = (1920 / TILE.w) * 1.012;
const PUSH = getEase([0.6, 0, 0.3, 1]); // gentle start, accelerates in, settles on the full frame
// Depth layers (Figma: far grid / mid headline / near cards) share the camera's focus but
// zoom by depth^k during the push: near cards rush out of frame, the grid barely moves.
const DEPTH_K = { near: 1.6, far: 0.45 };
// Memes: a little tight (1.5×). Type: eases to frame all of line 1 (1.25×). Trades: pull
// back to the full canvas as they burst, then a hair of continued drift.
function camAt(t) {
  let z;
  if (t < T.toSlots) z = Math.exp(lerp(Math.log(1.5), Math.log(1.62), slow(clamp01(t / T.toSlots)))); // slow push behind the memes
  else if (t < T.trades) z = Math.exp(lerp(Math.log(1.62), Math.log(1.25), slow(clamp01((t - T.toSlots) / 0.9))));
  else z = Math.exp(lerp(Math.log(1.25), Math.log(1), slow(clamp01((t - T.trades) / (T.pullEnd - T.trades)))));
  z *= 1 - 0.015 * clamp01((Math.min(t, T.zoom) - T.pullEnd) / (T.zoom - T.pullEnd));
  const sh = shake(t); // the grid shakes too (memes add the same offset in screen space)
  if (t <= T.zoom) return { fx: C[0] - sh[0] / z, fy: C[1] - sh[1] / z, z, depth: 1 };
  // Transition: push into the Analyze meme until its video covers the frame. Zoom is eased
  // in log space; the meme's screen position glides to the center on the same curve.
  const e = PUSH(clamp01((t - T.zoom) / (T.zoomEnd - T.zoom)));
  const zz = Math.exp(lerp(Math.log(z), Math.log(Z_FULL), e));
  const s0 = [C[0] + z * (PUSH_AT[0] - C[0]), C[1] + z * (PUSH_AT[1] - C[1])]; // where the meme sits on screen at T.zoom
  const sx = lerp(s0[0], C[0], e), sy = lerp(s0[1], C[1], e);
  return { fx: PUSH_AT[0] - (sx - C[0]) / zz, fy: PUSH_AT[1] - (sy - C[1]) / zz, z: zz, depth: zz / z };
}
const cam = [];
for (let f = 0; f <= Math.round(DURATION * FPS); f++) cam.push({ t: f / FPS, ...camAt(f / FPS) });
const camTrack = (fn) => decimate(cam.map((c) => ({ t: r4(c.t), v: r4(fn(c)) })), 0.02);
add({
  id: "camera", name: "Camera", type: "null", label: "#c5b9ee", props: {},
  keyframes: { x: camTrack((c) => C[0] - c.z * (c.fx - C[0])), y: camTrack((c) => C[1] - c.z * (c.fy - C[1])), scale: camTrack((c) => c.z) },
});
for (const [layer, k] of Object.entries(DEPTH_K)) {
  const zl = (c) => c.z * Math.pow(c.depth, k - 1);
  add({
    id: `camera-${layer}`, name: `Camera · ${layer} (depth)`, type: "null", label: "#c5b9ee", props: {},
    keyframes: { x: camTrack((c) => C[0] - zl(c) * (c.fx - C[0])), y: camTrack((c) => C[1] - zl(c) * (c.fy - C[1])), scale: camTrack((c) => zl(c)) },
  });
}
const camOf = (t) => cam[Math.max(0, Math.min(cam.length - 1, Math.round(t * FPS)))];
const w2c = (x, y) => ({ x: r4(x - C[0]), y: r4(y - C[1]) });

add({ id: "grid", name: "Grid (Figma)", type: "image", parent: "camera-far", label: "#8c958a", props: { src: "grid.svg", ...w2c(966, 540), width: 1920, height: 1080 } });

// ---------- cards in their lanes ----------
for (const [lane, Ln] of Object.entries(LANES)) {
  const samples = [];
  for (let f = Math.round(T.trades * FPS); f <= Math.round(DURATION * FPS); f++) samples.push({ t: r4(f / FPS), v: r4(Ln.dir * travel(f / FPS, Ln.v, LANE_T0[lane])) });
  add({ id: `lane-${lane}`, name: `Lane · ${lane} (scroll)`, type: "null", parent: "camera-near", label: "#9fdcc6", props: { x: 0, y: r4(Ln.y - C[1]) },
    keyframes: { x: decimate(samples, 0.05) } });
}
for (const id of ORDER) {
  const d = CARDS2[id], { lane, x } = SLOT[id], Ln = LANES[lane], t0 = SPAWN[id];
  const ls = cardLayers(id, d).filter((l) => l.id !== `${id}-letter`).map((l) => ({ ...l, matte: "card-hide", matteMode: "inverse" }));
  // Light mode: white card, hairline outline, ink text, deeper green/red for contrast on white.
  const LIGHT = {
    [`${id}-bg`]: { radius: 2, fill: "#FFFFFF", stroke: "rgba(10,26,29,0.08)" }, // v008: no drop shadow
    [`${id}-pair`]: { fill: INK }, [`${id}-meta`]: { fill: "rgba(10,26,29,0.56)" }, [`${id}-date`]: { fill: "rgba(10,26,29,0.40)" },
    [`${id}-usd`]: { fill: "rgba(10,26,29,0.56)" }, [`${id}-pnl`]: { fill: d.up ? "#0B9A50" : "#E0394D" },
  };
  for (const l of ls) if (LIGHT[l.id]) Object.assign(l.props, LIGHT[l.id]);
  const coin = ls.find((l) => l.id === `${id}-coin`);
  Object.assign(coin, { type: "image", name: `${d.pair} logo`, props: { x: coin.props.x, y: coin.props.y, src: `coin-${d.logo}.svg`, width: 63.462, height: 63.462 } });
  const pnl = ls.find((l) => l.id === `${id}-pnl`), m = d.pnl.match(/^([+−-])([\d.]+)%$/);
  if (m) { // counts up as the card lands, then stays "live" with a small wobble
    const v = +m[2], keys = [{ t: r4(t0 + 0.1), v: 0, ease: APPLE }, { t: r4(t0 + 0.8), v, ease: "sineInOut" }];
    for (let k = 1, tk = t0 + 0.8; (tk += 0.38 + ((k * 7) % 5) * 0.06) < DURATION; k++)
      keys.push({ t: r4(tk), v: r4(v + Math.sin(k * 2.3 + v) * 0.06 * Math.max(1, v / 3)), ease: "sineInOut" });
    pnl.props.text = `${m[1]}{counter}%`;
    pnl.props.counterDecimals = 2;
    pnl.keyframes = { counter: keys };
  }
  // Slides straight out of the text band into the lane (lane-local y; the lane is at y=0).
  // Outer lanes drop in from beyond the frame edge instead (never crossing the inner lanes).
  const fromY = Ln.from === "band" ? 540 - Ln.y : Math.sign(Ln.y - 540) * 320;
  add({
    id, name: `Card · ${d.pair}`, type: "null", parent: `lane-${lane}`, label: d.coin, props: { x: r4(x - C[0]), scale: LANE_SCALE },
    keyframes: {
      y: [{ t: t0, v: r4(fromY), ease: APPLE }, { t: r4(t0 + SLIDE), v: 0 }],
      opacity: [{ t: t0, v: 0 }, { t: r4(t0 + 2 / FPS), v: 1 }],
    },
  }, ...ls);
}

// The text band: cards are hidden inside it, so they slide out from under the headline.
// It spans the whole width so cards beside the text come out of the same line.
add({
  id: "card-hide", name: "Card hide · text band (matte)", type: "rect", parent: "camera",
  props: { ...w2c(960, 540), width: 4000, height: r4(2 * BAND_HALF), fill: "#000000" },
});

// ---------- headline ----------
const RISE = 0.6, FADE = 0.22, MASK_TOP = -100, MASK_BOTTOM = 64, RISE_FROM = MASK_BOTTOM + ROW_H / 2 + 4;
const mask = (row) => ({ id: `${row}-mask`, name: `Mask · ${row} (matte)`, type: "rect", parent: row, props: { x: 0, y: r4((MASK_TOP + MASK_BOTTOM) / 2), width: 2200, height: MASK_BOTTOM - MASK_TOP, fill: "#000000" } });
const riseWord = (id, row, name, x, text, t) => ({
  id, name, type: "text", parent: row, matte: `${row}-mask`, props: { ...HEAD, x: r4(x), anchorY: 0.5, text },
  keyframes: { y: [{ t: r4(t), v: r4(RISE_FROM), ease: APPLE }, { t: r4(t + RISE), v: 0 }], opacity: [{ t: r4(t), v: 0, ease: "sineOut" }, { t: r4(t + FADE), v: 1 }] },
});
const head = [mask("row1")];
for (const [k, v] of row1Items) if (k === "word") head.push(riseWord(`word-${v.toLowerCase()}`, "row1", `Word · ${v}`, itemX[v] - WORD_W[v] / 2 - 960, v, T.words[v]));
const ROW2 = [["Sie", 152.57], ["alle", 172.33], ["Ihre", 180.86], ["Trades", 323.23]], SPACE = 22.46;
const row2W = ROW2.reduce((s, [, w]) => s + w, 0) + SPACE * (ROW2.length - 1);
head.push(mask("row2"));
{ let x2 = -row2W / 2; ROW2.forEach(([w, width], i) => { head.push(riseWord(`word2-${w.toLowerCase()}`, "row2", `Word · ${w}`, x2, w, T.line2 + 0.06 + i * 0.06)); x2 += width + SPACE; }); }
add(
  { id: "row2", name: "Headline · row 2", type: "null", parent: "camera", label: INK, props: w2c(960, ROW2_Y) },
  { id: "row1", name: "Headline · row 1", type: "null", parent: "camera", label: INK, props: { x: 0 },
    keyframes: { y: [{ t: r4(T.line2 - 0.02), v: w2c(0, ROW1_Y_SOLO).y, ease: APPLE }, { t: r4(T.line2 + 0.4), v: w2c(0, ROW1_Y_FINAL).y }] } },
  ...head,
);

// ---------- memes: big first, then into their slots ----------
const MEME = {
  sync: { src: "meme-sync.mp4", crop: [551, 66, 1103, 691], name: "Sync · Gif3", big: 830, park: { x: 330, y: 290, h: 280 }, tilt: -6 },
  analyze: { src: "meme-analyze.mp4", crop: [1290, 105, 816, 511], name: "Analyze · Gif1 basti (subject on the right)", big: 760, at: [1150, 560], lean: 4 },
};
// Screen-space pose → world (camera focus is the frame center).
const toWorld = (sx, sy, sh, t) => { const c = camOf(t); return { x: c.fx + (sx - C[0]) / c.z, y: c.fy + (sy - C[1]) / c.z, s: sh / c.z / TILE.h }; };
// Opening choreography (screen space, so the camera push only moves the grid behind):
//  · Sync springs up from below the frame, swinging upright with a little overshoot.
//  · Analyze is dealt in on top (leaning right) and the two fan out like a hand of cards;
//    the frame takes a short, soft shake as it lands.
//  · Both idle-float while playing, wind up (a small swell) and fly into their slots on an
//    arc with a swing, Analyze a beat after Sync.
const bouncy = slow; // Apple ease-out — no overshoot
const float = () => [0, 0, 0]; // v006: no idle float
const FLY = { sync: T.toSlots, analyze: T.toSlots + 0.07 }, FLY_DUR = 0.9, SWING = { sync: 0, analyze: 0 }, ARC = { sync: -24, analyze: -16 };
// A hand of cards: both panels sit on an arc around a pivot far below the frame, rotated
// by their angle on it (like cards fanned in a hand). Sync is held alone first, then
// Analyze gets dealt in on top from below-right and the hand fans open.
const PIVOT = [960, 540 + 1500], RADIUS = 1500, FAN = 12, HAND_H = 640;
const onHand = (deg) => ({ sx: PIVOT[0] + RADIUS * Math.sin(deg * DEG), sy: PIVOT[1] - RADIUS * Math.cos(deg * DEG) });
function memeScreen(v, m, t) {
  const fl = float(t, v === "sync" ? 0 : 2.1), sh = shake(t).map((x) => x * 0.6);
  const settled = clamp01((t - (T.analyze + 0.6)) / 0.4), breathe = 0 * settled; // v006: the fan holds still // the fan opens and closes a hair
  let sx, sy, h, rot;
  if (v === "sync") {
    const e = bouncy(clamp01((t - T.sync) / 1.1)); // springs up from below, swinging upright
    let deg = 0, hh = m.big;
    const k = bouncy(clamp01((t - (T.analyze + 0.04)) / 0.85)); // fans left as Analyze is dealt in
    deg = lerp(0, -FAN, k) - breathe; hh = lerp(m.big, HAND_H, k);
    const at = onHand(deg);
    sx = at.sx; sy = lerp(540 + 900, at.sy, e); h = hh * lerp(0.72, 1, e); rot = deg + lerp(-5, 0, e);
  } else {
    const e = bouncy(clamp01((t - T.analyze) / 0.85)); // dealt in from below-right, onto the top of the hand
    const deg = lerp(FAN + 8, FAN, e) + breathe, at = onHand(deg);
    sx = at.sx; sy = at.sy + lerp(560, 0, e); h = HAND_H * lerp(0.96, 1, e); rot = deg;
  }
  const swell = 1 + 0 * slow(clamp01((t - (FLY[v] - 0.18)) / 0.18)); // wind-up before the flight
  return { sx: sx + fl[0] + sh[0], sy: sy + fl[1] + sh[1], h: h * swell, rot: rot + fl[2] + sh[2] };
}
for (const [v, m] of Object.entries(MEME)) {
  const born = v === "sync" ? T.sync : T.analyze;
  const track = [];
  let held = null;
  for (let f = Math.round(born * FPS); f <= Math.round(DURATION * FPS); f++) {
    const t = f / FPS;
    let p, rot;
    if (t < FLY[v] || !held) {
      const q = memeScreen(v, m, t);
      p = toWorld(q.sx, q.sy, q.h, t); rot = q.rot;
      if (t < FLY[v]) { held = null; } else held = { ...p, rot };
    }
    if (t >= FLY[v]) { // arc into the slot (with a swing) and ride with row 1
      const u = clamp01((t - FLY[v]) / FLY_DUR), e = slow(u), b = held;
      p = { x: lerp(b.x, itemX[v], e), y: lerp(b.y, row1Y(t), e) + ARC[v] * Math.sin(Math.PI * e), s: lerp(b.s, 1, e) };
      rot = lerp(b.rot, 0, e) + SWING[v] * Math.sin(Math.PI * e) * (1 - e);
    }
    track.push({ t: r4(t), ...p, rot });
  }
  const k = (fn) => decimate(track.map((p) => ({ t: p.t, v: r4(fn(p)) })), 0.03);
  add(
    {
      id: `meme-${v}-fly`, name: `Meme · ${m.name}`, type: "null", parent: "camera", label: "#e6d3a3", props: {},
      keyframes: { x: k((p) => p.x - C[0]), y: k((p) => p.y - C[1]), scale: k((p) => p.s), rotation: k((p) => p.rot), opacity: [{ t: r4(born), v: 0 }, { t: r4(born + 2 / FPS), v: 1 }] },
    },
    {
      id: `meme-${v}`, name: `Meme video · ${m.name}`, type: "video", parent: `meme-${v}-fly`, start: r4(born),
      props: { src: m.src, x: 0, y: 0, width: TILE.w, height: TILE.h, radius: 0.5, /* panel scales up to ~6× when big → ~3px */ cropX: m.crop[0], cropY: m.crop[1], cropW: m.crop[2], cropH: m.crop[3], videoFps: 24, decodeWidth: 1280, loop: "yes" },
    },
  );
}

// ---------- order (first = top): memes, headline, cards, grid ----------
const parentOf = Object.fromEntries(layers.map((l) => [l.id, l.parent]));
const under = (root) => (l) => { for (let p = l.id; p; p = parentOf[p]) if (p === root) return true; return false; };
const pick = (pred) => layers.filter(pred);
const shot = {
  name: "TRD-01b · Type first → trades burst",
  note: "End transition: 1.6s push into the Analyze meme until it fills the frame, with depth parallax (cards near, headline mid, grid far).",
  width: W, height: H, fps: FPS, duration: DURATION, background: PAPER,
  layers: [
    ...pick((l) => l.id.startsWith("camera")),
    ...pick((l) => under("meme-analyze-fly")(l)), ...pick((l) => under("meme-sync-fly")(l)),
    ...pick((l) => under("row1")(l) || under("row2")(l)),
    ...Object.keys(LANES).map((k) => `lane-${k}`).flatMap((lane) => pick((l) => under(lane)(l))),
    ...pick((l) => l.id === "card-hide"),
    ...pick((l) => l.id === "grid"),
  ],
};
if (shot.layers.length !== layers.length) throw new Error(`ordering dropped ${layers.length - shot.layers.length} layers`);
const dir = new URL("../shots/trd-01b-type-first/", import.meta.url);
mkdirSync(dir, { recursive: true });
writeFileSync(new URL("v010.json", dir), JSON.stringify(shot, null, 2) + "\n");
console.log(`trd-01b-type-first v010: ${shot.layers.length} layers, ${DURATION}s; trades ${ORDER.map((id) => SPAWN[id]).join(" ")}`);
