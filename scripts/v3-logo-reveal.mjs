// V3 logo reveal — a 1:1 remake of the ElevenLabs "v4" reveal reference (screen
// recording), in Trademania's type and gradients. Framing, timing, cuts and easing were
// measured frame by frame from the reference (ref 1.35s = our 0; the orb intro is cut).
// Mapping: "V4" → "3.0", "Eleven [V4]" → "Trademania [3.0]", "ElevenLabs" → "Trademania 3.0".
// (The ElevenLabs "II" mark has no Trademania equivalent, so it's left out.)
//
//   ref 1.35–2.30  A  giant blurred 3 (ref: V), revealed top-down through haze; zoom-in speeds up
//       2.33       ── cut
//   ref 2.33–3.30  B  the 0 (ref: 4) huge and blurred, drifting; zoom-out speeds up at the end
//       3.33       ── cut
//   ref 3.33–4.20  C  3.0 in a huge pill, zooming out (text shrinks faster than the pill)
//       4.23       ── cut
//   ref 4.23–4.95  D  small badge, settling zoom-out while drifting right to make room
//       4.98       ── cut
//   ref 4.98–6.20  E  "Trademania [3.0]" cuts in; camera settles 43px right, scale 0.966 → 1
//   ref 6.20–6.35  F  Trademania snaps to bold letter by letter (L→R), badge blurs away
//   ref 6.40–6.57     the final "3.0" blurs in glyph by glyph in the gradient
//   ref 6.55–7.50     each glyph settles from gradient to ink, staggered
//
// Every measured framing is a key; a key with `hold` easing before each cut makes the cut.
// Glyphs and the pill stroke are track mattes over the Figma fill textures.
//
//   node scripts/v3-logo-reveal.mjs [vNNN]   (default v009)

import { mkdirSync, writeFileSync } from "node:fs";

// Keys are authored in 30fps frame units (as measured); the shot renders at 60fps
// like the reference's source, so fast moves and the letter wave don't step.
const BASE = 30, FPS = 60;
const f = (n) => +(Math.round((n / BASE) * FPS) / FPS).toFixed(4); // 30fps frame → seconds (snapped to 1/60)
const k = (frame, v, ease) => (ease ? { t: f(frame), v, ease } : { t: f(frame), v });
const r2 = (v) => +v.toFixed(2);

const PAPER = "#F4F9EE";
const INK = "#0a1a1d";
const FONT = "Geist";
const TEX_ASPECT = 3865 / 2160;
// Eases fitted to the reference's per-frame motion (ink extents tracked on every
// captured frame). The reference's rhythm per shot: a fast snap that settles, a
// near-hold, then a move that accelerates into the next cut.
const PUSH = [0.33, 1, 0.68, 1];          // haze
const SNAP_C = [0, 0.2, 0.45, 0.9];       // C: snap-settle after the cut (fit)
const OUT_C = [0.25, 0.05, 0.25, 0];      // C: zoom-out accelerating into the cut (fit)
const SNAP_D = [0.3, 0.8, 0, 0.85];       // D: 1.6x -> 1x snap in 0.47s (fit)
const CUBIC_IN = [0.32, 0, 0.67, 0];      // B: zoom-out into the cut (cubic-in fits)
const WHIP = [1, 0.1, 0.3, 0.7];          // D: whip right into the E cut (fit: slow start, ~83% done 2 frames before the cut)

// ---------- shot boundaries (frames, 30fps units) ----------
const A = 0, B = 29, C = 59, D = 86, E = 109, F = 145, END = 240;
const last = (next) => next - 0.5; // last 60fps frame before a cut

// Shot space is 1920×1080; the camera null sits at the frame centre, so children use
// coordinates relative to it.
const CX = 960, CY = 540;
const rx = (x) => r2(x - CX), ry = (y) => r2(y - CY);

/**
 * Keys over several shots. Each segment: { pts: [[frame, value, ease?], ...], ease }.
 * A key uses its own ease, else the segment's; the last key of a segment holds until
 * the next segment's first key (a hard cut).
 */
