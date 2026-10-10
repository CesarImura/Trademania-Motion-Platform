// v007 of trademania-v3-thinking, built on top of v006 (feedback round 6):
// the step tree is rendered as ONE group — every line solid white, then the finished
// group is faded to 24% once. Overlaps (junctions, ball line → spine) no longer
// stack into brighter spots, and all lines share one color and width.
// The spine is clipped to start exactly where the ball line straightens (removes the
// faint second line beside the curve).
//
//   node scripts/trademania-v3-v007.mjs

import { readFileSync, writeFileSync } from "node:fs";

const dir = new URL("../shots/trademania-v3-thinking/", import.meta.url);
const shot = JSON.parse(readFileSync(new URL("v006.json", dir), "utf8"));

const get = (id) => {
  const l = shot.layers.find((x) => x.id === id);
  if (!l) throw new Error(`missing layer ${id}`);
  return l;
};
const insertBefore = (beforeId, ...layers) => {
  const i = shot.layers.findIndex((x) => x.id === beforeId);
  if (i < 0) throw new Error(`missing layer ${beforeId}`);
  shot.layers.splice(i, 0, ...layers);
};
const clone = (v) => JSON.parse(JSON.stringify(v));

shot.note = "Step tree rendered as one group: no brighter overlaps, consistent lines";

const camera = get("camera");
const JUNCTION = 160; // layout-space y where the ball line becomes the vertical spine

insertBefore(
  "stem",
  {
    id: "tree", name: "Step tree (group)", type: "null", parent: "layout", label: "#9fdcc6",
    // Group render: lines are drawn solid, then the whole tree is faded once.
    props: {
      x: 0, y: 0, opacity: 0.24, isolate: "yes",
      rampBlur: camera.props.rampBlur ?? 14, rampStart: camera.props.rampStart, rampEnd: camera.props.rampEnd,
    },
    keyframes: camera.keyframes?.rampBlur ? { rampBlur: clone(camera.keyframes.rampBlur) } : undefined,
  },
  {
    id: "tree-scroll", name: "Tree scroll (follows camera)", type: "null", parent: "tree", label: "#c5b9ee",
    props: { x: 0 },
    keyframes: { y: clone(camera.keyframes.y) },
  },
  {
    // Matte: keeps the spine below the junction only (the ball line covers above it).
    id: "spine-clip", name: "Spine clip (matte)", type: "rect", parent: "layout", label: "#c5b9ee",
    props: { x: 500, y: JUNCTION, anchorX: 0.5, anchorY: 0, width: 3000, height: 3000, fill: "#000000" },
  },
);
if (!get("tree").keyframes) delete get("tree").keyframes;

const stem = get("stem");
stem.parent = "tree";
delete stem.matte;
delete stem.matteMode;
stem.props.stroke = "#ffffff";

const spine = get("spine");
spine.parent = "tree-scroll";
spine.matte = "spine-clip";
spine.props.fill = "#ffffff";

for (const l of shot.layers.filter((l) => /^(step|sub)\d-branch$/.test(l.id))) {
  l.parent = "tree-scroll";
  l.props.stroke = "#ffffff"; // keeps the list's fade mask, so branches leave with their rows
}

writeFileSync(new URL("v007.json", dir), JSON.stringify(shot, null, 2) + "\n");
console.log(`v007: ${shot.layers.length} layers, ${shot.duration}s`);
