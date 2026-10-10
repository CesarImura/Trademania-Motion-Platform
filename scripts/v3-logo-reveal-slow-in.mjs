// v3-logo-reveal v009 → v010: every shot becomes one accelerating move into its cut.
// Per shot window, each track keeps only its first and last key (inner "snap then
// settle" keys dropped) and the first key gets figmaSlowIn (gentle start, fastest
// at the cut). Tracks that settled early in a window are stretched to the cut.
import fs from "node:fs";

const dir = "shots/v3-logo-reveal";
const scene = JSON.parse(fs.readFileSync(`${dir}/v009.json`, "utf8"));
const EASE = "figmaSlowIn";
const shots = [
  [0, 0.95],
  [0.9667, 1.95],
  [1.9667, 2.85],
  [2.8667, 3.6167],
];
const eps = 1e-3;

for (const layer of scene.layers) {
  // The V-reveal haze wipe builds instead of decelerating (same timing).
  if (layer.id === "haze") layer.keyframes.y[0].ease = EASE;
  for (const [prop, keys] of Object.entries(layer.keyframes ?? {})) {
    // Fades keep their timing; only moves (and the drift texture's crossfade) retime.
    if (layer.id === "haze" || (prop === "opacity" && !layer.id.startsWith("texb-"))) continue;
    let out = keys.slice();
    for (const [a, b] of shots) {
      const inWin = out.filter((k) => k.t >= a - eps && k.t <= b + eps);
      if (inWin.length < 2) continue;
      const first = inWin[0], last = { ...inWin[inWin.length - 1] };
      if (first.v === last.v && inWin.every((k) => k.v === first.v)) continue; // static
      if (last.t < b - eps) last.t = b; // settled early → keep moving to the cut
      const lastEase = inWin[inWin.length - 1].ease;
      if (lastEase !== undefined) last.ease = lastEase;
      out = [...out.filter((k) => !inWin.includes(k)), { ...first, ease: EASE }, last].sort((x, y) => x.t - y.t);
    }
    layer.keyframes[prop] = out;
  }
}

scene.note =
  "Slow → fast: each shot is now one move that starts gentle and accelerates into its cut (figmaSlowIn), instead of snapping in and settling. The haze wipe builds the same way.";
fs.writeFileSync(`${dir}/v010.json`, JSON.stringify(scene, null, 2) + "\n");
console.log("wrote v010.json");
