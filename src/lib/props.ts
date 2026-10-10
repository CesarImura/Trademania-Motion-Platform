import { GENERATORS, GENERATOR_NAMES } from "./generators";
import type { Layer, LayerType, Value } from "./types";

export type PropKind = "number" | "color" | "text" | "enum" | "string";

export interface PropDef {
  key: string;
  label: string;
  kind: PropKind;
  default: Value;
  step?: number;
  min?: number;
  max?: number;
  options?: string[];
  group: "Transform" | "Content" | "Style" | "Effects";
}

const n = (
  key: string,
  label: string,
  def: number,
  group: PropDef["group"],
  extra: Partial<PropDef> = {},
): PropDef => ({ key, label, kind: "number", default: def, group, step: 1, ...extra });

const c = (key: string, label: string, def: string, group: PropDef["group"] = "Style"): PropDef => ({
  key,
  label,
  kind: "color",
  default: def,
  group,
});

const TRANSFORM: PropDef[] = [
  n("x", "Position X", 0, "Transform"),
  n("y", "Position Y", 0, "Transform"),
  n("anchorX", "Anchor X", 0.5, "Transform", { step: 0.01 }),
  n("anchorY", "Anchor Y", 0.5, "Transform", { step: 0.01 }),
  n("scale", "Scale", 1, "Transform", { step: 0.01 }),
  n("scaleX", "Scale X", 1, "Transform", { step: 0.01 }),
  n("scaleY", "Scale Y", 1, "Transform", { step: 0.01 }),
  n("rotation", "Rotation", 0, "Transform", { step: 0.5 }),
  n("opacity", "Opacity", 1, "Transform", { step: 0.01, min: 0, max: 1 }),
];

const EFFECTS: PropDef[] = [
  n("blur", "Blur", 0, "Effects", { step: 0.5, min: 0 }),
  c("shadowColor", "Shadow color", "rgba(0,0,0,0)", "Effects"),
  n("shadowBlur", "Shadow blur", 0, "Effects", { min: 0 }),
  n("shadowX", "Shadow X", 0, "Effects"),
  n("shadowY", "Shadow Y", 0, "Effects"),
  // Shutter in frames (0 = off, 0.5 = 180°): the layer is drawn as the average of
  // sub-frame samples over [t − shutter/fps, t], so fast moves smear like a camera.
  n("motionBlur", "Motion blur (shutter, frames)", 0, "Effects", { step: 0.05, min: 0 }),
  {
    key: "blend", label: "Blend mode", kind: "enum", default: "normal", group: "Effects",
    options: ["normal", "overlay", "screen", "multiply", "soft-light", "lighten", "darken", "color-dodge", "lighter"],
  },
];

// Gradient fill (rect, ellipse, text, path). Stops: "color pos, color pos, ..." with pos 0–1.
// Linear angle follows CSS (0 = to top, 90 = to right, 180 = to bottom). Radial is
// centered on the layer box; gradientScale 1 = CSS farthest-corner. gradientShift
// slides the gradient along its axis (in gradient lengths) — animate it for shimmers.
const GRADIENT: PropDef[] = [
  { key: "fillType", label: "Fill type", kind: "enum", default: "solid", options: ["solid", "linear", "radial"], group: "Style" },
  { key: "gradientStops", label: "Gradient stops", kind: "string", default: "#ffffff 0, #000000 1", group: "Style" },
  n("gradientAngle", "Gradient angle", 180, "Style"),
  n("gradientScale", "Gradient scale", 1, "Style", { step: 0.01, min: 0.01 }),
  n("gradientShift", "Gradient shift", 0, "Style", { step: 0.01 }),
  { key: "gradientRepeat", label: "Gradient repeat", kind: "enum", default: "no", options: ["no", "yes"], group: "Style" },
];

// Frosted glass (CSS backdrop-filter): blurs what's already drawn under the shape.
const BACKDROP = n("backdropBlur", "Background blur", 0, "Effects", { step: 0.5, min: 0 });

