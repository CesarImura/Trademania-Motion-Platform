"use client";

import { ArrayBufferTarget, Muxer } from "mp4-muxer";
import { preloadShot, renderFrame } from "./render";
import type { Shot } from "./types";

export interface ExportSettings {
  width: number;
  height: number;
  fps: number;
  /** Bits per pixel per frame — drives bitrate. */
  quality: QualityKey;
  start: number;
  end: number;
}

export const QUALITY = {
  draft: { label: "Draft", bpp: 0.04 },
  good: { label: "Good", bpp: 0.08 },
  high: { label: "High", bpp: 0.15 },
  max: { label: "Max", bpp: 0.3 },
} as const;
export type QualityKey = keyof typeof QUALITY;

export function bitrateFor(s: Pick<ExportSettings, "width" | "height" | "fps" | "quality">) {
  return Math.min(150_000_000, Math.round(s.width * s.height * s.fps * QUALITY[s.quality].bpp));
}

const CODECS = ["avc1.640034", "avc1.640033", "avc1.640032", "avc1.64002A", "avc1.640028", "avc1.4D0028", "avc1.42001F"];

async function pickCodec(width: number, height: number, fps: number, bitrate: number) {
  if (typeof VideoEncoder === "undefined") throw new Error("This browser has no WebCodecs support — use Chrome, Edge or Arc.");
  for (const codec of CODECS) {
    const config: VideoEncoderConfig = { codec, width, height, bitrate, framerate: fps, avc: { format: "avc" } };
    try {
      const res = await VideoEncoder.isConfigSupported(config);
      if (res.supported) return config;
    } catch {
      /* try next */
    }
  }
  throw new Error(`No H.264 encoder supports ${width}×${height} @ ${fps}fps in this browser.`);
}

export async function exportMp4(
  shot: Shot,
  shotId: string,
  s: ExportSettings,
  onProgress: (p: number) => void,
  signal?: AbortSignal,
): Promise<Blob> {
  const width = Math.round(s.width / 2) * 2;
  const height = Math.round(s.height / 2) * 2;
  const bitrate = bitrateFor({ ...s, width, height });
  const config = await pickCodec(width, height, s.fps, bitrate);
  await preloadShot(shot, shotId);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { alpha: false })!;

  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: "avc", width, height, frameRate: s.fps },
    fastStart: "in-memory",
  });
  let failure: unknown = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => (failure = e),
  });
  encoder.configure({ ...config, bitrateMode: "variable", latencyMode: "quality" });

  const total = Math.max(1, Math.round((s.end - s.start) * s.fps));
  const frameUs = 1_000_000 / s.fps;
  const scale = width / shot.width;
  try {
    for (let i = 0; i < total; i++) {
      if (signal?.aborted) throw new DOMException("Export cancelled", "AbortError");
      if (failure) throw failure;
      renderFrame(ctx, shot, s.start + i / s.fps, { scale, shotId });
      const frame = new VideoFrame(canvas, { timestamp: Math.round(i * frameUs), duration: Math.round(frameUs) });
      encoder.encode(frame, { keyFrame: i % (s.fps * 2) === 0 });
      frame.close();
      while (encoder.encodeQueueSize > 8) await new Promise((r) => setTimeout(r, 1));
      if (i % 4 === 0) {
        onProgress(i / total);
        await new Promise((r) => setTimeout(r, 0));
      }
    }
    await encoder.flush();
    if (failure) throw failure;
    muxer.finalize();
  } finally {
    if (encoder.state !== "closed") encoder.close();
  }
  onProgress(1);
  return new Blob([muxer.target.buffer], { type: "video/mp4" });
}
