// TRD-02 key passes: just the pixel transition (no type, items or grid), trimmed, for
// compositing over other footage.
//  - shots/trd-02-trading-analysing/v002.json        fill on chroma blue (#0047BB). Stages
//    that are see-through in the design (tint, dots) are drawn opaque here ("straight"
//    fill) — their real transparency lives in the matte, so nothing mixes with the blue.
//  - shots/trd-02-trading-analysing-matte/v001.json  black/white alpha matte (luma).
// Use the matte as a luma track matte on the fill; or chroma-key the fill alone, in which
// case the tint/dot stages come out opaque.
import fs from "node:fs";

const FPS = 60;
const PRE = 4 / FPS; // a few frames of clean blue before the first cell
const T = { wipeIn: [PRE, PRE + 0.7], clear: [PRE + 1.1667, PRE + 1.6667] }; // same timing as v001, shifted
const duration = Math.round((T.clear[1] + 4 / FPS) * FPS) / FPS;
const end = T.clear[1] + 1 / FPS;

const cellBox = { x: 966, y: 540, width: 2080, height: 1234.29, cols: 13, rows: 8 };
const cellKeys = {
  progress: [{ t: T.wipeIn[0], v: 0, ease: "quadIn" }, { t: T.wipeIn[1], v: 1 }],
  clear: [{ t: T.clear[0], v: 0, ease: "quadIn" }, { t: T.clear[1], v: 1 }],
};
const DOT_ALPHA = 0.5, TINT = 0.45; // the design's see-through amounts (v001)

const fill = {
  name: "TRD-02 · Pixel transition (key fill, blue)",
  note: "Key pass: type, items and grid removed; trimmed to the transition (1.8s) on chroma blue #0047BB. Tint/dot stages are opaque here — pair with the trd-02-trading-analysing-matte shot as a luma matte for their real transparency.",
  width: 1920, height: 1080, fps: FPS, duration, background: "#0047BB",
  layers: [
    {
      id: "dots", name: "Cells · dots", type: "generator", end,
      props: { generator: "pixelStages", output: "dots", ...cellBox, dotColor: "#0a1a1d" },
      keyframes: cellKeys,
    },
    {
      id: "backdrop", name: "Backdrop (Figma 95 BG)", type: "generator", matte: "cells", end,
      props: {
        generator: "tmBackdrop", x: 960, y: 540, width: 1920, height: 1080,
        baseColor: "#d9f9b9", darkColor: "#0a1a1d", blobBlur: 280,
        b1x: 1028, b1y: -410, b1rx: 1711, b1ry: 852, b1a: 1,
        b2x: 980, b2y: 1707, b2rx: 1364, b2ry: 742, b2a: 1, b2Color: "#F5FFEB",
        noise: 0.15, ringX: 960, ringY: 540, tilt: 0.35,
      },
      keyframes: { ringShift: [{ t: T.wipeIn[0], v: -0.03, ease: "linear" }, { t: T.clear[1], v: 0.06 }] },
    },
    {
      id: "cells", name: "Cells · mask (matte)", type: "generator", end,
      props: { generator: "pixelStages", output: "mask", ...cellBox, tint: 1 },
      keyframes: cellKeys,
    },
  ],
};

const matte = {
  name: "TRD-02 · Pixel transition (key matte)",
  note: "Alpha matte for the trd-02-trading-analysing key fill (v002): white = opaque, gray = tint stage, half-white dots. Same frames and duration.",
  width: 1920, height: 1080, fps: FPS, duration, background: "#000000",
  layers: [
    {
      id: "dots", name: "Matte · dots", type: "generator", end,
      props: { generator: "pixelStages", output: "dots", ...cellBox, dotColor: `rgba(255,255,255,${DOT_ALPHA})` },
      keyframes: cellKeys,
    },
    {
      id: "cells", name: "Matte · cells", type: "generator", end,
      props: { generator: "pixelStages", output: "mask", ...cellBox, tint: TINT, maskColor: "#ffffff" },
      keyframes: cellKeys,
    },
  ],
};

const round = (k, v) => (["t", "start", "end", "duration"].includes(k) ? Math.round(v * 1e4) / 1e4 : v);
const write = (dir, file, scene) => {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(`${dir}/${file}`, JSON.stringify(scene, round, 2) + "\n");
  console.log(`wrote ${dir}/${file}`);
};
write("shots/trd-02-trading-analysing", "v002.json", fill);
write("shots/trd-02-trading-analysing-matte", "v001.json", matte);
