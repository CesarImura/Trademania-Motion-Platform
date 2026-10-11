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
//   node --no-warnings scripts/trd-04-light-blue-light.mjs [seed]  →  shots/trd-04-light-blue-light/v001.json
import fs from "node:fs";
import { FPS, K, HP, X0, Y0, P, cellW, cellH, comp, snap, IN, OUT, cam0, inRest } from "./lib/reference-transition.mjs";

const ID = "trd-04-light-blue-light";
const SEED = Number(process.argv[2] ?? 5);
const COLS = 60, ROWS = 7; // wide enough that the page still covers the frame after the outgoing move
const HOLD_EXTRA = 0.6; // reference hold ≈ 0.62s → ≈ 1.22s
const IN_END = comp(IN.t1), OUT0 = comp(OUT.t0) + HOLD_EXTRA, OUT1 = comp(OUT.t1) + HOLD_EXTRA;

// ---- noise ----
let s = SEED * 9301 + 49297;
const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
function valueNoise(scaleX, scaleY) { // smooth 2D value noise in [-1, 1]
  const gw = Math.ceil(COLS / scaleX) + 2, gh = Math.ceil(ROWS / scaleY) + 2;
  const g = [...Array(gh)].map(() => [...Array(gw)].map(() => rnd() * 2 - 1));
  const sm = (u) => u * u * (3 - 2 * u);
  return (c, r) => {
    const x = c / scaleX, y = r / scaleY, i = Math.floor(x), j = Math.floor(y), u = sm(x - i), v = sm(y - j);
    const a = g[j][i] + (g[j][i + 1] - g[j][i]) * u, b = g[j + 1][i] + (g[j + 1][i + 1] - g[j + 1][i]) * u;
    return a + (b - a) * v;
  };
}
const nOpen = valueNoise(3.2, 2.2), nTrail = valueNoise(2.5, 2), nClear = valueNoise(3, 2.4), nTrail2 = valueNoise(2.5, 2);
const q = (t) => Math.round(t * FPS) / FPS;

// ---- schedule (comp seconds) ----
const blank = () => [...Array(ROWS)].map(() => Array(COLS).fill(null));
const open = blank(), color = blank(), clear = blank(), settle = blank();
const done = [...Array(ROWS)].map(() => Array(COLS).fill(false));
for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
  if (done[r][c]) continue;
  // Blocks like the reference: mostly 2 half-cells wide, sometimes 2 rows tall.
  const w = c + 1 < COLS && rnd() < 0.75 ? 2 : 1, h = r + 1 < ROWS && rnd() < 0.3 ? 2 : 1;
  const cx = c + (w - 1) / 2, cy = r + (h - 1) / 2, jit = (rnd() - 0.5) * 0.06;
  // In: the whip's column order, broken up by clusters (±0.22s) so the front is organic.
  let o = 0.06 + ((cx - 12) / 42) * 0.7 + 0.22 * nOpen(cx, cy) + jit;
  const trail = 0.12 + 0.16 * (0.5 + 0.5 * nTrail(cx, cy));
  let col = o + trail;
  if (cx >= 30) { col = Math.min(col, IN_END - 0.04); o = Math.min(o, col - 0.1); } // on screen in the hold: blue by then
  const never = o < 0.03; // far left, ahead of the whip: stays paper and slides away
  // Out: right to left behind the outgoing move, also clustered; dots linger, then paper.
  const cl = OUT0 - 0.05 + ((COLS - cx) / 26) * 0.3 + 0.12 * nClear(cx, cy) + jit;
  const st = cl + 0.12 + 0.16 * (0.5 + 0.5 * nTrail2(cx, cy));
  for (let dr = 0; dr < h; dr++) for (let dc = 0; dc < w; dc++) {
    const rr = r + dr, cc = c + dc;
    if (done[rr][cc]) continue;
    done[rr][cc] = true;
    if (never) continue;
    open[rr][cc] = q(Math.max(0.03, o));
    color[rr][cc] = q(Math.max(open[rr][cc] + 2 / FPS, col));
    clear[rr][cc] = q(Math.max(color[rr][cc] + 0.2, cl));
    settle[rr][cc] = q(Math.max(clear[rr][cc] + 2 / FPS, st));
  }
}

// ---- camera (cells ride it), hold stretched ----
const fieldX = (cam) => Math.round(K * (X0 - HP + cam) * 100) / 100; // layer x=0 = left edge of half-column −1
const xKeys = [
  { t: 0, v: fieldX(cam0), ease: inRest },
  { t: IN_END, v: fieldX(IN.to), ease: "hold" },
  { t: snap(OUT0), v: fieldX(OUT.from), ease: OUT.bez },
  { t: snap(OUT1), v: fieldX(OUT.to) },
];

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
  name: "Light -> Blue -> Light v1",
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
