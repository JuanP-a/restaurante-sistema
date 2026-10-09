import { NextResponse } from "next/server";
import { getOrder } from "@/infra/db/order-repository";
import { getEnv } from "@/env";
import { resolveTransport } from "@/infra/printer/index";
import { printOrder } from "@/infra/printer/print-service";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const data = await getOrder(id);
  if (!data) {
    return NextResponse.json(
      { ok: false, error: { message: "Pedido no encontrado" } },
      { status: 404 },
    );
  }
  const outcome = await printOrder(data, "kitchen", resolveTransport(getEnv()));
  if (outcome.printed === "failed") {
    return NextResponse.json(
      { ok: false, error: { message: "No se pudo imprimir la comanda" } },
      { status: 502 },
    );
  }
  return NextResponse.json({ ok: true, printed: outcome.printed });
}
