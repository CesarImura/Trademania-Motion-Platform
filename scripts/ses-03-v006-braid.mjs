// SES-02→04 v006: Gemini-print braid. On the Live click the red and green lines each
// split into 3 fine strands that fan out flat at both edges and weave into a tight,
// spinning cable through the middle (a symmetric funnel), growing with the card. No
// separate shoot beat. Later: strands collapse into one line → lime → ring → orb (as v005).
// Built on v005 (latest). Writes shots/ses-03-live-or-replay/v006.json.
import fs from "node:fs";

const DIR = "shots/ses-03-live-or-replay";
const scene = JSON.parse(fs.readFileSync(`${DIR}/v005.json`, "utf8"));
const lines = scene.layers.find((l) => l.id === "live-lines");
const END = scene.duration - 1 / scene.fps;
const CLICK = 4.2; // hand press on Live
const EXPAND = [4.3333, 5.2333]; // card grows to full frame (same ease as the box)

// Drop the v003–v005 shoot/helix beat.
for (const k of ["shoot", "radius", "turns", "chirp", "squeeze"]) delete lines.keyframes[k];
delete lines.props.mergeSweep;
lines.props.trail = 0;
lines.props.headDots = 0;

Object.assign(lines.props, { strands: 3, braidWidth: 0.14, braidRamp: 0.24 });
Object.assign(lines.keyframes, {
  braid: [{ t: CLICK, v: 0, ease: "figmaSlow" }, { t: 5.0, v: 1 }],
  braidTurns: [{ t: CLICK, v: 4, ease: "figmaSlow" }, { t: 5.2333, v: 9 }],
  // Thin, fine strands like the print (the ring step still ends at 10px).
  lineWidth: [{ t: CLICK, v: 22, ease: "figmaSlow" }, { t: 5.0, v: 9 }],
  // Geometry is in the line box's pixels, which grow with the card → track the expand.
  axisY: [{ t: EXPAND[0], v: 176, ease: "figmaSlow" }, { t: EXPAND[1], v: 383.75 }],
  spread: [{ t: EXPAND[0], v: 120, ease: "figmaSlow" }, { t: EXPAND[1], v: 260 }],
  braidRadius: [{ t: EXPAND[0], v: 9, ease: "figmaSlow" }, { t: EXPAND[1], v: 20 }],
  // Spins up from the click and keeps accelerating; crests flow left → right.
  spin: [{ t: CLICK, v: 0, ease: "quadIn" }, { t: END, v: -14 }],
});

scene.note = "Gemini-style braid from the Live click: each color splits into 3 fine strands, fanned flat at the edges and woven into a tight spinning cable in the middle; then one line → lime ring → orb.";
const round = (k, v) => (k === "t" && typeof v === "number" ? Math.round(v * 1e4) / 1e4 : v);
fs.writeFileSync(`${DIR}/v006.json`, JSON.stringify(scene, round, 2) + "\n");
console.log(`wrote ${DIR}/v006.json`);
