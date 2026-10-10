import { errorResponse, HttpError, readVersion, writeVersion } from "@/lib/store";
import type { Shot } from "@/lib/types";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; v: string }> };

function parseV(v: string) {
  const n = Number(v.replace(/^v/, ""));
  if (!Number.isInteger(n) || n < 1) throw new HttpError(400, `Invalid version "${v}"`);
  return n;
}

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { id, v } = await params;
    return Response.json(await readVersion(id, parseV(v)));
  } catch (e) {
    return errorResponse(e);
  }
}

/** Overwrite this version in place. */
export async function PUT(req: Request, { params }: Ctx) {
  try {
    const { id, v } = await params;
    const n = parseV(v);
    await readVersion(id, n).catch((e) => {
      if (e instanceof HttpError && e.status === 422) return; // allow fixing a broken file
      throw e;
    });
    const mtime = await writeVersion(id, n, (await req.json()) as Shot);
    return Response.json({ v: n, mtime });
  } catch (e) {
    return errorResponse(e);
  }
}
