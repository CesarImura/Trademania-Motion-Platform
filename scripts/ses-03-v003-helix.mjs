// SES-02→04 v003: smoother cursor + the Live lines' new ending.
// After the Live card expands, the red/green lines shoot right (reference whip ease):
// a head races along each line, pulling it taut, leaving a pixel-cell trail and breaking
// into halftone dots at the head. They twist into a rotating 3D helix around one axis,
// merge into one lime line, curl into the thinking orb's ring and the orb fills in — the
// last frame is "Trademania V3 · Denkt nach → Bereit (DE)" at 0.46s, so a cut continues it.
// Built on v002 (the latest saved version). Writes shots/ses-03-live-or-replay/v003.json.
import fs from "node:fs";

const DIR = "shots/ses-03-live-or-replay";
const scene = JSON.parse(fs.readFileSync(`${DIR}/v002.json`, "utf8"));
const de = JSON.parse(fs.readFileSync("shots/trademania-v3-thinking-de/v001.json", "utf8"));
const FPS = scene.fps; // 30
const byId = (s, id) => s.layers.find((l) => l.id === id);
const WHIP = [0.75, 0.15, 0.2, 1]; // camera whip measured from the pixel-transition reference

// ---- timing ----
const T = {
  shoot: [5.2333, 6.1], // heads race right (after the card has expanded)
  twist: [5.9, 6.9],
  merge: [7.3, 8.1],
  ring: [8.0, 8.7],
  orb: 8.675, // DE t=0 here …
  deCut: 11 / 24, // … and the last frame is DE's frame 11 (0.458s)
};
const END = Math.round((T.orb + T.deCut) * FPS) / FPS;
scene.duration = Math.round((END + 1 / FPS) * 1e4) / 1e4;

// ---- cursor: arcs (x/y on different eases), soft entrance, springy clicks, motion blur ----
const hand = byId(scene, "hand");
hand.props.motionBlur = 0.6;
hand.keyframes = {
  x: [
    { t: 0, v: 1568, ease: [0.45, 0, 0.2, 1] },
    { t: 0.9, v: 1308, ease: "sineInOut" },
    { t: 3.0667, v: 1278, ease: [0.4, 0, 0.2, 1] },
    { t: 3.9333, v: 764.17, ease: "sineInOut" },
    { t: 4.4333, v: 761, ease: [0.45, 0, 0.75, 0.6] },
    { t: 6.0333, v: 1130 },
  ],
  y: [
    { t: 0, v: 898, ease: [0.3, 0.15, 0.25, 1] },
    { t: 0.9, v: 568, ease: "sineInOut" },
    { t: 3.0667, v: 586, ease: [0.6, 0, 0.3, 1] },
    { t: 3.9333, v: 937.37, ease: "sineInOut" },
    { t: 4.4333, v: 940, ease: [0.45, 0, 0.75, 0.6] },
    { t: 6.0333, v: 1190 },
  ],
  rotation: [
    { t: 0, v: 14, ease: [0.3, 0, 0.2, 1] },
    { t: 1, v: 0 },
    { t: 3.0667, v: 0, ease: "sineInOut" },
    { t: 3.4667, v: -7, ease: "sineInOut" },
    { t: 4, v: 0, ease: "sineInOut" },
    { t: 5.2, v: 0, ease: "sineInOut" },
    { t: 6.0333, v: 10 },
  ],
  opacity: [
    { t: 0, v: 0, ease: "easeOut" },
    { t: 0.2, v: 1 },
    { t: 5.4667, v: 1, ease: "easeIn" },
    { t: 6.0333, v: 0 },
  ],
  scale: [
    { t: 0.9667, v: 1, ease: "quadIn" },
    { t: 1.0333, v: 0.92, ease: "figmaBouncy" },
    { t: 1.4333, v: 1 },
    { t: 3.0667, v: 1, ease: "figmaSlow" },
    { t: 3.9333, v: 0.74 },
    { t: 4.1333, v: 0.74, ease: "quadIn" },
    { t: 4.2, v: 0.68, ease: "figmaBouncy" },
    { t: 4.6, v: 0.74 },
  ],
  shadowY: [
    { t: 0.9667, v: 14, ease: "quadIn" },
    { t: 1.0333, v: 6, ease: "figmaBouncy" },
    { t: 1.4333, v: 14 },
    { t: 4.1333, v: 14, ease: "quadIn" },
    { t: 4.2, v: 6, ease: "figmaBouncy" },
    { t: 4.6, v: 14 },
  ],
};
hand.end = Math.round(6.0667 * 1e4) / 1e4;

