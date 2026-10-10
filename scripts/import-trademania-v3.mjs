// One-off importer: rebuilds the "Trademania V3 · Thinking → Ready" artifact
// (claude.ai/artifact/7HUufEMKQsxYRhHsPf8sY8) as an editable Motion Studio shot.
// The original timing model is reproduced below; keyframe values are sampled
// from it so the shot matches the artifact at every key.
//
//   node scripts/import-trademania-v3.mjs  →  shots/trademania-v3-thinking/v001.json

import { mkdirSync, writeFileSync } from "node:fs";

// ---------- original motion tokens ----------
const ease = {
  expoOut: (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x)),
  p3InOut: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  p2InOut: (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2),
  sineInOut: (x) => -(Math.cos(Math.PI * x) - 1) / 2,
  linear: (x) => x,
};
const TOK = { rise: 16, blur: 12, previewOpacity: 0.28, iconScale: 89.41 / 332, breathPeriod: 1.2, breathAmp: 0.018, scrollMax: 260 };
const R_MAIN = [1.3, 1.48, 1.66], R_SUB = [1.84, 1.96, 2.08], FOCUS = 0.34, DESC_LAG = 0.06;
const TR = {
  "orb-in": [0, 0.34, "expoOut"], "orb-handoff": [0.8, 1.3, "p3InOut"], "ready-pulse": [2.7, 3.0, "expoOut"],
  "title-in": [0.1, 0.46, "expoOut"], "title-out": [0.78, 1.0, "p2InOut"], "bg-swap": [0.84, 1.34, "p3InOut"],
  "header-in": [1.16, 1.5, "expoOut"], "title-swap": [2.46, 2.84, "expoOut"], "list-in": [1.18, 1.36, "p2InOut"],
  "step3-swap": [2.5, 2.74, "expoOut"], "lines-out": [2.42, 2.62, "p2InOut"], "dots-ready": [2.48, 2.8, "expoOut"],
  scroll: [1.5, 2.2, "p2InOut"], collapse: [2.44, 2.86, "p3InOut"], "desc-collapse": [2.42, 2.6, "p3InOut"],
};
R_MAIN.forEach((r, i) => { TR["step-" + i] = [r, r + FOCUS, "expoOut"]; TR["desc-" + i] = [r + DESC_LAG, r + DESC_LAG + FOCUS, "expoOut"]; });
R_SUB.forEach((r, i) => { TR["sub-" + i] = [r, r + FOCUS, "expoOut"]; TR["sdesc-" + i] = [r + DESC_LAG, r + DESC_LAG + FOCUS, "expoOut"]; });
[[1.34, 1.48], [1.52, 1.66], [1.7, 2.14]].forEach(([s, e], i) => (TR["line-" + i] = [s, e, "sineInOut"]));

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, k) => a + (b - a) * k;
const raw = (id, t) => { const [s, e] = TR[id]; return clamp((t - s) / (e - s)); };
const P = (id, t) => ease[TR[id][2]](raw(id, t));

// ---------- helpers ----------
const r4 = (v) => +v.toFixed(4);
const EASE_MAP = { expoOut: "expoOut", p3InOut: "easeInOut", p2InOut: "quadInOut", sineInOut: "sineInOut", linear: "linear" };

/** Keyframes from fn sampled at [time, ease-out-of-this-key] pairs. */
function keys(fn, pts) {
  const sorted = [...pts].sort((a, b) => a[0] - b[0]).filter((p, i, arr) => i === 0 || Math.abs(p[0] - arr[i - 1][0]) > 1e-6);
  return sorted.map(([t, e], i) => {
    const v = fn(t);
    const k = { t: r4(t), v: typeof v === "number" ? r4(v) : v };
    if (e && e !== "linear" && i < sorted.length - 1) k.ease = e;
    return k;
  });
}
const rgba = ([r, g, b], a = 1) => `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${r4(a)})`;
const mix = (a, b, k) => a.map((v, i) => lerp(v, b[i], k));

