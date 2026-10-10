// v008 of trademania-v3-thinking, built on top of v007 (feedback round 7):
//  - All six list items share one style: Indicators / Economic Data / Orderflow
//    get the same title + description size as the main steps, same alignment and
//    spacing. Tree, camera and ready layout re-spaced to match.
//  - When the list starts, the icon ball lights up into the Figma "lit" look:
//    #4A6C28 → #D9F9B9 diagonal, soft glow, white rim (Figma node 15781:15043).
//
//   node scripts/trademania-v3-v008.mjs

import { readFileSync, writeFileSync } from "node:fs";

const dir = new URL("../shots/trademania-v3-thinking/", import.meta.url);
const shot = JSON.parse(readFileSync(new URL("v007.json", dir), "utf8"));

const r4 = (v) => +v.toFixed(4);
const get = (id) => {
  const l = shot.layers.find((x) => x.id === id);
  if (!l) throw new Error(`missing layer ${id}`);
  return l;
};
const setKeys = (id, prop, keys) => {
  const l = get(id);
  (l.keyframes ??= {})[prop] = keys;
  delete l.props[prop];
};
const insertBefore = (beforeId, ...layers) => {
  const i = shot.layers.findIndex((x) => x.id === beforeId);
  if (i < 0) throw new Error(`missing layer ${beforeId}`);
  shot.layers.splice(i, 0, ...layers);
};

shot.note = "All list items same size; icon ball lights up (Figma lit state) as the list starts";

// Timings from v007 (items every 0.45s from 3.0; collapse read from the file).
const GAP = 0.45, T = [0, 1, 2, 3, 4, 5].map((i) => r4(3.0 + i * GAP));
const stepY = get("step1").keyframes.y;
const COLLAPSE = [stepY.at(-2).t, stepY.at(-1).t];
const collapse = (from, to) => [{ t: COLLAPSE[0], v: r4(from), ease: "figmaSlow" }, { t: COLLAPSE[1], v: r4(to) }];

// ---------- 1. one style for every item ----------
const ITEMS = ["step1", "step2", "step3", "sub1", "sub2", "sub3"];
const SPACING = 245, READY_SPACING = 104, ITEM_X = 89.4, DESC_DY = 80.76;
const ROW = Object.fromEntries(ITEMS.map((id, i) => [id, r4(190 + i * SPACING)]));
const ROW_READY = Object.fromEntries(ITEMS.map((id, i) => [id, r4(190 + i * READY_SPACING)]));
const TITLE = { fontWeight: 500, fontSize: 49.18, letterSpacing: -0.4918, lineHeight: 64 / 49.18, fill: "#F4F9EE" };
const DESC = { fontWeight: 400, fontSize: 30.74, letterSpacing: -0.1537, lineHeight: 1.4, maxWidth: 716.8 };
const TITLE_W = { sub1: 223.57, sub2: 337.96, sub3: 225.2 }; // Geist 500 49.18px, measured

ITEMS.forEach((id, i) => {
  const t = T[i], y = ROW[id], yr = ROW_READY[id];
  get(id).props.x = ITEM_X;
  setKeys(id, "y", [{ t, v: r4(y + 16), ease: "figmaSlow" }, { t: r4(t + 0.5), v: y }, ...collapse(y, yr)]);
  const desc = get(`${id}-desc`), d0 = r4(t + 0.08);
  desc.props.x = ITEM_X;
  setKeys(`${id}-desc`, "y", [{ t: d0, v: r4(y + DESC_DY + 16), ease: "figmaSlow" }, { t: r4(d0 + 0.5), v: r4(y + DESC_DY) }, ...collapse(y + DESC_DY, yr + DESC_DY)]);
  if (id.startsWith("sub")) {
    Object.assign(desc.props, DESC);
    const title = get(`${id}-title`);
    Object.assign(title.props, TITLE, { gradientStops: title.props.gradientStops.replaceAll("rgba(244,249,238,0.32)", "rgba(244,249,238,0.45)") });
    delete title.keyframes.fill; // no separate "brighten when ready" — they match the main steps now
    Object.assign(get(`${id}-dots`).props, TITLE, { x: TITLE_W[id] });
  }
});

// ---------- 2. tree + camera re-spaced ----------
const X = -1.6, TOP = 100;
const forks = ITEMS.map((id) => r4(ROW[id] + 32 - 22));
const LEN = forks.at(-1) - TOP, LEN_READY = r4(ROW_READY.sub3 + 32 - 22 - TOP);
const spineH = [{ t: r4(T[0] - 0.15), v: 0, ease: "figmaSlow" }];
forks.forEach((f, i) => {
  if (i > 0) spineH.push({ t: r4(T[i] - GAP + 0.1), v: spineH.at(-1).v, ease: "figmaSlow" });
  spineH.push({ t: T[i], v: r4(f - TOP) });
});
setKeys("spine", "height", [...spineH, ...collapse(LEN, LEN_READY)]);
ITEMS.forEach((id) => {
  const b = get(`${id}-branch`);
  b.props.d = `M${X} -22 C${X} -6 ${r4(X + 8)} 0 ${r4(X + 24)} 0 L72 0`; // same branch for every item
  setKeys(`${id}-branch`, "y", collapse(ROW[id] + 32, ROW_READY[id] + 32));
});
// Camera follows each new item, keeping it around the middle of the frame.
const FOCUS_Y = 420; // layout-space y where the newest item should sit
const cam = [{ t: r4(T[2] - 0.05), v: 0, ease: "figmaSlow" }];
for (let i = 2; i < ITEMS.length; i++) cam.push({ t: r4(T[i] + 0.4), v: r4(Math.min(0, FOCUS_Y - ROW[ITEMS[i]])), ease: "figmaSlow" });
delete cam.at(-1).ease;
const camKeys = [...cam, ...collapse(cam.at(-1).v, 0)];
setKeys("camera", "y", camKeys);
setKeys("tree-scroll", "y", JSON.parse(JSON.stringify(camKeys)));

// ---------- 3. icon ball lights up as the list starts ----------
const lit = [{ t: r4(T[0] - 0.1), v: 0, ease: "figmaSlow" }, { t: r4(T[0] + 0.5), v: 1 }];
insertBefore("orb", {
  id: "orb-lit", name: "Ball · lit (Figma)", type: "ellipse", parent: "orb-breath", label: "#D9F9B9",
  props: {
    x: 0, y: 0, width: 332, height: 332, fill: "#D9F9B9",
    fillType: "linear", gradientAngle: 45, gradientStops: "#4A6C28 0, #D9F9B9 1",
    stroke: "rgba(255,255,255,0.12)", strokeWidth: 8, blur: 8.2,
  },
  keyframes: { opacity: lit },
});
insertBefore("halo", {
  id: "orb-lit-glow", name: "Ball · lit glow", type: "ellipse", parent: "orb-breath", label: "#D9F9B9",
  props: {
    x: 0, y: 0, width: 900, height: 900, fillType: "radial",
    gradientStops: "rgba(217,249,185,0.32) 0, rgba(217,249,185,0.12) 0.28, rgba(217,249,185,0) 0.6",
  },
  keyframes: { opacity: JSON.parse(JSON.stringify(lit)) },
});

for (const l of shot.layers) for (const kfs of Object.values(l.keyframes ?? {})) kfs.sort((a, b) => a.t - b.t);
writeFileSync(new URL("v008.json", dir), JSON.stringify(shot, null, 2) + "\n");
console.log(`v008: ${shot.layers.length} layers, ${shot.duration}s, collapse ${COLLAPSE.join("→")}, camera ${cam.map((k) => k.v).join(" ")}`);
