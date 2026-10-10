// BRN-10 → BRN-13 ending (Trademania V3, Figma "Section 8", node 15961:28497),
// played over the Trademania platform (Figma "Watchlist · Default", 13007:112007):
//
//   BRN-10  "Es antwortet nicht nur. Es { zeichnet } deinen Chart." over the dimmed platform
//   BRN-11  status card "Zeichne Support-Zone…"   → the AI draws a support zone on the chart
//   BRN-12  "Zeichne Target…"                      → entry, target and stop draw on
//   BRN-13  "Füge Indikatoren hinzu…" (whip down)  → the Anchor curve draws on, volume lights up
//
// The platform UI is a static render (assets/platform.png). Its chart plot area is
// covered and rebuilt as vector layers (grid, axis labels, candles, Anchor curve,
// volume) from the Figma chart instance, so the AI's drawings can happen on it.
// All chart geometry is in platform pixels (1920×1386); a camera null frames it.

import { readFileSync } from "node:fs";

const DATA = new URL("../data/", import.meta.url);

export function buildEnding({ start: E0, fps }) {
  const f = (n) => +(n / fps).toFixed(4);
  const k = (frame, v, ease) => (ease ? { t: f(frame), v, ease } : { t: f(frame), v });
  const r2 = (v) => +v.toFixed(2);
  const at = (n) => E0 + n; // frames from the start of the ending

  // ---------- timeline (frames from E0) ----------
  const T = {
    row1: 0, braces: 14, open: 30, openLen: 30, headOut: 96,
    s1: 100, s2: 168, s3: 236, end: 330,
  };

  // ---------- platform geometry (Figma) ----------
  const F = { x: 426, y: 211, w: 1482, h: 476 }; // chart plot frame ("Frame 2147241221")
  const fx = (x) => r2(F.x + x), fy = (y) => r2(F.y + y);
  // Price scale: the Anchor/crosshair reads 62,688 at plot y 237.5, ~4 $/px.
  const price = (y) => Math.round(62688 + (237.5 - y) * 4);
  const fmt = (n) => n.toLocaleString("en-US");

  // Rescale absolute SVG path data (M/L/H/V/C/Z) from the export's viewBox to layout size.
  const rescale = (d, sx, sy, ox, oy) => {
    const out = [];
    for (const [, cmd, args] of d.matchAll(/([MLHVCZ])([^MLHVCZ]*)/g)) {
      const n = (args.match(/-?[\d.]+(?:e-?\d+)?/g) || []).map(Number);
      const xy = n.map((v, i) => (cmd === "H" ? ox + v * sx : cmd === "V" ? oy + v * sy : i % 2 ? oy + v * sy : ox + v * sx));
      out.push(cmd + xy.map(r2).join(" "));
    }
    return out.join("");
  };

  // Candles: the Figma group export (1709.51 wide) laid into its 1375.4 × 312 box.
  const candleSvg = readFileSync(new URL("brn-10-candles.svg", DATA), "utf8");
  const CSX = 1375.4 / 1709.51, COX = fx(30.71), COY = fy(47);
  const groups = { "#00D16F": { body: [], wick: [] }, "#FF6479": { body: [], wick: [] } };
  for (const m of candleSvg.matchAll(/<path[^>]*>/g)) {
    const tag = m[0], d = tag.match(/ d="([^"]+)"/)[1];
    const fill = (tag.match(/fill="(#[0-9A-F]+)"/) || [])[1], stroke = (tag.match(/stroke="(#[0-9A-F]+)"/) || [])[1];
    const g = groups[fill || stroke];
    if (g) (fill ? g.body : g.wick).push(rescale(d, CSX, 1, COX, COY));
  }
  // Anchor curve (1712.87 × 175 export → 1378.07 × 174 box).
  const curveD = readFileSync(new URL("brn-10-anchor-curve.svg", DATA), "utf8").match(/ d="([^"]+)"/)[1];
  const CURVE = rescale(curveD, 1378.07 / 1712.87, 174 / 175, fx(28.05), fy(156) - 0.5);
  // Volume bars (Figma: 120 flex bars, 10.625 wide, 1px gap, bottom-aligned at plot y 445).
  const VOL = JSON.parse(readFileSync(new URL("brn-10-volume.json", DATA), "utf8")); // [height, "up" | "down"]
  const volBars = { up: [], down: [] };
  VOL.forEach(([h, dir], i) => {
    const x = fx(16 + i * 11.625), y = fy(445) - h;
    volBars[dir].push(`M${r2(x)} ${r2(y)}H${r2(x + 10.625)}V${fy(445)}H${r2(x)}Z`);
  });
  // Grid (dashed, white 5%): 9 price rows, 7 time columns.
  const ROWS = [0, 54.625, 109.25, 163.875, 218.5, 273.125, 327.75, 382.375, 437];
  const COLS = [0, 232.5, 465, 697.5, 930, 1162.5, 1395];
  const dashH = (x0, len, y) => Array.from({ length: Math.ceil(len / 10) }, (_, i) => `M${r2(x0 + i * 10)} ${r2(y)}H${r2(Math.min(x0 + len, x0 + i * 10 + 5))}`).join("");
  const dashV = (x, y0, len) => Array.from({ length: Math.ceil(len / 10) }, (_, i) => `M${r2(x)} ${r2(y0 + i * 10)}V${r2(Math.min(y0 + len, y0 + i * 10 + 5))}`).join("");
  const GRID = ROWS.map((y) => dashH(fx(13), 1397, fy(y + 9) + 0.5)).join("") + COLS.map((x) => dashV(fx(x + 16) + 0.5, fy(8), 435.9)).join("");

  // ---------- the AI's drawings (plot coordinates) ----------
  const ZONE = { x0: 40, x1: 1397, y0: 286, y1: 330 }; // touched at the three swing lows below
  const TOUCHES = [[68.7, 323], [407.7, 323], [744.7, 291]];
  const TRADE = { x0: 762, x1: 1150, entry: 290, stop: 340, target: 100 };
  const rr = ((price(TRADE.target) - price(TRADE.entry)) / (price(TRADE.entry) - price(TRADE.stop))).toFixed(1);

  // ---------- camera (platform point at screen center, zoom) ----------
  const CAM = {
    head: { cx: 960, cy: 540, s: 1 },
    s1: { cx: 1145, cy: 405, s: 1.2 },
    s2: { cx: 988, cy: 431, s: 1.5 },
    s3: { cx: 1140, cy: 600, s: 1.15 },
  };
  const camKeys = (prop) => [
    k(at(0), prop === "s" ? CAM.head.s : CAM.head[prop], "linear"),
    k(at(T.headOut), prop === "s" ? 1.05 : CAM.head[prop], "figmaSlow"),
    k(at(T.s1 + 30), CAM.s1[prop], "hold"),
    k(at(T.s2 - 2), CAM.s1[prop], "figmaSlow"),
    k(at(T.s2 + 30), CAM.s2[prop], "hold"),
    // Whip pan down to the indicator area.
    k(at(T.s3), CAM.s2[prop], "expoInOut"),
    k(at(T.s3 + 16), CAM.s3[prop], "linear"),
    k(at(T.end), prop === "s" ? CAM.s3.s * 1.02 : CAM.s3[prop]),
  ];
  const live = { start: f(E0) };
  const P = "end-plat";

  // ---------- helpers ----------
  const text = (id, name, parent, props, extra = {}) => ({
    id, name, type: "text", parent, ...live, ...extra,
    props: { fontFamily: "Geist", align: "left", anchorX: 0, anchorY: 0, ...props },
  });
  const path = (id, name, d, props, extra = {}) => ({
    id, name, type: "path", parent: P, ...live, ...extra,
    props: { d, pathOrigin: "zero", x: 0, y: 0, fill: "rgba(0,0,0,0)", stroke: "rgba(0,0,0,0)", strokeWidth: 0, ...props },
  });
  const pop = (fr) => ({
    opacity: [k(fr, 0, "easeOut"), k(fr + 8, 1)],
    scale: [k(fr, 0.6, "figmaBouncy"), k(fr + 24, 1)],
  });
  /** Small chart tag like the platform's ENTRY/STOP labels. */
  const tag = (id, label, value, x, y, bg, fr, color = "#0F0F12") => [
    { id, name: `Tag · ${label}`, type: "null", parent: P, ...live, props: { x: r2(x), y: r2(y) }, keyframes: pop(fr) },
    text(`${id}-text`, `${label} ${value}`, id, {
      text: `${label} ${value}`, fontFamily: "Geist Mono", fontWeight: 500, fontSize: 12, lineHeight: 1.5, fill: color, x: 6, y: -9,
    }),
    { id: `${id}-bg`, name: "Tag surface", type: "rect", parent: id, ...live, props: { anchorX: 0, x: 0, y: 0, width: (label.length + value.length + 1) * 7.3 + 12, height: 22, radius: 2, fill: bg } },
  ];

  // ---------- headline ----------
  const H = { size: 104, ls: -2.08, lh: 1.08 };
  const W = { Es: 115.63, brace: 39.67, z: 410.86, dc: 639.46 }; // Geist 600 104px (measured in Chrome)
  const open = { Es: 288.35, ob: 431.98, z: 492.65, cb: 924.51, dc: 992.18 };
  const closed = { Es: 511.8, ob: 655.43, cb: 701.1, dc: 768.77 };
  const o0 = at(T.open), o1 = at(T.open + T.openLen);
  const word = (id, t, xClosed, xOpen, from = at(T.braces)) =>
    text(id, t, undefined, { text: t, fontWeight: 600, fontSize: H.size, letterSpacing: H.ls, lineHeight: H.lh, fill: "#ffffff", y: 540 }, {
      keyframes: {
        x: [k(o0, xClosed, "figmaSlow"), k(o1, xOpen)],
        opacity: [k(from, 0, "easeOut"), k(from + 10, 1), k(at(T.headOut), 1, "easeIn"), k(at(T.headOut + 14), 0)],
        blur: [k(from, 10, "easeOut"), k(from + 14, 0), k(at(T.headOut), 0, "easeIn"), k(at(T.headOut + 14), 14)],
      },
      end: f(at(T.headOut + 15)),
    });
  const headline = [
    text("end-row1", "Es antwortet nicht nur.", undefined, {
      text: "Es antwortet nicht nur.", fontWeight: 600, fontSize: H.size, letterSpacing: H.ls, lineHeight: H.lh, fill: "#ffffff",
      align: "center", anchorX: 0.5, x: 960,
    }, {
      end: f(at(T.headOut + 15)),
      keyframes: {
        y: [k(at(T.row1), 458, "figmaSlow"), k(at(T.row1 + 30), 428)],
        opacity: [k(at(T.row1), 0, "easeOut"), k(at(T.row1 + 14), 1), k(at(T.headOut), 1, "easeIn"), k(at(T.headOut + 14), 0)],
        blur: [k(at(T.row1), 12, "easeOut"), k(at(T.row1 + 18), 0), k(at(T.headOut), 0, "easeIn"), k(at(T.headOut + 14), 14)],
      },
    }),
    word("end-es", "Es", closed.Es, open.Es),
    // The braces snap in together, then spread apart as "zeichnet" writes on between them.
    { ...word("end-ob", "{", closed.ob, open.ob), keyframes: { ...word("end-ob", "{", closed.ob, open.ob).keyframes, scale: [k(at(T.braces), 1.25, "figmaBouncy"), k(at(T.braces + 18), 1)] } },
    {
      ...word("end-z", "zeichnet", closed.ob + W.brace + 21, open.z, o0),
      keyframes: {
        ...word("end-z", "zeichnet", closed.ob + W.brace + 21, open.z, o0).keyframes,
        x: [k(o0, r2(closed.ob + W.brace + 21), "figmaSlow"), k(o1, open.z)],
        reveal: [k(o0 + 4, 0, "linear"), k(o1, 1)],
        opacity: [k(o0, 1, "hold"), k(at(T.headOut), 1, "easeIn"), k(at(T.headOut + 14), 0)],
        fill: [k(o0, "#d2ffa4", "easeOut"), k(o1 + 20, "#ffffff")],
      },
    },
    { ...word("end-cb", "}", closed.cb, open.cb), keyframes: { ...word("end-cb", "}", closed.cb, open.cb).keyframes, scale: [k(at(T.braces), 1.25, "figmaBouncy"), k(at(T.braces + 18), 1)] } },
    word("end-dc", "deinen Chart.", closed.dc, open.dc),
  ];

  // ---------- status card (one card, text swaps, width eases to fit) ----------
  const CW = [728, 539, 746];
  const STEPS = ["Zeichne Support-Zone…", "Zeichne Target…", "Füge Indikatoren hinzu…"];
  const sT = [T.s1, T.s2, T.s3];
  const widthKeys = (map) => [
    k(at(T.s1), map(CW[0]), "hold"),
    k(at(T.s2), map(CW[0]), "figmaSlow"), k(at(T.s2 + 14), map(CW[1]), "hold"),
    k(at(T.s3), map(CW[1]), "figmaSlow"), k(at(T.s3 + 14), map(CW[2])),
  ];
  const progress = (w, i) => w * (i + 1) / 3;
  const card = [
    {
      id: "end-card", name: "Status card (group)", type: "null", label: "#D9F9B9", ...live, start: f(at(T.s1)),
      props: { x: 960, y: 540 },
      keyframes: {
        opacity: [k(at(T.s1), 0, "easeOut"), k(at(T.s1 + 10), 1)],
        scale: [k(at(T.s1), 0.88, "figmaBouncy"), k(at(T.s1 + 30), 1)],
        blur: [k(at(T.s1), 8, "easeOut"), k(at(T.s1 + 14), 0)],
      },
    },
    ...STEPS.map((s, i) => text(`end-step${i + 1}`, s, "end-card", {
      text: s, fontWeight: 500, fontSize: 56, letterSpacing: -0.56, lineHeight: 72 / 56, fill: "#f4f9ee", anchorY: 0.5, y: 0,
      x: r2(-CW[i] / 2 + 80),
    }, {
      start: f(at(sT[i] + (i ? 10 : 6))), ...(i < 2 ? { end: f(at(sT[i + 1])) } : {}),
      keyframes: { reveal: [k(at(sT[i] + (i ? 10 : 6)), 0, "linear"), k(at(sT[i] + (i ? 30 : 26)), 1)] },
    })),
    {
      id: "end-pixel", name: "Pixel", type: "rect", parent: "end-card", ...live, start: f(at(T.s1)),
      props: { width: 16, height: 16, fill: "#d2ffa4", shadowColor: "rgba(210,255,164,0.8)", shadowBlur: 16, y: 0 },
      keyframes: {
        x: widthKeys((w) => r2(-w / 2 + 48)),
        // "Working" pulse; solid once all three steps are done.
        opacity: [
          ...Array.from({ length: Math.floor((T.end - T.s1) / 14) }, (_, j) => k(at(T.s1 + j * 14), j % 2 ? 0.35 : 1, "sineInOut"))
            .filter((kf) => kf.t < f(at(T.s3 + 60))),
          k(at(T.s3 + 60), 1),
        ],
      },
    },
    {
      id: "end-progress", name: "Progress", type: "rect", parent: "end-card", ...live, start: f(at(T.s1)),
      props: { anchorX: 0, height: 2, fill: "#d2ffa4", y: 67 },
      keyframes: {
        x: widthKeys((w) => r2(-w / 2)),
        width: [
          k(at(T.s1 + 6), 0, "figmaSlow"), k(at(T.s1 + 60), r2(progress(CW[0], 0)), "hold"),
          k(at(T.s2), r2(progress(CW[0], 0)), "figmaSlow"), k(at(T.s2 + 14), r2(CW[1] / 3), "figmaSlow"), k(at(T.s2 + 60), r2(progress(CW[1], 1)), "hold"),
          k(at(T.s3), r2(progress(CW[1], 1)), "figmaSlow"), k(at(T.s3 + 14), r2(CW[2] * 2 / 3), "figmaSlow"), k(at(T.s3 + 60), CW[2]),
        ],
      },
    },
    {
      id: "end-track", name: "Progress track", type: "rect", parent: "end-card", ...live, start: f(at(T.s1)),
      props: { anchorX: 0, height: 2, fill: "rgba(255,255,255,0.08)", y: 67 },
      keyframes: { x: widthKeys((w) => r2(-w / 2)), width: widthKeys((w) => w) },
    },
    {
      id: "end-card-bg", name: "Card surface", type: "rect", parent: "end-card", ...live, start: f(at(T.s1)),
      props: {
        height: 136, radius: 8, fill: "rgba(7,9,9,0.72)", stroke: "rgba(210,255,164,0.9)", strokeWidth: 1, backdropBlur: 16,
        shadowColor: "rgba(210,255,164,0.22)", shadowBlur: 80,
      },
      keyframes: {
        width: widthKeys((w) => w),
        // Completion glow once 3/3 is reached.
        shadowBlur: [k(at(T.s3 + 58), 80, "expoOut"), k(at(T.s3 + 64), 130, "sineInOut"), k(at(T.end), 90)],
      },
    },
  ];

  // ---------- drawings (on top of the dim overlay) ----------
  const z0 = at(T.s1 + 16), z1 = at(T.s1 + 60);
  const zoneW = ZONE.x1 - ZONE.x0, zoneH = ZONE.y1 - ZONE.y0;
  const draw = (a, b) => ({ trimEnd: [k(a, 0, "figmaSlow"), k(b, 1)] });
  const lineD = (x0, x1, y) => `M${fx(x0)} ${fy(y)}H${fx(x1)}`;
  const tE = at(T.s2 + 18), tT = at(T.s2 + 30), tS = at(T.s2 + 36);
  const tradeW = TRADE.x1 - TRADE.x0;
  const drawings = [
    // Step 3: indicator legend + Anchor curve.
    ...tag("end-anchor-tag", "ANCHOR", fmt(price(237.5)), fx(TRADE.x1 + 20), fy(150), "#DCA738", at(T.s3 + 30)),
    path("end-curve", "Anchor curve (draws on)", CURVE, { stroke: "#DCA738", strokeWidth: 1.6, shadowColor: "rgba(220,167,56,0.6)", shadowBlur: 10 }, {
      start: f(at(T.s3 + 14)), keyframes: draw(at(T.s3 + 14), at(T.s3 + 64)),
    }),
    // Step 2: entry / target / stop (platform colors).
    ...tag("end-target-tag", "TARGET", fmt(price(TRADE.target)), fx(TRADE.x0) + 8, fy(TRADE.target) + 14, "#00D16F", tT + 10),
    ...tag("end-entry-tag", "ENTRY", fmt(price(TRADE.entry)), fx(TRADE.x0) + 8, fy(TRADE.entry) - 14, "#E8A13A", tE + 8),
    ...tag("end-stop-tag", "STOP", fmt(price(TRADE.stop)), fx(TRADE.x0) + 8, fy(TRADE.stop) + 14, "#FF6479", tS + 10),
    ...tag("end-rr-tag", "R:R", rr, fx(TRADE.x1) - 80, fy((TRADE.entry + TRADE.target) / 2), "rgba(0,209,111,0.25)", tT + 20, "#d7ffe9"),
    path("end-target-line", "Target line", lineD(TRADE.x0, TRADE.x1, TRADE.target), { stroke: "#00D16F", strokeWidth: 1.5 }, { start: f(tT), keyframes: draw(tT, tT + 22) }),
    path("end-stop-line", "Stop line", lineD(TRADE.x0, TRADE.x1, TRADE.stop), { stroke: "#FF6479", strokeWidth: 1.5 }, { start: f(tS), keyframes: draw(tS, tS + 22) }),
    path("end-entry-line", "Entry line", lineD(TRADE.x0, TRADE.x1, TRADE.entry), { stroke: "#E8A13A", strokeWidth: 1.5 }, { start: f(tE), keyframes: draw(tE, tE + 22) }),
    {
      id: "end-target-box", name: "Target box", type: "rect", parent: P, ...live, start: f(tT - 4),
      props: { anchorX: 0, anchorY: 1, x: fx(TRADE.x0), y: fy(TRADE.entry), width: tradeW, fill: "rgba(0,209,111,0.16)" },
      keyframes: { height: [k(tT - 4, 0, "figmaSlow"), k(tT + 22, TRADE.entry - TRADE.target)] },
    },
    {
      id: "end-stop-box", name: "Stop box", type: "rect", parent: P, ...live, start: f(tS - 4),
      props: { anchorX: 0, anchorY: 0, x: fx(TRADE.x0), y: fy(TRADE.entry), width: tradeW, fill: "rgba(255,100,121,0.16)" },
      keyframes: { height: [k(tS - 4, 0, "figmaSlow"), k(tS + 22, TRADE.stop - TRADE.entry)] },
    },
    // Step 1: support zone, with the three touches it is based on.
    ...TOUCHES.flatMap(([x, y], i) => {
      const fr = Math.round(z0 + ((x - ZONE.x0) / zoneW) * (z1 - z0));
      return [{
        id: `end-touch-${i}`, name: `Touch ${i + 1}`, type: "ellipse", parent: P, ...live, start: f(fr),
        props: { x: fx(x), y: fy(y), width: 10, height: 10, fill: "#d2ffa4", shadowColor: "rgba(210,255,164,0.9)", shadowBlur: 14 },
        keyframes: { scale: [k(fr, 0, "figmaBouncy"), k(fr + 20, 1)], opacity: [k(fr, 1, "hold"), k(at(T.s2), 1, "easeOut"), k(at(T.s2 + 20), 0.5)] },
      }];
    }),
    ...tag("end-zone-tag", "SUPPORT", `${fmt(price(ZONE.y1))} – ${fmt(price(ZONE.y0))}`, fx(ZONE.x0), fy(ZONE.y0) - 16, "#d2ffa4", z1 - 6),
    path("end-zone-top", "Zone top", lineD(ZONE.x0, ZONE.x1, ZONE.y0), { stroke: "rgba(210,255,164,0.85)", strokeWidth: 1.5 }, { start: f(z0), keyframes: draw(z0, z1) }),
    path("end-zone-bottom", "Zone bottom", lineD(ZONE.x0, ZONE.x1, ZONE.y1), { stroke: "rgba(210,255,164,0.85)", strokeWidth: 1.5 }, { start: f(z0 + 3), keyframes: draw(z0 + 3, z1 + 3) }),
    {
      id: "end-zone", name: "Support zone", type: "rect", parent: P, ...live, start: f(z0),
      props: { anchorX: 0, x: fx(ZONE.x0), y: fy((ZONE.y0 + ZONE.y1) / 2), height: zoneH, fill: "rgba(210,255,164,0.14)" },
      keyframes: { width: [k(z0, 0, "figmaSlow"), k(z1, zoneW)] },
    },
    // Dims everything below it (the platform); the drawings above stay bright.
    {
      id: "end-overlay", name: "Overlay (dim)", type: "rect", ...live,
      props: { x: 960, y: 540, width: 1920, height: 1080, fill: "#000000" },
      keyframes: { opacity: [k(at(0), 0.64, "hold"), k(at(T.headOut), 0.64, "figmaSlow"), k(at(T.s1 + 20), 0.5)] },
    },
  ];

  // ---------- rebuilt chart plot ----------
  const legendX = 932, legendY = 183; // platform's "ANCHOR 62,688" legend, re-added in step 3
  const plot = [
    {
      id: "end-cam", name: "Ending camera (zoom)", type: "null", label: "#c5b9ee", ...live,
      props: { x: 960, y: 540 }, keyframes: { scale: camKeys("s") },
    },
    {
      id: P, name: "Platform (pan)", type: "null", parent: "end-cam", label: "#c5b9ee", ...live,
      props: { x: -960, y: -540 },
      keyframes: {
        x: camKeys("cx").map((kf) => ({ ...kf, v: -kf.v })),
        y: camKeys("cy").map((kf) => ({ ...kf, v: -kf.v })),
        // Whip smear.
        blur: [k(at(T.s3 - 1), 0, "expoIn"), k(at(T.s3 + 7), 22, "expoOut"), k(at(T.s3 + 18), 0)],
      },
    },
    text("end-legend", "ANCHOR 62,688 (legend)", P, {
      text: `ANCHOR ${fmt(price(237.5))}`, fontFamily: "Geist Mono", fontWeight: 500, fontSize: 12, lineHeight: 1.33, fill: "#DCA738", x: legendX, y: legendY,
    }, { start: f(at(T.s3 + 30)), keyframes: { opacity: [k(at(T.s3 + 30), 0, "easeOut"), k(at(T.s3 + 40), 1)] } }),
    {
      id: "end-legend-cover", name: "Legend cover", type: "rect", parent: P, ...live,
      props: { anchorX: 0, anchorY: 0, x: legendX - 2, y: legendY - 1, width: 100, height: 18, fill: "#0F0F12" },
    },
    path("end-candles-up-body", "Candles · up", groups["#00D16F"].body.join(""), { fill: "#00D16F", stroke: "#00D16F", strokeWidth: 1 }),
    path("end-candles-up-wick", "Wicks · up", groups["#00D16F"].wick.join(""), { stroke: "#00D16F", strokeWidth: 1 }),
    path("end-candles-down-body", "Candles · down", groups["#FF6479"].body.join(""), { fill: "#FF6479", stroke: "#FF6479", strokeWidth: 1 }),
    path("end-candles-down-wick", "Wicks · down", groups["#FF6479"].wick.join(""), { stroke: "#FF6479", strokeWidth: 1 }),
    // Volume: faint, lights up when the indicators are added.
    ...[["up", "#00D16F"], ["down", "#FF6479"]].map(([key, color]) => path(`end-vol-${key}`, `Volume · ${key}`, volBars[key].join(""), { fill: color, opacity: 0.1 }, {
      keyframes: { opacity: [k(at(T.s3 + 20), 0.1, "figmaSlow"), k(at(T.s3 + 50), 0.4)] },
    })),
    ...ROWS.map((y, i) => text(`end-price-${i}`, "Price label", P, {
      text: fmt(price(y + 9)), fontSize: 12, lineHeight: 1.5, fill: "rgba(255,255,255,0.4)", x: fx(1426), y: fy(y),
    })),
    ...COLS.map((x, i) => text(`end-time-${i}`, "Time label", P, {
      text: `6:${String(i * 5).padStart(2, "0")}`, fontSize: 12, lineHeight: 1.5, fill: "rgba(255,255,255,0.4)", align: "center", anchorX: 0.5, x: fx(x + 16), y: fy(455.9),
    })),
    path("end-grid", "Grid", GRID, { stroke: "rgba(255,255,255,0.05)", strokeWidth: 1 }),
    {
      id: "end-plot-cover", name: "Plot cover (hides the baked chart)", type: "rect", parent: P, ...live,
      props: { anchorX: 0, anchorY: 0, x: F.x, y: F.y, width: F.w, height: F.h, fill: "#0F0F12" },
    },
    {
      id: "end-platform", name: "Platform UI (Figma render)", type: "image", parent: P, ...live,
      props: { src: "platform.png", anchorX: 0, anchorY: 0, x: 0, y: 0, width: 1920, height: 1386 },
    },
    {
      id: "end-platform-bg", name: "Platform backdrop (beyond the edges)", type: "rect", parent: P, ...live,
      props: { x: 960, y: 693, width: 3600, height: 2800, fill: "#0F0F12" },
    },
  ];

  return { layers: [...card, ...headline, ...drawings, ...plot], end: at(T.end) };
}