// ---------- layout constants ----------
const G2 = { x: 549.6, y: 142 }, G3 = { x: 615.1, y: 179 };
const MAIN = [
  { title: "Live Data", tag: "UTC +3", titleW: 208.49, tagW: 138.66, desc: "Loading live market data and aligning session timestamps to UTC +3.", r2: 190, r3: 190 },
  { icon: true, title: "BTCUSDT", tag: "Perp · Binance", titleW: 216.78, tagW: 270.7, desc: "Preparing the market context for Bitcoin’s BTCUSDT perpetual contract on Binance.", r2: 435, r3: 294 },
  { title: "Loading", alt: "Analysis data", titleW: 180.15, desc: "Loading the data sources needed to prepare the market analysis.", r2: 680, r3: 398 },
];
const SUBS = [
  { title: "Indicators", titleW: 152.43, desc: "Preparing technical indicator data for the current market context.", r2: 891.5, r3: 506.7 },
  { title: "Economic Data", titleW: 230.41, desc: "Loading economic information to provide broader market context.", r2: 991.5, r3: 586.1 },
  { title: "Orderflow", titleW: 153.53, desc: "Preparing orderflow data to review trading activity.", r2: 1091.5, r3: 665.5 },
];
const LINES = [{ a: 242, b: 435 }, { a: 487, b: 680 }, { a: 744, b: 1135 }];
const GREY = [63, 63, 63], LIME = [217, 249, 185], DONE = [128, 136, 124], WHITE = [244, 249, 238];
const FG = "#F4F9EE", DESC = "#999F96";
const C = { lime: "#D9F9B9", mint: "#9fdcc6", sand: "#e6d3a3", lilac: "#c5b9ee", fg: "#F4F9EE" };

const text = (props) => ({ fontFamily: "Geist", align: "left", anchorX: 0, anchorY: 0, ...props });
const L = (t) => P("list-in", t);
const base = (t) => TOK.previewOpacity * L(t);

const layers = [];
const add = (l) => (layers.push(l), l);

// ---------- rig (nulls) ----------
add({
  id: "layout", name: "Layout origin (G)", type: "null", label: C.lilac,
  props: {},
  keyframes: {
    x: keys((t) => lerp(G2.x, G3.x, P("collapse", t)), [[2.44, "easeInOut"], [2.86]]),
    y: keys((t) => lerp(G2.y, G3.y, P("collapse", t)), [[2.44, "easeInOut"], [2.86]]),
  },
});
add({
  id: "camera", name: "Camera scroll", type: "null", parent: "layout", label: C.lilac,
  props: { x: 0 },
  keyframes: {
    y: keys((t) => -TOK.scrollMax * P("scroll", t) * (1 - P("collapse", t)), [[1.5, "quadInOut"], [2.2], [2.44, "easeInOut"], [2.86]]),
  },
});

// ---------- orb ----------
const hs = (t) => P("orb-handoff", t);
const orbX = (t) => lerp(960, G2.x + 44.7, ease.p3InOut(clamp((raw("orb-handoff", t) - 0.12) / 0.88))) - G2.x;
const orbY = (t) => lerp(464, G2.y + 44.7, ease.p3InOut(clamp(raw("orb-handoff", t) * 1.18))) - G2.y;
const orbXKeys = keys(orbX, [[0.86, "easeInOut"], [1.3]]);
const orbYKeys = keys(orbY, [[0.8, "easeInOut"], [0.8 + 0.5 / 1.18]]);
const pulseSin = (t) => Math.sin(Math.PI * raw("ready-pulse", t));
const breathTimes = [0.3, 0.9, 1.5, 2.1, 2.7];

