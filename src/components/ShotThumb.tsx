"use client";

import { useEffect, useRef, useState } from "react";
import { onAssetsChange, preloadShot, renderFrame } from "@/lib/render";
import type { Shot } from "@/lib/types";

const cache = new Map<string, Promise<Shot>>();

function fetchShot(id: string, v: number, mtime: number) {
  const key = `${id}@${v}:${mtime}`;
  let p = cache.get(key);
  if (!p) {
    p = fetch(`/api/shots/${id}/${v}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => d.shot as Shot);
    cache.set(key, p);
  }
  return p;
}

/** Renders a shot version into a small canvas; plays while `playing`. */
export function ShotThumb({
  id, v, mtime, width, playing,
}: { id: string; v: number; mtime: number; width: number; playing: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [shot, setShot] = useState<Shot | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    fetchShot(id, v, mtime)
      .then(async (s) => {
        if (!s?.layers) return;
        await preloadShot(s, id);
        if (alive) setShot(s);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [id, v, mtime]);

  useEffect(() => onAssetsChange(() => setTick((n) => n + 1)), []);

  useEffect(() => {
    const c = canvas.current;
    if (!c || !shot) return;
    const dpr = window.devicePixelRatio || 1;
    const scale = (width / shot.width) * dpr;
    c.width = Math.round(shot.width * scale);
    c.height = Math.round(shot.height * scale);
    const ctx = c.getContext("2d")!;
    const poster = Math.min(shot.duration, shot.duration * 0.6);
    if (!playing) {
      renderFrame(ctx, shot, poster, { scale, shotId: id });
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const loop = (now: number) => {
      renderFrame(ctx, shot, ((now - t0) / 1000) % shot.duration, { scale, shotId: id });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [shot, playing, width, id, tick]);

  return <canvas ref={canvas} style={{ width: "100%", height: "100%", objectFit: "contain" }} />;
}
