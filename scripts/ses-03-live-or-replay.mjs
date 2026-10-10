// SES-02 → SES-03 → SES-04 (Trademania V3, Figma "Motion test 4", node 15834:30653).
// Continues SES-01→02: opens on the tail of the "Neue Trading-Session erstellen" click
// (button + hand copied from ses-01-create-session's latest version), pixel-wipes
// to "Wähle die Daten…" with the Live / Replay cards, the hand clicks Live and the
// card grows in place to fill the frame.
//
// Live lines are the `liveLines` generator (Figma paths, morphing small → big card
// shape, with a slow travelling flow); the candles are `replayChart`.
//
//   node scripts/ses-03-live-or-replay.mjs

import { mkdirSync, readFileSync, readdirSync, writeFileSync, copyFileSync } from "node:fs";

const FPS = 30;
const f = (n) => +(n / FPS).toFixed(4); // frame → seconds
const k = (frame, v, ease) => (ease ? { t: f(frame), v, ease } : { t: f(frame), v });
const S = "figmaSlow";

// ---------- SES-02 tail, copied from the latest ses-01 version ----------
const srcDir = new URL("../shots/ses-01-create-session/", import.meta.url);
const latest = readdirSync(srcDir).filter((n) => /^v\d{3}\.json$/.test(n)).sort().at(-1);
const src = JSON.parse(readFileSync(new URL(latest, srcDir), "utf8"));
const OFFSET = src.layers.find((l) => l.id === "hand").start; // open as the hand enters
const SES02_IDS = ["btn", "plus", "plus-h", "plus-v", "plus-tile", "btn-label", "btn-bg", "btn-shape", "grid"];

// Timeline (frames of this shot)
const PRESS = 32; // button click (from SES-02)
const WIPE1_IN = PRESS + 4, WIPE1_OUT = WIPE1_IN + 18; // ink pixels ripple out from the click
const WIPE2_IN = WIPE1_IN + 9, WIPE2_OUT = WIPE2_IN + 20; // paper follows behind
const SES02_END = WIPE1_OUT;
const TITLE_IN = WIPE2_OUT - 7;
const LIVE_IN = TITLE_IN + 6, REPLAY_IN = LIVE_IN + 4;
const HAND_GO = 92, HAND_LAND = HAND_GO + 26;
const PRESS2 = HAND_LAND + 9;
const EXP = PRESS2 + 3, EXP_END = EXP + 27;
const DURATION = EXP_END + 66;

const shift = (kfs) => {
  // Shift keys into this shot; drop keys before 0 except the one feeding the first segment.
  const moved = kfs.map((kf) => ({ ...kf, t: +(kf.t - OFFSET).toFixed(4) }));
  const firstPos = moved.findIndex((kf) => kf.t >= 0);
  if (firstPos === -1) return [{ ...moved.at(-1), t: 0 }];
  return moved.slice(Math.max(0, firstPos - 1));
};
const ses02 = SES02_IDS.map((id) => {
  const l = structuredClone(src.layers.find((x) => x.id === id));
  delete l.start;
  l.end = f(SES02_END);
  if (l.keyframes) for (const key of Object.keys(l.keyframes)) l.keyframes[key] = shift(l.keyframes[key]);
  return l;
});
// The pressed button pops back as the wipe starts.
const btn = ses02.find((l) => l.id === "btn");
btn.keyframes.scale.push(k(PRESS + 4, 0.965, "easeOut"), k(PRESS + 10, 1));

// ---------- geometry (Figma, 1920×1080) ----------
const FINGER_BTN = { x: 1308, y: 568 };
const HAND_SMALL = 149 / 200; // Figma hand is 149 px in SES-03/04
const FINGER_LIVE = { x: 715 + 149 * 0.33, y: 918 + 149 * 0.13 };
const FINGER_S04 = { x: 860 + 149 * 0.33, y: 900 + 149 * 0.13 };

