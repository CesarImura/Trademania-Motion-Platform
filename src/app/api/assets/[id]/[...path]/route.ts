import { promises as fs } from "node:fs";
import path from "node:path";
import { assertId, errorResponse, safeJoin, SHOTS_DIR } from "@/lib/store";

const TYPES: Record<string, string> = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp",
  ".gif": "image/gif", ".svg": "image/svg+xml", ".avif": "image/avif",
};

type Ctx = { params: Promise<{ id: string; path: string[] }> };

/** Serves files from shots/<id>/assets/. */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { id, path: parts } = await params;
    assertId(id);
    const full = safeJoin(path.join(SHOTS_DIR, id, "assets"), ...parts);
    const data = await fs.readFile(full);
    return new Response(data, {
      headers: { "Content-Type": TYPES[path.extname(full).toLowerCase()] ?? "application/octet-stream", "Cache-Control": "no-cache" },
    });
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return new Response("Not found", { status: 404 });
    return errorResponse(e);
  }
}
