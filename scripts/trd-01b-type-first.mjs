// TRD-01b · test: type first, trades last.
//  1. 0–2.5s   big memes: the Sync video opens as a big panel; the Analyze video bursts
//              in big while Sync tucks aside.
//  2. 2.5–3.4s both memes shrink into their line-1 slots as "Sync / und / analysieren"
//              rise; the camera eases out just enough to frame the whole line.
//  3. 3.7s →   line 2 lands, and the trades burst out from BEHIND the headline one after
//              another (accelerating), shoving the cards already out, while the camera
//              pulls back to the full canvas. Cards settle and drift.
// Cards "ghost" through the headline solid while they slide out from behind it, but
// always collide with each other (they push, never overlap).
//
//   node --no-warnings scripts/trd-01b-type-first.mjs  →  shots/trd-01b-type-first/v001.json

import { mkdirSync, writeFileSync } from "node:fs";
import { EASES } from "../src/lib/easing.ts";
import { decimate, separate, simulate, smooth } from "./lib/card-physics.mjs";

const r4 = (v) => +v.toFixed(4);
const FPS = 60, W = 1920, H = 1080, C = [960, 540];
const INK = "#0A1A1D", PAPER = "#F4F9EE";
const DEG = Math.PI / 180;
const slow = EASES.figmaSlow, quick = EASES.figmaQuick;
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
  line2: 3.7, trades: 3.86, pullEnd: 5.0, end: 6.8,
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

// ---------- trades: burst out from behind the headline ----------
const ORDER = ["btc", "eth", "sol", "xrp", "doge", "bnb", "avax", "link"];
const GAPS = [0.17, 0.15, 0.13, 0.11, 0.1, 0.09, 0.08]; // accelerating
const SPAWN = {};
ORDER.forEach((id, i) => (SPAWN[id] = r4(T.trades + GAPS.slice(0, i).reduce((a, b) => a + b, 0))));
// Each card's final spot around the text (3 top, 3 bottom, 1 per side); spawn order
// alternates sides so the burst feels like it's coming from everywhere.
const SPOT = {
  btc: { at: [410, 195], rot: -4 }, eth: { at: [1525, 880], rot: -3 },
  sol: { at: [1545, 210], rot: 4 }, xrp: { at: [395, 870], rot: 3 },
  doge: { at: [40, 540], rot: -5 }, bnb: { at: [1880, 560], rot: 5 },
  avax: { at: [985, 160], rot: 2 }, link: { at: [955, 920], rot: 2 },
};
const HEAD_ROW_H = ROW_H, HEAD_HALF_W = row1W / 2, PAD = 26;
const EMERGE = 0.42; // seconds to slide out from behind the text
const DRIFT = 12, ZETA = 0.62;
const bodies = ORDER.map((id) => {
  const spawn = SPAWN[id], [sx, sy] = SPOT[id].at;
  const dx = sx - C[0], dy = sy - C[1], len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len;
  // Starts hidden behind the headline (a little toward its own side), slides outward.
  const from = [C[0] + ux * 220, C[1] + uy * 40];
  const out = [C[0] + ux * Math.min(len, 900) * 0.62, C[1] + uy * Math.min(len, 900) * 0.62];
  return {
    id, spawn, from, v0: [0, 0], angle0: SPOT[id].rot * DEG,
    hx: (CW / 2) * SCALE, hy: (CH / 2) * SCALE, mass: 1, angK: 60, angDamp: 15.5,
    ghostUntil: spawn + EMERGE, // passes behind the headline while emerging
    grow: (t) => lerp(0.6, 1, slow(clamp01((t - spawn) / EMERGE))),
    target: (t) => {
      const u = (t - spawn) / EMERGE;
      if (u < 1) { // strongly driven out from behind the text (still collides with cards)
        const e = slow(clamp01(u));
        return [lerp(from[0], out[0], e), lerp(from[1], out[1], e), 520, 46, SPOT[id].rot * DEG];
      }
      const e = Math.max(0, t - (spawn + EMERGE));
      return [sx + ux * DRIFT * e, sy + uy * DRIFT * e, 22, 2 * ZETA * Math.sqrt(22), SPOT[id].rot * DEG];
    },
  };
});
const ease3 = (u) => 1 - Math.pow(1 - clamp01(u), 3);
const headlineSolid = {
  at: (t) => {
    if (t < T.line2) return { x: 960, y: 540, a: 0, hx: HEAD_HALF_W + PAD, hy: HEAD_ROW_H / 2 + PAD };
    const g2 = ease3((t - T.line2) / 0.2);
    return { x: 960, y: 540, a: 0, hx: HEAD_HALF_W + PAD, hy: HEAD_ROW_H / 2 + PAD + (HEAD_ROW_H / 2) * g2 };
  },
};
const frames = simulate({ duration: DURATION, fps: FPS, cards: bodies, obstacles: [headlineSolid], skin: 3, torque: 0.000012, maxTilt: 2.5 * DEG });
const tracks = {};
for (const id of ORDER) {
  const from = frames.findIndex((f) => f.bodies[id]);
  const live = frames.slice(from);
  tracks[id] = {
    from, hx: (CW / 2) * SCALE, hy: (CH / 2) * SCALE,
    x: smooth(live.map((f) => f.bodies[id].x), 2), y: smooth(live.map((f) => f.bodies[id].y), 2),
    a: smooth(live.map((f) => f.bodies[id].a), 3), g: live.map((f) => f.bodies[id].g),
  };
}
separate(tracks, { skin: 2 });

