// v003 of trademania-v3-thinking, built on top of v002 (feedback round 2):
//  - Ball: no blur on entry; crisp edge; look matched to the Figma reference
//    (top-right light, grain, calmer blobs); ASCII scrambles fast while thinking,
//    slow drift once ready; wider, softer glow kept separate from the ball
//  - Branching: a stem grows out of the ball into the step spine, and sub-items
//    branch off it with elbow connectors (decision-tree look)
//  - Thinking text: dim text with a white light sweeping left → right on loop
//
//   node scripts/trademania-v3-v003.mjs

import { readFileSync, writeFileSync } from "node:fs";

const dir = new URL("../shots/trademania-v3-thinking/", import.meta.url);
const shot = JSON.parse(readFileSync(new URL("v002.json", dir), "utf8"));

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
const r4 = (v) => +v.toFixed(4);

shot.note = "Crisp Figma-style ball, scrambling ASCII, branching connectors, light-sweep thinking text";

// ---------- ball ----------
delete get("orb-move").keyframes.blur; // no blur on entry — opacity + scale only

// Colors sampled from the Figma frame: bright top/top-right, dark core behind the
// mark, a bounce rim at the lower left, mid-tone edges.
Object.assign(get("orb").props, {
  lighting: "studio",
  light: "#a3c889", mid: "#4b6747", shade: "#1f3324", edge: "#3d573b", rim: "#7a9d6b", glyphColor: "#e2f3d2",
  lightX: 0.62, lightY: 0.04, lightSize: 1.2, core: 0.95, rimX: 0.22, rimY: 0.86, rimSize: 0.62,
  blobs: 0.15, vignette: 0.12, grain: 0.14, glyphAlpha: 1.15,
});
// Scramble hard while the agent works (thinking + steps loading), then calm down.
setKeys("orb", "scramble", [{ t: 0, v: 0.85 }, { t: 2.5, v: 0.85, ease: "sineInOut" }, { t: 3.1, v: 0.12 }]);
setKeys("orb", "scrambleRate", [{ t: 0, v: 16 }, { t: 2.5, v: 16, ease: "sineInOut" }, { t: 3.1, v: 3 }]);
setKeys("orb", "spin", [{ t: 0, v: 1.2 }, { t: 2.5, v: 1.2, ease: "sineInOut" }, { t: 3.1, v: 0.35 }]);

// Glow: wider and softer, so it reads as light around a solid ball.
Object.assign(get("halo").props, {
  width: 1150, height: 1150,
  gradientStops: "rgba(130,165,115,0.46) 0, rgba(100,130,92,0.20) 0.3, rgba(60,80,58,0.07) 0.5, rgba(15,15,18,0) 0.7",
});

// ---------- thinking text: white light sweeping across dim text ----------
const sweep = {
  fillType: "linear", gradientAngle: 90, gradientScale: 2, gradientRepeat: "yes",
  gradientStops: "rgba(244,249,238,0.42) 0, rgba(244,249,238,0.42) 0.3, #ffffff 0.5, rgba(244,249,238,0.42) 0.7, rgba(244,249,238,0.42) 1",
};
Object.assign(get("title").props, sweep);
setKeys("title", "gradientShift", [{ t: 0.1, v: -0.55 }, { t: 1.0, v: 0.2 }]); // ~1.2s per sweep
Object.assign(get("header-thinking").props, sweep);
setKeys("header-thinking", "gradientShift", [{ t: 1.16, v: -0.5 }, { t: 2.66, v: 0.75 }]);

// ---------- branching connectors ----------
const LINE = "rgba(255,255,255,0.24)", SPINE_X = -1.6;
const fadeOut = [{ t: 2.42, v: 1, ease: "quadInOut" }, { t: 2.62, v: 0 }]; // with the original lines-out

// Stem: out of the bottom of the ball (icon state: center 44.7, radius 44.7) into the spine.
// It lives in layout space (doesn't scroll) and is shown only ABOVE the list's fade band
// (inverted matte), so it crossfades seamlessly into the scrolling spine below.
insertBefore("line1", {
  id: "stem", name: "Stem (ball → spine)", type: "path", parent: "layout", label: "#9fdcc6",
  matte: "list-mask", matteMode: "inverse",
  props: {
    x: SPINE_X, y: 89.4, anchorX: 0, anchorY: 0,
    d: `M44.7 89.4 C44.7 128 ${SPINE_X} 118 ${SPINE_X} 160 L${SPINE_X} 240`,
    fill: "rgba(0,0,0,0)", stroke: LINE, strokeWidth: 3.2, lineCap: "butt",
  },
  keyframes: { trimEnd: [{ t: 1.22, v: 0, ease: "expoOut" }, { t: 1.44, v: 1 }], opacity: fadeOut },
}, {
  // Spine piece from under the ball down to the first dot (scrolls with the list).
  id: "line0", name: "Connector 0", type: "rect", parent: "camera", label: "#9fdcc6", matte: "list-mask",
  props: { x: SPINE_X, y: 100, anchorY: 0, width: 3.2, height: 103, fill: LINE },
  keyframes: {
    scaleY: [{ t: 1.3, v: 0, ease: "sineInOut" }, { t: 1.42, v: 1 }],
    opacity: [{ t: 1.18, v: 0, ease: "quadInOut" }, { t: 1.36, v: 1 }, ...fadeOut],
  },
});

// Elbows: from the spine into each sub-item, drawn on as the item loads.
const SUB_FOCUS = [1.84, 1.96, 2.08];
[1, 2, 3].forEach((n, i) => {
  const sub = get(`sub${n}`);
  const sx = r4(SPINE_X - sub.props.x); // spine x in the sub row's local space
  const y = 22; // vertical center of the sub title line box
  insertBefore(`sub${n}-title`, {
    id: `sub${n}-branch`, name: `Branch → ${get(`sub${n}-title`).props.text}`, type: "path", parent: `sub${n}`,
    label: "#9fdcc6", matte: "list-mask",
    props: {
      x: sx, y: -8, anchorX: 0, anchorY: 0,
      d: `M${sx} -8 C${sx} 12 ${r4(sx + 8)} ${y} ${r4(sx + 26)} ${y} L-14 ${y}`,
      fill: "rgba(0,0,0,0)", stroke: LINE, strokeWidth: 3.2, lineCap: "round",
    },
    keyframes: {
      trimEnd: [{ t: r4(SUB_FOCUS[i] - 0.04), v: 0, ease: "expoOut" }, { t: r4(SUB_FOCUS[i] + 0.3), v: 1 }],
      opacity: fadeOut,
    },
  });
});

// The list's fade band follows the layout down during the collapse, so it always
// starts just under the ball.
setKeys("list-mask", "y", [{ t: 2.44, v: 540, ease: "easeInOut" }, { t: 2.86, v: 577 }]);

writeFileSync(new URL("v003.json", dir), JSON.stringify(shot, null, 2) + "\n");
console.log(`v003: ${shot.layers.length} layers, ${shot.duration}s`);
