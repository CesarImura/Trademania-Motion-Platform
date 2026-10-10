// Tiny deterministic 2D physics for "cards that touch and push each other".
// Cards are oriented boxes with mass; contacts are resolved with SAT (no
// interpenetration), inelastic normal response, and a small torque from off-center
// hits. A soft spring pulls each card toward its current anchor (or a shared center),
// and another pulls its angle back to its base tilt. Kinematic obstacles (e.g. a
// growing headline block) push cards without being pushed.
//
// simulate({ duration, fps, cards, obstacles, substeps }) → per-frame samples.
//
// Card options: spawn, from, v0, angle0, hx, hy, mass, angK, angDamp,
//   target(t, body) → [x, y, stiffness, damping, baseAngle]
//   grow(t) → 0..1 size factor (a card growing out of a point pushes others as it grows)
//   ghostUntil: before this time the card passes through obstacles (e.g. slides out from
//   behind a headline) — it still collides with other cards.
//   kinematicUntil: the card can't be pushed until this time; it holds still, or follows
//   path(t) → [x, y] if given (and keeps that velocity when it's released).

const rot = (x, y, c, s) => [x * c - y * s, x * s + y * c];

function corners(b) {
  const c = Math.cos(b.a), s = Math.sin(b.a);
  return [[-b.hx, -b.hy], [b.hx, -b.hy], [b.hx, b.hy], [-b.hx, b.hy]].map(([x, y]) => {
    const [rx, ry] = rot(x, y, c, s);
    return [b.x + rx, b.y + ry];
  });
}

function axes(b) {
  const c = Math.cos(b.a), s = Math.sin(b.a);
  return [[c, s], [-s, c]];
}

/** SAT: returns null if separated, else { depth, nx, ny } with n pointing from A to B. */
function penetration(A, B) {
  const ca = corners(A), cb = corners(B);
  let best = null;
  for (const [ax, ay] of [...axes(A), ...axes(B)]) {
    const pa = ca.map(([x, y]) => x * ax + y * ay), pb = cb.map(([x, y]) => x * ax + y * ay);
    const o = Math.min(Math.max(...pa), Math.max(...pb)) - Math.max(Math.min(...pa), Math.min(...pb));
    if (o <= 0) return null;
    if (!best || o < best.depth) {
      const dir = (B.x - A.x) * ax + (B.y - A.y) * ay >= 0 ? 1 : -1;
      best = { depth: o, nx: ax * dir, ny: ay * dir };
    }
  }
  return best;
}

/** Deepest point of B inside A (approx contact point). */
function contactPoint(A, B) {
  const ca = corners(A), cb = corners(B);
  const inside = (p, box) => {
    const c = Math.cos(-box.a), s = Math.sin(-box.a);
    const [lx, ly] = rot(p[0] - box.x, p[1] - box.y, c, s);
    return Math.abs(lx) <= box.hx && Math.abs(ly) <= box.hy;
  };
  const pts = [...cb.filter((p) => inside(p, A)), ...ca.filter((p) => inside(p, B))];
  if (!pts.length) return [(A.x + B.x) / 2, (A.y + B.y) / 2];
  return [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];
}