// ---------- camera ----------
// Memes: a little tight (1.5×). Type: eases to frame all of line 1 (1.25×). Trades: pull
// back to the full canvas as they burst, then a hair of continued drift.
function camAt(t) {
  let z;
  if (t < T.toSlots) z = 1.5;
  else if (t < T.trades) z = Math.exp(lerp(Math.log(1.5), Math.log(1.25), slow(clamp01((t - T.toSlots) / 0.9))));
  else z = Math.exp(lerp(Math.log(1.25), Math.log(1), slow(clamp01((t - T.trades) / (T.pullEnd - T.trades)))));
  z *= 1 - 0.015 * clamp01((t - T.pullEnd) / (T.end - T.pullEnd));
  return { fx: C[0], fy: C[1], z };
}
const cam = [];
for (let f = 0; f <= Math.round(DURATION * FPS); f++) cam.push({ t: f / FPS, ...camAt(f / FPS) });
const camTrack = (fn) => decimate(cam.map((c) => ({ t: r4(c.t), v: r4(fn(c)) })), 0.02);
add({
  id: "camera", name: "Camera", type: "null", label: "#c5b9ee", props: {},
  keyframes: { x: camTrack((c) => C[0] - c.z * (c.fx - C[0])), y: camTrack((c) => C[1] - c.z * (c.fy - C[1])), scale: camTrack((c) => c.z) },
});
const camOf = (t) => cam[Math.max(0, Math.min(cam.length - 1, Math.round(t * FPS)))];
const w2c = (x, y) => ({ x: r4(x - C[0]), y: r4(y - C[1]) });

add({ id: "grid", name: "Grid (Figma)", type: "image", parent: "camera", label: "#8c958a", props: { src: "grid.svg", ...w2c(966, 540), width: 1920, height: 1080 } });

// ---------- cards ----------
for (const id of ORDER) {
  const d = CARDS[id], Tk = tracks[id];
  const keys = (vals, off = 0, mul = 1) => decimate(vals.map((v, i) => ({ t: r4((Tk.from + i) / FPS), v: r4((v - off) * mul) })), 0.04);
  const ls = cardLayers(id, d).filter((l) => l.id !== `${id}-letter`).map((l) => ({ ...l, matte: "card-hide", matteMode: "inverse" }));
  const coin = ls.find((l) => l.id === `${id}-coin`);
  Object.assign(coin, { type: "image", name: `${d.pair} logo`, props: { x: coin.props.x, y: coin.props.y, src: `coin-${id}.svg`, width: 63.462, height: 63.462 } });
  const pnl = ls.find((l) => l.id === `${id}-pnl`), m = d.pnl.match(/^([+−-])([\d.]+)%$/);
  if (m) {
    pnl.props.text = `${m[1]}{counter}%`;
    pnl.props.counterDecimals = 2;
    pnl.keyframes = { counter: [{ t: r4(SPAWN[id] + 0.1), v: 0, ease: "figmaSlow" }, { t: r4(SPAWN[id] + 0.75), v: +m[2] }] };
  }
  add({
    id, name: `Card · ${d.pair}`, type: "null", parent: "camera", label: d.coin, props: { scale: SCALE },
    keyframes: {
      x: keys(Tk.x, C[0]), y: keys(Tk.y, C[1]), rotation: keys(Tk.a, 0, 1 / DEG), scale: keys(Tk.g, 0, SCALE),
      opacity: [{ t: r4(Tk.from / FPS), v: 0 }, { t: r4(Tk.from / FPS + 0.08), v: 1 }],
    },
  }, ...ls);
}

// Cards stay hidden inside the headline block, so they slide out from under the text.
// The block fades away once the burst is done (an invisible matte = unmasked).
const HIDE_PAD = 14, lastOut = SPAWN[ORDER.at(-1)] + EMERGE;
add({
  id: "card-hide", name: "Card hide · headline block (matte)", type: "rect", parent: "camera",
  props: { ...w2c(960, 540), width: r4(row1W + 2 * HIDE_PAD), radius: 12, fill: "#000000" },
  keyframes: {
    height: [{ t: r4(T.line2), v: r4(ROW_H + 2 * HIDE_PAD), ease: "figmaSlow" }, { t: r4(T.line2 + 0.4), v: r4(2 * ROW_H + 2 * HIDE_PAD) }],
    opacity: [{ t: r4(lastOut), v: 1, ease: "hold" }, { t: r4(lastOut + 0.1), v: 0 }],
  },
});