add({
  id: "orb-move", name: "Orb move", type: "null", parent: "layout", label: C.lime,
  props: {},
  keyframes: {
    x: orbXKeys,
    y: orbYKeys,
    scale: keys(
      (t) => lerp(0.86, 1, P("orb-in", t)) * lerp(1, TOK.iconScale, hs(t)) * (1 + 0.06 * pulseSin(t)),
      [[0, "expoOut"], [0.34], [0.8, "easeInOut"], [1.3], [2.7, "sineOut"], [2.85, "sineIn"], [3.0]],
    ),
    opacity: keys((t) => P("orb-in", t), [[0, "expoOut"], [0.34]]),
    blur: keys((t) => 14 * (1 - P("orb-in", t)), [[0, "expoOut"], [0.34]]),
  },
});
add({
  id: "orb-breath", name: "Orb breath", type: "null", parent: "orb-move", label: C.lime,
  props: {},
  keyframes: {
    scale: keys((t) => 1 + TOK.breathAmp * Math.sin((t * Math.PI * 2) / TOK.breathPeriod) * (1 - hs(t)), [[0, "sineOut"], [0.3, "sineInOut"], [0.9, "sineInOut"], [1.3]]),
  },
});
add({
  id: "ring", name: "Ready ring", type: "ellipse", parent: "orb-breath", label: C.lime,
  props: { x: 0, y: 0, width: 322, height: 322, fill: "rgba(0,0,0,0)", stroke: "rgba(217,249,185,0.9)", strokeWidth: 10 },
  keyframes: {
    opacity: [{ t: 0, v: 0, ease: "hold" }, { t: 2.7, v: 0.7 }, { t: 3, v: 0 }],
    scale: [{ t: 2.7, v: 1 }, { t: 3, v: 1.9 }],
  },
});
add({
  id: "logo", name: "Logo mark", type: "path", parent: "orb-breath", label: C.lime,
  props: {
    x: 0, y: -0.5, strokeWidth: 0, fill: "#F6FFEE",
    fillType: "linear", gradientAngle: 180, gradientStops: "#F4FFEA 0, #ffffff 0.9074", gradientScale: 1.09,
    d: "M62.7039 50.998C62.7039 50.998 62.7144 51.0033 62.7197 50.998C63.1819 51.0302 63.6441 51.0572 64.1063 51.0733C64.3221 51.0841 64.5369 51.0895 64.758 51.0949C65.1096 51.1057 65.4676 51.1111 65.8245 51.1111H66.1709C66.5278 51.1111 66.8857 51.1057 67.2374 51.0949C67.4585 51.0895 67.6732 51.0841 67.8891 51.0733C68.3512 51.0571 68.8135 51.0302 69.2756 50.998C69.2809 51.0033 69.2862 51.0033 69.2915 50.998C95.3527 49.2676 115.965 27.0948 115.965 0H94.9474C94.9474 1.6012 94.8211 3.17646 94.5799 4.71301C92.7512 16.3529 84.2813 25.7412 73.2741 28.6647H73.2688C73.2688 28.6647 73.2583 28.67 73.253 28.67C70.9357 29.2881 68.5027 29.6155 65.997 29.6155C63.4912 29.6155 61.0582 29.2881 58.7409 28.67C58.7356 28.67 58.7304 28.6647 58.7251 28.6647H58.7198C47.7126 25.7412 39.2417 16.3529 37.414 4.71301C37.1718 3.17646 37.0465 1.60111 37.0465 0H16.0291C16.0291 27.0948 36.6425 49.2676 62.7039 50.998Z M125.006 48.208C124.56 48.208 124.108 48.2134 123.671 48.2349H123.576C96.6749 49.0468 75.111 71.6062 75.111 99.3136V113.505H56.8889V99.3136C56.8889 71.6062 35.3251 49.0468 8.42354 48.2349H8.32876C7.89289 48.2133 7.44017 48.208 6.99375 48.208H0V69.7036H6.91488C9.51011 69.7036 12.0221 70.0525 14.4235 70.7136C25.3581 73.7178 33.7596 83.1223 35.5199 94.7396C35.7568 96.2276 35.8715 97.7599 35.8715 99.3127V121.614L48.9602 135H83.0398L96.1284 121.614V99.3127C96.1284 97.7599 96.2442 96.2277 96.4801 94.7397C98.2404 83.1214 106.642 73.7168 117.576 70.7137C119.978 70.0525 122.489 69.7037 125.085 69.7037H132V48.2081L125.006 48.208Z",
  },
});
add({
  id: "orb", name: "Dither orb", type: "generator", parent: "orb-breath", label: C.lime,
  props: { generator: "ditherOrb", x: 0, y: 0, width: 332, height: 332 },
  keyframes: { energy: keys((t) => 1 - hs(t) * 0.5, [[0.8, "easeInOut"], [1.3]]) },
});
add({
  id: "halo", name: "Orb halo", type: "ellipse", parent: "orb-breath", label: C.lime,
  props: {
    x: 0, y: 0, width: 632, height: 632, fillType: "radial",
    gradientStops: "rgba(140,195,112,0.42) 0, rgba(110,160,90,0.16) 0.38, rgba(15,15,18,0) 0.66",
  },
  keyframes: {
    opacity: keys(
      (t) => (0.78 + 0.22 * Math.sin((t * Math.PI * 2) / TOK.breathPeriod)) * (1 - 0.55 * hs(t)) + 0.5 * pulseSin(t),
      [[0, "sineOut"], ...breathTimes.slice(0, -1).map((t) => [t, "sineInOut"]), [2.7, "sineOut"], [2.85, "sineIn"], [3.0]],
    ),
  },
});

