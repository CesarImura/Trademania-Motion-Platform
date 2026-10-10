"use client";

import { Close, Copy, TrashCan } from "@carbon/icons-react";
import { EPS, getValue, setValueAt, snapTime, toggleAnimated, toggleKeyframeAt } from "@/lib/animate";
import { EASE_NAMES, getEase } from "@/lib/easing";
import { ANIMATABLE, propDef, propsForLayer, type PropDef } from "@/lib/props";
import type { Ease, Layer, Shot } from "@/lib/types";
import { ColorField, Diamond, NumberField, TextField } from "./fields";
import type { KeySel } from "./Timeline";
import type { EditorApi } from "./useEditor";

function EaseCurve({ ease }: { ease: Ease | undefined }) {
  const fn = getEase(ease);
  const W = 120, H = 70, pad = 12;
  const pts = Array.from({ length: 49 }, (_, i) => {
    const p = i / 48;
    return `${pad + p * (W - pad * 2)},${H - pad - fn(p) * (H - pad * 2)}`;
  });
  return (
    <svg className="ease-preview" width={W} height={H}>
      <line x1={pad} y1={H - pad} x2={W - pad} y2={pad} stroke="#313534" strokeDasharray="2 3" />
      <polyline points={pts.join(" ")} fill="none" stroke="#d9f9b9" strokeWidth="1.8" />
    </svg>
  );
}

