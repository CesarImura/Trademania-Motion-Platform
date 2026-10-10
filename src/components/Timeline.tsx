"use client";

import { Add, ChevronDown, ChevronLeft, ChevronRight, Locked, PauseFilled, PlayFilledAlt, Repeat, SkipBackFilled, TreeViewAlt, Unlocked, View, ViewOff } from "@carbon/icons-react";
import { useEffect, useRef, useState } from "react";
import { allKeyTimes, formatTime, getValue, layerEnd, layerStart, snapTime, toHex } from "@/lib/animate";
import { LAYER_TYPES, propDef } from "@/lib/props";
import type { Layer, LayerType, Shot } from "@/lib/types";
import type { EditorApi } from "./useEditor";

export interface KeySel {
  layerId: string;
  prop: string;
  t: number;
}

const NAME_W = 280;
const LABELS = ["#d9f9b9", "#9fdcc6", "#e6d3a3", "#c5b9ee", "#a6cf90", "#8c958a", "#f4f9ee"];

function niceStep(pps: number) {
  for (const s of [0.1, 0.25, 0.5, 1, 2, 5, 10, 30, 60]) if (s * pps >= 70) return s;
  return 60;
}

function drag(e: React.PointerEvent, onMove: (dx: number, ev: PointerEvent) => void, onUp?: () => void) {
  e.preventDefault();
  e.stopPropagation();
  const el = e.currentTarget as HTMLElement;
  el.setPointerCapture(e.pointerId);
  const x0 = e.clientX;
  const move = (ev: PointerEvent) => onMove(ev.clientX - x0, ev);
  const up = () => {
    el.removeEventListener("pointermove", move);
    el.removeEventListener("pointerup", up);
    onUp?.();
  };
  el.addEventListener("pointermove", move);
  el.addEventListener("pointerup", up);
}

