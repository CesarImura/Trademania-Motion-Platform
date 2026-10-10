# Motion Studio

A Next.js previewer/editor for motion shots. Claude writes shots as JSON scene
files; the user previews, tweaks them on an After Effects–style timeline, and
exports MP4. Run with `npm run dev` → http://localhost:3210.

## Workflow when the user asks for an animation

1. **New shot** → create `shots/<kebab-id>/v001.json`. Pick a short, descriptive
   id (e.g. `hero-logo-reveal`, `s03-pricing-cards`). For a big project, prefix
   ids with the scene/shot number so the gallery sorts sensibly.
2. **Change to an existing shot** → never overwrite. Read the **latest**
   `vNNN.json` (the user may have tweaked and saved it in the editor), then write
   the next number (`v004.json`) with a `note` that says what changed. The open
   editor auto-loads it within ~1s.
   - Exception: if the user explicitly says "fix it in place" or it's a broken
     file, edit the current version.
3. Keep the JSON valid and 2-space indented. Times are seconds; snap them to the
   shot's frame grid (multiples of `1/fps`) when practical.
4. Images go in `shots/<id>/assets/` and are referenced as `"src": "logo.png"`.
5. Exports land in `exports/<id>/` (written by the app — don't write there).

## Scene format (`src/lib/types.ts`, defaults in `src/lib/props.ts`)

```jsonc
{
  "name": "Hero logo reveal",
  "note": "What changed in this version",       // shown in gallery + version menu
  "width": 1920, "height": 1080, "fps": 30, "duration": 4,
  "background": "#0d0d12",
  "layers": [                                    // FIRST layer renders ON TOP
    {
      "id": "title",                             // unique, stable; used for parenting
      "name": "Title",
      "type": "text",                            // rect | ellipse | text | image | path | generator | null
      "parent": "emblem",                        // optional: inherit that layer's transform
      "matte": "list-mask",                      // optional: AE track matte (alpha of that layer)
      "matteMode": "inverse",                    // optional: show where the matte is transparent
      "start": 0.5, "end": 4,                    // optional in/out points (default whole shot)
      "hidden": false, "locked": false,
      "props": { "x": 960, "y": 540, "text": "Hello", "fill": "#fff" },   // static values
      "keyframes": {                             // animated props (overrides props[key])
        "opacity": [ { "t": 0, "v": 0, "ease": "easeOut" }, { "t": 0.6, "v": 1 } ]
      }
    }
  ]
}
```

- A keyframe's `ease` controls the segment **leaving** that keyframe. Names:
  `linear hold easeIn easeOut easeInOut sineIn sineOut sineInOut quadIn quadOut quadInOut expoIn expoOut
  expoInOut backIn backOut backInOut elasticOut bounceOut spring smooth snappy
  anticipate figmaGentle figmaQuick figmaBouncy figmaSlow figmaGentleIn figmaSlowIn`, or a cubic-bezier array
  `[x1, y1, x2, y2]`. The `figma*` eases are Figma's spring presets (same physics),
  time-fit to the segment; `figmaSlowIn`/`figmaGentleIn` are the same springs
  played backwards (gentle start, fastest at the end). **House style: `figmaSlow` for motion** (starts gentle,
  picks up, settles) — the user asked for it over expo/linear. Give spring segments
  ≥ 0.4s so the gentle start reads.
- Numbers and colors interpolate; strings (text, font, enums) hold.
- Colors: `#rgb`, `#rrggbb`, `#rrggbbaa`, `rgba()`, named colors. Use
  `rgba(0,0,0,0)` for "none".

### Transform (all layer types)
`x, y` (position of the anchor point, in parent space — shot pixels for
unparented layers), `anchorX, anchorY` (0–1 within the layer's box; default 0.5
= centered), `scale, scaleX, scaleY` (multipliers), `rotation` (degrees),
`opacity` (0–1).

### Effects (all but null)
`blur`, `shadowColor`, `shadowBlur`, `shadowX`, `shadowY`, `blend` (normal, overlay,
screen, multiply, soft-light, lighten, darken, color-dodge, lighter). Rect and
ellipse also take `backdropBlur` (frosted glass: blurs what's drawn beneath,
clipped to the shape — CSS `backdrop-filter: blur()` ports 1:1).

### Gradient fill (rect, ellipse, text, path)
`fillType` (solid/linear/radial), `gradientStops` (`"rgba(...) 0, #fff 0.5, ..."`,
positions 0–1), `gradientAngle` (CSS degrees: 180 = top→bottom), `gradientScale`
(radial: 1 = CSS `farthest-corner`, so CSS radial-gradients port 1:1),
`gradientShift` (slide along the axis, in gradient lengths — animate for
shimmers), `gradientRepeat` (yes = tile; shift then loops seamlessly).

### Groups and mattes
- A **null's** `opacity` multiplies into all its descendants and its `blur`
  adds to theirs — use nulls as groups (rows, cards, the whole orb).
- A null with `isolate: "yes"` renders its descendants as one group (AE precomp)
  and can apply a depth-of-field blur ramp: `rampBlur` (max px) from `rampStart`
  to `rampEnd` (shot-space y). Used for the "blur coming from the bottom".
  Its `opacity` applies once to the finished group (not per child), and so does
  its own `blur` plus any parent nulls' `blur` (cheap: computed downsampled).
  It can also apply a **focus plane** (lens depth of field): `focusBlur` (max px)
  keeps the group sharp within `focusRange` of a line through `focusX/focusY`
  (shot space) at `focusAngle` (0 = horizontal), blurring smoothly to the max over
  `focusFalloff` px on both sides. Animate the point/angle for a rack focus —
  that's how a giant blurred glyph gets "part crisp, part melting". **Translucent
  connected strokes (trees, connectors) must be drawn solid inside an isolated
  group with the group faded** — separate translucent layers brighten where they
  overlap (the user called this out).
- `"matte": "<layer id>"` shows the layer only where the matte layer has alpha
  (e.g. a gradient rect to fade a scrolling list at its edges). Layers used as
  mattes are not drawn on their own.

### Per type
- **rect**: `width height radius fill stroke strokeWidth`
- **ellipse**: `width height fill stroke strokeWidth arcStart arcEnd` (0–1,
  starting at 12 o'clock; with a stroke it draws an arc, otherwise a pie)
- **text**: `text` (use `\n` for lines) `fontFamily` (any Google Font, loaded
  automatically) `fontWeight fontSize letterSpacing lineHeight align`
  (left/center/right) `fill stroke strokeWidth reveal` (0–1 typewriter)
  `maxWidth` (auto-wrap, 0 = off). `{counter}` in the text is replaced by the
  animatable `counter` prop with `counterDecimals` (e.g. "Thinking for {counter}s").
  CSS line boxes port as `lineHeight = cssLineHeight / fontSize`, `anchorY: 0`.
- **image**: `src width height radius` (set one of width/height to keep aspect)
- **path**: `d` (SVG path data, in layer space) `fill stroke strokeWidth
  lineCap trimStart trimEnd` (0–1, for draw-on effects). Its box is the path's
  bounding box, so anchor 0.5/0.5 is the path's center. `pathOrigin: "zero"` uses
  the path's own coordinates instead (x/y offset its 0,0) — use it for curves.
- **generator**: procedural visuals drawn by code (`src/lib/generators.ts`):
  `generator` (name) `width height` + that generator's own params, which are
  keyframable like any prop. Current: `asciiRings` (Figma "Dither" layer: glyph
  grid whose opacity follows concentric radial rings — use with `blend: overlay`;
  `ringShift` ripples it), `ditherField` (ASCII glow field: `intensity
  coverage floor edgeFade`), `ditherOrb` (ASCII-dithered orb: `lighting`
  classic/studio with key light, dark core and rim; `scramble`/`scrambleRate` for
  glyphs re-rolling while "working"; `grain blobs vignette glyphAlpha`), `tmBackdrop`
  (Trademania V3 page/button background: base color + two blurred dark ellipses
  + noise + white glyph dither blended `overlay`, alpha ringing out from
  `ringX/ringY`; `glyphReveal ringShift scramble`; `b2Color` tints blob 2, e.g. Figma's
  light ellipse), `pixelWipe` (grid cells flip
  on with an accent flash: `progress cols rows color accent sweep angle`), `pixelStages`
  (reference-style staged cells: dots → tinted → full as `progress` 0→1, full → tint →
  off as `clear` 0→1; `output: mask` mattes a `tmBackdrop`, `output: dots` draws the
  halftone — use both with the same keys, see `trd-02-trading-analysing`), `liveLines` (Trademania Live card's glowing red/green lines from the
  Figma paths: `morph` small→big card shape, `draw`, `phase`/`wave` flow), `replayChart`
  (Replay card candles + dashed guides: `progress` pops candles in left→right). When a shot needs something
  keyframes can't express (noise, particles, dithering), add a generator there —
  pure function of `t` + params — rather than faking it with hundreds of keys.
  Generators are rendered into an offscreen buffer when blurred or faded, so
  blur/opacity apply to the whole layer (never per draw call — that's slow and
  looks wrong).
- **null**: invisible; use as a parent to move groups together. Its origin is
  its `x, y`, so children are positioned relative to it.

### Motion tips
- Prefer a few well-eased keyframes over many linear ones.
- Stagger related elements by 2–4 frames for a natural feel.
- Group with a `null` parent instead of duplicating keyframes across layers.

## Importing animations from Claude chat artifacts
Read the artifact (Artifact tool, `action: "read"`), port its timing model into a
script under `scripts/` (see `scripts/import-trademania-v3.mjs`) that samples the
original formulas at keyframe times and writes `shots/<id>/v001.json`. Rig with
nulls (layout origin, camera, groups) so the user can retime whole sections.
Measure text widths in the browser when layout depends on them.

## Figma source for Trademania V3
File `3ajjpzYjyjfDJyp2Jrfvbl`, frame `15781:15020` ("SES-06 · Thinking · Timeline").
Reference renders live in `shots/trademania-v3-thinking/assets/` (`figma-frame.png`,
`ref-orb.webp`). Compare renders against them side by side before reporting.

## Brand
UI and default colors follow the Trademania palette: lime `#D9F9B9`, paper
`#F4F9EE`, mint `#9fdcc6`, sand `#e6d3a3`, lilac `#c5b9ee`, stage `#0F0F12`,
font Geist / Geist Mono. Icons: IBM Carbon (`@carbon/icons-react`, size 16 in
buttons, 14 in timeline rows) — never emojis or unicode glyphs as icons.

## Code map
- `src/lib/` — engine: `types`, `easing`, `props` (prop catalog + defaults),
  `generators` (procedural layers),
  `animate` (evaluation + edit helpers), `render` (canvas renderer, hit-testing,
  font/image loading), `export` (WebCodecs H.264 → MP4 via mp4-muxer),
  `store` (server-side file storage).
- `src/app/api/` — `shots` (list/create), `shots/[id]` (versions / new version),
  `shots/[id]/[v]` (read/overwrite), `assets`, `exports`.
- `src/components/` — `Gallery`, `Editor` (+ `useEditor` for versions, undo,
  disk polling), `Viewer`, `Timeline`, `Inspector`, `ExportDialog`.
- Rendering is deterministic for a given time, so preview == export. Export
  needs a Chromium-based browser (WebCodecs).
