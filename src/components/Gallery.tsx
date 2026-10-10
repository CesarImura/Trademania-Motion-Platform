"use client";

import { Add, Close, VideoPlayer } from "@carbon/icons-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { ShotSummary } from "@/lib/types";
import { ShotThumb } from "./ShotThumb";

const PRESETS = [
  { label: "16:9 · 1920×1080", w: 1920, h: 1080 },
  { label: "9:16 · 1080×1920", w: 1080, h: 1920 },
  { label: "1:1 · 1080×1080", w: 1080, h: 1080 },
  { label: "4:5 · 1080×1350", w: 1080, h: 1350 },
  { label: "4K · 3840×2160", w: 3840, h: 2160 },
];

function ago(ms: number) {
  const s = (Date.now() - ms) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(ms).toLocaleDateString();
}

function ShotCard({ s, onExports }: { s: ShotSummary; onExports: () => void }) {
  const router = useRouter();
  const [hover, setHover] = useState(false);
  const [previewV, setPreviewV] = useState(s.latest);
  const info = s.versions.find((x) => x.v === previewV) ?? s.versions.at(-1)!;
  return (
    <div className="card">
      <div
        className="card-thumb"
        style={{ aspectRatio: s.width >= s.height ? "16 / 9" : "4 / 5" }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => {
          setHover(false);
          setPreviewV(s.latest);
        }}
        onClick={() => router.push(`/shot/${s.id}?v=${previewV}`)}
      >
        <ShotThumb id={s.id} v={info.v} mtime={info.mtime} width={360} playing={hover} />
        <span className="card-badge mono">
          v{info.v} · {s.duration}s
        </span>
      </div>
      <div className="card-body">
        <div className="row">
          <span className="card-title">{s.name}</span>
          <span className="spacer" />
          <span className="muted mono" style={{ fontSize: 10 }}>{ago(s.mtime)}</span>
        </div>
        <div className="card-note" title={info.note}>{info.note ?? "—"}</div>
        <div className="row">
          <div className="chips" style={{ flex: 1 }} onMouseLeave={() => setPreviewV(s.latest)}>
            {s.versions.map((x) => (
              <Link
                key={x.v}
                href={`/shot/${s.id}?v=${x.v}`}
                className={`chip ${x.v === info.v ? "on" : ""}`}
                title={x.note}
                onMouseEnter={() => {
                  setPreviewV(x.v);
                  setHover(true);
                }}
              >
                v{x.v}
              </Link>
            ))}
          </div>
          {s.exports > 0 && (
            <button className="ghost" style={{ fontSize: 11 }} onClick={onExports}>
              <VideoPlayer size={16} /> {s.exports}
            </button>
          )}
        </div>
        <div className="muted mono" style={{ fontSize: 10 }}>
          {s.id} · {s.width}×{s.height} · {s.fps}fps
        </div>
      </div>
    </div>
  );
}

function ExportsModal({ id, onClose }: { id: string; onClose: () => void }) {
  const [list, setList] = useState<{ file: string; size: number; mtime: number; path: string }[] | null>(null);
  useEffect(() => {
    fetch(`/api/exports/${id}`).then((r) => r.json()).then(setList);
  }, [id]);
  return (
    <div className="modal-back" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal wide">
        <div className="row">
          <h2>Exports · {id}</h2>
          <span className="spacer" />
          <button className="ghost icon" onClick={onClose} aria-label="Close"><Close size={16} /></button>
        </div>
        {!list ? (
          <span className="muted">Loading…</span>
        ) : (
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
            {list.map((x) => (
              <div key={x.file} style={{ display: "grid", gap: 4 }}>
                <video src={`/api/exports/${id}/${encodeURIComponent(x.file)}`} controls muted loop preload="metadata" />
                <span className="mono" style={{ fontSize: 11 }}>{x.file}</span>
                <span className="muted" style={{ fontSize: 10 }}>
                  {(x.size / 1e6).toFixed(1)} MB · {ago(x.mtime)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function NewShotModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [preset, setPreset] = useState(0);
  const [fps, setFps] = useState(30);
  const [duration, setDuration] = useState(5);
  const [busy, setBusy] = useState(false);
  const create = async () => {
    setBusy(true);
    const p = PRESETS[preset];
    const res = await fetch("/api/shots", {
      method: "POST",
      body: JSON.stringify({ name: name || "Untitled shot", width: p.w, height: p.h, fps, duration }),
    });
    const body = await res.json();
    if (res.ok) router.push(`/shot/${body.id}`);
    else setBusy(false);
  };
  return (
    <div className="modal-back" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h2>New shot</h2>
        <div className="form">
          <label>Name</label>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && create()} placeholder="Hero logo reveal" />
          <label>Format</label>
          <select value={preset} onChange={(e) => setPreset(Number(e.target.value))}>
            {PRESETS.map((p, i) => (
              <option key={p.label} value={i}>{p.label}</option>
            ))}
          </select>
          <label>FPS</label>
          <select value={fps} onChange={(e) => setFps(Number(e.target.value))}>
            {[24, 25, 30, 50, 60].map((f) => <option key={f}>{f}</option>)}
          </select>
          <label>Duration (s)</label>
          <input type="number" min={0.5} step={0.5} value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
        </div>
        <div className="row">
          <span className="muted">Tip: you can also just ask Claude to make a new shot.</span>
          <span className="spacer" />
          <button onClick={onClose}>Cancel</button>
          <button className="primary" onClick={create} disabled={busy}>Create</button>
        </div>
      </div>
    </div>
  );
}

export function Gallery() {
  const [shots, setShots] = useState<ShotSummary[] | null>(null);
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const [exportsFor, setExportsFor] = useState<string | null>(null);

  const refresh = useCallback(() => {
    fetch("/api/shots", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => Array.isArray(d) && setShots(d))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    refresh();
    const t = window.setInterval(() => !document.hidden && refresh(), 2000);
    return () => window.clearInterval(t);
  }, [refresh]);

  const filtered = (shots ?? []).filter((s) =>
    `${s.name} ${s.id} ${s.versions.map((v) => v.note).join(" ")}`.toLowerCase().includes(q.toLowerCase()),
  );
  const totalVersions = (shots ?? []).reduce((n, s) => n + s.versions.length, 0);

  return (
    <div className="gallery">
      <div className="gallery-head">
        <span className="logo-dot" />
        <h1>Motion Studio</h1>
        <span className="muted">
          {shots ? `${shots.length} shots · ${totalVersions} versions` : "Loading…"}
        </span>
        <span className="spacer" />
        <input placeholder="Search shots, notes…" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 240 }} />
        <button className="primary" onClick={() => setCreating(true)}><Add size={16} /> New shot</button>
      </div>

      {shots && shots.length === 0 && (
        <div className="empty">
          No shots yet. Ask Claude for an animation — it will appear here — or create one with <b>New shot</b>.
          <br />
          <br />
          Shots live in <code>shots/&lt;id&gt;/v001.json</code>.
        </div>
      )}

      <div className="grid">
        {filtered.map((s) => (
          <ShotCard key={s.id} s={s} onExports={() => setExportsFor(s.id)} />
        ))}
      </div>

      {creating && <NewShotModal onClose={() => setCreating(false)} />}
      {exportsFor && <ExportsModal id={exportsFor} onClose={() => setExportsFor(null)} />}
    </div>
  );
}