export function Timeline({
  shot, editor, time, setTime, playing, togglePlay, selected, onSelect, keySel, setKeySel, onAddLayer, loop, setLoop,
  cadence, setCadence, speed, setSpeed, onFps,
}: {
  shot: Shot;
  editor: EditorApi;
  time: number;
  setTime: (t: number) => void;
  playing: boolean;
  togglePlay: () => void;
  selected: string | null;
  onSelect: (id: string | null) => void;
  keySel: KeySel | null;
  setKeySel: (k: KeySel | null) => void;
  onAddLayer: (type: LayerType) => void;
  loop: boolean;
  setLoop: (v: boolean) => void;
  cadence: "frames" | "smooth";
  setCadence: (c: "frames" | "smooth") => void;
  speed: number;
  setSpeed: (s: number) => void;
  onFps: (fps: number) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const [laneAvail, setLaneAvail] = useState(800);
  const [zoom, setZoom] = useState(1);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [menu, setMenu] = useState(false);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);

  useEffect(() => {
    const el = scroller.current!;
    const ro = new ResizeObserver(() => setLaneAvail(el.clientWidth - NAME_W - 24));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (selected) setExpanded((prev) => (prev.has(selected) ? prev : new Set(prev).add(selected)));
  }, [selected]);

  const pps = (Math.max(200, laneAvail) / shot.duration) * zoom;
  const laneW = shot.duration * pps + 16;
  const xOf = (t: number) => t * pps + 8;
  const step = niceStep(pps);
  const frameW = pps / shot.fps;

  const scrub = (e: React.PointerEvent<HTMLDivElement>) => {
    const lane = e.currentTarget.getBoundingClientRect();
    const at = (cx: number) => setTime(Math.min(shot.duration, Math.max(0, snapTime((cx - lane.left - 8) / pps, shot.fps))));
    at(e.clientX);
    drag(e, (_dx, ev) => at(ev.clientX));
  };

  const ticks: React.ReactNode[] = [];
  for (let t = 0; t <= shot.duration + 1e-6; t += step) {
    ticks.push(
      <div key={`M${t}`} className="tick" style={{ left: xOf(t) }}>
        <span className="mono">{step < 1 ? `${+t.toFixed(2)}s` : `${Math.round(t)}s`}</span>
      </div>,
    );
    if (frameW > 6) {
      for (let f = 1; f < step * shot.fps && t + f / shot.fps < shot.duration; f++) {
        ticks.push(<div key={`m${t}-${f}`} className="tick minor" style={{ left: xOf(t + f / shot.fps) }} />);
      }
    } else {
      const half = t + step / 2;
      if (half < shot.duration) ticks.push(<div key={`h${t}`} className="tick minor" style={{ left: xOf(half) }} />);
    }
  }

  const mutateLayer = (id: string, fn: (l: Layer) => void, checkpoint = true) =>
    editor.apply((d) => fn(d.layers.find((l) => l.id === id)!), { checkpoint });

  const moveBar = (e: React.PointerEvent, layer: Layer, mode: "move" | "in" | "out") => {
    onSelect(layer.id);
    const s0 = layerStart(layer), e0 = layerEnd(layer, shot);
    const kfs0 = structuredClone(layer.keyframes ?? {});
    let began = false;
    drag(e, (dx) => {
      const dt = snapTime(dx / pps, shot.fps);
      if (!began) {
        if (Math.abs(dx) < 2) return;
        began = true;
        editor.checkpoint();
      }
      mutateLayer(
        layer.id,
        (l) => {
          if (mode === "move") {
            const d = Math.max(-s0, dt);
            l.start = +(s0 + d).toFixed(4);
            l.end = +(e0 + d).toFixed(4);
            // Keyframes travel with the layer, like moving a layer in AE.
            if (layer.keyframes) {
              l.keyframes = structuredClone(kfs0);
              for (const ks of Object.values(l.keyframes)) for (const k of ks) k.t = +(k.t + d).toFixed(4);
            }
          } else if (mode === "in") {
            l.start = Math.max(0, Math.min(e0 - 1 / shot.fps, +(s0 + dt).toFixed(4)));
          } else {
            l.end = Math.max(s0 + 1 / shot.fps, +(e0 + dt).toFixed(4));
          }
          if (l.start === 0) delete l.start;
          if (l.end !== undefined && Math.abs(l.end - shot.duration) < 1e-4) delete l.end;
        },
        false,
      );
    });
  };

  const moveKey = (e: React.PointerEvent, layer: Layer, prop: string, t0: number) => {
    onSelect(layer.id);
    setKeySel({ layerId: layer.id, prop, t: t0 });
    setTime(t0);
    let began = false;
    let cur = t0;
    drag(e, (dx) => {
      const nt = Math.min(shot.duration, Math.max(0, snapTime(t0 + dx / pps, shot.fps)));
      if (nt === cur) return;
      const kfs = layer.keyframes?.[prop] ?? [];
      // Don't stack two keys on the same frame.
      if (kfs.some((k) => Math.abs(k.t - nt) < 1e-4 && Math.abs(k.t - t0) > 1e-4)) return;
      if (!began) {
        began = true;
        editor.checkpoint();
      }
      const prev = cur;
      cur = nt;
      mutateLayer(
        layer.id,
        (l) => {
          const k = l.keyframes![prop].find((x) => Math.abs(x.t - prev) < 1e-4);
          if (k) k.t = nt;
          l.keyframes![prop].sort((a, b) => a.t - b.t);
        },
        false,
      );
      setKeySel({ layerId: layer.id, prop, t: nt });
      setTime(nt);
    });
  };

  const reorder = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    editor.apply((d) => {
      const from = d.layers.findIndex((l) => l.id === fromId);
      const [item] = d.layers.splice(from, 1);
      const to = d.layers.findIndex((l) => l.id === toId);
      d.layers.splice(to, 0, item);
    });
  };

  return (
    <div className="timeline">
      <div className="tl-toolbar">
        <button className="icon" title="Go to start (Home)" aria-label="Go to start" onClick={() => setTime(0)}><SkipBackFilled size={16} /></button>
        <button className="icon" title="Previous frame (←)" aria-label="Previous frame" onClick={() => setTime(Math.max(0, snapTime(time - 1 / shot.fps, shot.fps)))}><ChevronLeft size={16} /></button>
        <button className="icon primary" title="Play / pause (Space)" onClick={togglePlay} style={{ minWidth: 34 }}>
          {playing ? <PauseFilled size={16} /> : <PlayFilledAlt size={16} />}
        </button>
        <button className="icon" title="Next frame (→)" aria-label="Next frame" onClick={() => setTime(Math.min(shot.duration, snapTime(time + 1 / shot.fps, shot.fps)))}><ChevronRight size={16} /></button>
        <button className={`icon ${loop ? "on" : "ghost"}`} title="Loop" aria-label="Loop" aria-pressed={loop} onClick={() => setLoop(!loop)}><Repeat size={16} /></button>
        <span className="timecode mono">{formatTime(time, shot.fps)}</span>
        <span className="muted mono">
          f{Math.round(time * shot.fps)} / {Math.round(shot.duration * shot.fps)}
        </span>
        <div className="add-menu" style={{ marginLeft: 8 }}>
          <button onClick={() => setMenu(!menu)}><Add size={16} /> Layer</button>
          {menu && (
            <div className="menu" onMouseLeave={() => setMenu(false)}>
              {LAYER_TYPES.map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    onAddLayer(t);
                    setMenu(false);
                  }}
                >
                  {t === "null" ? "Null (parent)" : t[0].toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="spacer" />
        <label className="tl-field" title="Shot frame rate — keyframes stay at the same seconds">
          <span>FPS</span>
          <select value={shot.fps} onChange={(e) => onFps(Number(e.target.value))}>
            {[...new Set([12, 15, 24, 25, 30, 48, 50, 60, shot.fps])].sort((a, b) => a - b).map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </label>
        <div className="seg" title="Playback cadence">
          <button className={cadence === "frames" ? "on" : ""} onClick={() => setCadence("frames")} title={`Step at ${shot.fps} fps, exactly like the export`}>
            {shot.fps} fps
          </button>
          <button className={cadence === "smooth" ? "on" : ""} onClick={() => setCadence("smooth")} title="Continuous, for judging curves">
            Smooth
          </button>
        </div>
        <div className="seg" title="Playback speed">
          {[0.25, 0.5, 1].map((v) => (
            <button key={v} className={speed === v ? "on" : ""} onClick={() => setSpeed(v)}>
              {v}×
            </button>
          ))}
        </div>
        <span className="muted" style={{ marginLeft: 6 }}>Zoom</span>
        <input type="range" min={1} max={12} step={0.1} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} style={{ width: 120 }} />
      </div>

      <div className="tl-scroll" ref={scroller}>
        <div className="tl-inner" style={{ width: NAME_W + laneW }}>
          <div className="tl-row tl-ruler">
            <div className="tl-name" style={{ cursor: "default" }}>
              <span className="tiny">LAYERS · {shot.layers.length}</span>
            </div>
            <div className="tl-lane" style={{ width: laneW }} onPointerDown={scrub}>
              {ticks}
            </div>
          </div>

          {shot.layers.map((layer, idx) => {
            const animated = Object.keys(layer.keyframes ?? {}).filter((k) => layer.keyframes![k].length);
            const open = expanded.has(layer.id) && animated.length > 0;
            const s = layerStart(layer), en = layerEnd(layer, shot);
            const isSel = selected === layer.id;
            const color = layer.label ?? LABELS[idx % LABELS.length];
            return (
              <div key={layer.id}>
                <div
                  className={`tl-row ${isSel ? "selected" : ""} ${dropTarget === layer.id ? "drop-above" : ""}`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDropTarget(layer.id);
                  }}
                  onDragLeave={() => setDropTarget(null)}
                  onDrop={(e) => {
                    setDropTarget(null);
                    reorder(e.dataTransfer.getData("text/layer"), layer.id);
                  }}
                >
                  <div
                    className="tl-name"
                    draggable={renaming !== layer.id}
                    onDragStart={(e) => e.dataTransfer.setData("text/layer", layer.id)}
                    onClick={() => onSelect(layer.id)}
                    onDoubleClick={() => setRenaming(layer.id)}
                  >
                    <button
                      className="ghost"
                      style={{ visibility: animated.length ? "visible" : "hidden", width: 14 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        const next = new Set(expanded);
                        if (next.has(layer.id)) next.delete(layer.id);
                        else next.add(layer.id);
                        setExpanded(next);
                      }}
                    >
                      {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                    <span className="tag" style={{ background: color }} />
                    <span className="tiny mono" style={{ width: 16, textAlign: "right" }}>{idx + 1}</span>
                    {renaming === layer.id ? (
                      <input
                        autoFocus
                        defaultValue={layer.name ?? layer.id}
                        style={{ flex: 1 }}
                        onKeyDown={(e) => {
                          e.stopPropagation();
                          if (e.key === "Enter") e.currentTarget.blur();
                          if (e.key === "Escape") setRenaming(null);
                        }}
                        onBlur={(e) => {
                          const v = e.currentTarget.value.trim();
                          if (v && v !== (layer.name ?? layer.id)) mutateLayer(layer.id, (l) => (l.name = v));
                          setRenaming(null);
                        }}
                      />
                    ) : (
                      <span className="name" title={`${layer.id} · ${layer.type}`}>
                        {layer.name ?? layer.id}
                      </span>
                    )}
                    <span className="tiny">{layer.type}</span>
                    {layer.parent && <span className="tiny" title={`Parent: ${layer.parent}`} style={{ display: "inline-flex" }}><TreeViewAlt size={12} /></span>}
                    <button
                      className={`ghost ${layer.locked ? "on" : ""}`}
                      title="Lock"
                      onClick={(e) => {
                        e.stopPropagation();
                        mutateLayer(layer.id, (l) => (l.locked ? delete l.locked : (l.locked = true)));
                      }}
                    >
                      {layer.locked ? <Locked size={14} /> : <Unlocked size={14} />}
                    </button>
                    <button
                      className={`ghost ${layer.hidden ? "" : "on"}`}
                      title="Show / hide"
                      onClick={(e) => {
                        e.stopPropagation();
                        mutateLayer(layer.id, (l) => (l.hidden ? delete l.hidden : (l.hidden = true)));
                      }}
                    >
                      {layer.hidden ? <ViewOff size={14} /> : <View size={14} />}
                    </button>
                  </div>
                  <div className="tl-lane" style={{ width: laneW }} onPointerDown={scrub}>
                    <div
                      className="bar"
                      style={{
                        left: xOf(s),
                        width: Math.max(4, (en - s) * pps),
                        background: `${toHex(color)}${isSel ? "55" : "33"}`,
                        borderColor: `${toHex(color)}aa`,
                        opacity: layer.hidden ? 0.35 : 1,
                      }}
                      onPointerDown={(e) => moveBar(e, layer, "move")}
                    >
                      <div className="edge l" onPointerDown={(e) => moveBar(e, layer, "in")} />
                      <div className="edge r" onPointerDown={(e) => moveBar(e, layer, "out")} />
                    </div>
                    {!open &&
                      allKeyTimes(layer).map((t) => (
                        <div key={t} className="diamond summary" style={{ left: xOf(t) }} />
                      ))}
                  </div>
                </div>

                {open &&
                  animated.map((prop) => {
                    const def = propDef(layer, prop);
                    const v = getValue(layer, prop, time);
                    const kfs = layer.keyframes![prop];
                    return (
                      <div key={prop} className={`tl-row sub ${isSel ? "selected" : ""}`}>
                        <div className="tl-name">
                          <span className="name">{def?.label ?? prop}</span>
                          <span className="val mono muted">
                            {typeof v === "number" ? +v.toFixed(2) : def?.kind === "color" ? toHex(String(v)) : String(v).slice(0, 10)}
                          </span>
                          <button
                            className="ghost"
                            title="Previous keyframe"
                            onClick={() => {
                              const prev = kfs.filter((k) => k.t < time - 1e-4).pop();
                              if (prev) setTime(prev.t);
                            }}
                          >
                            <ChevronLeft size={14} />
                          </button>
                          <button
                            className="ghost"
                            title="Next keyframe"
                            onClick={() => {
                              const next = kfs.find((k) => k.t > time + 1e-4);
                              if (next) setTime(next.t);
                            }}
                          >
                            <ChevronRight size={14} />
                          </button>
                        </div>
                        <div className="tl-lane" style={{ width: laneW }} onPointerDown={scrub}>
                          {kfs.map((k) => {
                            const sel = keySel?.layerId === layer.id && keySel.prop === prop && Math.abs(keySel.t - k.t) < 1e-4;
                            const ease = typeof k.ease === "string" ? k.ease : k.ease ? "bezier" : "linear";
                            return (
                              <div
                                key={k.t}
                                className={`diamond kf ${sel ? "sel" : ""} ${ease === "hold" ? "hold" : ""}`}
                                style={{ left: xOf(k.t) }}
                                title={`${prop} @ ${k.t.toFixed(3)}s → ${String(k.v)} (${ease})`}
                                onPointerDown={(e) => moveKey(e, layer, prop, k.t)}
                              />
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
              </div>
            );
          })}

          {shot.layers.length === 0 && (
            <div className="muted" style={{ padding: 16 }}>
              No layers yet. Add one with “+ Layer”, or ask Claude to build the shot.
            </div>
          )}

          <div className="playhead" style={{ left: NAME_W + xOf(time) }} />
        </div>
      </div>
    </div>
  );
}