function cuts(...segs) {
  const out = [];
  segs.forEach((s, si) => {
    s.pts.forEach(([fr, v, e], i) => {
      const lastOfSeg = i === s.pts.length - 1;
      const lastAll = lastOfSeg && si === segs.length - 1;
      out.push(k(fr, typeof v === "number" ? r2(v) : v, lastAll ? undefined : lastOfSeg ? "hold" : e ?? s.ease));
    });
  });
  return out;
}

// ---------- "3.0" glyph geometry (Geist Bold 350px, −7 tracking; canvas-measured) ----------
// Glyph layers sit at their advance centres inside the label null.
const GLYPHS = [
  { id: "3", text: "3", cx: -155.6, w: 220.5 },
  { id: "dot", text: ".", cx: -7.5, w: 75.6 },
  { id: "0", text: "0", cx: 148.1, w: 235.6 },
];
const THREE = { cx: -155.6 + 3.25, bottom: 100 }; // 3's ink centre x and bottom
const ZERO = { cx: 148.1 + 2.72, bottom: 100 };   // 0's ink centre x and bottom
const TEXT_W = 506;                               // "3.0" ink width
// One gradient box for the whole word (like Figma's single "3.0" text fill), padded so
// the blurred glyph edges never run past the image (that's what caused hard crops).
const FILL_PAD = 170; // room for the blur and for the fill to drift (see FILL_A/FILL_B)
const FILL = { w: 531.65 + FILL_PAD * 2, h: 350 + FILL_PAD * 2 };
const INK_CX = 3.2;                               // "3.0" ink centre x (label space)
const VIS_CY = -29;                               // cap centre (label space)

// Shot A — the 3 framed like the reference's V. Ref: quick push-in that settles by
// ref 1.78s, while the whole frame drifts left at a steady ~150px/s.
const S_A = 5.33;
const shotA = [
  [A, S_A * 0.86, 668, 1028, "quadOut"],
  [13, S_A, 600, 1030, "linear"],
  [last(B), S_A * 1.01, 522, 1034],
].map(([fr, s, cx, base, e]) => ({ fr, s, e, x: cx - THREE.cx * s, y: base - THREE.bottom * s }));

// Shot B — the 0 placed by the reference 4. Ref: steady pan left with a hair of
// push-in until ref 3.04s, then a cubic-in zoom-out into the cut.
const shotB = [
  [B, 5.405, 948, 972, "linear"],
  [51, 5.45, 893, 1000, CUBIC_IN],
  [last(C), 4.09, 895, 912],
].map(([fr, s, cx, base, e]) => ({ fr, s, e, x: cx - ZERO.cx * s, y: base - ZERO.bottom * s }));

// Shot C — text width snaps 28% -> 20% of frame and nearly holds (ref 3.34–3.80s), then
// zooms out to 10% accelerating into the cut. Zoom centre ≈ (955 + 70·w, 0.49H + 0.114·w).
const cAt = (tw) => ({ tx: 955 + 70 * (tw / 1920), ty: (0.49 + 0.114 * (tw / 1920)) * 1080 });
const shotC = [
  { fr: C, tw: 538, pw: 2356, ph: 1400, sw: 36, px: 967, py: 540, blur: 5, e: SNAP_C },
  { fr: 73.5, tw: 389, pw: 2110, ph: 1125, sw: 34, px: 967, py: 538, blur: 1.5, e: OUT_C },
  { fr: last(D), tw: 199, pw: 1430, ph: 783, sw: 32, px: 964, py: 537, blur: 0 },
].map((p) => ({ ...p, ...cAt(p.tw) }));

// ---------- shot E/F layout: "Trademania [3.0]" -> "Trademania 3.0" ----------
const WORD = "Trademania";
const SIZE = 78;
const ADV_REG = [43.06, 25.66, 39.86, 45.94, 42.98, 67.63, 42.2, 45.01, 18.56, 42.2]; // Geist 400 @78
const ADV_BOLD = [46.72, 29.72, 43.68, 48.67, 46.41, 69.42, 45.32, 47.66, 21.45, 45.55, 17.78, 50.7, 18.41, 54.05]; // "Trademania 3.0" Geist 700 @78
const TEXT_DY = 6.4; // em-middle -> cap centre for Geist @78
const GAP = 31;
const BADGE_E = { w: 115, h: 70, sw: 6 }; // ref: badge settles at 6% of frame width
const sum = (a) => a.reduce((n, v) => n + v, 0);

