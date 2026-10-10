"use client";

import { useEffect, useRef, useState } from "react";
import { num, setValueAt, snapTime } from "@/lib/animate";
import { hitTest, layerCorners, onAssetsChange, parentMatrix, renderFrame } from "@/lib/render";
import type { Shot } from "@/lib/types";
import type { EditorApi } from "./useEditor";

export function Viewer({
  shot, shotId, time, selected, onSelect, editor, playing,
}: {
  shot: Shot;
  shotId: string;
  time: number;
  selected: string | null;
  onSelect: (id: string | null) => void;
  editor: EditorApi;
  playing: boolean;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [box, setBox] = useState({ w: 800, h: 450 });
  const [zoom, setZoom] = useState<number | "fit">("fit");
  const [assetTick, setAssetTick] = useState(0);

  useEffect(() => onAssetsChange(() => setAssetTick((n) => n + 1)), []);

  useEffect(() => {
    const el = wrap.current!;
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fit = Math.min((box.w - 40) / shot.width, (box.h - 40) / shot.height);
  const scale = zoom === "fit" ? Math.max(0.05, fit) : zoom;
  const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
  const cssW = Math.round(shot.width * scale), cssH = Math.round(shot.height * scale);

  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const pw = Math.round(cssW * dpr), ph = Math.round(cssH * dpr);
    if (c.width !== pw) c.width = pw;
    if (c.height !== ph) c.height = ph;
    const ctx = c.getContext("2d")!;
    renderFrame(ctx, shot, time, { scale: scale * dpr, shotId });
    // Selection outline.
    const layer = selected ? shot.layers.find((l) => l.id === selected) : undefined;
    if (layer && !playing) {
      const pts = layerCorners(shot, layer, time, shotId);
      ctx.save();
      ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
      ctx.strokeStyle = "#d9f9b9";
      ctx.lineWidth = 1.5 / scale;
      ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.closePath();
      ctx.stroke();
      // Anchor point.
      const ax = num(layer, "x", time), ay = num(layer, "y", time);
      const a = parentMatrix(shot, layer, time, shotId).transformPoint(new DOMPoint(ax, ay));
      const r = 6 / scale;
      ctx.beginPath();
      ctx.arc(a.x, a.y, r, 0, Math.PI * 2);
      ctx.moveTo(a.x - r * 1.8, a.y);
      ctx.lineTo(a.x + r * 1.8, a.y);
      ctx.moveTo(a.x, a.y - r * 1.8);
      ctx.lineTo(a.x, a.y + r * 1.8);
      ctx.stroke();
      ctx.restore();
    }
  }, [shot, shotId, time, selected, scale, cssW, cssH, dpr, assetTick, playing]);

  const toShot = (e: { clientX: number; clientY: number }) => {
    const r = canvas.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const p = toShot(e);
    // Keep dragging the selected layer if the click lands on it, even under others.
    const sel = selected ? shot.layers.find((l) => l.id === selected) : undefined;
    let target = hitTest(shot, time, p.x, p.y, shotId);
    if (sel && !sel.locked) {
      const inv = layerCorners(shot, sel, time, shotId);
      const path = new Path2D();
      inv.forEach((q, i) => (i ? path.lineTo(q.x, q.y) : path.moveTo(q.x, q.y)));
      const ctx = canvas.current!.getContext("2d")!;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (ctx.isPointInPath(path, p.x, p.y)) target = sel;
      ctx.restore();
    }
    onSelect(target?.id ?? null);
    if (!target || target.locked) return;

    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const inv = parentMatrix(shot, target, time, shotId).inverse();
    const start = inv.transformPoint(new DOMPoint(p.x, p.y));
    const x0 = num(target, "x", time), y0 = num(target, "y", time);
    const t = snapTime(time, shot.fps);
    const id = target.id;
    let began = false;

    const move = (ev: PointerEvent) => {
      const q = toShot(ev);
      const cur = inv.transformPoint(new DOMPoint(q.x, q.y));
      let dx = cur.x - start.x, dy = cur.y - start.y;
      if (!began) {
        if (Math.hypot(dx, dy) * scale < 3) return;
        began = true;
        editor.checkpoint();
      }
      if (ev.shiftKey) {
        if (Math.abs(dx) > Math.abs(dy)) dy = 0;
        else dx = 0;
      }
      editor.apply(
        (draft) => {
          const l = draft.layers.find((x) => x.id === id)!;
          setValueAt(l, "x", t, Math.round(x0 + dx));
          setValueAt(l, "y", t, Math.round(y0 + dy));
        },
        { checkpoint: false },
      );
    };
    const up = () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
  };

  return (
    <div className="viewer" ref={wrap}>
      <canvas
        ref={canvas}
        style={{ width: cssW, height: cssH, cursor: "default" }}
        onPointerDown={onPointerDown}
      />
      <div className="viewer-hud mono">
        {shot.width}×{shot.height} · {shot.fps}fps · {Math.round(scale * 100)}%
      </div>
      <div className="viewer-zoom">
        {(["fit", 0.5, 1] as const).map((z) => (
          <button key={z} className={`icon ${zoom === z ? "primary" : ""}`} onClick={() => setZoom(z)}>
            {z === "fit" ? "Fit" : `${z * 100}%`}
          </button>
        ))}
      </div>
    </div>
  );
}
