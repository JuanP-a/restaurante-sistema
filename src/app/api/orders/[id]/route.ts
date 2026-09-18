import { NextRequest, NextResponse } from "next/server";
import { getOrder } from "@/infra/db/order-repository";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const data = await getOrder(id);
  if (!data) {
    return NextResponse.json(
      { ok: false, error: { message: "No existe" } },
      { status: 404 },
    );
  }
  return NextResponse.json({ ok: true, data });
}
