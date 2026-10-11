// TRD-02b · the TRD-02 pixel transition with a NEW cell pattern, so repeated uses in the
// edit don't look duplicated. Same grid, camera whip + hold, backdrop, colors, chroma key
// and wipe-out as TRD-02 v003 — only which cell does what changes.
//
// The pattern is resampled from the measured reference (scripts/lib/cell-variant.mjs),
// so the feel is identical — new blocks, front, light cells and clear order.
//
//   node --no-warnings scripts/trd-02b-pixel-variant.mjs [seed]  →  shots/trd-02b-pixel-transition/v001.json
import fs from "node:fs";
import { FPS, K, comp, snap, cells, camKeys, cellLayer, grid, IN, OUT } from "./lib/reference-transition.mjs";
import { resampleCells } from "./lib/cell-variant.mjs";

const ID = "trd-02b-pixel-transition";
const SEED = Number(process.argv[2] ?? 11);
const { open, color, clear, same, total } = resampleCells(SEED);

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
  name: "Light -> Green -> Light v2", // named by the user in the editor
  note: `Same as TRD-02 v003 (grid, camera whip + hold, backdrop, chroma blue, wipe-out) with a new cell pattern resampled from the reference (seed ${SEED}): new blocks, front, light cells and clear order — ${Math.round((100 * same) / total)}% of cells match TRD-02.`,
  width: 1920, height: 1080, fps: FPS, duration: snap(lastClear + 5 / FPS), background: "#0047BB",
  layers,
};
fs.mkdirSync(`shots/${ID}`, { recursive: true });
fs.writeFileSync(`shots/${ID}/v001.json`, JSON.stringify(scene, (k, v) => (k === "t" ? Math.round(v * 1e4) / 1e4 : v), 2) + "\n");
console.log(`wrote shots/${ID}/v001.json · ${scene.duration}s · seed ${SEED} · ${same}/${total} cells identical to TRD-02`);
console.log(grid(open.map((row) => row.map((v) => (v == null ? null : Math.round(v * 60))))));
