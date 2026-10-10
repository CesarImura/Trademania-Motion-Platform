"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Shot, VersionInfo } from "@/lib/types";

const POLL_MS = 1200;
const MAX_HISTORY = 300;

async function json<T>(res: Response): Promise<T> {
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? res.statusText);
  return body as T;
}

/**
 * Owns the shot being edited: loading versions, undo/redo, saving, and
 * watching the shot folder so versions Claude writes show up live.
 */
export function useEditor(id: string, requestedV: number | null) {
  const [shot, setShot] = useState<Shot | null>(null);
  const [v, setV] = useState<number | null>(null);
  const [versions, setVersions] = useState<VersionInfo[]>([]);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newer, setNewer] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [historySize, setHistorySize] = useState({ undo: 0, redo: 0 });

  const shotRef = useRef<Shot | null>(null);
  const vRef = useRef<number | null>(null);
  const dirtyRef = useRef(false);
  const mtimeRef = useRef(0);
  const knownLatest = useRef(0);
  const undoStack = useRef<Shot[]>([]);
  const redoStack = useRef<Shot[]>([]);

  shotRef.current = shot;
  vRef.current = v;
  dirtyRef.current = dirty;

  const flash = useCallback((msg: string) => {
    setToast(msg);
    window.clearTimeout((flash as unknown as { t?: number }).t);
    (flash as unknown as { t?: number }).t = window.setTimeout(() => setToast(null), 2200);
  }, []);

  const syncHistory = () => setHistorySize({ undo: undoStack.current.length, redo: redoStack.current.length });

  const load = useCallback(
    async (n: number, opts: { keepHistory?: boolean } = {}) => {
      try {
        const data = await json<{ shot: Shot; mtime: number }>(await fetch(`/api/shots/${id}/${n}`, { cache: "no-store" }));
        if (!opts.keepHistory) {
          undoStack.current = [];
          redoStack.current = [];
        } else if (shotRef.current) {
          undoStack.current.push(shotRef.current);
        }
        syncHistory();
        mtimeRef.current = data.mtime;
        setShot(data.shot);
        setV(n);
        setDirty(false);
        setError(null);
        if (n >= knownLatest.current) setNewer(null);
        const url = new URL(window.location.href);
        url.searchParams.set("v", String(n));
        window.history.replaceState(null, "", url);
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [id],
  );

  const refreshVersions = useCallback(async () => {
    const data = await json<{ versions: VersionInfo[] }>(await fetch(`/api/shots/${id}`, { cache: "no-store" }));
    setVersions(data.versions);
    return data.versions;
  }, [id]);

  // Initial load.
  useEffect(() => {
    let cancelled = false;
    refreshVersions()
      .then((vs) => {
        if (cancelled) return;
        const latest = vs.at(-1)?.v ?? 1;
        knownLatest.current = latest;
        const target = requestedV && vs.some((x) => x.v === requestedV) ? requestedV : latest;
        return load(target);
      })
      .catch((e) => setError((e as Error).message));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Watch for versions written on disk (by Claude or a text editor).
  useEffect(() => {
    const timer = window.setInterval(async () => {
      if (document.hidden) return;
      let vs: VersionInfo[];
      try {
        vs = await refreshVersions();
      } catch {
        return;
      }
      const latest = vs.at(-1)?.v ?? 0;
      const cur = vRef.current;
      if (latest > knownLatest.current) {
        const wasOnLatest = cur === knownLatest.current;
        knownLatest.current = latest;
        if (wasOnLatest && !dirtyRef.current) {
          await load(latest, { keepHistory: true });
          flash(`Loaded v${latest} — ${vs.at(-1)?.note ?? "new version"}`);
        } else {
          setNewer(latest);
        }
        return;
      }
      const curInfo = vs.find((x) => x.v === cur);
      if (curInfo && cur && curInfo.mtime > mtimeRef.current + 1) {
        if (!dirtyRef.current) {
          await load(cur, { keepHistory: true });
          flash(`v${cur} updated on disk`);
        } else {
          mtimeRef.current = curInfo.mtime;
          flash(`v${cur} changed on disk — you have unsaved edits`);
        }
      }
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [refreshVersions, load, flash]);

  /** Push the current state onto the undo stack (call once per gesture). */
  const checkpoint = useCallback(() => {
    if (!shotRef.current) return;
    undoStack.current.push(shotRef.current);
    if (undoStack.current.length > MAX_HISTORY) undoStack.current.shift();
    redoStack.current = [];
    syncHistory();
  }, []);

  /** Apply a mutation to a clone of the shot. */
  const apply = useCallback(
    (fn: (draft: Shot) => void, opts: { checkpoint?: boolean } = {}) => {
      const cur = shotRef.current;
      if (!cur) return;
      if (opts.checkpoint !== false) checkpoint();
      const next = structuredClone(cur);
      fn(next);
      shotRef.current = next;
      setShot(next);
      setDirty(true);
    },
    [checkpoint],
  );

  const undo = useCallback(() => {
    const prev = undoStack.current.pop();
    if (!prev || !shotRef.current) return;
    redoStack.current.push(shotRef.current);
    setShot(prev);
    setDirty(true);
    syncHistory();
  }, []);

  const redo = useCallback(() => {
    const next = redoStack.current.pop();
    if (!next || !shotRef.current) return;
    undoStack.current.push(shotRef.current);
    setShot(next);
    setDirty(true);
    syncHistory();
  }, []);

  const save = useCallback(async () => {
    const cur = shotRef.current, n = vRef.current;
    if (!cur || !n) return;
    try {
      const res = await json<{ mtime: number }>(
        await fetch(`/api/shots/${id}/${n}`, { method: "PUT", body: JSON.stringify(cur) }),
      );
      mtimeRef.current = res.mtime;
      setDirty(false);
      flash(`Saved v${n}`);
      refreshVersions();
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id, flash, refreshVersions]);

  const saveAsNew = useCallback(
    async (note?: string) => {
      const cur = shotRef.current;
      if (!cur) return;
      const body = { ...cur, note: note ?? cur.note };
      try {
        const res = await json<{ v: number; mtime: number }>(
          await fetch(`/api/shots/${id}`, { method: "POST", body: JSON.stringify(body) }),
        );
        knownLatest.current = Math.max(knownLatest.current, res.v);
        mtimeRef.current = res.mtime;
        shotRef.current = body;
        setShot(body);
        setV(res.v);
        setDirty(false);
        setNewer(null);
        const url = new URL(window.location.href);
        url.searchParams.set("v", String(res.v));
        window.history.replaceState(null, "", url);
        flash(`Saved as v${res.v}`);
        refreshVersions();
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [id, flash, refreshVersions],
  );

  return {
    shot, v, versions, dirty, error, newer, toast, historySize,
    load, apply, checkpoint, undo, redo, save, saveAsNew, flash, setError,
  };
}

export type EditorApi = ReturnType<typeof useEditor>;