const regW = sum(ADV_REG);
const groupW = regW + GAP + BADGE_E.w;
const regLeft = CX - groupW / 2;
const regCenters = ADV_REG.map((w, i) => regLeft + sum(ADV_REG.slice(0, i)) + w / 2);
const badgeE = { x: regLeft + regW + GAP + BADGE_E.w / 2, y: CY };

const boldW = sum(ADV_BOLD);
const boldLeft = CX - boldW / 2;
const boldCenters = ADV_BOLD.map((w, i) => boldLeft + sum(ADV_BOLD.slice(0, i)) + w / 2);
const box30 = { x0: boldLeft + sum(ADV_BOLD.slice(0, 11)), w: sum(ADV_BOLD.slice(11)) };

// Camera in E (ref): group starts 37px left and a touch large, eases to centre and
// scale 1 over 0.75s (quad out).
const CAM_E = { x: CX - 37, s: 1 / 0.977, dur: 22.5 };
const camAt = (x) => CAM_E.x + (x - CX) * CAM_E.s; // where shot-space x lands at the E cut

// Shot D — badge snaps from 1.6x to its size in 0.47s and holds centred; from ref 4.80s
// it whips right (accelerating) and the E cut lands mid-move.
const D_HOLD = 100, D_WHIP = 103.5;
const whipX = camAt(badgeE.x) - 3;
const labelInBadge = (w) => (w * 0.5) / TEXT_W; // ref: the label is ~half the badge width
const dSize = (scale) => ({ w: BADGE_E.w * scale, h: BADGE_E.h * scale, sw: BADGE_E.sw * scale });
const LX = (x) => rx(x - INK_CX * labelInBadge(BADGE_E.w));

// ---------- per-property keys ----------
const labelX = cuts(
  { pts: shotA.map((p) => [p.fr, rx(p.x), p.e]) },
  { pts: shotB.map((p) => [p.fr, rx(p.x), p.e]) },
  { pts: shotC.map((p) => [p.fr, rx(p.tx - INK_CX * (p.tw / TEXT_W)), p.e]) },
  { pts: [[D, LX(CX), "linear"], [D_WHIP, LX(CX), WHIP], [last(E), LX(whipX)]] },
  { pts: [[E, LX(badgeE.x)]] },
);
const labelY = cuts(
  { pts: shotA.map((p) => [p.fr, ry(p.y), p.e]) },
  { pts: shotB.map((p) => [p.fr, ry(p.y), p.e]) },
  { pts: shotC.map((p) => [p.fr, ry(p.ty - VIS_CY * (p.tw / TEXT_W)), p.e]) },
  { pts: [[D, ry(CY - VIS_CY * labelInBadge(dSize(1.6).w)), SNAP_D], [D_HOLD, ry(CY - VIS_CY * labelInBadge(BADGE_E.w))]] },
  { pts: [[E, ry(badgeE.y - VIS_CY * labelInBadge(BADGE_E.w))]] },
);
const labelS = cuts(
  { pts: shotA.map((p) => [p.fr, p.s, p.e]) },
  { pts: shotB.map((p) => [p.fr, p.s, p.e]) },
  { pts: shotC.map((p) => [p.fr, p.tw / TEXT_W, p.e]) },
  { pts: [[D, labelInBadge(dSize(1.6).w), SNAP_D], [D_HOLD, labelInBadge(BADGE_E.w)]] },
  { pts: [[E, labelInBadge(BADGE_E.w)]] },
);
const glyphBlur = cuts(
  { pts: [[A, 22, "quadOut"], [13, 10, "linear"], [last(B), 8]] },
  { pts: [[B, 14, "linear"], [51, 10, CUBIC_IN], [last(C), 12]] },
  { pts: shotC.map((p) => [p.fr, p.blur, p.e]) },
  { pts: [[D, 0]] },
);