// ---------- header ----------
add({
  id: "header", name: "Header", type: "null", parent: "layout", label: C.sand,
  props: { y: 6.7 },
  keyframes: {
    x: keys((t) => 116.2 - 24 * (1 - P("header-in", t)), [[1.16, "expoOut"], [1.5]]),
    opacity: keys((t) => P("header-in", t), [[1.16, "expoOut"], [1.5]]),
    blur: keys((t) => 10 * (1 - P("header-in", t)), [[1.16, "expoOut"], [1.5]]),
  },
});
const headerFont = { fontWeight: 500, fontSize: 58.12, letterSpacing: -0.5812, lineHeight: 76 / 58.12 };
const swapIn = (t) => ease.expoOut(clamp((raw("title-swap", t) - 0.3) / 0.7));
const swapOut = (t) => ease.p2InOut(clamp(raw("title-swap", t) / 0.45));
const tIn = 2.46 + 0.3 * 0.38, tOut = 2.46 + 0.45 * 0.38;
add({
  id: "header-ready", name: "“Your session is ready”", type: "text", parent: "header", label: C.sand,
  props: text({ x: 0, text: "Your session is ready", ...headerFont, fill: "rgba(244,249,238,0.86)" }),
  keyframes: {
    opacity: keys(swapIn, [[tIn, "expoOut"], [2.84]]),
    blur: keys((t) => 8 * (1 - swapIn(t)), [[tIn, "expoOut"], [2.84]]),
    y: keys((t) => 10 * (1 - swapIn(t)), [[tIn, "expoOut"], [2.84]]),
  },
});
add({
  id: "header-thinking", name: "“Trademania V3 is thinking” (shimmer)", type: "text", parent: "header", label: C.sand,
  props: text({
    x: 0, y: 0, text: "Trademania V3 is thinking", ...headerFont, fill: "rgba(244,249,238,0.82)",
    fillType: "linear", gradientAngle: 90, gradientScale: 2, gradientRepeat: "yes",
    gradientStops: "rgba(244,249,238,0.82) 0, rgba(244,249,238,0.82) 0.32, rgba(120,132,114,0.62) 0.5, rgba(244,249,238,0.82) 0.68, rgba(244,249,238,0.82) 1",
  }),
  keyframes: {
    // Band position: one sweep every 0.9s, phase-locked to t = 1.04.
    gradientShift: [{ t: 1.16, v: r4(-0.5 + (1.16 - 1.04) / 0.9) }, { t: 2.7, v: r4(-0.5 + (2.7 - 1.04) / 0.9) }],
    opacity: keys((t) => 1 - swapOut(t), [[2.46, "quadInOut"], [tOut]]),
    blur: keys((t) => 8 * swapOut(t), [[2.46, "quadInOut"], [tOut]]),
  },
});

// ---------- step list (scrolls with the camera; masked) ----------
const listLayers = [];
const listAdd = (l) => (listLayers.push({ ...l, matte: "list-mask" }), l);

const riseY = (focusId, y2, y3) => (t) => lerp(y2, y3, P("collapse", t)) + TOK.rise * (1 - P(focusId, t));
const focusKeys = (id) => [[TR[id][0], "expoOut"], [TR[id][1]]];

