// BRN-07 match-cut test: the BRN-07→08 shot (latest version on disk), then after
// the 64 % hero (its text column centered in the frame from the start) holds, the
// shot hard match-cuts through ten more results on the same locked, centered
// layout — negatives, neutrals and positives, cutting faster and faster, landing
// on a positive one. Only the data changes per cut (symbol/indicator, setup line,
// stat, candle pattern, price tag, accent color); the support band stays put as
// the anchor of the match. Each cut gets a 2-frame accent flicker + glyph kick.
//
// v001: 3 cards (neg → neutral → pos), 0.9s each, left-aligned like the hero.
// v002: 10 accelerating cards (0.5s → 0.2s), stat column centered.
// v003: hero answer is centered from the start instead of sliding there.
// v004: a distinct chart pattern per card (crash, staircase, range, fake-out, parabola,
// gap fill, widening bleed, flat + spike, rounded top, double bottom).
// v005: steeper acceleration — cards go from 0.6s down to ~0.08s before the landing.
// v006: hard cut from the landing card into the BRN-10→13 ending over the platform
// (headline, then the AI draws support zone → target → indicators; scripts/lib/brn-10-ending.mjs).
//
//   node scripts/brn-07-match-cut-test.mjs

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { buildEnding } from "./lib/brn-10-ending.mjs";

const SRC = new URL("../shots/brn-07-prompt-answer/", import.meta.url);
const latest = readdirSync(SRC).filter((n) => /^v\d+\.json$/.test(n)).sort().at(-1);
const base = JSON.parse(readFileSync(new URL(latest, SRC), "utf8"));

const FPS = base.fps;
const f = (n) => +(n / FPS).toFixed(4);
const k = (frame, v, ease) => (ease ? { t: f(frame), v, ease } : { t: f(frame), v });
const r2 = (v) => +v.toFixed(2);
const byId = new Map(base.layers.map((l) => [l.id, l]));
const fr = (sec) => Math.round(sec * FPS);

// ---------- the results (last one is the landing card) ----------
const ACCENT = { neg: "#eea39c", neutral: "#e6d3a3", pos: "#d2ffa4" };
// speakerW: width of "Trademania AI · <symbol> · <indicator>" in Geist 400 24px (measured in Chrome).
const CARDS = [
  { s: "neg", symbol: "ETHUSD", indicator: "VWAP", speakerW: 345.67, price: "3.412", line: "Deine Shorts nach einem VWAP-Reclaim gewinnen nur", stat: "38 % bei −0,4R", sub: "über 37 Trades" },
  { s: "pos", symbol: "XAUUSD", indicator: "Anchor", speakerW: 358.97, price: "2.318", line: "Deine Longs am Anchor-Retest gewinnen", stat: "61 % bei 1,2R", sub: "über 49 Trades" },
  { s: "neutral", symbol: "NAS100", indicator: "RSI", speakerW: 312.62, price: "18.240", line: "Deine Longs bei einer RSI-Divergenz gewinnen", stat: "51 % bei 0,1R", sub: "über 58 Trades" },
  { s: "neg", symbol: "GER40", indicator: "Opening Range", speakerW: 430.94, price: "18.105", line: "Deine Breakouts aus der Opening Range gewinnen nur", stat: "34 % bei −0,7R", sub: "über 41 Trades" },
  { s: "pos", symbol: "SOLUSD", indicator: "EMA", speakerW: 330.91, price: "142,60", line: "Deine Longs am 4h-EMA-Bounce gewinnen", stat: "57 % bei 1,1R", sub: "über 33 Trades" },
  { s: "neutral", symbol: "USDJPY", indicator: "Fair Value Gap", speakerW: 435.24, price: "151,42", line: "Deine Shorts in einer Fair Value Gap gewinnen", stat: "49 % bei 0,0R", sub: "über 72 Trades" },
  { s: "neg", symbol: "SPX500", indicator: "Bollinger", speakerW: 374.42, price: "5.284", line: "Deine Longs am unteren Bollinger-Band gewinnen nur", stat: "41 % bei −0,3R", sub: "über 55 Trades" },
  { s: "neutral", symbol: "GBPUSD", indicator: "Session", speakerW: 368.78, price: "1,2710", line: "Deine Longs im Asia-Range-Breakout gewinnen", stat: "52 % bei 0,2R", sub: "über 46 Trades" },
  { s: "neg", symbol: "BTCUSD", indicator: "Funding", speakerW: 366.91, price: "84.950", line: "Deine Longs bei hoher Funding-Rate gewinnen nur", stat: "36 % bei −0,5R", sub: "über 29 Trades" },
  { s: "pos", symbol: "EURUSD", indicator: "Session", speakerW: 367.75, price: "1,0864", line: "Deine Longs im London-Open-Breakout gewinnen", stat: "58 % bei 1,4R", sub: "über 64 Trades" },
];

