import { NextResponse } from "next/server";
import { createZone, listZones } from "@/infra/db/delivery-repository";
import { validateDeliveryCost } from "@/core/delivery/validate-cost";

export async function GET() {
  const rows = await listZones();
  return NextResponse.json({ ok: true, data: rows });
}

export async function POST(req: Request) {
  const body = (await req.json()) as { name?: unknown; cost?: unknown };
  if (!body.name || typeof body.name !== "string") {
    return NextResponse.json(
      { ok: false, error: { message: "Falta nombre" } },
      { status: 400 },
    );
  }
  const costStr = body.cost == null ? "" : String(body.cost);
  const v = validateDeliveryCost(costStr);
  if (!v.ok) {
    return NextResponse.json(
      { ok: false, error: { message: v.error.message } } satisfies {
        ok: false;
        error: { message: string };
      },
      { status: 400 },
    );
  }
  const row = await createZone({ name: body.name, cost: costStr });
  return NextResponse.json({ ok: true, data: row });
}