MAIN.forEach((m, i) => {
  const r = R_MAIN[i], step = "step-" + i, dsc = "desc-" + i;
  const next = i < 2 ? "step-" + (i + 1) : "sub-2";
  const op = (t) => base(t) * (1 - P(step, t)) + P(step, t);
  // Row group.
  listAdd({
    id: `step${i + 1}`, name: `Step ${i + 1} · ${m.title}`, type: "null", parent: "camera", label: C.lime,
    props: { x: 89.4 },
    keyframes: {
      y: keys(riseY(step, m.r2, m.r3), [...focusKeys(step), [2.44, "easeInOut"], [2.86]]),
      opacity: keys(op, [[1.18, "quadInOut"], [r, "expoOut"], [1.36, "expoOut"], [r + FOCUS]]),
      blur: keys((t) => TOK.blur * (1 - P(step, t)), focusKeys(step)),
    },
  });
  const x0 = m.icon ? 53.65 + 22.35 : 0;
  const titleBase = { fontWeight: 500, fontSize: 49.18, letterSpacing: -0.4918, lineHeight: 64 / 49.18, fill: FG };
  if (m.icon) {
    listAdd({ id: `step${i + 1}-coin`, name: "BTC coin", type: "ellipse", parent: `step${i + 1}`, props: { x: 0, y: 5.175, anchorX: 0, anchorY: 0, width: 53.65, height: 53.65, fill: "#F7931A" } });
    listAdd({
      id: `step${i + 1}-coin-b`, name: "BTC ₿", type: "path", parent: `step${i + 1}`,
      props: {
        x: 13.587, y: 15.168, anchorX: 0, anchorY: 0, scale: 0.9935, fill: "#ffffff", strokeWidth: 0,
        d: "M38.8798 23.5069C39.4063 19.9922 36.7286 18.1024 33.0701 16.8414L34.2572 12.0792L31.3599 11.3582L30.2029 15.9946C29.4417 15.8035 28.6604 15.6257 27.8807 15.448L29.046 10.7813L26.1487 10.0586L24.9616 14.8192C24.3312 14.675 23.7108 14.5341 23.1105 14.3832L23.1139 14.3681L19.1166 13.3704L18.3454 16.4658C18.3454 16.4658 20.4966 16.9588 20.4513 16.989C21.625 17.2825 21.8362 18.0588 21.801 18.6759L20.4496 24.1005C20.5301 24.1206 20.6341 24.1508 20.7514 24.1961L20.4446 24.1206L18.5499 31.7201C18.4057 32.0756 18.0419 32.6105 17.2203 32.4076C17.2505 32.4495 15.1144 31.8828 15.1144 31.8828L13.6758 35.1996L17.4483 36.1403C18.1492 36.3164 18.8366 36.5008 19.5123 36.6735L18.3135 41.4894L21.2092 42.2105L22.3963 37.4482C23.1877 37.6612 23.9556 37.8591 24.7067 38.0469L23.523 42.789L26.4203 43.51L27.6192 38.7042C32.562 39.6399 36.2776 39.2626 37.8419 34.7921C39.1028 31.1936 37.7799 29.116 35.1794 27.7628C37.074 27.3268 38.4992 26.0809 38.8798 23.5069ZM32.2569 32.7933C31.3632 36.3935 25.302 34.4467 23.3369 33.9587L24.9297 27.5783C26.8948 28.0696 33.1942 29.0405 32.2569 32.7933ZM33.1539 23.4549C32.3374 26.7298 27.2939 25.0647 25.6591 24.6572L27.1011 18.8721C28.7358 19.2796 34.0057 20.0392 33.1539 23.4549Z",
      },
    });
  }
  if (m.alt) {
    const k = (t) => P("step3-swap", t);
    listAdd({
      id: `step${i + 1}-title`, name: m.title, type: "text", parent: `step${i + 1}`,
      props: text({ x: x0, y: 0, text: m.title, ...titleBase }),
      keyframes: { opacity: keys((t) => 1 - k(t), [[2.5, "expoOut"], [2.74]]), blur: keys((t) => 6 * k(t), [[2.5, "expoOut"], [2.74]]) },
    });
    listAdd({
      id: `step${i + 1}-title-alt`, name: m.alt, type: "text", parent: `step${i + 1}`,
      props: text({ x: x0, y: 0, text: m.alt, ...titleBase }),
      keyframes: { opacity: keys(k, [[2.5, "expoOut"], [2.74]]), blur: keys((t) => 6 * (1 - k(t)), [[2.5, "expoOut"], [2.74]]) },
    });
  } else {
    listAdd({ id: `step${i + 1}-title`, name: m.title, type: "text", parent: `step${i + 1}`, props: text({ x: x0, y: 0, text: m.title, ...titleBase }) });
  }
  if (m.tag) {
    const tx = x0 + m.titleW + 22.35;
    listAdd({ id: `step${i + 1}-tag`, name: `Tag · ${m.tag}`, type: "rect", parent: `step${i + 1}`, props: { x: tx, y: 5, anchorX: 0, anchorY: 0, width: m.tagW + 28, height: 54, radius: 4.5, fill: "rgba(255,255,255,0.08)" } });
    listAdd({
      id: `step${i + 1}-tag-text`, name: `Tag text · ${m.tag}`, type: "text", parent: `step${i + 1}`,
      props: text({ x: tx + 14, y: 5, text: m.tag, fontWeight: 400, fontSize: 42.47, letterSpacing: -0.4247, lineHeight: 54 / 42.47, fill: "rgba(255,255,255,0.56)" }),
    });
  }
  // Description.
  const dop = (t) => (base(t) * (1 - P(dsc, t)) + P(dsc, t)) * (1 - P("desc-collapse", t));
  listAdd({
    id: `step${i + 1}-desc`, name: `Step ${i + 1} description`, type: "text", parent: "camera", label: C.lime,
    props: text({ x: 89.4, text: m.desc, fontWeight: 400, fontSize: 30.74, letterSpacing: -0.1537, lineHeight: 1.4, fill: DESC, maxWidth: 716.8 }),
    keyframes: {
      y: keys((t) => riseY(dsc, m.r2, m.r3)(t) + 80.76, [...focusKeys(dsc), [2.44, "easeInOut"], [2.86]]),
      opacity: keys(dop, [[1.18, "quadInOut"], [r + DESC_LAG, "expoOut"], [1.36, "expoOut"], [r + DESC_LAG + FOCUS], [2.42, "easeInOut"], [2.6]]),
      blur: keys((t) => TOK.blur * (1 - P(dsc, t)) + 6 * P("desc-collapse", t), [...focusKeys(dsc), [2.42, "easeInOut"], [2.6]]),
    },
  });
  // Timeline dot.
  const [rs, re] = TR[step], [ns, ne] = TR[next];
  const rk0 = 2.48 + 0.32 * (i * 0.16), rk1 = 2.48 + 0.32 * (i * 0.16 + 0.6);
  const rk = (t) => ease.expoOut(clamp((raw("dots-ready", t) - i * 0.16) / 0.6));
  const dotColor = (t) => rgba(mix(mix(mix(GREY, LIME, P(step, t)), DONE, P(next, t)), WHITE, rk(t)));
  const active = (t) => P(step, t) * (1 - P(next, t)) * (1 - rk(t));
  const colorPts = [[rs, "expoOut"], [re, "expoOut"], [ns, "expoOut"], [ne, "expoOut"], [rk0, "expoOut"], [rk1]];
  const dy = i === 2 ? 30.2 : 25.7;
  listAdd({
    id: `step${i + 1}-dot`, name: `Step ${i + 1} dot`, type: "ellipse", parent: "camera", label: C.mint,
    props: { x: 0, width: 12.6, height: 12.6, shadowBlur: 22 },
    keyframes: {
      y: keys((t) => lerp(m.r2, m.r3, P("collapse", t)) + dy, [[2.44, "easeInOut"], [2.86]]),
      fill: keys(dotColor, colorPts),
      shadowColor: keys((t) => `rgba(217,249,185,${r4(0.55 * active(t))})`, colorPts),
      opacity: keys((t) => Math.max(0.5 * L(t) + 0.5 * P(step, t), rk(t)), [[1.18, "quadInOut"], [1.36], [rs, "expoOut"], [re], [rk0, "expoOut"], [rk1]]),
      scale: [{ t: r4(rk0), v: 1, ease: "sineOut" }, { t: r4(rk0 + 0.0192), v: 1.45, ease: "expoOut" }, { t: r4(rk1), v: 1 }],
    },
  });
});

