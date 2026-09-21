import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/infra/db/client";
import { orderEvents } from "@/infra/db/schema";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const db = getDb();
  await db
    .insert(orderEvents)
    .values({ orderId: id, kind: "printed_kitchen", payload: {} });
  return NextResponse.json({ ok: true });
}
