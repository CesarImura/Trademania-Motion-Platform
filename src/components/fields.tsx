"use client";

import { useEffect, useRef, useState } from "react";
import { toHex } from "@/lib/animate";

function decimals(step: number) {
  const s = String(step);
  return s.includes(".") ? s.split(".")[1].length : 0;
}

export function roundTo(v: number, step: number) {
  const d = Math.max(decimals(step), 0);
  return Number(v.toFixed(Math.min(d + 1, 6)));
}

/** Number input whose label can be dragged to scrub the value, AE-style. */
export function NumberField({
  label, value, step = 1, min, max, onBegin, onChange, className,
}: {
  label: React.ReactNode;
  value: number;
  step?: number;
  min?: number;
  max?: number;
  onBegin: () => void;
  onChange: (v: number) => void;
  className?: string;
}) {
  const [text, setText] = useState(String(roundTo(value, step)));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(String(roundTo(value, step)));
  }, [value, step]);

  const clamp = (v: number) => Math.min(max ?? Infinity, Math.max(min ?? -Infinity, v));

  const onPointerDown = (e: React.PointerEvent<HTMLLabelElement>) => {
    e.preventDefault();
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const startX = e.clientX, start = value;
    let began = false;
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      if (!began) {
        if (Math.abs(dx) < 2) return;
        began = true;
        onBegin();
      }
      const mult = ev.shiftKey ? 10 : ev.altKey ? 0.1 : 1;
      onChange(clamp(roundTo(start + dx * step * mult, step * (ev.altKey ? 0.1 : 1))));
    };
    const up = () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
  };

  const commit = () => {
    // Allow simple math like "960+40" or "1920/2".
    let parsed = Number(text);
    if (Number.isNaN(parsed) && /^[\d\s.+\-*/()]+$/.test(text)) {
      try {
        parsed = Number(Function(`"use strict";return (${text})`)());
      } catch {
        parsed = NaN;
      }
    }
    if (Number.isFinite(parsed) && parsed !== value) {
      onBegin();
      onChange(clamp(parsed));
    } else setText(String(roundTo(value, step)));
  };

  return (
    <>
      <label onPointerDown={onPointerDown} className={className} title="Drag to scrub · Shift ×10 · Alt ×0.1">
        {label}
      </label>
      <input
        className="mono"
        value={text}
        onFocus={(e) => {
          focused.current = true;
          e.currentTarget.select();
        }}
        onBlur={() => {
          focused.current = false;
          commit();
        }}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            setText(String(roundTo(value, step)));
            focused.current = false;
            e.currentTarget.blur();
          }
          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            const d = (e.key === "ArrowUp" ? 1 : -1) * step * (e.shiftKey ? 10 : 1);
            onBegin();
            onChange(clamp(roundTo(value + d, step)));
          }
          e.stopPropagation();
        }}
      />
    </>
  );
}

export function TextField({
  value, onCommit, multiline,
}: { value: string; onCommit: (v: string) => void; multiline?: boolean }) {
  const [text, setText] = useState(value);
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(value);
  }, [value]);
  const props = {
    value: text,
    onFocus: () => (focused.current = true),
    onBlur: () => {
      focused.current = false;
      if (text !== value) onCommit(text);
    },
    onChange: (e: React.ChangeEvent<HTMLInputElement & HTMLTextAreaElement>) => setText(e.target.value),
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement & HTMLTextAreaElement>) => {
      e.stopPropagation();
      if (e.key === "Enter" && (!multiline || e.metaKey || e.ctrlKey)) e.currentTarget.blur();
    },
  };
  return multiline ? <textarea rows={3} {...props} /> : <input {...props} />;
}

export function ColorField({
  value, onBegin, onChange,
}: { value: string; onBegin: () => void; onChange: (v: string) => void }) {
  return (
    <div className="color-field">
      <input
        type="color"
        value={toHex(value)}
        onPointerDown={onBegin}
        onChange={(e) => onChange(e.target.value)}
      />
      <TextField
        value={value}
        onCommit={(v) => {
          onBegin();
          onChange(v);
        }}
      />
    </div>
  );
}

export function Diamond({ filled }: { filled?: boolean }) {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11">
      <path d="M5.5 1 L10 5.5 L5.5 10 L1 5.5 Z" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}