SUBS.forEach((s, i) => {
  const r = R_SUB[i], sub = "sub-" + i, dsc = "sdesc-" + i;
  const op = (t) => base(t) * (1 - P(sub, t)) + P(sub, t);
  listAdd({
    id: `sub${i + 1}`, name: `Sub ${i + 1} · ${s.title}`, type: "null", parent: "camera", label: C.sand,
    props: { x: 111.75 },
    keyframes: {
      y: keys(riseY(sub, s.r2 + 6.7, s.r3 + 6.7), [...focusKeys(sub), [2.44, "easeInOut"], [2.86]]),
      opacity: keys(op, [[1.18, "quadInOut"], [1.36], [r, "expoOut"], [r + FOCUS]]),
      blur: keys((t) => TOK.blur * (1 - P(sub, t)), focusKeys(sub)),
    },
  });
  const subFont = { fontWeight: 500, fontSize: 33.53, letterSpacing: -0.3353, lineHeight: 44 / 33.53, fill: "rgba(244,249,238,0.56)" };
  listAdd({ id: `sub${i + 1}-title`, name: s.title, type: "text", parent: `sub${i + 1}`, props: text({ x: 0, y: 0, text: s.title, ...subFont }) });
  listAdd({
    id: `sub${i + 1}-dots`, name: `${s.title} “...”`, type: "text", parent: `sub${i + 1}`,
    props: text({ x: s.titleW, y: 0, text: "...", ...subFont }),
    keyframes: { opacity: keys((t) => 1 - P("desc-collapse", t), [[2.42, "easeInOut"], [2.6]]) },
  });
  const dop = (t) => (base(t) * (1 - P(dsc, t)) + P(dsc, t)) * (1 - P("desc-collapse", t));
  listAdd({
    id: `sub${i + 1}-desc`, name: `Sub ${i + 1} description`, type: "text", parent: "camera", label: C.sand,
    props: text({ x: 111.75, text: s.desc, fontWeight: 400, fontSize: 25.15, letterSpacing: -0.1258, lineHeight: 1.4, fill: DESC }),
    keyframes: {
      y: keys((t) => riseY(dsc, s.r2 + 6.7, s.r3 + 6.7)(t) + 46, [...focusKeys(dsc), [2.44, "easeInOut"], [2.86]]),
      opacity: keys(dop, [[1.18, "quadInOut"], [1.36], [r + DESC_LAG, "expoOut"], [r + DESC_LAG + FOCUS], [2.42, "easeInOut"], [2.6]]),
      blur: keys((t) => TOK.blur * (1 - P(dsc, t)) + 6 * P("desc-collapse", t), [...focusKeys(dsc), [2.42, "easeInOut"], [2.6]]),
    },
  });
});