// Lens-like blur (ref): part of the glyph is nearly sharp while the rest falls off,
// and the sharp zone wanders. A: the 3's upper-left is crisp and the plane drifts
// down-right; B: the 0's lower edge is crisp first, then focus climbs up-left (the
// ref 4's stem → diagonal); C: a light rack that clears by the D cut.
// [frame, focusX, focusY, angle, maxBlur, ease]
const FOCUS = [
  [[A, 360, 250, -25, 46, "linear"], [last(B), 480, 390, -14, 40]],
  [[B, 1060, 940, -18, 50, "sineInOut"], [51, 820, 640, -34, 46, CUBIC_IN], [last(C), 830, 600, -36, 44]],
  [[C, 975, 560, 80, 8, SNAP_C], [73.5, 970, 552, 84, 2.5, OUT_C], [last(D), 965, 545, 88, 0]],
  [[D, 960, 540, 0, 0]],
];
const focusKeys = (col) => cuts(...FOCUS.map((seg) => ({ pts: seg.map((p) => [p[0], p[col], p[5]]) })));
const FOCUS_RANGE = cuts({ pts: [[A, 70, "linear"]] }, { pts: [[B, 80]] }, { pts: [[C, 140]] });
const FOCUS_FALLOFF = cuts({ pts: [[A, 520, "linear"]] }, { pts: [[B, 560]] }, { pts: [[C, 360]] });

// The gradient lives too (ref: colour patches slide through the glyphs, the 4's
// diagonal darkens from grey to green). The main fill drifts; a second texture drifts
// the other way and fades in and out on top of it. Label-space offsets.
const FILL_A = cuts(
  { pts: [[A, [110, 30], "sineInOut"], [last(B), [-70, -20]]] },
  { pts: [[B, [-110, -40], "sineInOut"], [last(C), [90, 40]]] }, // darkens across B, like the ref 4
  { pts: [[C, [-50, 0], SNAP_C], [last(D), [40, 10]]] },
  { pts: [[D, [0, 0]]] },
);
const FILL_B = cuts(
  { pts: [[A, [-90, -30, 0], "sineInOut"], [last(B), [80, 20, 0.35]]] },
  { pts: [[B, [-100, -20, 0.15], "sineInOut"], [last(C), [110, 50, 0.75]]] },
  { pts: [[C, [60, 0, 0.4], SNAP_C], [last(D), [-30, 0, 0.1]]] },
  { pts: [[D, [0, 0, 0]]] },
);
const pick = (keys, i) => keys.map((kf) => ({ ...kf, v: r2(kf.v[i]) }));

// Pill keys exist from C on (layer starts at C). x has its own D timing (hold → whip).
const pillSegs = (fn, axis) => cuts(
  { pts: shotC.map((p) => [p.fr, fn({ w: p.pw, h: p.ph, sw: p.sw, x: p.px, y: p.py }), p.e]) },
  axis === "x"
    ? { pts: [[D, fn({ x: CX }), "linear"], [D_WHIP, fn({ x: CX }), WHIP], [last(E), fn({ x: whipX })]] }
    : { pts: [[D, fn({ ...dSize(1.6), x: CX, y: CY }), SNAP_D], [D_HOLD, fn({ ...dSize(1), x: CX, y: CY })]] },
  { pts: [[E, fn({ ...BADGE_E, ...badgeE })]] },
);
const pill = (fn) => pillSegs(fn);
const cover = (w, h) => (w / h > TEX_ASPECT ? { w, h: w / TEX_ASPECT } : { w: h * TEX_ASPECT, h });

// F timing (frames): letters snap bold L→R, badge blurs away, 3.0 blurs in, then settles.
const boldAt = (i) => F + i * 0.6; // 0.02s per letter, like the reference's wave
// Each letter hops up and shrinks a touch just before its turn, then drops in bold
// with a small overshoot (ref 6.25s: "ven" still regular and raised behind ".Ele").
const HOP = { lead: 2.4, up: -11, upScale: 0.94, land: 3, landScale: 1.04, settle: 2.5 };
const G30 = [
  { id: "3", text: "3", i: 11, at: 151, ink: [156, 166] },
  { id: "dot", text: ".", i: 12, at: 153, ink: [162, 172] },
  { id: "0", text: "0", i: 13, at: 155, ink: [170, 184] },
];

