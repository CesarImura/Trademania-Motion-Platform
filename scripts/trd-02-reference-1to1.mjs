// TRD-02 v003 · pixel transition 1:1 with the reference recording, in Trademania style,
// as a key fill on chroma blue.
// Measured from "Screen Recording 2026-10-10 at 08.31.02.mov" (2778×1560):
//  - cell grid: 264.4px squares, split into half-width cells (blocks open on half-cell
//    offsets); origin x 145.5 / y 120 at rest. → ×1920/2778 here.
//  - per-half-cell open / full-color / clear times → scripts/data/trd-02-reference-cells.json
//  - camera (cells ride it): whip 0.87→2.41s = cubic-bezier(0.75, 0.15, 0.2, 1) over
//    -4240px; hold; wipe-out move 3.04→3.54s ≈ -330px. Backdrop follows at 0.25× (gentle parallax; the reference field moves ~0.8×, but then our gradient would be off-screen).
// Clip time = recording time − 1.20s. Writes shots/trd-02-trading-analysing/v003.json.
import fs from "node:fs";
import { FPS, K, comp, r2, snap, cells, camKeys, cellLayer, IN, OUT, cam0, inRest } from "./lib/reference-transition.mjs";

const ID = "trd-02-trading-analysing";

const BD_PAD = 800; // backdrop extends left so it can slide in at 0.25× the camera (parallax)
const layers = [
  cellLayer("light", "Cells · light end (paper + dots)", "overlay", {
    paper: "#F4F9EE", dotColor: "rgba(10,26,29,0.42)", dotPitch: 18.27, dotSize: 4.8, feather: 150,
  }),
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
  cellLayer("cells", "Cells · mask (matte)", "mask"),
];

const scene = {
  name: "TRD-02 · Pixel transition (key fill, blue)",
  note: "1:1 with the reference: its grid (183px, half-cell blocks), every cell's measured open / color / clear time, and its camera (whip-in, 0.6s hold, wipe-out) — in Trademania style. The light end of the field is opaque paper + dots, so it keys cleanly on blue without a matte.",
  width: 1920, height: 1080, fps: FPS, duration: snap(Math.max(...cells.clear.flat().filter((v) => v != null)) + 5 / FPS),
  background: "#0047BB",
  layers,
};
fs.writeFileSync(`shots/${ID}/v003.json`, JSON.stringify(scene, (k, v) => (k === "t" ? Math.round(v * 1e4) / 1e4 : v), 2) + "\n");
console.log(`wrote shots/${ID}/v003.json · ${scene.duration}s · cam0=${Math.round(cam0)} rest-ease=${inRest}`);