// ---------- timing ----------
const TAG_IN = fr(byId.get("tag").start);
const FIRST = 36, FASTEST = 5, LAND_HOLD = 84; // frames per card: 0.6s → ~0.08s, then the landing card
const ratio = (FASTEST / FIRST) ** (1 / (CARDS.length - 2));
const CUTS = [TAG_IN + 60]; // hero holds ~1s once the tag has settled
for (let i = 0; i < CARDS.length - 1; i++) CUTS.push(CUTS[i] + Math.round(FIRST * ratio ** i));
const DURATION = CUTS.at(-1) + LAND_HOLD; // end of the landing card = hard cut into the ending

// ---------- layout ----------
const AX = 424, BIG_Y = 308.67, MID = 960;
const SPEAKER_ICON = 44; // brain (32) + gap (12) before the speaker text
// Hero widths (Geist, measured in Chrome).
const HERO_W = { speaker: 356.76, line1: 985.88, sub: 216.99, big: 1050.26 };

// ---------- hero: center its column (from the start), cut out at the first cut ----------
const HERO_IDS = /^(speaker|speaker-name|brain|line1|sub|hero-glow|chart|candle-.*|big.*|sweep-.*|crosshair|tag.*)$/;
for (const l of base.layers) if (HERO_IDS.test(l.id)) l.end = Math.min(l.end ?? Infinity, f(CUTS[0]));
byId.get("speaker-name").props.text = "Trademania AI · BTCUSD · Anchor";
const center = (id, x) => (byId.get(id).props.x = r2(x));
center("speaker", MID - (SPEAKER_ICON + HERO_W.speaker) / 2);
center("line1", MID - HERO_W.line1 / 2);
center("sub", MID - HERO_W.sub / 2);
center("big", MID); // the stat's pieces are laid out around this null's center
center("hero-glow", MID);

// Backdrop + band: kick the glyphs and tint the band glow on each cut.
const bg = byId.get("bg").keyframes;
const bandGlow = byId.get("band-glow");
const rgba = (hex, a) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
};
bandGlow.keyframes.fill = [k(0, bandGlow.props.fill, "hold")];
CUTS.forEach((c, i) => {
  const len = Math.min(10, (CUTS[i + 1] ?? DURATION) - c - 1);
  bg.glyphAlpha.push(k(c, 1.45, "expoOut"), k(c + len, 1, "hold"));
  bg.scramble.push(k(c, 0.28, "sineOut"), k(c + len, 0.05, "hold"));
  bandGlow.keyframes.fill.push(k(c, rgba(ACCENT[CARDS[i].s], 0.22), "hold"));
});

