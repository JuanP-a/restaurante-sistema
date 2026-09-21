import { NextResponse } from "next/server";
import { deleteColonia, updateColonia } from "@/infra/db/delivery-repository";

type RouteParams = { params: Promise<{ id: string }> };

type ColoniaPatch = Partial<{ name: string; active: boolean }>;

export async function PATCH(req: Request, { params }: RouteParams) {
  const { id } = await params;
  const body = (await req.json()) as Record<string, unknown>;
  const patch: ColoniaPatch = {};
  if (typeof body.name === "string") patch.name = body.name;
  if (typeof body.active === "boolean") patch.active = body.active;
  const row = await updateColonia(id, patch);
  return NextResponse.json({ ok: true, data: row });
}

export async function DELETE(_req: Request, { params }: RouteParams) {
  const { id } = await params;
  await deleteColonia(id);
  return NextResponse.json({ ok: true });
}
