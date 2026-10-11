// TRD-02b · the TRD-02 pixel transition with a NEW cell pattern, so repeated uses in the
// edit don't look duplicated. Same grid, camera whip + hold, backdrop, colors, chroma key
// and wipe-out as TRD-02 v003 — only which cell does what changes.
//
// The pattern is resampled from the measured reference itself, so the feel is identical:
// cells are grouped into blocks (mostly 2 half-cells wide, sometimes 2 rows tall, paired
// on a different phase than the reference), and each block copies the behaviour of a
// random "donor" cell from the same or a neighbouring column of the reference — its open
// time, whether it stays light (dots, never colors) or never opens (a hole), its open →
// color delay, and (from a donor in the same row band) its clear time. Columns that sit
// on screen during the hold always open and color, like the reference.
//
//   node --no-warnings scripts/trd-02b-pixel-variant.mjs [seed]  →  shots/trd-02b-pixel-transition/v001.json
import fs from "node:fs";
import { FPS, K, comp, snap, cells, camKeys, cellLayer, grid, IN, OUT } from "./lib/reference-transition.mjs";

const ID = "trd-02b-pixel-transition";
const SEED = Number(process.argv[2] ?? 11);
let s = SEED * 9301 + 49297;
const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];

const R = cells.rows, Cn = cells.open[0].length;
const at = (g, r, c) => g[r]?.[c] ?? null;
// Columns on screen while the camera holds (all open + color in the reference).
const HOLD_FROM = 31;
const band = (r) => (r <= 2 ? 0 : 1); // the reference clears in two row bands on the left

function donor(r, c, { solid }) {
  const pool = [];
  for (let dc = -1; dc <= 1; dc++) for (let rr = 0; rr < R; rr++) {
    const cc = c + dc;
    if (cc < 0 || cc >= Cn) continue;
    const o = at(cells.open, rr, cc), col = at(cells.color, rr, cc);
    if (solid && (o == null || col == null)) continue;
    pool.push({ o, col, r: rr, c: cc });
  }
  return pick(pool);
}
function clearDonor(r, c) {
  const pool = [];
  for (let dc = -1; dc <= 1; dc++) for (let rr = 0; rr < R; rr++) {
    const cc = c + dc, cl = at(cells.clear, rr, cc);
    if (cc >= 0 && cc < Cn && cl != null && band(rr) === band(r)) pool.push(cl);
  }
  return pool.length ? pick(pool) : null;
}

const open = [...Array(R)].map(() => Array(Cn).fill(null));
const color = [...Array(R)].map(() => Array(Cn).fill(null));
const clear = [...Array(R)].map(() => Array(Cn).fill(null));
const done = [...Array(R)].map(() => Array(Cn).fill(false));
for (let r = 0; r < R; r++) {
  // Pair half-cells on the opposite phase to the reference (odd starts), with some singles.
  for (let c = 0; c < Cn; c++) {
    if (done[r][c]) continue;
    const firstOpen = Math.min(...[...Array(R).keys()].map((rr) => at(cells.open, rr, c) ?? Infinity));
    if (firstOpen === Infinity && c < HOLD_FROM) { done[r][c] = true; continue; } // reference never opens this column
    const w = c % 2 === 1 && c + 1 < Cn && rnd() < 0.8 ? 2 : 1;
    const h = r + 1 < R && rnd() < 0.3 ? 2 : 1;
    const solid = c >= HOLD_FROM - 1;
    const d = donor(r, c, { solid });
    const cl = d.o == null ? null : clearDonor(r, c);
    for (let dr = 0; dr < h; dr++) for (let dc = 0; dc < w; dc++) {
      const rr = r + dr, cc = c + dc;
      if (rr >= R || cc >= Cn || done[rr][cc]) continue;
      done[rr][cc] = true;
      open[rr][cc] = d.o;
      color[rr][cc] = d.col;
      clear[rr][cc] = cl;
    }
  }
}

// Checks: on-screen hold columns fully open + color; how different from the reference.
let holes = 0, same = 0, total = 0;
for (let r = 0; r < R; r++) for (let c = 0; c < Cn; c++) {
  if (c >= HOLD_FROM && (open[r][c] == null || color[r][c] == null)) holes++;
  if (at(cells.open, r, c) != null || open[r][c] != null) {
    total++;
    if (at(cells.open, r, c) === open[r][c] && at(cells.color, r, c) === color[r][c]) same++;
  }
}
if (holes) throw new Error(`${holes} hold-area cells don't reach color`);

const BD_PAD = 800;
const withSchedule = (layer) => Object.assign(layer, { props: { ...layer.props, open: grid(open), color: grid(color), clear: grid(clear) } });
const layers = [
  withSchedule(cellLayer("light", "Cells · light end (paper + dots)", "overlay", {
    paper: "#F4F9EE", dotColor: "rgba(10,26,29,0.42)", dotPitch: 18.27, dotSize: 4.8, feather: 150,
  })),
  {
    id: "backdrop", name: "Backdrop (Trademania, 0.25× parallax)", type: "generator", matte: "cells",
    props: {
      generator: "tmBackdrop", anchorX: 0, y: 540, width: 3000, height: 1080,
      baseColor: "#d9f9b9", darkColor: "#0a1a1d", blobBlur: 280,
      b1x: 1028 + BD_PAD, b1y: -410, b1rx: 1711, b1ry: 852, b1a: 1,
      b2x: 980 + BD_PAD, b2y: 1707, b2rx: 1364, b2ry: 742, b2a: 1, b2Color: "#F5FFEB",
      noise: 0.15, ringX: 960 + BD_PAD, ringY: 540, tilt: 0.35,
    },
    keyframes: {
      x: camKeys((cam) => -BD_PAD + 0.25 * K * (cam - IN.to)),
      ringShift: [{ t: 0, v: -0.03, ease: "linear" }, { t: comp(OUT.t1), v: 0.06 }],
    },
  },
  withSchedule(cellLayer("cells", "Cells · mask (matte)", "mask")),
];

const lastClear = Math.max(...clear.flat().filter((v) => v != null), ...cells.clear.flat().filter((v) => v != null));
const scene = {
  name: "TRD-02b · Pixel transition B (key fill, blue)",
  note: `Same as TRD-02 v003 (grid, camera whip + hold, backdrop, chroma blue, wipe-out) with a new cell pattern resampled from the reference (seed ${SEED}): new blocks, front, light cells and clear order — ${Math.round((100 * same) / total)}% of cells match TRD-02.`,
  width: 1920, height: 1080, fps: FPS, duration: snap(lastClear + 5 / FPS), background: "#0047BB",
  layers,
};
fs.mkdirSync(`shots/${ID}`, { recursive: true });
fs.writeFileSync(`shots/${ID}/v001.json`, JSON.stringify(scene, (k, v) => (k === "t" ? Math.round(v * 1e4) / 1e4 : v), 2) + "\n");
console.log(`wrote shots/${ID}/v001.json · ${scene.duration}s · seed ${SEED} · ${same}/${total} cells identical to TRD-02`);
console.log(grid(open.map((row) => row.map((v) => (v == null ? null : Math.round(v * 60))))));
