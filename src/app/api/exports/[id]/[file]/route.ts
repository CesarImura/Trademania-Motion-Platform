import { promises as fs } from "node:fs";
import path from "node:path";
import { isValidExportName } from "@/lib/filename";
import { assertId, errorResponse, EXPORTS_DIR, HttpError, safeJoin } from "@/lib/store";

type Ctx = { params: Promise<{ id: string; file: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { id, file } = await params;
    assertId(id);
    const data = await fs.readFile(safeJoin(path.join(EXPORTS_DIR, id), file));
    return new Response(data, { headers: { "Content-Type": "video/mp4" } });
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return new Response("Not found", { status: 404 });
    return errorResponse(e);
  }
}

/** Body: { name: "<new>.mp4" } (".mp4" is added if missing). */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const { id, file } = await params;
    assertId(id);
    let name = String(((await req.json()) as { name?: string }).name ?? "").trim();
    if (!name.endsWith(".mp4")) name += ".mp4";
    if (!isValidExportName(name)) throw new HttpError(400, "Names can't contain / \\ : * ? \" < > |");
    const dir = path.join(EXPORTS_DIR, id);
    const from = safeJoin(dir, file);
    const to = safeJoin(dir, name);
    if (to !== from && (await fs.stat(to).catch(() => null))) throw new HttpError(409, `${name} already exists`);
    await fs.rename(from, to);
    return Response.json({ file: name });
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return new Response("Not found", { status: 404 });
    return errorResponse(e);
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const { id, file } = await params;
    assertId(id);
    await fs.unlink(safeJoin(path.join(EXPORTS_DIR, id), file));
    return Response.json({ ok: true });
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return new Response("Not found", { status: 404 });
    return errorResponse(e);
  }
}
