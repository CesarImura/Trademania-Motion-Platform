// TRD-03 · light → dark pixel transition (Figma Section 6, frame 101 "Winning · Pixel
// transition"), as a key fill: the light page is opaque paper on chroma blue, and the
// dark scene keys in where cells pop off.
// Same measured reference as TRD-02 v003 (cell order, timing, camera whip — see
// scripts/lib/reference-transition.mjs): a cell's "open" time is when it gets the
// halftone dots (the reference's light end), its "full color" time is when it pops off.
// Cells the reference never opened stay paper and slide out with the whip.
// Writes shots/trd-03-light-to-dark/v001.json.
import fs from "node:fs";
import { FPS, snap, cells, cellLayer } from "./lib/reference-transition.mjs";

const ID = "trd-03-light-to-dark";
const lastOff = Math.max(...cells.color.flat().filter((v) => v != null));

const scene = {
  name: "TRD-03 · Pixel transition light → dark (key fill, blue)",
  note: "Light → dark (Figma 101): the paper page breaks up with the reference's measured cell order, timing and camera whip — cells get halftone dots, then pop to chroma blue #0047BB where the dark scene keys in. Faint light-mode grid on the paper.",
  width: 1920, height: 1080, fps: FPS, duration: snap(lastOff + 6 / FPS), background: "#0047BB",
  layers: [
    // Clear times aren't used here: the clip ends once the page is gone.
    cellLayer("page", "Light page · cells (paper + dots)", "paper", {
      clear: "", paper: "#F4F9EE", dotColor: "rgba(10,26,29,0.42)", dotPitch: 18.27, dotSize: 4.8,
      gridColor: "rgba(10,26,29,0.08)", gridEvery: 2, gridPhase: 1,
    }),
  ],
};
fs.mkdirSync(`shots/${ID}`, { recursive: true });
fs.writeFileSync(`shots/${ID}/v001.json`, JSON.stringify(scene, (k, v) => (k === "t" || k === "duration" ? Math.round(v * 1e4) / 1e4 : v), 2) + "\n");
console.log(`wrote shots/${ID}/v001.json · ${scene.duration}s`);
