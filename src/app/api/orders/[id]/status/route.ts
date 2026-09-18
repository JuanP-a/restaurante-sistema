import { NextRequest, NextResponse } from "next/server";
import { getOrder, updateOrderStatus } from "@/infra/db/order-repository";
import { canTransition } from "@/core/order/state-machine";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { status } = (await req.json()) as { status: string };
  const data = await getOrder(id);
  if (!data) {
    return NextResponse.json(
      { ok: false, error: { message: "No existe" } },
      { status: 404 },
    );
  }
  if (!canTransition(data.order.status, status as "received" | "delivered" | "cancelled")) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          message: `Transición inválida: ${data.order.status} -> ${status}`,
        },
      },
      { status: 400 },
    );
  }
  const updated = await updateOrderStatus(id, status as "received" | "delivered" | "cancelled");
  return NextResponse.json({ ok: true, data: updated });
}