// ---------- headline ----------
const RISE = 0.45, FADE = 0.22, MASK_TOP = -100, MASK_BOTTOM = 64, RISE_FROM = MASK_BOTTOM + ROW_H / 2 + 4;
const mask = (row) => ({ id: `${row}-mask`, name: `Mask · ${row} (matte)`, type: "rect", parent: row, props: { x: 0, y: r4((MASK_TOP + MASK_BOTTOM) / 2), width: 2200, height: MASK_BOTTOM - MASK_TOP, fill: "#000000" } });
const riseWord = (id, row, name, x, text, t) => ({
  id, name, type: "text", parent: row, matte: `${row}-mask`, props: { ...HEAD, x: r4(x), anchorY: 0.5, text },
  keyframes: { y: [{ t: r4(t), v: r4(RISE_FROM), ease: "figmaSlow" }, { t: r4(t + RISE), v: 0 }], opacity: [{ t: r4(t), v: 0, ease: "sineOut" }, { t: r4(t + FADE), v: 1 }] },
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
    keyframes: { y: [{ t: r4(T.line2 - 0.02), v: w2c(0, ROW1_Y_SOLO).y, ease: "figmaSlow" }, { t: r4(T.line2 + 0.4), v: w2c(0, ROW1_Y_FINAL).y }] } },
  ...head,
);

// ---------- memes: big first, then into their slots ----------
const MEME = {
  sync: { src: "meme-sync.mp4", crop: [551, 66, 1103, 691], name: "Sync · Gif3", big: 830, park: { x: 330, y: 290, h: 280 }, tilt: -6 },
  analyze: { src: "meme-analyze.mp4", crop: [1290, 105, 816, 511], name: "Analyze · Gif1 basti (subject on the right)", big: 760, at: [1150, 560], tilt: 5 },
};
// Screen-space pose → world (camera focus is the frame center).
const toWorld = (sx, sy, sh, t) => { const c = camOf(t); return { x: c.fx + (sx - C[0]) / c.z, y: c.fy + (sy - C[1]) / c.z, s: sh / c.z / TILE.h }; };
for (const [v, m] of Object.entries(MEME)) {
  const born = v === "sync" ? T.sync : T.analyze;
  const track = [];
  for (let f = Math.round(born * FPS); f <= Math.round(DURATION * FPS); f++) {
    const t = f / FPS;
    const [bx, by] = m.at ?? [960, 540];
    let p = toWorld(bx, by, m.big * lerp(0.82, 1, quick(clamp01((t - born) / 0.34))), t), rot = 0;
    if (v === "sync" && t >= T.analyze) { // tucks aside while the Analyze meme takes over
      const e = slow(clamp01((t - T.analyze) / 0.4));
      const big = toWorld(960, 540, m.big, t), park = toWorld(m.park.x, m.park.y, m.park.h, t);
      p = { x: lerp(big.x, park.x, e), y: lerp(big.y, park.y, e), s: lerp(big.s, park.s, e) };
      rot = lerp(0, m.tilt, e);
    }
    if (t >= T.toSlots) { // shrink into the slot and ride with row 1
      const e = slow(clamp01((t - T.toSlots) / 0.55));
      p = { x: lerp(p.x, itemX[v], e), y: lerp(p.y, row1Y(t), e), s: lerp(p.s, 1, e) };
      rot = lerp(rot, 0, e);
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
      props: { src: m.src, x: 0, y: 0, width: TILE.w, height: TILE.h, radius: 8, cropX: m.crop[0], cropY: m.crop[1], cropW: m.crop[2], cropH: m.crop[3], videoFps: 24, decodeWidth: 1280, loop: "yes", shadowColor: "rgba(10,26,29,0.28)", shadowBlur: 18, shadowY: 6 },
    },
  );
}

// ---------- order (first = top): memes, headline, cards, grid ----------
const parentOf = Object.fromEntries(layers.map((l) => [l.id, l.parent]));
const under = (root) => (l) => { for (let p = l.id; p; p = parentOf[p]) if (p === root) return true; return false; };
const pick = (pred) => layers.filter(pred);
const shot = {
  name: "TRD-01b · Type first → trades burst",
  note: "Test: big memes → memes shrink into line 1 as words rise → trades burst from behind line 2",
  width: W, height: H, fps: FPS, duration: DURATION, background: PAPER,
  layers: [
    ...pick((l) => l.id === "camera"),
    ...pick((l) => under("meme-analyze-fly")(l)), ...pick((l) => under("meme-sync-fly")(l)),
    ...pick((l) => under("row1")(l) || under("row2")(l)),
    ...[...ORDER].reverse().flatMap((id) => pick((l) => l.id === id || l.parent === id)),
    ...pick((l) => l.id === "card-hide"),
    ...pick((l) => l.id === "grid"),
  ],
};
if (shot.layers.length !== layers.length) throw new Error(`ordering dropped ${layers.length - shot.layers.length} layers`);
const dir = new URL("../shots/trd-01b-type-first/", import.meta.url);
mkdirSync(dir, { recursive: true });
writeFileSync(new URL("v001.json", dir), JSON.stringify(shot, null, 2) + "\n");
console.log(`trd-01b-type-first v001: ${shot.layers.length} layers, ${DURATION}s; trades ${ORDER.map((id) => SPAWN[id]).join(" ")}`);
