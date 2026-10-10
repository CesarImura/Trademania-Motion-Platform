// SES-02→04 v004: faster shoot and spin; the strands keep their red/green while they
// spin and merge, and only turn lime as the line curls into the orb's ring.
// Built on v003 (latest). Writes shots/ses-03-live-or-replay/v004.json.
import fs from "node:fs";

const DIR = "shots/ses-03-live-or-replay";
const scene = JSON.parse(fs.readFileSync(`${DIR}/v003.json`, "utf8"));
const lines = scene.layers.find((l) => l.id === "live-lines");
const END = scene.duration - 1 / scene.fps;

Object.assign(lines.keyframes, {
  // Shoot in ~0.45s (was 0.87s), quicker off the mark than the reference whip.
  shoot: [{ t: 5.2333, v: 0, ease: [0.55, 0.05, 0.2, 1] }, { t: 5.7, v: 1.15 }],
  // Twist forms right behind the heads.
  radius: [{ t: 5.5333, v: 90, ease: "figmaSlow" }, { t: 6.1333, v: 150 }],
  turns: [{ t: 5.5333, v: 0, ease: "figmaSlow" }, { t: 6.1333, v: 2.4 }],
  // ~2.5 turns/s (was ~0.8).
  spin: [{ t: 5.5333, v: 0, ease: "linear" }, { t: END, v: 9 }],
  // Red/green hold through the spin and merge; lime only for the ring.
  recolor: [{ t: 8.0, v: 0, ease: "figmaSlow" }, { t: 8.6, v: 1 }],
});

scene.note = "Faster shoot (0.45s) and spin (~2.5 turns/s); strands keep red/green while spinning and merging, turning lime only as they curl into the orb ring.";
const round = (k, v) => (k === "t" && typeof v === "number" ? Math.round(v * 1e4) / 1e4 : v);
fs.writeFileSync(`${DIR}/v004.json`, JSON.stringify(scene, round, 2) + "\n");
console.log(`wrote ${DIR}/v004.json`);