LINES.forEach((l, i) => {
  const id = "line-" + i;
  listAdd({
    id: `line${i + 1}`, name: `Connector ${i + 1}`, type: "rect", parent: "camera", label: C.mint,
    props: { x: -1.6, y: l.a, anchorY: 0, width: 3.2, height: l.b - l.a, fill: "rgba(255,255,255,0.24)" },
    keyframes: {
      scaleY: keys((t) => ease.sineInOut(raw(id, t)), [[TR[id][0], "sineInOut"], [TR[id][1]]]),
      opacity: keys((t) => (1 - P("lines-out", t)) * L(t), [[1.18, "quadInOut"], [1.36], [2.42, "quadInOut"], [2.62]]),
    },
  });
});

// Rows first (each group null above its children), connector lines at the back.
for (const l of listLayers) add(l);

// ---------- scene 1 title ----------
const ti = (t) => P("title-in", t), to = (t) => P("title-out", t);
const titlePts = [[0.1, "expoOut"], [0.46], [0.78, "quadInOut"], [1.0]];
add({
  id: "timer", name: "Timer", type: "text", label: C.fg,
  props: { x: 960, anchorY: 0, text: "Thinking for {counter}s", fontFamily: "Geist", fontWeight: 500, fontSize: 40, letterSpacing: -0.4, lineHeight: 52 / 40, fill: "rgba(244,249,238,0.45)", counterDecimals: 1 },
  keyframes: {
    counter: [{ t: 0.1, v: 0 }, { t: r4(0.1 + 1.8 / 2.6), v: 1.8 }],
    y: keys((t) => 789 + TOK.rise * (1 - ti(t)) - 14 * to(t), titlePts),
    opacity: keys((t) => ti(t) * (1 - to(t)), titlePts),
    blur: keys((t) => TOK.blur * 0.7 * (1 - ti(t)) + 8 * to(t), titlePts),
  },
});
add({
  id: "title", name: "Title · is thinking...", type: "text", label: C.fg,
  props: { x: 960, anchorY: 0, text: "Trademania V3 is thinking...", fontFamily: "Geist", fontWeight: 600, fontSize: 70.76, letterSpacing: -0.7076, lineHeight: 94 / 70.76, fill: FG },
  keyframes: {
    y: keys((t) => 675 + TOK.rise * (1 - ti(t)) - 14 * to(t), titlePts),
    opacity: keys((t) => ti(t) * (1 - to(t)), titlePts),
    blur: keys((t) => TOK.blur * 0.7 * (1 - ti(t)) + 8 * to(t), titlePts),
  },
});

