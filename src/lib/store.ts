import { promises as fs } from "node:fs";
import path from "node:path";
import type { Shot, ShotSummary, VersionInfo } from "./types";

export const ROOT = process.cwd();
export const SHOTS_DIR = path.join(ROOT, "shots");
export const EXPORTS_DIR = path.join(ROOT, "exports");

const ID_RE = /^[a-z0-9][a-z0-9_-]{0,80}$/i;
const VERSION_RE = /^v(\d+)\.json$/;

export function assertId(id: string) {
  if (!ID_RE.test(id)) throw new HttpError(400, `Invalid shot id "${id}"`);
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function versionFile(v: number) {
  return `v${String(v).padStart(3, "0")}.json`;
}

async function exists(p: string) {
  return fs.stat(p).then(() => true, () => false);
}

export async function listVersions(id: string): Promise<VersionInfo[]> {
  assertId(id);
  const dir = path.join(SHOTS_DIR, id);
  if (!(await exists(dir))) throw new HttpError(404, `Shot "${id}" not found`);
  const files = (await fs.readdir(dir)).filter((f) => VERSION_RE.test(f));
  const out = await Promise.all(
    files.map(async (file) => {
      const full = path.join(dir, file);
      const stat = await fs.stat(full);
      let note: string | undefined;
      try {
        note = (JSON.parse(await fs.readFile(full, "utf8")) as Shot).note;
      } catch {
        note = "⚠︎ invalid JSON";
      }
      return { v: Number(file.match(VERSION_RE)![1]), file, mtime: stat.mtimeMs, note };
    }),
  );
  return out.sort((a, b) => a.v - b.v);
}

export async function readVersion(id: string, v: number): Promise<{ shot: Shot; mtime: number }> {
  assertId(id);
  const full = path.join(SHOTS_DIR, id, versionFile(v));
  if (!(await exists(full))) throw new HttpError(404, `${id} ${versionFile(v)} not found`);
  const [raw, stat] = await Promise.all([fs.readFile(full, "utf8"), fs.stat(full)]);
  try {
    return { shot: JSON.parse(raw), mtime: stat.mtimeMs };
  } catch (e) {
    throw new HttpError(422, `${id}/${versionFile(v)} is not valid JSON: ${(e as Error).message}`);
  }
}

export async function writeVersion(id: string, v: number, shot: Shot) {
  assertId(id);
  const dir = path.join(SHOTS_DIR, id);
  await fs.mkdir(dir, { recursive: true });
  const full = path.join(dir, versionFile(v));
  await fs.writeFile(full, JSON.stringify(shot, null, 2) + "\n");
  return (await fs.stat(full)).mtimeMs;
}

export async function createVersion(id: string, shot: Shot) {
  const versions = await listVersions(id).catch(() => [] as VersionInfo[]);
  const v = (versions.at(-1)?.v ?? 0) + 1;
  const mtime = await writeVersion(id, v, shot);
  return { v, mtime };
}

async function countExports(id: string) {
  const dir = path.join(EXPORTS_DIR, id);
  if (!(await exists(dir))) return 0;
  return (await fs.readdir(dir)).filter((f) => f.endsWith(".mp4")).length;
}

export async function listShots(): Promise<ShotSummary[]> {
  await fs.mkdir(SHOTS_DIR, { recursive: true });
  const entries = await fs.readdir(SHOTS_DIR, { withFileTypes: true });
  const shots = await Promise.all(
    entries
      .filter((e) => e.isDirectory() && ID_RE.test(e.name))
      .map(async (e): Promise<ShotSummary | null> => {
        const versions = await listVersions(e.name);
        const latest = versions.at(-1);
        if (!latest) return null;
        let shot: Partial<Shot> = {};
        try {
          shot = (await readVersion(e.name, latest.v)).shot;
        } catch {
          /* show it anyway */
        }
        return {
          id: e.name,
          name: shot.name ?? e.name,
          width: shot.width ?? 1920,
          height: shot.height ?? 1080,
          fps: shot.fps ?? 30,
          duration: shot.duration ?? 0,
          versions,
          latest: latest.v,
          mtime: Math.max(...versions.map((v) => v.mtime)),
          exports: await countExports(e.name),
        };
      }),
  );
  return shots.filter((s): s is ShotSummary => !!s).sort((a, b) => b.mtime - a.mtime);
}

export function slugify(name: string) {
  return (
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "shot"
  );
}

export async function uniqueId(base: string) {
  let id = base, i = 2;
  while (await exists(path.join(SHOTS_DIR, id))) id = `${base}-${i++}`;
  return id;
}

/** Resolve a path inside `base`, rejecting traversal. */
export function safeJoin(base: string, ...parts: string[]) {
  const full = path.resolve(base, ...parts);
  if (!full.startsWith(path.resolve(base) + path.sep)) throw new HttpError(400, "Invalid path");
  return full;
}

export function errorResponse(e: unknown) {
  const status = e instanceof HttpError ? e.status : 500;
  return Response.json({ error: (e as Error).message ?? String(e) }, { status });
}
