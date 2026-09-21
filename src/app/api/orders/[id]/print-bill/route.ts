import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/infra/db/client";
import { orderEvents, orders } from "@/infra/db/schema";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const db = getDb();
  const [existing] = await db.select().from(orders).where(eq(orders.id, id));
  if (!existing) {
    return NextResponse.json(
      { ok: false, error: { message: "Pedido no encontrado" } },
      { status: 404 },
    );
  }
  await db
    .insert(orderEvents)
    .values({ orderId: id, kind: "printed_bill", payload: {} });
  return NextResponse.json({ ok: true });
}
