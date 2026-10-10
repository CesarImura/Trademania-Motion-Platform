import { createVersion, errorResponse, listShots, slugify, uniqueId } from "@/lib/store";
import type { Shot } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json(await listShots());
  } catch (e) {
    return errorResponse(e);
  }
}

/** Create a new shot. Body: partial Shot (name, width, height, fps, duration...). */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<Shot>;
    const shot: Shot = {
      name: body.name || "Untitled shot",
      note: body.note ?? "Created",
      width: body.width ?? 1920,
      height: body.height ?? 1080,
      fps: body.fps ?? 30,
      duration: body.duration ?? 5,
      background: body.background ?? "#0d0d12",
      layers: body.layers ?? [],
    };
    const id = await uniqueId(slugify(shot.name));
    const { v } = await createVersion(id, shot);
    return Response.json({ id, v });
  } catch (e) {
    return errorResponse(e);
  }
}
