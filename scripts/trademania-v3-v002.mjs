// v002 of trademania-v3-thinking, built on top of v001:
//  - BTC logo fix (₿ was stacked under the coin) + coin spins in as a group
//  - Full-screen, subtler ASCII field in the second half
//  - Longer ready hold (3.0s → 4.6s) with ambient life: icon breath, second ring
//    pulse, shimmer on "Your session is ready", dot glow wave, gentle push-in
//  - More motion while loading: orb float, title shimmer, tags slide in
//
//   node scripts/trademania-v3-v002.mjs

import { readFileSync, writeFileSync } from "node:fs";

const dir = new URL("../shots/trademania-v3-thinking/", import.meta.url);
const shot = JSON.parse(readFileSync(new URL("v001.json", dir), "utf8"));

const DUR = 4.6;
const get = (id) => {
  const l = shot.layers.find((x) => x.id === id);
  if (!l) throw new Error(`missing layer ${id}`);
  return l;
};
const kf = (l, prop) => ((l.keyframes ??= {})[prop] ??= []);
const setKeys = (id, prop, keys) => {
  const l = get(id);
  (l.keyframes ??= {})[prop] = keys;
  delete l.props[prop];
};
const insertBefore = (beforeId, ...layers) => {
  const i = shot.layers.findIndex((x) => x.id === beforeId);
  shot.layers.splice(i, 0, ...layers);
};
const r4 = (v) => +v.toFixed(4);

shot.duration = DUR;
shot.note = "4.6s with ready hold, full-screen subtle ASCII bg, BTC logo fix, more motion";

// ---------- camera push-in over the ready hold ----------
const layout = get("layout");
for (const k of layout.keyframes.x) k.v = r4(k.v - 960);
for (const k of layout.keyframes.y) k.v = r4(k.v - 540);
layout.parent = "push";
insertBefore("layout", {
  id: "push", name: "Camera push", type: "null", label: "#c5b9ee",
  props: { x: 960, y: 540 },
  keyframes: { scale: [{ t: 2.86, v: 1, ease: "sineInOut" }, { t: DUR, v: 1.03 }] },
});

// ---------- BTC coin: fix stacking, group it, spin it in ----------
const coin = get("step2-coin"), coinB = get("step2-coin-b");
shot.layers = shot.layers.filter((l) => l !== coin && l !== coinB);
const cx = 26.825, cy = 5.175 + 26.825;
Object.assign(coin, { parent: "step2-coin-group" });
coin.props = { x: 0, y: 0, width: 53.65, height: 53.65, fill: "#F7931A" };
Object.assign(coinB, { parent: "step2-coin-group" });
coinB.props.x = r4(coinB.props.x - cx);
coinB.props.y = r4(coinB.props.y - cy);
insertBefore("step2-title", {
  id: "step2-coin-group", name: "BTC logo", type: "null", parent: "step2", label: "#e6d3a3",
  props: { x: cx, y: cy },
  keyframes: {
    scale: [{ t: 1.48, v: 0.4, ease: "backOut" }, { t: 1.92, v: 1 }],
    rotation: [{ t: 1.48, v: -120, ease: "expoOut" }, { t: 2.0, v: 0 }],
  },
}, coinB, coin); // ₿ above the coin

// ---------- tags slide in a beat after their row ----------
for (const [row, r] of [["step1", 1.3], ["step2", 1.48]]) {
  for (const id of [`${row}-tag`, `${row}-tag-text`]) {
    const l = get(id), x = l.props.x;
    setKeys(id, "x", [{ t: r, v: r4(x + 18), ease: "expoOut" }, { t: r4(r + 0.45), v: x }]);
    setKeys(id, "opacity", [{ t: r4(r + 0.04), v: 0, ease: "expoOut" }, { t: r4(r + 0.36), v: 1 }]);
  }
}

