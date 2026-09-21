import { NextResponse } from "next/server";
import { deleteZone, updateZone } from "@/infra/db/delivery-repository";
import { validateDeliveryCost } from "@/core/delivery/validate-cost";

type RouteParams = { params: Promise<{ id: string }> };

type ZonePatch = Partial<{
  name: string;
  cost: string;
  active: boolean;
  sortOrder: number;
}>;

export async function PATCH(req: Request, { params }: RouteParams) {
  const { id } = await params;
  const body = (await req.json()) as Record<string, unknown>;
  const patch: ZonePatch = {};
  if (typeof body.name === "string") patch.name = body.name;
  if (body.cost != null) {
    const v = validateDeliveryCost(String(body.cost));
    if (!v.ok) {
      return NextResponse.json(
        { ok: false, error: { message: v.error.message } },
        { status: 400 },
      );
    }
    patch.cost = String(body.cost);
  }
  if (typeof body.active === "boolean") patch.active = body.active;
  if (typeof body.sortOrder === "number") patch.sortOrder = body.sortOrder;
  const row = await updateZone(id, patch);
  return NextResponse.json({ ok: true, data: row });
}

export async function DELETE(_req: Request, { params }: RouteParams) {
  const { id } = await params;
  await deleteZone(id);
  return NextResponse.json({ ok: true });
}
