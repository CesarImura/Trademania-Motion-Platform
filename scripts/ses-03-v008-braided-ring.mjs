// SES-02→04 v008: no flattening — the braid spins about twice as fast and curls into the
// orb's ring still braided (the cable's centre line bends onto the circle, strands keep
// twisting around it), then fades as the orb fills. Built on v007 (latest).
import fs from "node:fs";

const DIR = "shots/ses-03-live-or-replay";
const scene = JSON.parse(fs.readFileSync(`${DIR}/v007.json`, "utf8"));
const braid = scene.layers.find((l) => l.id === "braid");
const END = scene.duration - 1 / scene.fps;
const r4 = (v) => Math.round(v * 1e4) / 1e4;
const CLICK = 4.2, CURL = [7.6, 8.4];

delete braid.keyframes.merge;
delete braid.keyframes.recolor;
Object.assign(braid.props, { ringKeep: 1, ringWidth: 3.2 });
Object.assign(braid.keyframes, {
  // ~1.6 turns/s (was 0.75).
  spin: [{ t: CLICK, v: 0, ease: "linear" }, { t: END, v: r4((END - CLICK) * 1.6) }],
  // As it curls, the edge fans pull into the cable so the whole line is braided on the ring.
  core: [{ t: CURL[0], v: 0.17, ease: "figmaSlow" }, { t: CURL[1], v: 0.5 }],
  ramp: [{ t: CURL[0], v: 0.25, ease: "figmaSlow" }, { t: CURL[1], v: 0.03 }],
  radius: [
    { t: 4.3333, v: 16, ease: "figmaSlow" }, { t: 5.2333, v: 38 },
    { t: CURL[0], v: 38, ease: "figmaSlow" }, { t: CURL[1] + 0.2, v: 16 },
  ],
  ring: [{ t: 7.9, v: 0, ease: "figmaSlow" }, { t: 8.6, v: 1 }],
});

scene.note = "No flattening: the braid spins ~2× faster and curls into the orb ring still braided, then fades as the orb fills.";
fs.writeFileSync(`${DIR}/v008.json`, JSON.stringify(scene, (k, v) => (k === "t" && typeof v === "number" ? r4(v) : v), 2) + "\n");
console.log(`wrote ${DIR}/v008.json`);