// ---------- orb: float while thinking, breathe while ready ----------
setKeys("orb-breath", "y", [
  { t: 0, v: 0, ease: "sineInOut" }, { t: 0.4, v: -7, ease: "sineInOut" }, { t: 0.8, v: 0 },
]);
const breath = kf(get("orb-breath"), "scale");
breath.at(-1).ease = "sineInOut";
breath.push(
  { t: 3.0, v: 1, ease: "sineInOut" }, { t: 3.4, v: 1.07, ease: "sineInOut" }, { t: 3.85, v: 1, ease: "sineInOut" },
  { t: 4.25, v: 1.05, ease: "sineInOut" }, { t: DUR, v: 1 },
);
const halo = kf(get("halo"), "opacity");
halo.at(-1).ease = "sineInOut";
halo.push(
  { t: 3.4, v: 0.62, ease: "sineInOut" }, { t: 3.85, v: 0.4, ease: "sineInOut" },
  { t: 4.25, v: 0.55, ease: "sineInOut" }, { t: DUR, v: 0.42 },
);
// Second, softer ready ring.
setKeys("ring", "opacity", [
  { t: 0, v: 0, ease: "hold" }, { t: 2.7, v: 0.7 }, { t: 3.0, v: 0, ease: "hold" }, { t: 3.4, v: 0.35 }, { t: 3.85, v: 0 },
]);
setKeys("ring", "scale", [
  { t: 2.7, v: 1 }, { t: 3.0, v: 1.9, ease: "hold" }, { t: 3.4, v: 1, ease: "expoOut" }, { t: 3.85, v: 1.75 },
]);

// ---------- shimmer on the scene-1 title while thinking ----------
Object.assign(get("title").props, {
  fillType: "linear", gradientAngle: 90, gradientScale: 2, gradientRepeat: "yes",
  gradientStops: "#F4F9EE 0, #F4F9EE 0.34, rgba(150,165,140,0.75) 0.5, #F4F9EE 0.66, #F4F9EE 1",
});
setKeys("title", "gradientShift", [{ t: 0.1, v: -0.5 }, { t: 1.0, v: 0.5 }]);

// ---------- one lime shimmer across "Your session is ready" ----------
Object.assign(get("header-ready").props, {
  fillType: "linear", gradientAngle: 90, gradientScale: 3,
  gradientStops: "rgba(244,249,238,0.86) 0, rgba(244,249,238,0.86) 0.42, #D9F9B9 0.5, rgba(244,249,238,0.86) 0.58, rgba(244,249,238,0.86) 1",
});
setKeys("header-ready", "gradientShift", [{ t: 3.05, v: -0.6, ease: "sineInOut" }, { t: 3.95, v: 0.6 }]);

// ---------- ready: sub titles brighten, dots glow in a wave ----------
[1, 2, 3].forEach((n, i) => {
  const t0 = r4(2.62 + i * 0.06);
  setKeys(`sub${n}-title`, "fill", [{ t: t0, v: "rgba(244,249,238,0.56)", ease: "expoOut" }, { t: r4(t0 + 0.4), v: "rgba(244,249,238,0.8)" }]);
});
[1, 2, 3].forEach((n, i) => {
  const dot = get(`step${n}-dot`), t0 = r4(3.3 + i * 0.12);
  kf(dot, "shadowColor").push(
    { t: t0, v: "rgba(217,249,185,0)", ease: "sineInOut" }, { t: r4(t0 + 0.28), v: "rgba(217,249,185,0.5)", ease: "sineInOut" },
    { t: r4(t0 + 0.8), v: "rgba(217,249,185,0)" },
  );
  kf(dot, "scale").push({ t: t0, v: 1, ease: "sineInOut" }, { t: r4(t0 + 0.28), v: 1.18, ease: "sineInOut" }, { t: r4(t0 + 0.8), v: 1 });
});

// ---------- ASCII field: subtle, full screen in part two, slow breathing ----------
Object.assign(get("dither").props, { intensity: 0.5, coverage: 1.3, floor: 0.32, edgeFade: 0.2 });
setKeys("dither", "intensity", [
  { t: 1.34, v: 0.5, ease: "sineInOut" }, { t: 2.9, v: 0.5, ease: "sineInOut" }, { t: 3.75, v: 0.62, ease: "sineInOut" }, { t: DUR, v: 0.5 },
]);
const glow2 = kf(get("glow2"), "opacity");
glow2.at(-1).ease = "sineInOut";
glow2.push({ t: 3.8, v: 0.8, ease: "sineInOut" }, { t: DUR, v: 1 }); // opacity caps at 1, so breathe downward

writeFileSync(new URL("v002.json", dir), JSON.stringify(shot, null, 2) + "\n");
console.log(`v002: ${shot.layers.length} layers, ${shot.duration}s`);