export function simulate({
  duration, fps = 60, substeps = 8, cards, obstacles = [], torque = 0.00012, skin = 0, iterations = 10,
  maxSpin = 1.6, // rad/s cap — cards wobble when hit, they don't spin
  maxTilt = 8 * (Math.PI / 180), // max deviation from the card's base tilt
}) {
  const dt = 1 / (fps * substeps);
  const live = new Map(); // id → body
  const frames = [];
  const total = Math.round(duration * fps);
  for (let f = 0; f <= total; f++) {
    for (let s = 0; s < substeps; s++) {
      const t = (f * substeps + s) * dt;
      // Spawn.
      for (const c of cards) {
        if (!live.has(c.id) && t >= c.spawn) {
          live.set(c.id, { ...c, hx0: c.hx, hy0: c.hy, x: c.from[0], y: c.from[1], vx: c.v0?.[0] ?? 0, vy: c.v0?.[1] ?? 0, a: c.angle0, w: 0, g: 1 });
        }
      }
      const bodies = [...live.values()];
      for (const b of bodies) {
        b.g = b.grow ? Math.max(0, Math.min(1.25, b.grow(t))) : 1; // may overshoot a little (a pop)
        b.hx = b.hx0 * b.g;
        b.hy = b.hy0 * b.g;
        b.kinematic = b.kinematicUntil !== undefined && t < b.kinematicUntil;
      }
      // Forces: anchor spring (target may change over time), angle spring, damping.
      for (const b of bodies) {
        if (b.kinematic) {
          if (b.path) {
            const [nx, ny] = b.path(t);
            b.vx = (nx - b.x) / dt; b.vy = (ny - b.y) / dt; b.x = nx; b.y = ny;
          } else b.vx = b.vy = 0;
          b.w = 0;
          continue;
        }
        const [tx, ty, k, damp, baseA] = b.target(t, b);
        b.vx += (-(b.x - tx) * k - b.vx * damp) * dt;
        b.vy += (-(b.y - ty) * k - b.vy * damp) * dt;
        // Soft tilt limit: the angle spring stiffens progressively past ±maxTilt instead
        // of hitting a wall (a hard clamp stops the card dead and reads as a stutter).
        const dev = b.a - baseA, over = Math.max(0, Math.abs(dev) / maxTilt - 1);
        b.w += (-dev * b.angK * (1 + 40 * over * over) - b.w * b.angDamp) * dt;
        b.w = Math.max(-maxSpin, Math.min(maxSpin, b.w));
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.a += b.w * dt;
      }
      // Kinematic obstacles at this time.
      const obs = obstacles.map((o) => ({ ...o.at(t), kinematic: true, obstacle: true })).filter((o) => o.hx > 0 && o.hy > 0);
      // Contacts (relaxation passes). `skin` keeps a hairline gap so edges read as
      // touching. Pairs involving something solid (kinematic) are resolved last in each
      // pass, so a squeezed pile can't push a card into a growing card or the headline.
      const all = [...bodies, ...obs];
      const pairs = [];
      for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) pairs.push([all[i], all[j]]);
      pairs.sort((p, q) => (p[0].kinematic || p[1].kinematic ? 1 : 0) - (q[0].kinematic || q[1].kinematic ? 1 : 0));
      for (let it = 0; it < iterations; it++) {
        {
          for (const [A, B] of pairs) {
            if (A.kinematic && B.kinematic) continue;
            if (A.hx < 0.5 || A.hy < 0.5 || B.hx < 0.5 || B.hy < 0.5) continue;
            if ((A.obstacle && B.ghostUntil > t) || (B.obstacle && A.ghostUntil > t)) continue;
            const grownA = { ...A, hx: A.hx + skin / 2, hy: A.hy + skin / 2 }, grownB = { ...B, hx: B.hx + skin / 2, hy: B.hy + skin / 2 };
            const p = penetration(grownA, grownB);
            if (!p) continue;
            const ima = A.kinematic ? 0 : 1 / A.mass, imb = B.kinematic ? 0 : 1 / B.mass;
            const sum = ima + imb;
            if (!sum) continue;
            // Positional correction.
            const corrA = (p.depth * ima) / sum, corrB = (p.depth * imb) / sum;
            A.x -= p.nx * corrA; A.y -= p.ny * corrA;
            B.x += p.nx * corrB; B.y += p.ny * corrB;
            // Inelastic normal velocity.
            const avx = A.vx ?? 0, avy = A.vy ?? 0; // a moving kinematic body pushes with its velocity
            const rel = (B.vx - avx) * p.nx + (B.vy - avy) * p.ny;
            if (rel < 0) {
              const j = -rel / sum;
              if (!A.kinematic) { A.vx -= p.nx * j * ima; A.vy -= p.ny * j * ima; }
              if (!B.kinematic) { B.vx += p.nx * j * imb; B.vy += p.ny * j * imb; }
              // Off-center hits spin the cards a little.
              const [cx, cy] = contactPoint(A, B);
              if (!A.kinematic) A.w -= ((cx - A.x) * p.ny - (cy - A.y) * p.nx) * j * ima * torque;
              if (!B.kinematic) B.w += ((cx - B.x) * p.ny - (cy - B.y) * p.nx) * j * imb * torque;
            }
          }
        }
      }
    }
    const t = f / fps;
    frames.push({ t, bodies: Object.fromEntries([...live.values()].map((b) => [b.id, { x: b.x, y: b.y, a: b.a, g: b.g }])) });
  }
  return frames;
}