const CARD = { w: 831.07, h: 536, top: 441 };
const LIVE_C = { x: 131 + CARD.w / 2, y: CARD.top + CARD.h / 2 };
const REPLAY_C = { x: 131 + 864.93 + CARD.w / 2, y: LIVE_C.y };
const BIG = { w: 1920, h: 1099, x: 960, y: -9 + 1099 / 2 };
const PAD_S = 43.54, PAD_B = 89.25;

// Inside a card, relative to its center: small (SES-03) and big (SES-04).
const rel = (sx, sy, bx, by) => ({
  s: { x: +(sx - CARD.w / 2).toFixed(2), y: +(sy - CARD.h / 2).toFixed(2) },
  b: { x: +(bx - BIG.w / 2).toFixed(2), y: +(by - BIG.h / 2).toFixed(2) },
});
const CHART = rel(PAD_S, PAD_S, PAD_B, PAD_B);
const TITLE = rel(PAD_S, 396.37, PAD_B, 1099 - PAD_B - 70.4 - 24.79 - 114.4);
const DESC = rel(PAD_S, 396.37 + 65.09, PAD_B, 1099 - PAD_B - 70.4);

const grow = (key, small, big, extra = []) => [...extra, k(EXP, small, S), k(EXP_END, big)];
const fadeIn = (fr, len = 12) => [k(fr, 0, "easeOut"), k(fr + len, 1)];

const REWIND_D = "M14.5127 0V19.3503L0 9.67515L14.5127 0ZM31.4442 0V19.3503L16.9315 9.67515L31.4442 0Z";
const text = (o) => ({
  fontFamily: "Geist", lineHeight: 1.1, align: "left", anchorX: 0, anchorY: 0, ...o,
});

