import { createVersion, errorResponse, listVersions } from "@/lib/store";
import type { Shot } from "@/lib/types";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    return Response.json({ id, versions: await listVersions(id) });
  } catch (e) {
    return errorResponse(e);
  }
}

/** Save the body as the next version. */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const shot = (await req.json()) as Shot;
    return Response.json(await createVersion(id, shot));
  } catch (e) {
    return errorResponse(e);
  }
}
