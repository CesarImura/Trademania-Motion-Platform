// v005 of trademania-v3-thinking, built on top of v004 (feedback round 4):
//  - No decision branches in the thinking part
//  - List reads like an AI working through steps: no bullets; one spine grows down
//    from the ball and branches into each item; items arrive one by one, top first,
//    ~0.45s apart; the item being worked on shimmers, then turns solid
//  - Ready state has no blur at all
//
//   node scripts/trademania-v3-v005.mjs

import { readFileSync, writeFileSync } from "node:fs";

const dir = new URL("../shots/trademania-v3-thinking/", import.meta.url);
const shot = JSON.parse(readFileSync(new URL("v004.json", dir), "utf8"));

const r4 = (v) => +v.toFixed(4);
const byId = () => new Map(shot.layers.map((l) => [l.id, l]));
const get = (id) => {
  const l = byId().get(id);
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
const remove = (pred) => (shot.layers = shot.layers.filter((l) => !pred(l)));

// ---------- 1. remove thinking branches, bullets, old connector segments ----------
remove((l) => /^branch\d/.test(l.id) || /^step\d-dot$/.test(l.id) || /^line\d$/.test(l.id) || /^sub\d-branch$/.test(l.id));

// ---------- 2. retime: one item at a time ----------
const GAP = 0.45;
const ITEMS = ["step1", "step2", "step3", "sub1", "sub2", "sub3"];
const OLD_T = [2.8, 2.98, 3.16, 3.34, 3.46, 3.58]; // v004 focus starts
const T = ITEMS.map((_, i) => r4(3.0 + i * GAP)); // 3.00 … 5.25
const READY_OLD = 3.9; // first key of the ready state in v004
const READY_SHIFT = r4(T.at(-1) + 0.4 - READY_OLD); // ready starts 0.4s after the last item
const itemOf = (id) => ITEMS.findIndex((p) => id === p || id.startsWith(p + "-"));

for (const l of shot.layers) {
  const item = itemOf(l.id);
  const delta = item >= 0 ? r4(T[item] - OLD_T[item]) : 0;
  for (const kfs of Object.values(l.keyframes ?? {})) {
    for (const k of kfs) {
      if (k.t >= READY_OLD) k.t = r4(k.t + READY_SHIFT);
      else if (item >= 0 && k.t >= 2.6) k.t = r4(k.t + delta);
    }
  }
}
shot.duration = r4(shot.duration + READY_SHIFT);
const READY = r4(READY_OLD + READY_SHIFT);
shot.note = "List as an AI step tree: spine branches into items one by one; no thinking branches; no blur when ready";

// Ready-state keys of a layer/prop (already shifted), to append after regenerated keys.
const readyKeys = (id, prop) => (get(id).keyframes?.[prop] ?? []).filter((k) => k.t >= READY - 0.05);

// ---------- 3. items: hidden until their turn, rise + fade in ----------
const ROW = { step1: 190, step2: 435, step3: 680, sub1: 898.2, sub2: 998.2, sub3: 1098.2 }; // y before collapse
ITEMS.forEach((id, i) => {
  const t = T[i], y = ROW[id];
  setKeys(id, "y", [{ t, v: r4(y + 16), ease: "figmaSlow" }, { t: r4(t + 0.5), v: y }, ...readyKeys(id, "y")]);
  setKeys(id, "opacity", [{ t: r4(t - 0.01), v: 0, ease: "figmaSlow" }, { t: r4(t + 0.45), v: 1 }]);
  setKeys(id, "blur", [{ t, v: 6, ease: "figmaSlow" }, { t: r4(t + 0.45), v: 0 }]);
  const desc = `${id}-desc`, d0 = r4(t + 0.08);
  const dy = id.startsWith("step") ? 80.76 : 46;
  setKeys(desc, "y", [{ t: d0, v: r4(y + dy + 16), ease: "figmaSlow" }, { t: r4(d0 + 0.5), v: r4(y + dy) }, ...readyKeys(desc, "y")]);
  setKeys(desc, "opacity", [{ t: r4(d0 - 0.01), v: 0, ease: "figmaSlow" }, { t: r4(d0 + 0.45), v: 1 }, ...readyKeys(desc, "opacity")]);
  setKeys(desc, "blur", [{ t: d0, v: 6, ease: "figmaSlow" }, { t: r4(d0 + 0.45), v: 0 }]); // nothing after ready
});

// The item being worked on shimmers (same light sweep as "is thinking"), then turns solid.
const SWEEP = 0.75;
const shimmer = (base) => ({
  fillType: "linear", gradientAngle: 90, gradientScale: 2, gradientRepeat: "yes",
  gradientStops: `${base} 0, ${base} 0.3, #ffffff 0.5, ${base} 0.7, ${base} 1`,
});
const TITLES = ["step1-title", "step2-title", "step3-title", "sub1-title", "sub2-title", "sub3-title"];
TITLES.forEach((id, i) => {
  const start = T[i], end = i < TITLES.length - 1 ? T[i + 1] : READY;
  Object.assign(get(id).props, shimmer(id.startsWith("sub") ? "rgba(244,249,238,0.32)" : "rgba(244,249,238,0.45)"));
  setKeys(id, "fillType", [{ t: start, v: "linear" }, { t: r4(end + 0.1), v: "solid" }]);
  setKeys(id, "gradientShift", [{ t: start, v: -0.5 }, { t: r4(end + 0.1), v: r4(-0.5 + (end + 0.1 - start) / SWEEP) }]);
});

// ---------- 4. the step tree: one spine + a branch into every item ----------
const LINE = "rgba(255,255,255,0.24)", X = -1.6, TOP = 100;
const fadeOut = readyKeys("stem", "opacity"); // tree fades as the list collapses into the ready layout
const centers = ITEMS.map((id) => ROW[id] + (id.startsWith("step") ? 32 : 22));
const forks = centers.map((c) => r4(c - 22)); // where each branch leaves the spine
const spineLen = forks.at(-1) - TOP;
const spineTrim = [{ t: r4(T[0] - 0.15), v: 0, ease: "figmaSlow" }];
forks.forEach((f, i) => {
  if (i > 0) spineTrim.push({ t: r4(T[i] - GAP + 0.1), v: spineTrim.at(-1).v, ease: "figmaSlow" });
  spineTrim.push({ t: T[i], v: r4((f - TOP) / spineLen) });
});
const tree = [{
  id: "spine", name: "Spine", type: "path", parent: "camera", label: "#9fdcc6", matte: "list-mask",
  props: { d: `M${X} ${TOP} L${X} ${forks.at(-1)}`, pathOrigin: "zero", fill: "rgba(0,0,0,0)", stroke: LINE, strokeWidth: 3.2, lineCap: "butt" },
  keyframes: { trimEnd: spineTrim, opacity: fadeOut.map((k) => ({ ...k })) },
}];
ITEMS.forEach((id, i) => {
  const c = centers[i], f = forks[i];
  const endX = id.startsWith("step") ? 72 : 96; // stop short of the item's text
  tree.push({
    id: `${id}-branch`, name: `Branch → ${get(`${id}-title`).props.text}`, type: "path", parent: "camera", label: "#9fdcc6", matte: "list-mask",
    props: {
      d: `M${X} ${f} C${X} ${r4(c - 6)} ${r4(X + 8)} ${c} ${r4(X + 24)} ${c} L${endX} ${c}`,
      pathOrigin: "zero", fill: "rgba(0,0,0,0)", stroke: LINE, strokeWidth: 3.2, lineCap: "round",
    },
    keyframes: {
      trimEnd: [{ t: r4(T[i] - 0.02), v: 0, ease: "figmaSlow" }, { t: r4(T[i] + 0.38), v: 1 }],
      opacity: fadeOut.map((k) => ({ ...k })),
    },
  });
});
insertBefore("sub3-desc", ...tree);

// Camera follows the work down the list, then returns on collapse (ready keys kept).
setKeys("camera", "y", [{ t: r4(T[2] - 0.1), v: 0, ease: "figmaSlow" }, { t: r4(T.at(-1) + 0.3), v: -260 }, ...readyKeys("camera", "y")]);
// Header keeps shimmering until the session is ready.
const hIn = get("header-thinking").keyframes.gradientShift[0];
setKeys("header-thinking", "gradientShift", [hIn, { t: r4(READY + 0.3), v: r4(hIn.v + (READY + 0.3 - hIn.t) / SWEEP) }]);

// ---------- 5. no blur once ready ----------
for (const id of ["header-ready", "header-thinking", "step3-title", "step3-title-alt"]) delete get(id).keyframes?.blur;
get("camera").props.rampBlur = 14;
setKeys("camera", "rampBlur", [{ t: READY, v: 14, ease: "figmaSlow" }, { t: r4(READY + 0.45), v: 0 }]);
let stray = [];
for (const l of shot.layers) {
  for (const k of l.keyframes?.blur ?? []) if (k.t >= READY && k.v > 0) stray.push(`${l.id}@${k.t}`);
}

writeFileSync(new URL("v005.json", dir), JSON.stringify(shot, null, 2) + "\n");
console.log(`v005: ${shot.layers.length} layers, ${shot.duration}s, items at ${T.join(", ")}, ready at ${READY}`);
if (stray.length) console.log("blur after ready:", stray.join(" "));
