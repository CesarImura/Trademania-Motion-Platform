"use client";

import { Close, Download, Export } from "@carbon/icons-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { bitrateFor, exportMp4, QUALITY, type QualityKey } from "@/lib/export";
import type { Shot } from "@/lib/types";

const PREFS_KEY = "motion-studio:export";

function sizes(shot: Shot) {
  const short = Math.min(shot.width, shot.height);
  const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);
  const at = (target: number) => ({ w: even((shot.width * target) / short), h: even((shot.height * target) / short) });
  const list = [{ key: "native", label: `Shot size`, ...{ w: even(shot.width), h: even(shot.height) } }];
  // Short-side targets, so non-16:9 shots keep their aspect (2K = QHD 1440, 4K = UHD 2160).
  const presets = [
    ["720", 720, "720p"],
    ["1080", 1080, "1080p · Full HD"],
    ["1440", 1440, "2K · QHD"],
    ["2160", 2160, "4K · UHD"],
  ] as const;
  for (const [key, target, label] of presets) {
    const s = at(target);
    if (s.w !== list[0].w || s.h !== list[0].h) list.push({ key, label, ...s });
  }
  return list.sort((a, b) => a.w * a.h - b.w * b.h);
}

function fmtBytes(b: number) {
  return b > 1e9 ? `${(b / 1e9).toFixed(2)} GB` : b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.round(b / 1e3)} KB`;
}

export function ExportDialog({
  shot, shotId, version, dirty, onClose,
}: {
  shot: Shot;
  shotId: string;
  version: number;
  dirty: boolean;
  onClose: () => void;
}) {
  const opts = useMemo(() => sizes(shot), [shot]);
  const saved = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}");
    } catch {
      return {};
    }
  }, []);
  const [sizeKey, setSizeKey] = useState<string>(opts.some((o) => o.key === saved.sizeKey) ? saved.sizeKey : "native");
  const [fps, setFps] = useState<number>(saved.fps ?? shot.fps);
  const [quality, setQuality] = useState<QualityKey>(saved.quality ?? "high");
  const [range, setRange] = useState<"all" | "custom">("all");
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(shot.duration);
  const [progress, setProgress] = useState<number | null>(null);
  const [result, setResult] = useState<{ url: string; path: string; size: number; ms: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({ sizeKey, fps, quality }));
    } catch {
      /* ignore */
    }
  }, [sizeKey, fps, quality]);

  useEffect(() => () => abort.current?.abort(), []);

  const size = opts.find((o) => o.key === sizeKey) ?? opts[0];
  const s0 = range === "all" ? 0 : start, s1 = range === "all" ? shot.duration : end;
  const bitrate = bitrateFor({ width: size.w, height: size.h, fps, quality });
  const estimate = (bitrate * Math.max(0, s1 - s0)) / 8;
  const fileName = `${shotId}_v${String(version).padStart(3, "0")}${dirty ? "-edit" : ""}_${size.h}p${fps}_${quality}.mp4`;

  const run = async () => {
    setError(null);
    setResult(null);
    setProgress(0);
    abort.current = new AbortController();
    const t0 = performance.now();
    try {
      const blob = await exportMp4(
        shot,
        shotId,
        { width: size.w, height: size.h, fps, quality, start: s0, end: s1 },
        setProgress,
        abort.current.signal,
      );
      const res = await fetch(`/api/exports/${shotId}?file=${encodeURIComponent(fileName)}`, { method: "POST", body: blob });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      setResult({ url: URL.createObjectURL(blob), path: body.path, size: blob.size, ms: performance.now() - t0 });
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError((e as Error).message ?? String(e));
    } finally {
      setProgress(null);
    }
  };

  return (
    <div className="modal-back" onPointerDown={(e) => e.target === e.currentTarget && progress === null && onClose()}>
      <div className="modal" onKeyDown={(e) => e.stopPropagation()}>
        <div className="row">
          <h2>Export MP4</h2>
          <span className="spacer" />
          <button className="ghost icon" onClick={onClose} disabled={progress !== null} aria-label="Close"><Close size={16} /></button>
        </div>

        <div className="form">
          <label>Resolution</label>
          <div className="seg">
            {opts.map((o) => (
              <button key={o.key} className={sizeKey === o.key ? "on" : ""} onClick={() => setSizeKey(o.key)} title={`${o.w}×${o.h}`}>
                {o.key === "native" ? `${o.h}p · Shot` : o.label}
              </button>
            ))}
          </div>

          <label>Frame rate</label>
          <div className="seg">
            {[24, 25, 30, 50, 60].map((f) => (
              <button key={f} className={fps === f ? "on" : ""} onClick={() => setFps(f)}>
                {f}
              </button>
            ))}
          </div>

          <label>Quality</label>
          <div className="seg">
            {(Object.keys(QUALITY) as QualityKey[]).map((q) => (
              <button key={q} className={quality === q ? "on" : ""} onClick={() => setQuality(q)}>
                {QUALITY[q].label}
              </button>
            ))}
          </div>

          <label>Range</label>
          <div className="row">
            <div className="seg">
              <button className={range === "all" ? "on" : ""} onClick={() => setRange("all")}>Full</button>
              <button className={range === "custom" ? "on" : ""} onClick={() => setRange("custom")}>Custom</button>
            </div>
            {range === "custom" && (
              <>
                <input type="number" step={0.1} min={0} max={shot.duration} value={start} onChange={(e) => setStart(Number(e.target.value))} style={{ width: 70 }} />
                <span className="muted">to</span>
                <input type="number" step={0.1} min={0} max={shot.duration} value={end} onChange={(e) => setEnd(Number(e.target.value))} style={{ width: 70 }} />
                <span className="muted">s</span>
              </>
            )}
          </div>

          <label>Output</label>
          <div className="muted mono" style={{ fontSize: 11 }}>
            {size.w}×{size.h} · H.264 · {(bitrate / 1e6).toFixed(1)} Mbps · ≈{fmtBytes(estimate)} · {Math.round((s1 - s0) * fps)} frames
            <br />
            exports/{shotId}/{fileName}
          </div>
        </div>

        {dirty && <div className="notice">You have unsaved edits — the export uses what you see now, not the saved v{version}.</div>}
        {error && <div className="notice err">{error}</div>}

        {progress !== null && (
          <div style={{ display: "grid", gap: 6 }}>
            <div className="progress">
              <div style={{ width: `${progress * 100}%` }} />
            </div>
            <div className="row muted">
              Rendering… {Math.round(progress * 100)}%
              <span className="spacer" />
              <button onClick={() => abort.current?.abort()}>Cancel</button>
            </div>
          </div>
        )}

        {result && (
          <div style={{ display: "grid", gap: 8 }}>
            <div className="notice ok">
              Saved <span className="mono">{result.path}</span> · {fmtBytes(result.size)} · {(result.ms / 1000).toFixed(1)}s
            </div>
            <video src={result.url} controls autoPlay loop muted />
          </div>
        )}

        <div className="row">
          <span className="spacer" />
          {result && (
            <a href={result.url} download={fileName}>
              <button><Download size={16} /> Download</button>
            </a>
          )}
          <button className="primary" onClick={run} disabled={progress !== null || s1 <= s0}>
            <Export size={16} /> {result ? "Export again" : "Export"}
          </button>
        </div>
      </div>
    </div>
  );
}
