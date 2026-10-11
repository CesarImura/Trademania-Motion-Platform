// "Light -> Dark v2" · the TRD-03 light → dark pixel transition with a NEW cell pattern,
// so repeated uses in the edit don't look duplicated. Same grid, camera whip, paper +
// dots, faint grid and chroma-blue key as "Light -> Dark v1" (trd-03-light-to-dark) —
// only which cell does what changes. The pattern is resampled from the measured
// reference (scripts/lib/cell-variant.mjs), so the feel is identical.
// Here a cell's "open" time is when it gets the halftone dots and its "full color" time
// is when it pops off to blue; cells that never open stay paper and slide out with the whip.
//
//   node --no-warnings scripts/trd-03b-light-to-dark-v2.mjs [seed]  →  shots/trd-03b-light-to-dark-v2/v001.json
import fs from "node:fs";
import { FPS, snap, cellLayer, grid } from "./lib/reference-transition.mjs";
import { resampleCells } from "./lib/cell-variant.mjs";

const ID = "trd-03b-light-to-dark-v2";
const SEED = Number(process.argv[2] ?? 23); // a different seed from Light -> Green -> Light v2 (11)
const { open, color, matchPct } = resampleCells(SEED);
const lastOff = Math.max(...color.flat().filter((v) => v != null));

const page = cellLayer("page", "Light page · cells (paper + dots)", "paper", {
  clear: "", paper: "#F4F9EE", dotColor: "rgba(10,26,29,0.42)", dotPitch: 18.27, dotSize: 4.8,
  gridColor: "rgba(10,26,29,0.08)", gridEvery: 2, gridPhase: 1,
});
page.props.open = grid(open);
page.props.color = grid(color);

const scene = {
  name: "Light -> Dark v2",
  note: `Same as Light -> Dark v1 (camera whip, paper + dots, faint grid, chroma blue #0047BB) with a new cell pattern resampled from the reference (seed ${SEED}): new blocks, front and lingering-dot cells — ${matchPct}% of cells match v1.`,
  width: 1920, height: 1080, fps: FPS, duration: snap(lastOff + 6 / FPS), background: "#0047BB",
  layers: [page],
};
fs.mkdirSync(`shots/${ID}`, { recursive: true });
fs.writeFileSync(`shots/${ID}/v001.json`, JSON.stringify(scene, (k, v) => (k === "t" || k === "duration" ? Math.round(v * 1e4) / 1e4 : v), 2) + "\n");
console.log(`wrote shots/${ID}/v001.json · ${scene.duration}s · seed ${SEED} · ${matchPct}% cells match v1`);