// ---------- background ----------
const m2 = (t) => P("bg-swap", t), bloom = (t) => P("orb-in", t);
const bloomPts = [[0, "expoOut"], [0.34], [0.84, "easeInOut"], [1.34]];
add({
  id: "dither", name: "Dither field", type: "generator", label: C.mint,
  props: { generator: "ditherField", x: 960, y: 540, width: 1920, height: 1080, glyphColor: "#D9F9B9" },
  keyframes: {
    gridMix: keys(m2, [[0.84, "easeInOut"], [1.34]]),
    orbMix: keys((t) => bloom(t) * (1 - m2(t)), bloomPts),
    boost: keys(pulseSin, [[2.7, "sineOut"], [2.85, "sineIn"], [3.0]]),
  },
});
add({
  id: "glow1", name: "Orb glow", type: "ellipse", parent: "layout", label: C.mint,
  props: { width: 900, height: 900, fillType: "radial", gradientStops: "rgba(110,160,92,0.30) 0, rgba(70,110,60,0.12) 0.35, rgba(15,15,18,0) 0.68" },
  keyframes: { x: orbXKeys, y: orbYKeys, opacity: keys((t) => bloom(t) * (1 - m2(t)), bloomPts) },
});
add({
  id: "glow2", name: "Top glow", type: "ellipse", label: C.mint,
  props: { x: 960, y: -70, width: 2400, height: 1100, fillType: "radial", gradientStops: "rgba(217,249,185,0.20) 0, rgba(150,200,120,0.08) 0.40, rgba(14,21,19,0) 0.70" },
  keyframes: { opacity: keys((t) => m2(t) * (1 + 0.35 * pulseSin(t)), [[0.84, "easeInOut"], [1.34], [2.7, "sineOut"], [2.85, "sineIn"], [3.0]]) },
});
add({
  id: "base", name: "Base gradient", type: "rect", label: C.mint,
  props: { x: 960, y: 540, width: 1920, height: 1080, fillType: "linear", gradientAngle: 180, gradientStops: "#111915 0, #0e1311 0.45, #0F0F12 1" },
  keyframes: { opacity: keys(m2, [[0.84, "easeInOut"], [1.34]]) },
});
add({
  id: "list-mask", name: "List mask (matte)", type: "rect", label: C.lilac,
  props: {
    x: 960, y: 540, width: 1920, height: 1080, fillType: "linear", gradientAngle: 180,
    gradientStops: "rgba(0,0,0,0) 0, rgba(0,0,0,0) 0.2185, #000000 0.2815, #000000 0.9352, rgba(0,0,0,0) 1",
  },
});

// Put rig nulls first, then visuals in stacking order (orb on top).
const order = ["layout", "camera", "orb-move", "orb-breath", "header"];
const rig = order.map((id) => layers.find((l) => l.id === id));
const rest = layers.filter((l) => !order.includes(l.id));
const orbParts = rest.filter((l) => ["ring", "logo", "orb", "halo"].includes(l.id));
const headerParts = rest.filter((l) => l.id.startsWith("header-"));
const others = rest.filter((l) => !orbParts.includes(l) && !headerParts.includes(l));

const shot = {
  name: "Trademania V3 · Thinking → Ready",
  note: "Imported from Claude chat artifact (7HUufEMKQsxYRhHsPf8sY8)",
  width: 1920,
  height: 1080,
  fps: 24,
  duration: 3,
  background: "#0F0F12",
  layers: [...rig, ...orbParts, ...headerParts, ...others],
};

const dir = new URL("../shots/trademania-v3-thinking/", import.meta.url);
mkdirSync(dir, { recursive: true });
writeFileSync(new URL("v001.json", dir), JSON.stringify(shot, null, 2) + "\n");
console.log(`wrote ${shot.layers.length} layers`);
