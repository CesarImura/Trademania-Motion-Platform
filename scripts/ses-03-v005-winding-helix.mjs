// SES-02→04 v005: the helix winds tighter toward the right — loose and wide on the
// left, a tight, narrow coil on the right — and its crests travel rightward into the
// coil, so it reads as accelerating and intertwining at once. The merge starts at the
// tight right end and runs left. Built on v004 (latest). Writes v005.json.
import fs from "node:fs";

const DIR = "shots/ses-03-live-or-replay";
const scene = JSON.parse(fs.readFileSync(`${DIR}/v004.json`, "utf8"));
const lines = scene.layers.find((l) => l.id === "live-lines");
const END = scene.duration - 1 / scene.fps;
const TW = [5.5333, 6.1333]; // twist forms right behind the shooting heads

Object.assign(lines.props, { mergeSweep: 0.6 });
Object.assign(lines.keyframes, {
  radius: [{ t: TW[0], v: 90, ease: "figmaSlow" }, { t: TW[1], v: 170 }],
  turns: [{ t: TW[0], v: 0, ease: "figmaSlow" }, { t: TW[1], v: 4.2 }],
  // Turns bunch up toward the right edge (local twist ~5× denser there than mid-screen).
  chirp: [{ t: TW[0], v: 1, ease: "figmaSlow" }, { t: TW[1], v: 2.4 }],
  // Right end narrows to ~20% of the left's radius.
  squeeze: [{ t: TW[0], v: 0, ease: "figmaSlow" }, { t: TW[1], v: 0.8 }],
  // Negative spin = crests flow rightward into the coil; it keeps speeding up.
  spin: [{ t: TW[0], v: 0, ease: "quadIn" }, { t: END, v: -11 }],
});

scene.note = "Helix winds tighter toward the right (denser twist, narrowing radius) with crests flowing right and speeding up; merge starts at the tight end and runs left.";
const round = (k, v) => (k === "t" && typeof v === "number" ? Math.round(v * 1e4) / 1e4 : v);
fs.writeFileSync(`${DIR}/v005.json`, JSON.stringify(scene, round, 2) + "\n");
console.log(`wrote ${DIR}/v005.json`);
