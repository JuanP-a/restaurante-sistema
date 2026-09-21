import { NextResponse } from "next/server";
import {
  createColonia,
  listColoniasWithZone,
} from "@/infra/db/delivery-repository";

export async function GET() {
  const rows = await listColoniasWithZone();
  return NextResponse.json({ ok: true, data: rows });
}

export async function POST(req: Request) {
  const body = (await req.json()) as { name?: unknown; zoneId?: unknown };
  if (
    !body.name ||
    typeof body.name !== "string" ||
    !body.zoneId ||
    typeof body.zoneId !== "string"
  ) {
    return NextResponse.json(
      { ok: false, error: { message: "Faltan campos" } },
      { status: 400 },
    );
  }
  const row = await createColonia({
    name: body.name,
    zoneId: body.zoneId,
  });
  return NextResponse.json({ ok: true, data: row });
}
