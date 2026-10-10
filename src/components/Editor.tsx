"use client";

import { ArrowLeft, DocumentAdd, Export, Redo, Save, Undo } from "@carbon/icons-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { EPS, snapTime, uid } from "@/lib/animate";
import { preloadShot, renderFrame } from "@/lib/render";
import type { Layer, LayerType } from "@/lib/types";
import { ExportDialog } from "./ExportDialog";
import { Inspector } from "./Inspector";
import { Timeline, type KeySel } from "./Timeline";
import { useEditor } from "./useEditor";
import { Viewer } from "./Viewer";

const NEW_LAYER: Record<LayerType, (w: number, h: number) => Partial<Layer>> = {
  rect: () => ({ props: { width: 300, height: 200, radius: 16, fill: "#d9f9b9" } }),
  ellipse: () => ({ props: { width: 200, height: 200, fill: "#9fdcc6" } }),
  text: () => ({ props: { text: "New text", fontSize: 96, fill: "#ffffff" } }),
  path: () => ({ props: { d: "M0 0 C 100 -120 200 120 300 0", stroke: "#ffffff", strokeWidth: 8 } }),
  image: () => ({ props: { src: "", width: 400 } }),
  generator: (w, h) => ({ props: { generator: "ditherField", width: w, height: h } }),
  null: () => ({ props: {} }),
};

