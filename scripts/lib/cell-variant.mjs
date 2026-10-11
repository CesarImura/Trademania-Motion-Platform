// New cell patterns for the measured pixel transitions (TRD-02 / TRD-03), so repeated
// uses in the edit don't look duplicated. The pattern is resampled from the reference
// itself, so the feel is identical: cells are grouped into blocks (mostly 2 half-cells
// wide, sometimes 2 rows tall, paired on the opposite phase to the reference), and each
// block copies the behaviour of a random "donor" cell from the same or a neighbouring
// column of the reference — its open time, whether it stays light (dots, never colors)
// or never opens (a hole), its open → color delay, and (from a donor in the same row
// band) its clear time. Columns on screen during the camera hold always open and color,
// like the reference.
import { cells } from "./reference-transition.mjs";

export const HOLD_FROM = 31; // first column on screen while the camera holds

export function resampleCells(seed) {
  let s = seed * 9301 + 49297;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const R = cells.rows, Cn = cells.open[0].length;
  const at = (g, r, c) => g[r]?.[c] ?? null;
  const band = (r) => (r <= 2 ? 0 : 1); // the reference clears in two row bands on the left

  const donor = (c, solid) => {
    const pool = [];
    for (let dc = -1; dc <= 1; dc++) for (let rr = 0; rr < R; rr++) {
      const cc = c + dc;
      if (cc < 0 || cc >= Cn) continue;
      const o = at(cells.open, rr, cc), col = at(cells.color, rr, cc);
      if (solid && (o == null || col == null)) continue;
      pool.push({ o, col });
    }
    return pick(pool);
  };
  const clearDonor = (r, c) => {
    const pool = [];
    for (let dc = -1; dc <= 1; dc++) for (let rr = 0; rr < R; rr++) {
      const cc = c + dc, cl = at(cells.clear, rr, cc);
      if (cc >= 0 && cc < Cn && cl != null && band(rr) === band(r)) pool.push(cl);
    }
    return pool.length ? pick(pool) : null;
  };

  const blank = () => [...Array(R)].map(() => Array(Cn).fill(null));
  const open = blank(), color = blank(), clear = blank();
  const done = [...Array(R)].map(() => Array(Cn).fill(false));
  for (let r = 0; r < R; r++) {
    for (let c = 0; c < Cn; c++) {
      if (done[r][c]) continue;
      const opensInRef = [...Array(R).keys()].some((rr) => at(cells.open, rr, c) != null);
      if (!opensInRef && c < HOLD_FROM) { done[r][c] = true; continue; } // the reference never opens this column
      const w = c % 2 === 1 && c + 1 < Cn && rnd() < 0.8 ? 2 : 1;
      const h = r + 1 < R && rnd() < 0.3 ? 2 : 1;
      const d = donor(c, c >= HOLD_FROM - 1);
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

  // Checks: hold columns fully open + color; how much of it matches the reference.
  let holes = 0, same = 0, total = 0;
  for (let r = 0; r < R; r++) for (let c = 0; c < Cn; c++) {
    if (c >= HOLD_FROM && (open[r][c] == null || color[r][c] == null)) holes++;
    if (at(cells.open, r, c) != null || open[r][c] != null) {
      total++;
      if (at(cells.open, r, c) === open[r][c] && at(cells.color, r, c) === color[r][c]) same++;
    }
  }
  if (holes) throw new Error(`${holes} hold-area cells don't reach color`);
  return { open, color, clear, same, total, matchPct: Math.round((100 * same) / total) };
}