const layers = [
  // ---------- haze (shot A reveal, top-down) ----------
  {
    id: "haze", name: "Haze (V reveal)", type: "rect", label: "#c5b9ee",
    end: f(B),
    props: {
      x: 960, y: 0, anchorY: 0, width: 2400, height: 1500,
      fillType: "linear", gradientAngle: 180,
      gradientStops: "rgba(244,249,238,0) 0, rgba(244,249,238,0.95) 0.32, rgba(244,249,238,1) 1",
    },
    keyframes: {
      y: [k(A, 160, PUSH), k(A + 16, 1000)],
      opacity: [k(A + 6, 1, "easeOut"), k(A + 20, 0)],
    },
  },

  // ---------- camera ----------
  {
    id: "camera", name: "Camera", type: "null", label: "#c5b9ee",
    props: { x: CX, y: CY },
    keyframes: {
      x: [k(A, CX, "hold"), k(E, r2(CAM_E.x), "quadOut"), k(E + CAM_E.dur, CX)],
      scale: [k(A, 1, "hold"), k(E, r2(CAM_E.s), "quadOut"), k(E + CAM_E.dur, 1)],
    },
  },

  // ---------- final: "3.0" (gradient → ink) ----------
  ...G30.flatMap((g) => {
    const cx = rx(boldCenters[g.i]);
    const glyph = { text: g.text, fontFamily: FONT, fontWeight: 700, fontSize: SIZE, lineHeight: 1, x: cx, y: r2(TEXT_DY) };
    return [
      {
        id: `ink30-${g.id}`, name: `3.0 · "${g.text}" ink`, type: "text", parent: "camera", label: "#e6d3a3",
        start: f(g.ink[0]),
        props: { ...glyph, fill: INK },
        keyframes: { opacity: [k(g.ink[0], 0, "easeInOut"), k(g.ink[1], 1)] },
      },
      {
        id: `g30-${g.id}`, name: `3.0 · "${g.text}" (matte)`, type: "text", parent: "camera", label: "#e6d3a3",
        start: f(g.at),
        props: { ...glyph, fill: "#000" },
        keyframes: {
          opacity: [k(g.at, 0, "easeOut"), k(g.at + 3, 1)],
          blur: [k(g.at, 12, "easeOut"), k(g.at + 4, 0)],
        },
      },
      {
        id: `tex30-${g.id}`, name: `3.0 · "${g.text}" fill`, type: "image", parent: "camera", matte: `g30-${g.id}`, label: "#e6d3a3",
        start: f(g.at), end: f(g.ink[1] + 1),
        props: { src: "tex-a.jpg", x: rx(box30.x0 + box30.w / 2), y: r2(TEXT_DY), width: r2(box30.w + 48), height: SIZE + 48 }, // padded for the blur-in
      },
    ];
  }),

  // ---------- "Trademania": regular → bold, letter by letter ----------
  ...[...WORD].map((ch, i) => ({
    id: `w-${i}`, name: `Word · ${ch}`, type: "text", parent: "camera", label: "#c5b9ee",
    start: f(E),
    props: { text: ch, fontFamily: FONT, fontSize: SIZE, lineHeight: 1, fill: INK, y: r2(TEXT_DY) },
    keyframes: {
      x: [k(boldAt(i) - HOP.lead, rx(regCenters[i]), "easeOut"), k(boldAt(i), rx(boldCenters[i]))], // slides to its bold slot during the hop
      fontWeight: [k(E, 400, "hold"), k(boldAt(i), 700)],
      y: [
        k(boldAt(i) - HOP.lead, r2(TEXT_DY), "easeOut"), k(boldAt(i) - 0.5, r2(TEXT_DY + HOP.up), "hold"),
        k(boldAt(i), r2(TEXT_DY + HOP.land), "easeOut"), k(boldAt(i) + HOP.settle, r2(TEXT_DY)),
      ],
      scale: [
        k(boldAt(i) - HOP.lead, 1, "easeOut"), k(boldAt(i) - 0.5, HOP.upScale, "hold"),
        k(boldAt(i), HOP.landScale, "easeOut"), k(boldAt(i) + HOP.settle, 1),
      ],
    },
  })),

  // ---------- badge (3.0 + pill); blurs away in F ----------
  {
    id: "badge", name: "Badge (fade in F)", type: "null", parent: "camera", label: "#D9F9B9",
    props: {},
    keyframes: {
      blur: [k(F - 2, 0, "easeIn"), k(F + 7, 22)],
      opacity: [k(F - 2, 1, "easeIn"), k(F + 7, 0)],
    },
  },
  {
    id: "label", name: "3.0 (label · focus plane)", type: "null", parent: "badge", label: "#9fdcc6",
    props: { isolate: "yes" },
    keyframes: {
      x: labelX, y: labelY, scale: labelS,
      blur: glyphBlur, // base softness, applied once to the finished group (cheap)
      focusX: focusKeys(1), focusY: focusKeys(2), focusAngle: focusKeys(3), focusBlur: focusKeys(4),
      focusRange: FOCUS_RANGE, focusFalloff: FOCUS_FALLOFF,
    },
  },
  {
    id: "glyphs", name: "3.0 · focus", type: "null", parent: "label", label: "#9fdcc6",
    props: {},
    keyframes: {
      opacity: [k(A, 0.45, "linear"), k(12, 1)], // opens on the 3
    },
  },
  ...GLYPHS.flatMap((g) => [
    {
      id: `g-${g.id}`, name: `${g.text} · glyph (matte)`, type: "text", parent: "glyphs", label: "#9fdcc6",
      end: f(F + 8),
      props: {
        text: g.text, fontFamily: FONT, fontWeight: 700, fontSize: 350, letterSpacing: -7, lineHeight: 1,
        fill: "#000", x: g.cx, y: 0,
      },
    },
    {
      id: `texb-${g.id}`, name: `${g.text} · fill 2 (drift)`, type: "image", parent: "label", matte: `g-${g.id}`, label: "#9fdcc6",
      end: f(F + 8),
      props: { src: "tex-b.jpg", width: FILL.w, height: FILL.h },
      keyframes: { x: pick(FILL_B, 0), y: pick(FILL_B, 1), opacity: pick(FILL_B, 2) },
    },
    {
      id: `tex-${g.id}`, name: `${g.text} · fill`, type: "image", parent: "label", matte: `g-${g.id}`, label: "#9fdcc6",
      end: f(F + 8),
      props: { src: "tex-a.jpg", width: FILL.w, height: FILL.h },
      keyframes: { x: pick(FILL_A, 0), y: pick(FILL_A, 1) },
    },
  ]),
  {
    id: "ring-mask", name: "Pill · stroke (matte)", type: "rect", parent: "badge", label: "#D9F9B9",
    start: f(C), end: f(F + 8),
    props: { fill: "rgba(0,0,0,0)", stroke: "#000" },
    keyframes: {
      x: pillSegs((p) => rx(p.x), "x"),
      y: pill((p) => ry(p.y)),
      width: pill((p) => p.w - p.sw),
      height: pill((p) => p.h - p.sw),
      radius: pill((p) => (p.h - p.sw) / 2),
      strokeWidth: pill((p) => p.sw),
    },
  },
  {
    id: "ring-tex", name: "Pill · fill", type: "image", parent: "badge", matte: "ring-mask", label: "#D9F9B9",
    start: f(C), end: f(F + 8),
    props: { src: "tex-b.jpg" },
    keyframes: {
      x: pillSegs((p) => rx(p.x), "x"),
      y: pill((p) => ry(p.y)),
      // +60px so the stroke's blur-out in F stays inside the fill
      width: pill((p) => cover(p.w + 60, p.h + 60).w),
      height: pill((p) => cover(p.w + 60, p.h + 60).h),
    },
  },
];

const shot = {
  name: "V3 logo reveal",
  note: "Lens-like blur and a living gradient, like the reference: a focus plane keeps part of each glyph sharp while the rest falls off (and wanders), and the fill drifts with a second texture fading through it.",
  width: 1920,
  height: 1080,
  fps: FPS,
  duration: f(END),
  background: PAPER,
  layers,
};

const v = process.argv[2] ?? "v009";
const dir = new URL("../shots/v3-logo-reveal/", import.meta.url);
mkdirSync(dir, { recursive: true });
writeFileSync(new URL(`${v}.json`, dir), JSON.stringify(shot, null, 2) + "\n");
console.log(`wrote shots/v3-logo-reveal/${v}.json (${layers.length} layers, ${shot.duration}s)`);