/**
 * Zero-phase Gaussian smoothing of a sampled track (sigma in samples). Keeps impacts
 * readable but removes frame-to-frame jitter; endpoints are held.
 */
export function smooth(values, sigma) {
  if (sigma <= 0) return values.slice();
  const r = Math.ceil(sigma * 3), w = [];
  for (let i = -r; i <= r; i++) w.push(Math.exp(-(i * i) / (2 * sigma * sigma)));
  return values.map((_, i) => {
    let sum = 0, ws = 0;
    for (let k = -r; k <= r; k++) {
      const j = Math.min(values.length - 1, Math.max(0, i + k));
      sum += values[j] * w[k + r];
      ws += w[k + r];
    }
    return sum / ws;
  });
}

/**
 * Smoothing can nudge touching cards a pixel or two into each other. Walk every frame
 * and push overlapping pairs apart along the minimum axis (split evenly), so contact
 * stays exact after smoothing. `tracks[id] = { x, y, a, g, hx, hy, from }` where x/y/a/g
 * are per-frame arrays and `from` is the first frame the card exists.
 */
export function separate(tracks, { skin = 0, passes = 8 } = {}) {
  const ids = Object.keys(tracks);
  const frames = Math.max(...ids.map((id) => tracks[id].x.length + tracks[id].from));
  for (let f = 0; f < frames; f++) {
    const live = ids.filter((id) => f >= tracks[id].from && f - tracks[id].from < tracks[id].x.length);
    for (let pass = 0; pass < passes; pass++) {
      let moved = false;
      for (let i = 0; i < live.length; i++) {
        for (let j = i + 1; j < live.length; j++) {
          const A = tracks[live[i]], B = tracks[live[j]], ia = f - A.from, ib = f - B.from;
          const box = (T, k) => ({ x: T.x[k], y: T.y[k], a: T.a[k], hx: T.hx * T.g[k] + skin / 2, hy: T.hy * T.g[k] + skin / 2 });
          const a = box(A, ia), b = box(B, ib);
          if (a.hx < 0.5 || b.hx < 0.5) continue;
          const p = penetration(a, b);
          if (!p) continue;
          const d = p.depth / 2 + 0.01;
          A.x[ia] -= p.nx * d; A.y[ia] -= p.ny * d;
          B.x[ib] += p.nx * d; B.y[ib] += p.ny * d;
          moved = true;
        }
      }
      if (!moved) break;
    }
  }
}

/** Drop keyframes that linear interpolation reproduces within `tol` (greedy, ordered). */
export function decimate(keys, tol) {
  if (keys.length <= 2) return keys;
  const out = [keys[0]];
  let anchor = 0;
  for (let i = 2; i < keys.length; i++) {
    const a = keys[anchor], b = keys[i];
    let ok = true;
    for (let j = anchor + 1; j < i; j++) {
      const k = keys[j], u = (k.t - a.t) / (b.t - a.t);
      if (Math.abs(a.v + (b.v - a.v) * u - k.v) > tol) { ok = false; break; }
    }
    if (!ok) {
      out.push(keys[i - 1]);
      anchor = i - 1;
    }
  }
  out.push(keys.at(-1));
  return out;
}
