// "Light -> Green -> Light v3 / v4" · TRD-02 (key fill on chroma blue: light cells with
// dots → lime Trademania backdrop → wipe-out), with the Light -> Blue -> Light concept:
// an organic, clustered front instead of a line, and ~2× longer light/dotted trails —
// on the way in (open → green) and out (green → light → blue, via settle times).
// Same grid, camera whip, hold and outgoing move as TRD-02 (scripts/lib/organic-cells.mjs).
//
//   node --no-warnings scripts/trd-02-light-green-light-organic.mjs <seed> <id> <name>   (writes the next vNNN)
//   v3: 31 trd-02c-light-green-light-v3 "Light -> Green -> Light v3"
//   v4: 53 trd-02d-light-green-light-v4 "Light -> Green -> Light v4"
import fs from "node:fs";
import { FPS, K, Y0, P, cellW, cellH, comp, snap, camKeys, IN, OUT } from "./lib/reference-transition.mjs";
import { organicSchedule } from "./lib/organic-cells.mjs";

const SEED = Number(process.argv[2] ?? 31);
const ID = process.argv[3] ?? "trd-02c-light-green-light-v3";
const NAME = process.argv[4] ?? "Light -> Green -> Light v3";
const COLS = 60, ROWS = 7;
// Light cells are hard-edged (v002): TRD-02's 150px light→green feather turned the ~2× longer
// trail into a white fog over the green.
const FEATHER = 0;
// Never overwrite: write the next version, keeping the entry's current name (renames in the editor).
const dirUrl = `shots/${ID}`;
const versions = fs.existsSync(dirUrl) ? fs.readdirSync(dirUrl).filter((f) => /^v\d{3}\.json$/.test(f)).sort() : [];
const latest = versions.at(-1);
const VERSION = `v${String(versions.length ? +latest.slice(1, 4) + 1 : 1).padStart(3, "0")}`;
const KEEP_NAME = latest ? JSON.parse(fs.readFileSync(`${dirUrl}/${latest}`, "utf8")).name : null;
const { open, color, clear, settle, IN_END, OUT0, fieldX, xKeys } = organicSchedule({ seed: SEED, cols: COLS, rows: ROWS, holdExtra: 0 });

// ---- checks: the hold is fully green ----
const visibleCols = (x) => [...Array(COLS).keys()].filter((c) => x + (c + 1) * cellW > 0 && x + c * cellW < 1920);
for (const c of visibleCols(fieldX(IN.to))) for (let r = 0; r < ROWS; r++)
  if (color[r][c] == null || color[r][c] > IN_END + 1e-6 || clear[r][c] < snap(OUT0) - 0.06) throw new Error(`hold cell ${r},${c} not green for the hold`);
const end = snap(Math.max(...settle.flat().filter((v) => v != null)) + 5 / FPS);

const grid = (g) => g.map((row) => row.map((v) => (v == null ? "-" : String(+v.toFixed(4)))).join(" ")).join("\n");
const cellsLayer = (id, name, output, extra = {}) => ({
  id, name, type: "generator",
  props: {
    generator: "pixelSchedule", output, anchorX: 0, anchorY: 0,
    y: Math.round((Y0 - P) * K * 100) / 100, width: Math.round(COLS * cellW * 100) / 100, height: Math.round(ROWS * cellH * 100) / 100,
    cellW, cellH, open: grid(open), color: grid(color), clear: grid(clear), settle: grid(settle), ...extra,
  },
  keyframes: { x: xKeys },
});

const BD_PAD = 800; // as TRD-02: the backdrop slides in at 0.25× the camera (parallax)
const scene = {
  name: KEEP_NAME ?? NAME,
  note: `${FEATHER === 0 ? "Hard-edged light cells (no white fog). " : ""}Like Light -> Green -> Light v1 (TRD-02: key fill on blue, light cells + dots, lime backdrop, camera whip + hold + wipe-out) with an organic, clustered front and ~2× longer trails in and out (green → light → blue). Seed ${SEED}.`,
  width: 1920, height: 1080, fps: FPS, duration: end, background: "#0047BB",
  layers: [
    cellsLayer("light", "Cells · light end (paper + dots)", "overlay", {
      paper: "#F4F9EE", dotColor: "rgba(10,26,29,0.42)", dotPitch: 18.27, dotSize: 4.8, feather: FEATHER,
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
    cellsLayer("cells", "Cells · mask (matte)", "mask"),
  ],
};
fs.mkdirSync(`shots/${ID}`, { recursive: true });
fs.writeFileSync(`shots/${ID}/${VERSION}.json`, JSON.stringify(scene, (k, v) => (k === "t" || k === "duration" ? Math.round(v * 1e4) / 1e4 : v), 2) + "\n");
console.log(`wrote shots/${ID}/${VERSION}.json · ${end}s · hold ${IN_END.toFixed(2)}–${OUT0.toFixed(2)}s · seed ${SEED}`);