export function Inspector({
  shot, editor, time, selected, onSelect, keySel, setKeySel,
}: {
  shot: Shot;
  editor: EditorApi;
  time: number;
  selected: string | null;
  onSelect: (id: string | null) => void;
  keySel: KeySel | null;
  setKeySel: (k: KeySel | null) => void;
}) {
  const layer = selected ? shot.layers.find((l) => l.id === selected) : undefined;
  const t = snapTime(time, shot.fps);

  if (!layer) return <ShotSettings shot={shot} editor={editor} />;

  const mutate = (fn: (l: Layer) => void, checkpoint = true) =>
    editor.apply((d) => fn(d.layers.find((l) => l.id === layer.id)!), { checkpoint });

  const groups = new Map<string, PropDef[]>();
  for (const def of propsForLayer(layer)) {
    if (!groups.has(def.group)) groups.set(def.group, []);
    groups.get(def.group)!.push(def);
  }

  const renderProp = (def: PropDef) => {
    const kfs = layer.keyframes?.[def.key];
    const animated = !!kfs?.length;
    const here = animated && kfs!.some((k) => Math.abs(k.t - t) < EPS);
    const value = getValue(layer, def.key, t);
    const canAnimate = ANIMATABLE.includes(def.kind);
    const set = (v: number | string, checkpoint = false) => mutate((l) => setValueAt(l, def.key, t, v), checkpoint);

    const watch = canAnimate ? (
      <button
        className={`stopwatch ${here ? "here" : animated ? "on" : ""}`}
        title={animated ? (here ? "Remove keyframe here · Alt-click: stop animating" : "Add keyframe here · Alt-click: stop animating") : "Animate this property"}
        onClick={(e) => {
          if (e.altKey || !animated) mutate((l) => toggleAnimated(l, def.key, t));
          else mutate((l) => toggleKeyframeAt(l, def.key, t));
        }}
      >
        <Diamond filled={here} />
      </button>
    ) : (
      <span />
    );

    if (def.kind === "number") {
      return (
        <div className="prop" key={def.key}>
          {watch}
          <NumberField
            label={def.label}
            value={Number(value)}
            step={def.step}
            min={def.min}
            max={def.max}
            onBegin={editor.checkpoint}
            onChange={(v) => set(v)}
          />
        </div>
      );
    }
    if (def.kind === "color") {
      return (
        <div className="prop" key={def.key}>
          {watch}
          <label className="static">{def.label}</label>
          <ColorField value={String(value)} onBegin={editor.checkpoint} onChange={(v) => set(v)} />
        </div>
      );
    }
    if (def.kind === "enum") {
      return (
        <div className="prop" key={def.key}>
          {watch}
          <label className="static">{def.label}</label>
          <select value={String(value)} onChange={(e) => set(e.target.value, true)}>
            {def.options!.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </div>
      );
    }
    return (
      <div className={`prop ${def.kind === "text" ? "wide" : ""}`} key={def.key} style={def.kind === "text" ? { alignItems: "start" } : undefined}>
        {watch}
        {def.kind === "text" ? (
          <div style={{ display: "grid", gap: 4 }}>
            <label className="static">{def.label}</label>
            <TextField multiline value={String(value)} onCommit={(v) => set(v, true)} />
          </div>
        ) : (
          <>
            <label className="static">{def.label}</label>
            <TextField value={String(value)} onCommit={(v) => set(v, true)} />
          </>
        )}
      </div>
    );
  };

  // Selected keyframe (ease editor).
  const kfLayer = keySel?.layerId === layer.id ? layer : undefined;
  const kf = kfLayer?.keyframes?.[keySel!.prop]?.find((k) => Math.abs(k.t - keySel!.t) < EPS);
  const kfIsLast = kf && kfLayer!.keyframes![keySel!.prop].at(-1) === kf;
  const setKf = (fn: (k: NonNullable<typeof kf>) => void) =>
    mutate((l) => {
      const k = l.keyframes?.[keySel!.prop]?.find((x) => Math.abs(x.t - keySel!.t) < EPS);
      if (k) fn(k);
    });
  const easeName = kf ? (Array.isArray(kf.ease) ? "custom" : kf.ease ?? "linear") : "linear";

  const others = shot.layers.filter((l) => l.id !== layer.id);

  return (
    <div className="inspector">
      <div className="section">
        <div className="section-title">
          Layer <span className="spacer" />
          <span className="mono" style={{ textTransform: "none", letterSpacing: 0 }}>{layer.type}</span>
        </div>
        <div className="prop" style={{ gridTemplateColumns: "60px 1fr" }}>
          <label className="static">Name</label>
          <TextField value={layer.name ?? ""} onCommit={(v) => mutate((l) => (v ? (l.name = v) : delete l.name))} />
        </div>
        <div className="prop" style={{ gridTemplateColumns: "60px 1fr" }}>
          <label className="static">Parent</label>
          <select
            value={layer.parent ?? ""}
            onChange={(e) => {
              const p = e.target.value;
              mutate((l) => (p ? (l.parent = p) : delete l.parent));
            }}
          >
            <option value="">None</option>
            {others.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name ?? o.id}
              </option>
            ))}
          </select>
        </div>
        <div className="prop" style={{ gridTemplateColumns: "60px 1fr" }}>
          <label className="static" title="Track matte: only show this layer where the matte layer has alpha">Matte</label>
          <select
            value={layer.matte ?? ""}
            onChange={(e) => {
              const m = e.target.value;
              mutate((l) => (m ? (l.matte = m) : delete l.matte));
            }}
          >
            <option value="">None</option>
            {others.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name ?? o.id}
              </option>
            ))}
          </select>
        </div>
        {layer.matte && (
          <div className="prop" style={{ gridTemplateColumns: "60px 1fr" }}>
            <label className="static">Mode</label>
            <select
              value={layer.matteMode ?? "alpha"}
              onChange={(e) => {
                const m = e.target.value;
                mutate((l) => (m === "inverse" ? (l.matteMode = "inverse") : delete l.matteMode));
              }}
            >
              <option value="alpha">Alpha matte</option>
              <option value="inverse">Inverted alpha matte</option>
            </select>
          </div>
        )}
        <div className="prop" style={{ gridTemplateColumns: "60px 1fr 60px 1fr" }}>
          <NumberField
            label="In"
            value={layer.start ?? 0}
            step={1 / shot.fps}
            min={0}
            onBegin={editor.checkpoint}
            onChange={(v) => mutate((l) => (l.start = snapTime(v, shot.fps)), false)}
          />
          <NumberField
            label="Out"
            value={layer.end ?? shot.duration}
            step={1 / shot.fps}
            min={0}
            onBegin={editor.checkpoint}
            onChange={(v) => mutate((l) => (l.end = snapTime(v, shot.fps)), false)}
          />
        </div>
        <div className="row" style={{ flexWrap: "wrap" }}>
          <button
            onClick={() => {
              const taken = new Set(shot.layers.map((l) => l.id));
              let id = `${layer.id}-copy`, i = 2;
              while (taken.has(id)) id = `${layer.id}-copy${i++}`;
              editor.apply((d) => {
                const idx = d.layers.findIndex((l) => l.id === layer.id);
                d.layers.splice(idx, 0, { ...structuredClone(layer), id, name: `${layer.name ?? layer.id} copy` });
              });
              onSelect(id);
            }}
          >
            <Copy size={16} /> Duplicate
          </button>
          <button
            className="danger"
            onClick={() => {
              editor.apply((d) => {
                d.layers = d.layers.filter((l) => l.id !== layer.id);
                for (const l of d.layers) if (l.parent === layer.id) delete l.parent;
              });
              onSelect(null);
            }}
          >
            <TrashCan size={16} /> Delete
          </button>
          <span className="muted mono" style={{ fontSize: 10 }}>id: {layer.id}</span>
        </div>
      </div>

      {kf && (
        <div className="section keyframe">
          <div className="section-title">
            Keyframe · {propDef(layer, keySel!.prop)?.label ?? keySel!.prop}
            <span className="spacer" />
            <button className="ghost icon" onClick={() => setKeySel(null)} aria-label="Close"><Close size={16} /></button>
          </div>
          <div className="prop" style={{ gridTemplateColumns: "60px 1fr" }}>
            <NumberField
              label="Time"
              value={kf.t}
              step={1 / shot.fps}
              min={0}
              max={shot.duration}
              onBegin={editor.checkpoint}
              onChange={(v) => {
                const nt = snapTime(v, shot.fps);
                mutate((l) => {
                  const ks = l.keyframes![keySel!.prop];
                  const k = ks.find((x) => Math.abs(x.t - keySel!.t) < EPS);
                  if (k && !ks.some((x) => x !== k && Math.abs(x.t - nt) < EPS)) {
                    k.t = nt;
                    ks.sort((a, b) => a.t - b.t);
                  }
                }, false);
                setKeySel({ ...keySel!, t: nt });
              }}
            />
          </div>
          {kfIsLast ? (
            <div className="muted">Last keyframe — easing applies to the segment leaving a keyframe.</div>
          ) : (
            <>
              <div className="row" style={{ alignItems: "start" }}>
                <div style={{ display: "grid", gap: 6, flex: 1 }}>
                  <label>Ease out of this key</label>
                  <select
                    value={easeName}
                    onChange={(e) => {
                      const name = e.target.value;
                      setKf((k) => {
                        if (name === "custom") k.ease = [0.4, 0, 0.2, 1];
                        else if (name === "linear") delete k.ease;
                        else k.ease = name;
                      });
                    }}
                  >
                    {EASE_NAMES.map((n) => (
                      <option key={n}>{n}</option>
                    ))}
                    <option value="custom">custom (bezier)</option>
                  </select>
                  <button
                    title="Apply this ease to every keyframe of this property"
                    onClick={() =>
                      mutate((l) => {
                        for (const k of l.keyframes![keySel!.prop]) if (kf.ease) k.ease = kf.ease;
                        else delete k.ease;
                      })
                    }
                  >
                    Apply to all keys
                  </button>
                </div>
                <EaseCurve ease={kf.ease} />
              </div>
              {Array.isArray(kf.ease) && (
                <div className="prop" style={{ gridTemplateColumns: "repeat(4, 22px 1fr)" }}>
                  {(["x1", "y1", "x2", "y2"] as const).map((lab, i) => (
                    <NumberField
                      key={lab}
                      label={lab}
                      value={(kf.ease as number[])[i]}
                      step={0.01}
                      min={i % 2 === 0 ? 0 : undefined}
                      max={i % 2 === 0 ? 1 : undefined}
                      onBegin={editor.checkpoint}
                      onChange={(v) =>
                        mutate((l) => {
                          const k = l.keyframes![keySel!.prop].find((x) => Math.abs(x.t - keySel!.t) < EPS)!;
                          const arr = [...(k.ease as number[])] as [number, number, number, number];
                          arr[i] = v;
                          k.ease = arr;
                        }, false)
                      }
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {[...groups.entries()].map(([group, defs]) => (
        <div className="section" key={group}>
          <div className="section-title">{group}</div>
          {defs.map(renderProp)}
        </div>
      ))}
    </div>
  );
}

function ShotSettings({ shot, editor }: { shot: Shot; editor: EditorApi }) {
  const set = <K extends keyof Shot>(k: K, v: Shot[K], checkpoint = true) =>
    editor.apply((d) => void (d[k] = v), { checkpoint });
  return (
    <div className="inspector">
      <div className="section">
        <div className="section-title">Shot</div>
        <div className="prop" style={{ gridTemplateColumns: "80px 1fr" }}>
          <label className="static">Name</label>
          <TextField value={shot.name} onCommit={(v) => set("name", v)} />
        </div>
        <div className="prop" style={{ gridTemplateColumns: "80px 1fr" }}>
          <label className="static">Version note</label>
          <TextField value={shot.note ?? ""} onCommit={(v) => set("note", v)} />
        </div>
        <div className="prop" style={{ gridTemplateColumns: "80px 1fr" }}>
          <NumberField label="Width" value={shot.width} min={2} onBegin={editor.checkpoint} onChange={(v) => set("width", Math.round(v), false)} />
        </div>
        <div className="prop" style={{ gridTemplateColumns: "80px 1fr" }}>
          <NumberField label="Height" value={shot.height} min={2} onBegin={editor.checkpoint} onChange={(v) => set("height", Math.round(v), false)} />
        </div>
        <div className="prop" style={{ gridTemplateColumns: "80px 1fr" }}>
          <label className="static">FPS</label>
          <select value={shot.fps} onChange={(e) => set("fps", Number(e.target.value))}>
            {[12, 24, 25, 30, 48, 50, 60].map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
        </div>
        <div className="prop" style={{ gridTemplateColumns: "80px 1fr" }}>
          <NumberField label="Duration (s)" value={shot.duration} step={0.1} min={0.1} onBegin={editor.checkpoint} onChange={(v) => set("duration", v, false)} />
        </div>
        <div className="prop" style={{ gridTemplateColumns: "80px 1fr" }}>
          <label className="static">Background</label>
          <ColorField value={shot.background ?? "#000000"} onBegin={editor.checkpoint} onChange={(v) => set("background", v, false)} />
        </div>
      </div>
      <div className="section muted">
        Select a layer in the viewer or timeline to edit it. Click a property’s ◇ to animate it — after that,
        changing the value at the playhead creates a keyframe.
      </div>
    </div>
  );
}
