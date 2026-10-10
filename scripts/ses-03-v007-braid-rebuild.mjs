// SES-02→04 v007 — fresh rebuild of the Live ending on top of v002 (v003–v006 dropped).
// On the Live click the glowing chart lines hand over to `liveBraid`: each color splits
// into 2 crisp thin strands that fan out flat at both edges and twist into a real 3D cable
// through the middle (Gemini print), drawn back-to-front with over/under gaps. The cable
// turns steadily, then merges into one line that curls into the thinking orb's ring; the
// last frame is "Trademania V3 · Denkt nach → Bereit (DE)" at frame 11 (0.458s).
// Writes shots/ses-03-live-or-replay/v007.json.
import fs from "node:fs";

const DIR = "shots/ses-03-live-or-replay";
const scene = JSON.parse(fs.readFileSync(`${DIR}/v002.json`, "utf8"));
const de = JSON.parse(fs.readFileSync("shots/trademania-v3-thinking-de/v001.json", "utf8"));
const FPS = scene.fps;
const byId = (s, id) => s.layers.find((l) => l.id === id);
const r4 = (v) => Math.round(v * 1e4) / 1e4;

const T = {
  click: 4.2,
  expand: [4.3333, 5.2333], // card grows (v002)
  form: [4.25, 5.4], // chart lines → braid
  merge: [7.2, 8.0],
  ring: [7.9, 8.6],
  orb: 8.675, // DE t = 0
  deCut: 11 / 24,
};
const END = Math.round((T.orb + T.deCut) * FPS) / FPS;
scene.duration = r4(END + 1 / FPS);

// ---- old glowing chart lines hand over at the click ----
const old = byId(scene, "live-lines");
old.keyframes.opacity = [{ t: T.click, v: 1, ease: "figmaSlow" }, { t: T.click + 0.4, v: 0 }];
old.keyframes.phase = [{ t: 2.1333, v: 0, ease: "linear" }, { t: END, v: r4(((END - 2.1333) * 1.48) / 5.3) }];

// ---- the braid (same box as the chart lines, so it grows with the card) ----
const braid = {
  id: "braid", name: "Live lines · braid", type: "generator", parent: "live", matte: "live-clip",
  start: T.click,
  props: {
    generator: "liveBraid", anchorX: 0, anchorY: 0, strands: 2, turns: 3.2, core: 0.17, ramp: 0.25,
    wave: old.props.wave ?? 0.02, glow: 10, glowAlpha: 0.75, depthDim: 0.6, gap: 1.4, edgeFade: 0.08,
    ringX: 870.75, ringY: 383.75, ringR: 161, ringWidth: 10, mergeColor: "#D9F9B9",
  },
  keyframes: {
    x: old.keyframes.x, y: old.keyframes.y, width: old.keyframes.width, height: old.keyframes.height,
    morph: old.keyframes.morph, phase: old.keyframes.phase,
    opacity: [
      { t: T.click, v: 0, ease: "figmaSlow" }, { t: T.click + 0.35, v: 1 },
      { t: T.ring[1], v: 1, ease: "figmaSlow" }, { t: T.orb + 0.34, v: 0 },
    ],
    form: [{ t: T.form[0], v: 0, ease: "figmaSlow" }, { t: T.form[1], v: 1 }],
    // Geometry in box px, tracking the card's growth (box h 352.83 → 711.7).
    axisY: [{ t: T.expand[0], v: 176.4, ease: "figmaSlow" }, { t: T.expand[1], v: 383.75 }],
    spread: [{ t: T.expand[0], v: 42, ease: "figmaSlow" }, { t: T.expand[1], v: 100 }],
    radius: [{ t: T.expand[0], v: 16, ease: "figmaSlow" }, { t: T.expand[1], v: 38 }],
    lineWidth: [{ t: T.expand[0], v: 2.6, ease: "figmaSlow" }, { t: T.expand[1], v: 4.5 }],
    // Steady turn (~0.75 rev/s) — no acceleration games.
    spin: [{ t: T.click, v: 0, ease: "linear" }, { t: END, v: r4((END - T.click) * 0.75) }],
    bg: [{ t: 5.2333, v: "#020203", ease: "figmaSlow" }, { t: 6.1, v: "#0F0F12" }],
    merge: [{ t: T.merge[0], v: 0, ease: "figmaSlow" }, { t: T.merge[1], v: 1 }],
    recolor: [{ t: T.ring[0], v: 0, ease: "figmaSlow" }, { t: T.ring[0] + 0.6, v: 1 }],
    ring: [{ t: T.ring[0], v: 0, ease: "figmaSlow" }, { t: T.ring[1], v: 1 }],
  },
};
scene.layers.splice(scene.layers.indexOf(old), 0, braid);

// ---- card UI fades once the card is full frame; card bg settles to the DE base ----
const fadeOut = (id, t0, blur = 0) => {
  const l = byId(scene, id);
  l.keyframes ??= {};
  l.keyframes.opacity = [...(l.keyframes.opacity ?? []), { t: t0, v: 1, ease: "figmaSlow" }, { t: t0 + 0.4, v: 0 }];
  if (blur) l.keyframes.blur = [{ t: t0, v: 0, ease: "figmaSlow" }, { t: t0 + 0.4, v: blur }];
};
fadeOut("live-chip", 5.2333);
fadeOut("live-title", 5.2667, 10);
fadeOut("live-desc", 5.3, 10);
byId(scene, "live-card").keyframes.fill = [{ t: 5.2333, v: "#020203", ease: "figmaSlow" }, { t: 6.1, v: "#0F0F12" }];

// ---- cursor (v002 path) just leaves before the orb ----
const hand = byId(scene, "hand");
hand.keyframes.opacity = [...hand.keyframes.opacity, { t: 5.4, v: 1, ease: "easeIn" }, { t: 5.9, v: 0 }];

// ---- the DE shot's opening, shifted to T.orb ----
const COPY = ["push", "layout", "orb-move", "orb-breath", "logo", "orb", "halo", "glow1", "title", "timer", "dither"];
const copies = Object.fromEntries(
  COPY.map((id) => {
    const l = structuredClone(byId(de, id));
    l.id = `de-${id}`;
    l.name = `DE · ${l.name}`;
    if (l.parent) l.parent = `de-${l.parent}`;
    l.start = r4(T.orb);
    for (const [k, keys] of Object.entries(l.keyframes ?? {})) {
      const after = keys.findIndex((x) => x.t > T.deCut);
      l.keyframes[k] = (after < 0 ? keys : keys.slice(0, after + 1)).map((x) => ({ ...x, t: r4(x.t + T.orb) }));
    }
    return [id, l];
  }),
);
const L = scene.layers, at = (id) => L.findIndex((l) => l.id === id);
L.splice(at("hand") + 1, 0, copies.logo, copies.orb, copies.halo, copies.timer, copies.title);
L.splice(at("live-card"), 0, copies.dither, copies.glow1);
L.push(copies.push, copies.layout, copies["orb-move"], copies["orb-breath"]);

scene.note = "Rebuilt from v002: on the Live click the lines split into crisp thin strands that fan at the edges and twist into a 3D cable (over/under gaps, depth dimming) like the Gemini print, turning steadily; then merge → lime ring → thinking orb (ends on DE frame 11).";
fs.writeFileSync(`${DIR}/v007.json`, JSON.stringify(scene, (k, v) => (k === "t" && typeof v === "number" ? r4(v) : v), 2) + "\n");
console.log(`wrote ${DIR}/v007.json · ${scene.duration}s`);
