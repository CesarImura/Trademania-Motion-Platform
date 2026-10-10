// Scene format for a shot. Documented for authors in CLAUDE.md — keep in sync.

export type Ease = string | [number, number, number, number];

export type Value = number | string;

export interface Keyframe {
  /** Time in seconds (comp time). */
  t: number;
  v: Value;
  /** Easing applied from this keyframe to the next one. */
  ease?: Ease;
}

export type LayerType = "rect" | "ellipse" | "text" | "image" | "path" | "generator" | "null";

export interface Layer {
  id: string;
  name?: string;
  type: LayerType;
  /** Id of a parent layer whose transform this layer inherits. */
  parent?: string;
  /** In/out points in seconds. Defaults to the whole shot. */
  start?: number;
  end?: number;
  hidden?: boolean;
  locked?: boolean;
  /** Id of a layer used as an alpha matte (AE track matte). Matte layers are not drawn on their own. */
  matte?: string;
  /** "alpha" (default): show where the matte is opaque. "inverse": show where it's transparent. */
  matteMode?: "alpha" | "inverse";
  /** Timeline label color. */
  label?: string;
  /** Static values. A property with keyframes ignores its static value. */
  props: Record<string, Value>;
  keyframes?: Record<string, Keyframe[]>;
}

export interface Shot {
  name: string;
  /** What changed in this version — shown in the gallery. */
  note?: string;
  width: number;
  height: number;
  fps: number;
  duration: number;
  background?: string;
  /** First layer renders on top, like After Effects. */
  layers: Layer[];
}

export interface VersionInfo {
  v: number;
  file: string;
  mtime: number;
  note?: string;
}

export interface ShotSummary {
  id: string;
  name: string;
  width: number;
  height: number;
  fps: number;
  duration: number;
  versions: VersionInfo[];
  latest: number;
  mtime: number;
  exports: number;
}
