// Organic pixel-transition schedule (used by Light -> Blue -> Light and Light -> Green ->
// Light v3+): the reference rig's grid and camera whip, but open / clear times follow a
// smooth noise field (clusters and islands ahead of and behind the front) instead of the
// reference's column order, and every cell's light/dotted phase is ~2× the reference's
// (0.12–0.28s), on the way in (open → color) and out (clear → settle).
import { FPS, K, HP, X0, comp, snap, IN, OUT, cam0, inRest } from "./reference-transition.mjs";

export function organicSchedule({ seed, cols: COLS = 60, rows: ROWS = 7, holdExtra = 0 }) {
  const SEED = seed;
  const IN_END = comp(IN.t1), OUT0 = comp(OUT.t0) + holdExtra, OUT1 = comp(OUT.t1) + holdExtra;
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

  return { open, color, clear, settle, IN_END, OUT0, OUT1, fieldX, xKeys, cols: COLS, rows: ROWS };
}