const layers = [
  // ================= hand (carries across every screen) =================
  {
    id: "hand",
    name: "Hand cursor",
    type: "image",
    label: "#e6d3a3",
    props: {
      src: "hand-cursor.png", width: 200,
      anchorX: 0.33, anchorY: 0.13, // fingertip
      shadowColor: "rgba(10,26,29,0.22)", shadowBlur: 28,
    },
    keyframes: {
      x: [
        k(0, FINGER_BTN.x + 260, "expoOut"), k(26, FINGER_BTN.x, "sineInOut"),
        k(HAND_GO, FINGER_BTN.x - 30, S), k(HAND_LAND, FINGER_LIVE.x),
        k(EXP, FINGER_LIVE.x, S), k(EXP_END, FINGER_S04.x),
      ],
      y: [
        k(0, FINGER_BTN.y + 330, "expoOut"), k(26, FINGER_BTN.y, "sineInOut"),
        k(HAND_GO, FINGER_BTN.y + 18, S), k(HAND_LAND, FINGER_LIVE.y),
        k(EXP, FINGER_LIVE.y, S), k(EXP_END, FINGER_S04.y),
      ],
      rotation: [k(0, 14, "expoOut"), k(30, 0), k(HAND_GO, 0, "sineInOut"), k(HAND_GO + 12, -7, "sineInOut"), k(HAND_LAND + 2, 0)],
      opacity: fadeIn(0, 6),
      scale: [
        k(PRESS - 3, 1, "quadIn"), k(PRESS, 0.86, "easeOut"), k(PRESS + 5, 0.89, "easeOut"), k(PRESS + 12, 1),
        k(HAND_GO, 1, S), k(HAND_LAND, HAND_SMALL),
        k(PRESS2 - 3, HAND_SMALL, "quadIn"), k(PRESS2, +(HAND_SMALL * 0.86).toFixed(4), "easeOut"),
        k(PRESS2 + 6, +(HAND_SMALL * 0.89).toFixed(4), S), k(EXP_END, HAND_SMALL),
      ],
      shadowY: [
        k(PRESS - 3, 14, "quadIn"), k(PRESS, 4, "easeOut"), k(PRESS + 12, 14),
        k(PRESS2 - 3, 14, "quadIn"), k(PRESS2, 4, S), k(EXP_END, 14),
      ],
    },
  },

  // ================= SES-03/04 · Live card (grows to full frame) =================
  {
    id: "live",
    name: "Live card (group)",
    type: "null",
    label: "#ff6479",
    start: f(LIVE_IN),
    props: {},
    keyframes: {
      x: grow("x", LIVE_C.x, BIG.x),
      y: grow("y", LIVE_C.y, BIG.y, [k(LIVE_IN, LIVE_C.y + 90, S), k(LIVE_IN + 22, LIVE_C.y)]),
      opacity: fadeIn(LIVE_IN, 8),
      scale: [
        k(LIVE_IN, 0.95, S), k(LIVE_IN + 22, 1),
        k(PRESS2 - 2, 1, "quadOut"), k(PRESS2 + 1, 0.985, S), k(EXP_END - 6, 1),
      ],
    },
  },
  {
    id: "live-chip",
    name: "Chip · Live (group)",
    type: "null",
    parent: "live",
    label: "#ff6479",
    props: {},
    keyframes: {
      x: grow("x", CHART.s.x, CHART.b.x),
      y: grow("y", CHART.s.y, CHART.b.y),
      scale: grow("scale", 1, 2.0446),
      opacity: fadeIn(LIVE_IN + 8),
    },
  },
  {
    id: "live-chip-text", name: "Live", type: "text", parent: "live-chip",
    props: text({ text: "Live", fontWeight: 500, fontSize: 29.025, letterSpacing: -0.5805, fill: "#ffffff", x: 50.38, y: 14.09 }),
  },
  {
    id: "live-pixel", name: "Live pixel", type: "rect", parent: "live-chip",
    props: { anchorX: 0, anchorY: 0, x: 18.93, y: 21.63, width: 16.93, height: 16.93, fill: "#ff6479" },
    keyframes: {
      // Live "recording" blink once the card is open.
      opacity: [k(EXP_END + 6, 1, "hold"), k(EXP_END + 21, 0.25, "hold"), k(EXP_END + 30, 1, "hold"), k(EXP_END + 45, 0.25, "hold"), k(EXP_END + 54, 1)],
    },
  },
  {
    id: "live-chip-bg", name: "Chip box", type: "rect", parent: "live-chip",
    props: { anchorX: 0, anchorY: 0, width: 128.14, height: 60.19, radius: 4.838, fill: "#000000", stroke: "rgba(255,255,255,0.24)", strokeWidth: 2 },
  },
  {
    id: "live-title", name: "Live title", type: "text", parent: "live",
    props: text({ text: "Live-Daten", fontWeight: 500, fill: "#f4f9ee" }),
    keyframes: {
      x: grow("x", TITLE.s.x, TITLE.b.x),
      y: grow("y", TITLE.s.y, TITLE.b.y),
      fontSize: grow("fontSize", 48, 104),
      letterSpacing: grow("letterSpacing", -0.96, -2.08),
      opacity: fadeIn(LIVE_IN + 10),
    },
  },
  {
    id: "live-desc", name: "Live description", type: "text", parent: "live",
    props: text({ text: "Der Markt, in Echtzeit.", fontWeight: 400, fill: "#f4f9ee" }),
    keyframes: {
      x: grow("x", DESC.s.x, DESC.b.x),
      y: grow("y", DESC.s.y, DESC.b.y),
      fontSize: grow("fontSize", 28, 64),
      letterSpacing: grow("letterSpacing", -0.56, -1.28),
      opacity: fadeIn(LIVE_IN + 13),
    },
  },
  {
    id: "live-lines",
    name: "Live lines",
    type: "generator",
    parent: "live",
    matte: "live-clip",
    label: "#D9F9B9",
    props: { generator: "liveLines", anchorX: 0, anchorY: 0, wave: 0.02, shimmer: 0.06 },
    keyframes: {
      x: grow("x", CHART.s.x, CHART.b.x),
      y: grow("y", CHART.s.y, CHART.b.y),
      width: grow("width", 731, 1742),
      height: grow("height", 352.83, 711.7),
      lineWidth: grow("lineWidth", 22, 45.1),
      morph: grow("morph", 0, 1),
      draw: [k(LIVE_IN + 6, 0, S), k(LIVE_IN + 36, 1)],
      // Slow continuous flow — the market keeps moving.
      phase: [k(LIVE_IN, 0, "linear"), k(DURATION, +(((DURATION - LIVE_IN) / FPS) * 0.28).toFixed(3))],
    },
  },
  {
    id: "live-clip", name: "Card clip (matte)", type: "rect", parent: "live", label: "#9fdcc6",
    props: { fill: "#ffffff" },
    keyframes: {
      width: grow("width", CARD.w, BIG.w),
      height: grow("height", CARD.h, BIG.h),
      radius: grow("radius", 8, 16.4),
    },
  },
  {
    id: "live-card", name: "Live card", type: "rect", parent: "live",
    props: { fill: "#020203" },
    keyframes: {
      width: grow("width", CARD.w, BIG.w),
      height: grow("height", CARD.h, BIG.h),
      radius: grow("radius", 8, 16.4),
    },
  },

  // ================= SES-03 · title =================
  {
    id: "head",
    name: "Title (group)",
    type: "null",
    label: "#c5b9ee",
    start: f(TITLE_IN),
    end: f(EXP + 16),
    props: { x: 0, y: 0 },
    keyframes: {
      opacity: [k(EXP, 1, "easeIn"), k(EXP + 14, 0)],
      y: [k(EXP, 0, S), k(EXP + 16, -50)],
    },
  },
  ...["Wähle die Daten, mit", "denen du traden willst"].map((line, i) => ({
    id: `title-${i + 1}`,
    name: `Title line ${i + 1}`,
    type: "text",
    parent: "head",
    props: text({ text: line, fontWeight: 500, fontSize: 104, letterSpacing: -2.08, fill: "#0a1a1d", x: 118 }),
    keyframes: {
      y: [k(TITLE_IN + i * 3, 103 + i * 114.4 + 56, S), k(TITLE_IN + i * 3 + 20, 103 + i * 114.4)],
      opacity: fadeIn(TITLE_IN + i * 3, 10),
    },
  })),

  // ================= SES-03 · Replay card (pushed away on expand) =================
  {
    id: "replay",
    name: "Replay card (group)",
    type: "null",
    label: "#FFB947",
    start: f(REPLAY_IN),
    end: f(EXP + 18),
    props: { y: REPLAY_C.y },
    keyframes: {
      x: [k(EXP, REPLAY_C.x, S), k(EXP + 20, REPLAY_C.x + 260)],
      y: [k(REPLAY_IN, REPLAY_C.y + 90, S), k(REPLAY_IN + 22, REPLAY_C.y)],
      opacity: [k(REPLAY_IN, 0, "easeOut"), k(REPLAY_IN + 8, 1), k(EXP, 1, "easeIn"), k(EXP + 14, 0)],
      scale: [k(REPLAY_IN, 0.95, S), k(REPLAY_IN + 22, 1)],
    },
  },
  {
    id: "replay-chip",
    name: "Chip · Replay (group)",
    type: "null",
    parent: "replay",
    props: { x: CHART.s.x + 1.21, y: CHART.s.y + 1.21 },
    keyframes: { opacity: fadeIn(REPLAY_IN + 8) },
  },
  {
    id: "replay-chip-text", name: "Replay", type: "text", parent: "replay-chip",
    props: text({ text: "Replay", fontWeight: 500, fontSize: 29.025, letterSpacing: -0.5805, fill: "#F7F7F7", x: 64.89, y: 14.09 }),
  },
  {
    id: "rewind", name: "Rewind icon", type: "path", parent: "replay-chip",
    props: { d: REWIND_D, pathOrigin: "zero", x: 18.93, y: 20.42, fill: "#BFBFBF", strokeWidth: 0 },
  },
  {
    id: "replay-chip-bg", name: "Chip box", type: "rect", parent: "replay-chip",
    props: { anchorX: 0, anchorY: 0, width: 179.66, height: 60.19, radius: 4.838, fill: "rgba(0,0,0,0)", stroke: "rgba(244,249,238,0.24)", strokeWidth: 2 },
  },
  {
    id: "replay-title", name: "Replay title", type: "text", parent: "replay",
    props: text({ text: "Replay-Daten", fontWeight: 500, fontSize: 48, letterSpacing: -0.96, fill: "#F7F7F7", x: TITLE.s.x, y: TITLE.s.y }),
    keyframes: { opacity: fadeIn(REPLAY_IN + 10) },
  },
  {
    id: "replay-desc", name: "Replay description", type: "text", parent: "replay",
    props: text({ text: "Jede vergangene Session, Kerze für Kerze.", fontWeight: 400, fontSize: 28, letterSpacing: -0.56, fill: "#F7F7F7", x: DESC.s.x, y: DESC.s.y }),
    keyframes: { opacity: fadeIn(REPLAY_IN + 13) },
  },
  {
    id: "replay-chart",
    name: "Replay candles",
    type: "generator",
    parent: "replay",
    label: "#FFB947",
    props: { generator: "replayChart", anchorX: 0, anchorY: 0, x: CHART.s.x, y: CHART.s.y, width: 744, height: 352.83 },
    keyframes: {
      grid: [k(REPLAY_IN + 4, 0, S), k(REPLAY_IN + 22, 1)],
      progress: [k(REPLAY_IN + 8, 0, "sineInOut"), k(REPLAY_IN + 38, 1)],
    },
  },
  {
    id: "replay-card", name: "Replay card", type: "rect", parent: "replay",
    props: { width: CARD.w, height: CARD.h, radius: 8, fill: "#020203" },
  },

  // ================= transition =================
  {
    id: "wipe-paper",
    name: "Pixel wipe · paper",
    type: "generator",
    label: "#c5b9ee",
    start: f(WIPE2_IN),
    end: f(WIPE2_OUT),
    props: {
      generator: "pixelWipe", x: 966, y: 540, width: 2080, height: 1234.29, cols: 13, rows: 8,
      mode: "radial", originX: 0.664, originY: 0.523, sweep: 0.8, color: "#F4F9EE", accent: "#D9F9B9",
    },
    keyframes: { progress: [k(WIPE2_IN, 0, "sineInOut"), k(WIPE2_OUT, 1)] },
  },
  {
    id: "wipe-ink",
    name: "Pixel wipe · ink",
    type: "generator",
    label: "#c5b9ee",
    start: f(WIPE1_IN),
    end: f(WIPE2_OUT),
    props: {
      generator: "pixelWipe", x: 966, y: 540, width: 2080, height: 1234.29, cols: 13, rows: 8,
      mode: "radial", originX: 0.664, originY: 0.523, sweep: 0.8, color: "#0a1a1d", accent: "#D9F9B9",
    },
    keyframes: { progress: [k(WIPE1_IN, 0, "sineInOut"), k(WIPE1_OUT, 1)] },
  },

  // ================= SES-02 · create session (tail) =================
  ...ses02,
];

const shot = {
  name: "SES-02→04 · Create session → Live or replay → Live expands",
  note: "First pass from Figma (Motion test 4): button click from SES-02, ink/paper pixel wipe, title + Live/Replay cards build, hand clicks Live and the card grows to full frame",
  width: 1920,
  height: 1080,
  fps: FPS,
  duration: f(DURATION),
  background: "#F4F9EE",
  layers,
};

const dir = new URL("../shots/ses-03-live-or-replay/", import.meta.url);
mkdirSync(new URL("assets/", dir), { recursive: true });
copyFileSync(new URL("assets/hand-cursor.png", srcDir), new URL("assets/hand-cursor.png", dir));
writeFileSync(new URL("v001.json", dir), JSON.stringify(shot, null, 2) + "\n");
console.log(`wrote v001.json — ${shot.duration}s, ${layers.length} layers (SES-02 from ${latest})`);