export function Editor({ id, requestedV }: { id: string; requestedV: number | null }) {
  const editor = useEditor(id, requestedV);
  const { shot, v, versions, dirty } = editor;

  const [time, setTimeState] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loop, setLoop] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [keySel, setKeySel] = useState<KeySel | null>(null);
  const [exporting, setExporting] = useState(false);
  const [tlH, setTlH] = useState(300);
  const [cadence, setCadenceState] = useState<"frames" | "smooth">("frames");
  const [speed, setSpeed] = useState(1);
  const timeRef = useRef(0);
  const rawRef = useRef(0);
  const shotRef = useRef(shot);
  shotRef.current = shot;

  const setTime = useCallback((t: number) => {
    timeRef.current = t;
    setTimeState(t);
  }, []);

  useEffect(() => {
    if (shot) preloadShot(shot, id);
    // Dev hook for debugging/profiling from the console.
    if (shot && process.env.NODE_ENV !== "production") {
      (window as unknown as { __studio: unknown }).__studio = { shot, id, renderFrame };
    }
  }, [shot, id]);

  // Clamp time and drop stale selections when the shot changes underneath us.
  useEffect(() => {
    if (!shot) return;
    if (timeRef.current > shot.duration) setTime(shot.duration);
    if (selected && !shot.layers.some((l) => l.id === selected)) setSelected(null);
    if (keySel) {
      const l = shot.layers.find((x) => x.id === keySel.layerId);
      if (!l?.keyframes?.[keySel.prop]?.some((k) => Math.abs(k.t - keySel.t) < EPS)) setKeySel(null);
    }
  }, [shot, selected, keySel, setTime]);

  useEffect(() => {
    try {
      const v = localStorage.getItem("motion-studio:cadence");
      if (v === "smooth" || v === "frames") setCadenceState(v);
    } catch {
      /* ignore */
    }
  }, []);
  const setCadence = useCallback((c: "frames" | "smooth") => {
    setCadenceState(c);
    try {
      localStorage.setItem("motion-studio:cadence", c);
    } catch {
      /* ignore */
    }
  }, []);

  // Playback. "frames" steps at the shot's fps (what the export will look like);
  // "smooth" draws every display refresh, for judging curves.
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    rawRef.current = timeRef.current;
    const tick = (now: number) => {
      const s = shotRef.current;
      if (!s) return;
      // Clamp the step so a slow frame doesn't make playback jump.
      let t = rawRef.current + (Math.min(100, now - last) / 1000) * speed;
      last = now;
      if (t >= s.duration) {
        if (loop) t = t % s.duration;
        else {
          setTime(s.duration);
          setPlaying(false);
          return;
        }
      }
      rawRef.current = t;
      const shown = cadence === "frames" ? Math.floor(t * s.fps + 1e-6) / s.fps : t;
      if (shown !== timeRef.current) setTime(shown);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, loop, setTime, cadence, speed]);

  const togglePlay = useCallback(() => {
    setPlaying((p) => {
      if (!p && shotRef.current && timeRef.current >= shotRef.current.duration - 1e-3) setTime(0);
      if (p && shotRef.current) setTime(snapTime(timeRef.current, shotRef.current.fps));
      return !p;
    });
  }, [setTime]);

  const addLayer = (type: LayerType) => {
    if (!shot) return;
    const taken = new Set(shot.layers.map((l) => l.id));
    const lid = uid(type, taken);
    const base = NEW_LAYER[type](shot.width, shot.height);
    editor.apply((d) => {
      d.layers.unshift({
        id: lid,
        type,
        name: lid,
        ...base,
        props: { x: Math.round(d.width / 2), y: Math.round(d.height / 2), ...base.props },
      } as Layer);
    });
    setSelected(lid);
  };

  // Keyboard shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("input, textarea, select")) return;
      const s = shotRef.current;
      if (!s) return;
      const mod = e.metaKey || e.ctrlKey;
      const frame = 1 / s.fps;
      if (e.code === "Space") {
        e.preventDefault();
        togglePlay();
      } else if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) editor.redo();
        else editor.undo();
      } else if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        editor.redo();
      } else if (mod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (e.shiftKey) editor.saveAsNew();
        else editor.save();
      } else if (mod && e.key.toLowerCase() === "e") {
        e.preventDefault();
        setExporting(true);
      } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        const d = (e.key === "ArrowLeft" ? -1 : 1) * frame * (e.shiftKey ? 10 : 1);
        setTime(Math.min(s.duration, Math.max(0, snapTime(timeRef.current + d, s.fps))));
      } else if (e.key === "Home") {
        setTime(0);
      } else if (e.key === "End") {
        setTime(s.duration);
      } else if (e.key === "Escape") {
        setKeySel(null);
        setSelected(null);
      } else if (e.key === "Delete" || e.key === "Backspace") {
        if (keySel) {
          editor.apply((d) => {
            const l = d.layers.find((x) => x.id === keySel.layerId);
            const ks = l?.keyframes?.[keySel.prop];
            if (!l || !ks) return;
            const i = ks.findIndex((k) => Math.abs(k.t - keySel.t) < EPS);
            if (i < 0) return;
            if (ks.length === 1) {
              l.props[keySel.prop] = ks[0].v;
              delete l.keyframes![keySel.prop];
            } else ks.splice(i, 1);
          });
          setKeySel(null);
        } else if (selected) {
          editor.apply((d) => {
            d.layers = d.layers.filter((l) => l.id !== selected);
            for (const l of d.layers) if (l.parent === selected) delete l.parent;
          });
          setSelected(null);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editor, togglePlay, setTime, keySel, selected]);

  // Warn before leaving with unsaved edits.
  useEffect(() => {
    if (!dirty) return;
    const fn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", fn);
    return () => window.removeEventListener("beforeunload", fn);
  }, [dirty]);

  const resizeTimeline = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const y0 = e.clientY, h0 = tlH;
    const move = (ev: PointerEvent) => setTlH(Math.min(window.innerHeight - 200, Math.max(120, h0 - (ev.clientY - y0))));
    const up = () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
  };

  if (!shot || !v) {
    return (
      <div style={{ padding: 40 }}>
        {editor.error ? <div className="notice err">{editor.error}</div> : <span className="muted">Loading {id}…</span>}
        <p>
          <Link href="/" className="row"><ArrowLeft size={16} /> Gallery</Link>
        </p>
      </div>
    );
  }

  const latest = versions.at(-1)?.v ?? v;

  return (
    <div className="editor" style={{ ["--tl-h" as string]: `${tlH}px` }}>
      <div className="topbar">
        <Link href="/">
          <button className="ghost"><ArrowLeft size={16} /> Gallery</button>
        </Link>
        <span className="title">{shot.name}</span>
        <span className="muted mono">{id}</span>
        <select
          value={v}
          onChange={(e) => {
            if (dirty && !confirm("Discard unsaved edits?")) return;
            editor.load(Number(e.target.value));
          }}
          title="Version"
        >
          {[...versions].reverse().map((x) => (
            <option key={x.v} value={x.v}>
              v{x.v}
              {x.v === latest ? " (latest)" : ""}
              {x.note ? ` — ${x.note.slice(0, 40)}` : ""}
            </option>
          ))}
        </select>
        {dirty && <span className="dirty-dot" title="Unsaved changes" />}
        <div className="spacer" />
        <button className="icon ghost" onClick={editor.undo} disabled={!editor.historySize.undo} title="Undo (⌘Z)" aria-label="Undo"><Undo size={16} /></button>
        <button className="icon ghost" onClick={editor.redo} disabled={!editor.historySize.redo} title="Redo (⇧⌘Z)" aria-label="Redo"><Redo size={16} /></button>
        <button onClick={editor.save} disabled={!dirty} title="Overwrite this version (⌘S)">
          <Save size={16} /> Save v{v}
        </button>
        <button
          onClick={() => {
            const note = prompt("Note for the new version:", dirty ? "Tweaked in editor" : shot.note ?? "");
            if (note !== null) editor.saveAsNew(note);
          }}
          title="Save as a new version (⇧⌘S)"
        >
          <DocumentAdd size={16} /> Save as v{latest + 1}
        </button>
        <button className="primary" onClick={() => setExporting(true)} title="⌘E">
          <Export size={16} /> Export MP4
        </button>
      </div>

      <div className="main">
        <div style={{ position: "relative", minHeight: 0, display: "grid" }}>
          {editor.newer && (
            <div className="banner">
              <span>
                v{editor.newer} is available{dirty ? " — you have unsaved edits" : ""}
              </span>
              <button
                className="primary"
                onClick={() => {
                  if (dirty && !confirm("Discard unsaved edits and load the new version?")) return;
                  editor.load(editor.newer!);
                }}
              >
                Load v{editor.newer}
              </button>
            </div>
          )}
          {editor.error && (
            <div className="banner" style={{ borderColor: "var(--danger)" }}>
              <span>{editor.error}</span>
              <button onClick={() => editor.setError(null)}>Dismiss</button>
            </div>
          )}
          <Viewer
            shot={shot}
            shotId={id}
            time={time}
            selected={selected}
            onSelect={(lid) => {
              setSelected(lid);
              if (lid !== keySel?.layerId) setKeySel(null);
            }}
            editor={editor}
            playing={playing}
          />
        </div>
        <Inspector
          shot={shot}
          editor={editor}
          time={time}
          selected={selected}
          onSelect={setSelected}
          keySel={keySel}
          setKeySel={setKeySel}
        />
      </div>

      <div style={{ position: "relative", minHeight: 0, display: "grid" }}>
        <div className="tl-resize" onPointerDown={resizeTimeline} />
        <Timeline
          shot={shot}
          editor={editor}
          time={time}
          setTime={setTime}
          playing={playing}
          togglePlay={togglePlay}
          selected={selected}
          onSelect={(lid) => {
            setSelected(lid);
            if (lid !== keySel?.layerId) setKeySel(null);
          }}
          keySel={keySel}
          setKeySel={setKeySel}
          onAddLayer={addLayer}
          loop={loop}
          setLoop={setLoop}
          cadence={cadence}
          setCadence={setCadence}
          speed={speed}
          setSpeed={setSpeed}
          onFps={(fps) => editor.apply((d) => void (d.fps = fps))}
        />
      </div>

      {editor.toast && <div className="toast">{editor.toast}</div>}
      {exporting && <ExportDialog shot={shot} shotId={id} version={v} dirty={dirty} onClose={() => setExporting(false)} />}
    </div>
  );
}
