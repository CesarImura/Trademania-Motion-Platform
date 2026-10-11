import { promises as fs } from "node:fs";
import path from "node:path";
import { isValidExportName } from "@/lib/filename";
import { assertId, errorResponse, EXPORTS_DIR, HttpError, safeJoin } from "@/lib/store";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    assertId(id);
    const dir = path.join(EXPORTS_DIR, id);
    const files = await fs.readdir(dir).catch(() => [] as string[]);
    const out = await Promise.all(
      files
        .filter((f) => f.endsWith(".mp4"))
        .map(async (file) => {
          const stat = await fs.stat(path.join(dir, file));
          return { file, size: stat.size, mtime: stat.mtimeMs, path: `exports/${id}/${file}` };
        }),
    );
    return Response.json(out.sort((a, b) => b.mtime - a.mtime));
  } catch (e) {
    return errorResponse(e);
  }
}

/** Body: raw mp4 bytes. Query: ?file=<name>.mp4 */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    assertId(id);
    const file = new URL(req.url).searchParams.get("file") ?? "";
    if (!isValidExportName(file)) throw new HttpError(400, "Invalid file name");
    const dir = path.join(EXPORTS_DIR, id);
    await fs.mkdir(dir, { recursive: true });
    const full = safeJoin(dir, file);
    await fs.writeFile(full, Buffer.from(await req.arrayBuffer()));
    return Response.json({ path: path.relative(process.cwd(), full), absolute: full });
  } catch (e) {
    return errorResponse(e);
  }
}