const BY_TYPE: Record<LayerType, PropDef[]> = {
  rect: [
    n("width", "Width", 200, "Content", { min: 0 }),
    n("height", "Height", 200, "Content", { min: 0 }),
    n("radius", "Corner radius", 0, "Content", { min: 0 }),
    c("fill", "Fill", "#ffffff"),
    c("stroke", "Stroke", "rgba(0,0,0,0)"),
    n("strokeWidth", "Stroke width", 0, "Style", { min: 0 }),
    ...GRADIENT,
    BACKDROP,
  ],
  ellipse: [
    n("width", "Width", 200, "Content", { min: 0 }),
    n("height", "Height", 200, "Content", { min: 0 }),
    c("fill", "Fill", "#ffffff"),
    c("stroke", "Stroke", "rgba(0,0,0,0)"),
    n("strokeWidth", "Stroke width", 0, "Style", { min: 0 }),
    n("arcStart", "Arc start", 0, "Content", { min: 0, max: 1, step: 0.01 }),
    n("arcEnd", "Arc end", 1, "Content", { min: 0, max: 1, step: 0.01 }),
    ...GRADIENT,
    BACKDROP,
  ],
  text: [
    { key: "text", label: "Text", kind: "text", default: "Text", group: "Content" },
    { key: "fontFamily", label: "Font", kind: "string", default: "Inter", group: "Content" },
    n("fontWeight", "Weight", 600, "Content", { step: 100, min: 100, max: 900 }),
    n("fontSize", "Size", 96, "Content", { min: 1 }),
    n("letterSpacing", "Tracking", 0, "Content", { step: 0.5 }),
    n("lineHeight", "Line height", 1.15, "Content", { step: 0.01 }),
    { key: "align", label: "Align", kind: "enum", default: "center", options: ["left", "center", "right"], group: "Content" },
    c("fill", "Fill", "#ffffff"),
    c("stroke", "Stroke", "rgba(0,0,0,0)"),
    n("strokeWidth", "Stroke width", 0, "Style", { min: 0 }),
    n("reveal", "Reveal", 1, "Content", { min: 0, max: 1, step: 0.01 }),
    n("maxWidth", "Wrap width", 0, "Content", { min: 0 }),
    n("counter", "Counter {counter}", 0, "Content", { step: 0.1 }),
    n("counterDecimals", "Counter decimals", 1, "Content", { min: 0, max: 6 }),
    { key: "counterSeparator", label: "Decimal separator", kind: "string", default: ".", group: "Content" },
    { key: "counterGrouping", label: "Thousands separator", kind: "string", default: "", group: "Content" },
    ...GRADIENT,
  ],
  image: [
    { key: "src", label: "Source", kind: "string", default: "", group: "Content" },
    n("width", "Width", 0, "Content", { min: 0 }),
    n("height", "Height", 0, "Content", { min: 0 }),
    n("radius", "Corner radius", 0, "Content", { min: 0 }),
  ],
  path: [
    { key: "d", label: "Path data", kind: "text", default: "M0 0 L200 0", group: "Content" },
    c("fill", "Fill", "rgba(0,0,0,0)"),
    c("stroke", "Stroke", "#ffffff"),
    n("strokeWidth", "Stroke width", 6, "Style", { min: 0 }),
    { key: "lineCap", label: "Line cap", kind: "enum", default: "round", options: ["butt", "round", "square"], group: "Style" },
    n("trimStart", "Trim start", 0, "Content", { min: 0, max: 1, step: 0.01 }),
    n("trimEnd", "Trim end", 1, "Content", { min: 0, max: 1, step: 0.01 }),
    // "bbox": x/y/anchor refer to the path's bounding box. "zero": the path's own
    // coordinates are used as-is (x/y offset the path's 0,0; anchor is ignored).
    { key: "pathOrigin", label: "Path origin", kind: "enum", default: "bbox", options: ["bbox", "zero"], group: "Content" },
    ...GRADIENT,
  ],
  generator: [
    { key: "generator", label: "Generator", kind: "enum", default: GENERATOR_NAMES[0], options: GENERATOR_NAMES, group: "Content" },
    n("width", "Width", 1920, "Content", { min: 0 }),
    n("height", "Height", 1080, "Content", { min: 0 }),
  ],
  null: [
    // Group render (AE precomp): draw all descendants together, then apply a
    // depth-of-field blur that ramps from rampStart to rampEnd (shot-space y;
    // rampEnd above rampStart ramps upward).
    { key: "isolate", label: "Render as group", kind: "enum", default: "no", options: ["no", "yes"], group: "Effects" },
    n("rampBlur", "Bottom blur (max)", 0, "Effects", { step: 0.5, min: 0 }),
    n("rampStart", "Blur ramp start Y", 700, "Effects"),
    n("rampEnd", "Blur ramp end Y", 1080, "Effects"),
    // Focus plane (lens depth of field): sharp within focusRange of a line through
    // focusX/focusY at focusAngle (0 = horizontal), blurring up to focusBlur over
    // focusFalloff px on both sides. Animate the point/angle for a rack focus.
    n("focusBlur", "Focus blur (max)", 0, "Effects", { step: 0.5, min: 0 }),
    n("focusX", "Focus X", 960, "Effects"),
    n("focusY", "Focus Y", 540, "Effects"),
    n("focusAngle", "Focus angle", 0, "Effects", { step: 0.5 }),
    n("focusRange", "Focus range", 80, "Effects", { min: 0 }),
    n("focusFalloff", "Focus falloff", 400, "Effects", { min: 1 }),
  ],
};

const cache = new Map<string, PropDef[]>();

/** Property catalog for a layer type (generator layers add their generator's params). */
export function propsFor(type: LayerType, generator?: string): PropDef[] {
  const key = type === "generator" ? `${type}:${generator}` : type;
  let defs = cache.get(key);
  if (!defs) {
    const extra = type === "generator" ? (GENERATORS[generator ?? ""]?.params ?? []) : [];
    defs = [...TRANSFORM, ...(BY_TYPE[type] ?? []), ...extra, ...(type === "null" ? [] : EFFECTS)];
    cache.set(key, defs);
  }
  return defs;
}

export function propsForLayer(layer: Layer): PropDef[] {
  return propsFor(layer.type, layer.type === "generator" ? String(layer.props.generator ?? GENERATOR_NAMES[0]) : undefined);
}

export function propDef(layer: Layer, key: string): PropDef | undefined {
  return propsForLayer(layer).find((d) => d.key === key);
}

export const ANIMATABLE: PropKind[] = ["number", "color"];

export const LAYER_TYPES: LayerType[] = ["rect", "ellipse", "text", "path", "image", "generator", "null"];