// ---- Live card UI fades as the lines shoot; card bg settles to the DE base ----
const fadeOut = (id, t0, blur = 0) => {
  const l = byId(scene, id);
  l.keyframes ??= {};
  l.keyframes.opacity = [...(l.keyframes.opacity ?? []), { t: t0, v: 1, ease: "figmaSlow" }, { t: t0 + 0.4, v: 0 }];
  if (blur) l.keyframes.blur = [{ t: t0, v: 0, ease: "figmaSlow" }, { t: t0 + 0.4, v: blur }];
  if (l.type !== "null") l.end = Math.round((t0 + 0.4333) * 1e4) / 1e4;
};
fadeOut("live-chip", 5.2333);
fadeOut("live-title", 5.2667, 10);
fadeOut("live-desc", 5.3, 10);
byId(scene, "live-card").keyframes.fill = [
  { t: T.shoot[0], v: "#020203", ease: "figmaSlow" },
  { t: T.shoot[1], v: "#0F0F12" },
];

// ---- the lines ----
const lines = byId(scene, "live-lines");
// Box top-left on screen at full size: live group (960, 540.5) + (-870.75, -460.25).
const BOX = { x: 89.25, y: 80.25 };
const ORB = { x: 960, y: 464 }; // DE orb centre at t=0 (push + layout + orb-move)
const CELL = 45.7; // a quarter of the reference cell (183px), on a screen-anchored grid
Object.assign(lines.props, {
  axisY: ORB.y - BOX.y, ringX: ORB.x - BOX.x, ringY: ORB.y - BOX.y, ringR: 161, ringWidth: 10,
  mergeColor: "#D9F9B9", headDots: 0.1, dotPitch: 9, trailLen: 0.45, cell: CELL,
  cellOX: Math.round((CELL * 2 - BOX.x) * 100) / 100, cellOY: Math.round((CELL * 2 - BOX.y) * 100) / 100,
});
Object.assign(lines.keyframes, {
  phase: [{ t: 2.1333, v: 0, ease: "linear" }, { t: END, v: Math.round(((END - 2.1333) * 1.48) / 5.3 * 1000) / 1000 }],
  fade: [{ t: T.shoot[0], v: "#020203", ease: "figmaSlow" }, { t: T.shoot[1], v: "#0F0F12" }],
  shoot: [{ t: T.shoot[0], v: 0, ease: WHIP }, { t: T.shoot[1], v: 1.15 }],
  radius: [{ t: T.twist[0], v: 90, ease: "figmaSlow" }, { t: T.twist[1], v: 150 }],
  turns: [{ t: T.twist[0], v: 0, ease: "figmaSlow" }, { t: T.twist[1], v: 2.2 }],
  spin: [{ t: T.twist[0], v: 0, ease: "linear" }, { t: END, v: 2.6 }],
  merge: [{ t: T.merge[0], v: 0, ease: "figmaSlow" }, { t: T.merge[1], v: 1 }],
  ring: [{ t: T.ring[0], v: 0, ease: "figmaSlow" }, { t: T.ring[1], v: 1 }],
  opacity: [{ t: T.ring[1], v: 1, ease: "figmaSlow" }, { t: T.orb + 0.34, v: 0 }],
});

// ---- the DE shot's opening, shifted to T.orb ----
const COPY = ["push", "layout", "orb-move", "orb-breath", "logo", "orb", "halo", "glow1", "title", "timer", "dither"];
const copies = Object.fromEntries(
  COPY.map((id) => {
    const l = structuredClone(byId(de, id));
    l.id = `de-${id}`;
    l.name = `DE · ${l.name}`;
    if (l.parent) l.parent = `de-${l.parent}`;
    l.start = Math.round(T.orb * 1e4) / 1e4;
    // Keep keys up to the cut (+ the first one after, for the interpolation), shifted.
    for (const [k, keys] of Object.entries(l.keyframes ?? {})) {
      const after = keys.findIndex((x) => x.t > T.deCut);
      const kept = after < 0 ? keys : keys.slice(0, after + 1);
      l.keyframes[k] = kept.map((x) => ({ ...x, t: Math.round((x.t + T.orb) * 1e4) / 1e4 }));
    }
    return [id, l];
  }),
);
const L = scene.layers;
const at = (id) => L.findIndex((l) => l.id === id);
// Orb + text above everything but the cursor; DE background glow/dither just above the card.
L.splice(at("hand") + 1, 0, copies.logo, copies.orb, copies.halo, copies.timer, copies.title);
L.splice(at("live-card"), 0, copies.dither, copies.glow1);
L.push(copies.push, copies.layout, copies["orb-move"], copies["orb-breath"]);

scene.note =
  "Smoother cursor (arcs, soft entrance, springy clicks, motion blur). Live ending: lines shoot right with the pixel-transition whip — pixel trail + halftone heads — twist into a rotating helix, merge into one lime line that curls into the thinking orb (ends on DE t=0.46s).";
const round = (k, v) => (k === "t" && typeof v === "number" ? Math.round(v * 1e4) / 1e4 : v);
fs.writeFileSync(`${DIR}/v003.json`, JSON.stringify(scene, round, 2) + "\n");
console.log(`wrote ${DIR}/v003.json · ${scene.duration}s · ${L.length} layers`);