// ---------- candles ----------
// Same grid as the hero chart (chart-space centers of its candles).
const GRID = base.layers.filter((l) => /^candle-\d+$/.test(l.id)).map((l) => l.props.x).sort((a, b) => a - b);
let seed = 11;
const rand = (lo, hi) => {
  seed = (seed + 0x6d2b79f5) | 0;
  let x = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
  return lo + (((x ^ (x >>> 14)) >>> 0) / 4294967296) * (hi - lo);
};
// One distinct price pattern per card, in chart space (support line at y≈116;
// smaller y = higher price; usable range ≈ -40…200). `vol` scales candle size
// and noise, so a dead-flat session reads differently from a crash.
const ss = (a, b, u) => {
  const t = Math.min(1, Math.max(0, (u - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const lerp = (a, b, t) => a + (b - a) * t;
const PATTERNS = {
  // ETHUSD · VWAP: rallies, then a waterfall through support and a weak dead-cat bounce.
  ETHUSD: { vol: 1.2, path: (u) => lerp(lerp(120, -20, ss(0, 0.45, u)), 185, ss(0.47, 0.66, u)) - 30 * ss(0.72, 0.8, u) * (1 - ss(0.82, 0.95, u)) },
  // XAUUSD · Anchor: clean staircase uptrend — push, base, push, base.
  XAUUSD: { vol: 0.8, path: (u) => 175 - 50 * (ss(0.08, 0.2, u) + ss(0.34, 0.46, u) + ss(0.6, 0.72, u) + ss(0.84, 0.96, u)) },
  // NAS100 · RSI: wide range, price ping-pongs between the highs and the lows.
  NAS100: { vol: 1.1, path: (u) => 95 + 62 * Math.sin(u * Math.PI * 6 - 0.6) },
  // GER40 · Opening Range: tight range, fake breakout up, then the reversal dump.
  GER40: { vol: 1, path: (u) => lerp(lerp(100 + 6 * Math.sin(u * 60), 5, ss(0.46, 0.54, u)), 190, ss(0.56, 0.78, u)) },
  // SOLUSD · EMA: flat base, then a parabolic run.
  SOLUSD: { vol: 1, path: (u) => 160 - 200 * Math.max(0, (u - 0.4) / 0.6) ** 2.2 },
  // USDJPY · Fair Value Gap: trends down, gaps up, then drifts back to fill the gap.
  USDJPY: { vol: 0.9, path: (u) => (u < 0.42 ? lerp(40, 160, u / 0.42) : lerp(50, 120, ss(0.42, 1, u))) },
  // SPX500 · Bollinger: slow bleed with swings that widen as it falls.
  SPX500: { vol: 1.15, path: (u) => lerp(30, 160, u) + Math.sin(u * Math.PI * 9) * lerp(6, 40, u) },
  // GBPUSD · Session: dead-flat Asia range, one stop-run spike, back to flat.
  GBPUSD: { vol: 0.45, path: (u) => 104 + 3 * Math.sin(u * 40) - 70 * Math.exp(-(((u - 0.55) / 0.035) ** 2)) },
  // BTCUSD · Funding: rounded top — grinds up, stalls, rolls over hard.
  BTCUSD: { vol: 1, path: (u) => 175 - 190 * Math.sin(Math.PI * Math.min(1, u * 1.05)) ** 1.6 + 20 * ss(0.8, 1, u) },
  // EURUSD · Session (landing): double bottom, then the breakout rally.
  EURUSD: { vol: 1, path: (u) => (u < 0.55 ? 120 + 55 * Math.abs(Math.sin(u * Math.PI * 1.82)) : lerp(120, -35, ss(0.55, 1, u))) },
};
const BODY = 11, WICK = 2.2; // the hero's candles at 55% width
/** All candles of one card as two compound paths (rising bright, falling dim), in chart space. */
const candlePaths = ({ path, vol }) => {
  const up = [], down = [];
  let prev = path(0);
  GRID.forEach((x, i) => {
    const cy = path(i / (GRID.length - 1)) + rand(-6, 6) * vol;
    const h = rand(14, 34) * vol * (Math.abs(cy - prev) > 9 ? 1.4 : 1) + 6;
    const top = cy - h / 2, bt = top + h * rand(0.16, 0.3), bb = top + h * rand(0.68, 0.8);
    const d =
      `M${r2(x - BODY / 2)} ${r2(bt)}H${r2(x + BODY / 2)}V${r2(bb)}H${r2(x - BODY / 2)}Z` +
      `M${r2(x - WICK / 2)} ${r2(top)}H${r2(x + WICK / 2)}V${r2(top + h)}H${r2(x - WICK / 2)}Z`;
    (cy < prev ? up : down).push(d);
    prev = cy;
  });
  return { up: up.join(""), down: down.join("") };
};

// ---------- cards ----------
const text = (id, name, parent, props, extra = {}) => ({
  id, name, type: "text", parent, ...extra,
  props: { fontFamily: "Geist", align: "left", anchorX: 0, anchorY: 0, ...props },
});
const sp = (id) => byId.get(id).props;
const centered = { align: "center", anchorX: 0.5, x: MID };

const cardLayers = CARDS.flatMap((c, i) => {
  const cut = CUTS[i], next = CUTS[i + 1];
  const live = { start: f(cut), ...(next ? { end: f(next) } : {}) };
  const id = (s) => `c${i + 1}-${s}`;
  const tag = `${c.symbol} ${c.stat}`;
  const accent = ACCENT[c.s];
  const { up, down } = candlePaths(PATTERNS[c.symbol]);
  const settle = Math.min(30, (next ?? DURATION) - cut);
  const candle = (s, name, d, opacity, blur = 0) => ({
    id: id(s), name, type: "path", parent: id("chart"), matte: id("fade"), ...live,
    props: { d, pathOrigin: "zero", x: 0, y: 0, fill: "#F4F9EE", stroke: "rgba(0,0,0,0)", strokeWidth: 0, opacity, ...(blur ? { blur } : {}) },
  });
  return [
    {
      id: id("flash"), name: `${tag} · cut flicker`, type: "rect", parent: "cam", ...live,
      props: { x: MID, y: 540, width: 1920, height: 1080, fill: accent, blend: "screen", opacity: 0 },
      keyframes: { opacity: [k(cut, 0.07, "hold"), k(cut + 2, 0.03, "easeOut"), k(cut + 6, 0)] },
    },
    { id: id("tag"), name: `${tag} · price tag`, type: "null", parent: "cam", ...live, props: { x: 1440, y: 717 } },
    text(id("tag-text"), c.price, id("tag"), { ...sp("tag-text"), text: c.price }, live),
    { id: id("tag-bg"), name: "Tag surface", type: "path", parent: id("tag"), ...live, props: { ...sp("tag-bg") } },
    {
      id: id("speaker"), name: `${tag} · speaker (group)`, type: "null", parent: "cam", ...live,
      props: { x: r2(MID - (SPEAKER_ICON + c.speakerW) / 2), y: 160 },
    },
    text(id("speaker-name"), "Speaker", id("speaker"), { ...sp("speaker-name"), text: `Trademania AI · ${c.symbol} · ${c.indicator}` }, live),
    { id: id("brain"), name: "Brain symbol", type: "image", parent: id("speaker"), ...live, props: { ...sp("brain") } },
    text(id("line1"), c.line, "cam", { ...sp("line1"), text: c.line, ...centered, y: 248.67 }, live),
    // The stat settles a hair after the cut so the card doesn't feel frozen.
    text(id("stat"), c.stat, "cam", {
      text: c.stat, fontWeight: 600, fontSize: 176, letterSpacing: -3.52, lineHeight: 1, ...centered, y: BIG_Y,
      fill: "#f4f9ee", fillType: "linear", gradientAngle: 180, gradientStops: `#f4f9ee 0.1, ${accent} 1`,
    }, { ...live, keyframes: { scale: [k(cut, 1.015, "figmaSlow"), k(cut + settle, 1)] } }),
    text(id("sub"), c.sub, "cam", { ...sp("sub"), text: c.sub, ...centered, y: BIG_Y + 176 + 8 }, live),
    { id: id("chart"), name: `${tag} · chart (group)`, type: "null", parent: "cam", ...live, props: { x: 424, y: 600 } },
    candle("up", "Candles · rising", up, 1),
    candle("down", "Candles · falling", down, 0.45),
    candle("up-glow", "Candle glow · rising", up, 0.8, 14),
    candle("down-glow", "Candle glow · falling", down, 0.35, 14),
    {
      id: id("hero-glow"), name: `${tag} · hero glow`, type: "ellipse", parent: "cam", ...live,
      props: { ...sp("hero-glow"), x: MID, fill: rgba(accent, 0.14), opacity: 0.8 },
    },
    // Edge fade for the candles — narrower than the hero's (in by x 384, out from x 1650)
    // so each pattern's payoff on the right stays readable.
    {
      id: id("fade"), name: `${tag} · chart edge fade (matte)`, type: "rect", parent: "cam", ...live,
      props: {
        x: MID, y: 700, width: 1920, height: 400, fill: "#ffffff", fillType: "linear", gradientAngle: 90,
        gradientStops: "rgba(255,255,255,0) 0, #ffffff 0.2, #ffffff 0.86, rgba(255,255,255,0) 1",
      },
    },
  ];
});

// New layers sit above the hero ones (they never overlap in time) and below the hands.
const at = base.layers.findIndex((l) => l.id === "prompt");
base.layers.splice(at, 0, ...cardLayers);

// ---------- ending: hard cut into BRN-10 → 13 ----------
for (const l of base.layers) l.end = Math.min(l.end ?? Infinity, f(DURATION));
const ending = buildEnding({ start: DURATION, fps: FPS });
base.layers.unshift(...ending.layers);

const shot = {
  ...base,
  name: "BRN-07 · Match-cut test (neg → neutral → pos)",
  note: `Test from brn-07-prompt-answer ${latest.replace(".json", "")}: hero answer centered from the start, then 10 match cuts accelerating hard (0.6s → 0.08s), each with its own chart pattern, landing on EURUSD 58 % bei 1,4R, then a hard cut into BRN-10→13 (headline + the AI drawing support zone, target and indicators on the platform)`,
  duration: f(ending.end),
};

const dir = new URL("../shots/brn-07-match-cut-test/", import.meta.url);
mkdirSync(dir, { recursive: true });
writeFileSync(new URL("v006.json", dir), JSON.stringify(shot, null, 2) + "\n");
console.log(`wrote brn-07-match-cut-test/v006.json from ${latest} — ${shot.duration}s, ${shot.layers.length} layers, cuts at ${CUTS.join(", ")}`);
