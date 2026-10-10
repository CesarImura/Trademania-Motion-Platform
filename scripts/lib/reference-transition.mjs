// Shared rig for the pixel transitions measured from the reference recording
// ("Screen Recording 2026-10-10 at 08.31.02.mov", 2778×1560): grid, per-half-cell
// schedule (scripts/data/trd-02-reference-cells.json) and the camera the cells ride.
// Clip time = recording time − REC0. Used by trd-02 (v003+) and trd-03.
import fs from "node:fs";

export const FPS = 60;
export const REC0 = 1.2; // recording time of clip frame 0
export const K = 1920 / 2778; // recording px → comp px
export const snap = (t) => Math.round(t * FPS) / FPS;
export const r2 = (v) => Math.round(v * 100) / 100;
export const comp = (rec) => snap(rec - REC0);

export const cells = JSON.parse(fs.readFileSync("scripts/data/trd-02-reference-cells.json", "utf8"));
export const grid = (g) => g.map((row) => row.map((v) => (v == null ? "-" : String(v))).join(" ")).join("\n");

// ---- camera (recording px) ----
export const IN = { t0: 0.87, t1: 2.41, from: 0, to: -4240, bez: [0.75, 0.15, 0.2, 1] };
export const OUT = { t0: 3.04, t1: 3.54, from: -4240, to: -4570, bez: [0.45, 0, 0.6, 0.85] };

// Cubic-bezier ease split at normalized time x: returns [valueFraction, ease of the rest].
export function splitBezier([x1, y1, x2, y2], x) {
  const bx = (u) => 3 * (1 - u) ** 2 * u * x1 + 3 * (1 - u) * u * u * x2 + u ** 3;
  let lo = 0, hi = 1;
  for (let i = 0; i < 60; i++) {
    const m = (lo + hi) / 2;
    if (bx(m) < x) lo = m;
    else hi = m;
  }
  const u = (lo + hi) / 2;
  // de Casteljau on P0=(0,0) P1 P2 P3=(1,1); keep the right half.
  const L = (a, b) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
  const P0 = [0, 0], P1 = [x1, y1], P2 = [x2, y2], P3 = [1, 1];
  const A = L(P0, P1), B = L(P1, P2), C = L(P2, P3), D = L(A, B), E = L(B, C), F = L(D, E);
  const nx = (p) => (p[0] - F[0]) / (1 - F[0]), ny = (p) => (p[1] - F[1]) / (1 - F[1]);
  const r4 = (v) => Math.round(v * 1e4) / 1e4;
  return [F[1], [r4(nx(E)), r4(ny(E)), r4(nx(C)), r4(ny(C))]];
}
export const [y0, inRest] = splitBezier(IN.bez, (REC0 - IN.t0) / (IN.t1 - IN.t0));
export const cam0 = IN.from + (IN.to - IN.from) * y0;

// Keys for a layer whose x = f(cam).
export const camKeys = (f) => [
  { t: 0, v: r2(f(cam0)), ease: inRest },
  { t: comp(IN.t1), v: r2(f(IN.to)), ease: "hold" },
  { t: comp(OUT.t0), v: r2(f(OUT.from)), ease: OUT.bez },
  { t: comp(OUT.t1), v: r2(f(OUT.to)) },
];

// ---- layers ----
export const HP = 132.2, P = 264.4, X0 = 145.5, Y0 = 120;
export const cellW = r2(HP * K), cellH = r2(P * K);
export const cellLayer = (id, name, output, extra = {}) => ({
  id, name, type: "generator",
  props: {
    generator: "pixelSchedule", output, anchorX: 0, anchorY: 0,
    y: r2((Y0 - P) * K), width: r2(cells.cols * cellW), height: r2(cells.rows * cellH),
    cellW, cellH, open: grid(cells.open), color: grid(cells.color), clear: grid(cells.clear),
    ...extra,
  },
  // Layer-space x=0 is the left edge of half-column `firstHalfCol` (-1).
  keyframes: { x: camKeys((cam) => K * (X0 + cells.firstHalfCol * HP + cam)) },
});

