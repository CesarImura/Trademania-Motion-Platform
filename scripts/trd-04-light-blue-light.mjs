// "Light -> Blue -> Light v1" · like Light -> Green -> Light (TRD-02), but the middle is
// chroma-key blue (#0047BB, keyed in the edit) and the ends are the light page (paper
// #F4F9EE + faint grid, like Light -> Dark).
//  - Same grid and camera as the reference rig (scripts/lib/reference-transition.mjs):
//    whip-in, hold (stretched to ~1.2s), outgoing move.
//  - In: cells get halftone dots, then pop to blue. Out: cells come back as paper + dots,
//    then settle to plain paper.
//  - "Less in a line": open / clear times follow a smooth noise field (clusters and
//    islands ahead of and behind the front) instead of the reference's column order.
//  - "Longer trail": each cell's dotted phase is ~2× the reference's (0.12–0.28s), in and out.
//
//   node --no-warnings scripts/trd-04-light-blue-light.mjs [seed] [id] [name]  →  shots/<id>/v001.json
//   v1: seed 5  → trd-04-light-blue-light    "Light -> Blue -> Light v1"
//   v2: seed 17 → trd-04b-light-blue-light-v2 "Light -> Blue -> Light v2"  (same, new organic pattern)
import fs from "node:fs";
import { FPS, K, Y0, P, cellW, cellH, snap, IN, OUT } from "./lib/reference-transition.mjs";
import { organicSchedule } from "./lib/organic-cells.mjs";

const SEED = Number(process.argv[2] ?? 5);
const ID = process.argv[3] ?? "trd-04-light-blue-light";
const NAME = process.argv[4] ?? "Light -> Blue -> Light v1";
const COLS = 60, ROWS = 7; // wide enough that the page still covers the frame after the outgoing move
const HOLD_EXTRA = 0.6; // reference hold ≈ 0.62s → ≈ 1.22s

const { open, color, clear, settle, IN_END, OUT0, fieldX, xKeys } = organicSchedule({ seed: SEED, cols: COLS, rows: ROWS, holdExtra: HOLD_EXTRA });

// ---- checks: hold fully blue, end fully paper ----
const visibleCols = (x) => [...Array(COLS).keys()].filter((c) => x + (c + 1) * cellW > 0 && x + c * cellW < 1920);
for (const c of visibleCols(fieldX(IN.to))) for (let r = 0; r < ROWS; r++)
  if (color[r][c] == null || color[r][c] > IN_END + 1e-6 || clear[r][c] < snap(OUT0) - 0.06) throw new Error(`hold cell ${r},${c} not blue for the hold`);
const endX = fieldX(OUT.to);
if (endX > 0 || endX + COLS * cellW < 1920) throw new Error("page doesn't cover the frame at the end");
const flat = (g) => g.flat().filter((v) => v != null);
const end = snap(Math.max(...flat(settle)) + 6 / FPS);

const grid = (g) => g.map((row) => row.map((v) => (v == null ? "-" : String(+v.toFixed(4)))).join(" ")).join("\n");
const scene = {
  name: NAME,
  note: `Light page → chroma blue (#0047BB, key) → light page. Reference grid + camera whip (hold ~1.2s); organic clustered front instead of a line, ~2× longer dotted trail in and out (seed ${SEED}).`,
  width: 1920, height: 1080, fps: FPS, duration: end, background: "#0047BB",
  layers: [{
    id: "page", name: "Light page · cells (paper + dots ↔ blue)", type: "generator",
    props: {
      generator: "pixelSchedule", output: "paper", anchorX: 0, anchorY: 0,
      y: Math.round((Y0 - P) * K * 100) / 100, width: Math.round(COLS * cellW * 100) / 100, height: Math.round(ROWS * cellH * 100) / 100,
      cellW, cellH, open: grid(open), color: grid(color), clear: grid(clear), settle: grid(settle),
      paper: "#F4F9EE", dotColor: "rgba(10,26,29,0.42)", dotPitch: 18.27, dotSize: 4.8,
      gridColor: "rgba(10,26,29,0.08)", gridEvery: 2, gridPhase: 1,
    },
    keyframes: { x: xKeys },
  }],
};
fs.mkdirSync(`shots/${ID}`, { recursive: true });
fs.writeFileSync(`shots/${ID}/v001.json`, JSON.stringify(scene, (k, v) => (k === "t" || k === "duration" ? Math.round(v * 1e4) / 1e4 : v), 2) + "\n");
console.log(`wrote shots/${ID}/v001.json · ${end}s · hold ${IN_END.toFixed(2)}–${OUT0.toFixed(2)}s · seed ${SEED}`);
