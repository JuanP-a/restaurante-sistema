import { NextRequest, NextResponse } from "next/server";
import { createOrder, listOrders } from "@/infra/db/order-repository";
import { validateNewOrder } from "@/core/order/validate";
import { calculateOrderTotals } from "@/core/pricing/calculate-order";
import { getProduct } from "@/infra/db/menu-repository";
import { getColoniaDeliveryCost } from "@/infra/db/delivery-repository";
import { emitEvent } from "@/infra/events/event-bus";

export async function GET(req: NextRequest) {
  const status = new URL(req.url).searchParams.get("status");
  const rows = await listOrders(
    status ? { status: status as "received" | "delivered" | "cancelled" } : undefined,
  );
  return NextResponse.json({ ok: true, data: rows });
}

type IncomingItem = {
  productId: string;
  quantity: number;
  removed?: string[];
  extras?: { name: string; price: string }[];
};

type IncomingOrder = {
  serviceType: "local" | "delivery";
  customerPhone: string;
  customerName?: string;
  deliveryAddress?: string;
  deliveryColoniaId?: string;
  deliveryCostOverride?: string;
  source?: "whatsapp" | "staff";
  notes?: string;
  items: IncomingItem[];
};

export async function POST(req: NextRequest) {
  const body = (await req.json()) as IncomingOrder;
  const validation = validateNewOrder(body);
  if (!validation.ok) {
    return NextResponse.json(
      { ok: false, error: { message: validation.error.message } },
      { status: 400 },
    );
  }

  const items: {
    productId: string;
    productNameSnapshot: string;
    basePriceSnapshot: string;
    unitPrice: string;
    quantity: number;
    removedIngredients: string[];
    extraIngredients: { name: string; price: string }[];
    itemTotal: string;
  }[] = [];

  for (const it of body.items) {
    const product = await getProduct(it.productId);
    if (!product || !product.active) {
      return NextResponse.json(
        {
          ok: false,
          error: { message: `Producto no disponible: ${it.productId}` },
        },
        { status: 400 },
      );
    }
    const extras = it.extras ?? [];
    const extrasCost = extras.reduce(
      (s: number, e: { price: string }) => s + Number(e.price),
      0,
    );
    const unitPrice = (Number(product.basePrice) + extrasCost).toFixed(2);
    const itemTotal = (Number(unitPrice) * it.quantity).toFixed(2);
    items.push({
      productId: product.id,
      productNameSnapshot: product.name,
      basePriceSnapshot: product.basePrice,
      unitPrice,
      quantity: it.quantity,
      removedIngredients: it.removed ?? [],
      extraIngredients: extras,
      itemTotal,
    });
  }

  let deliveryCost = "0";
  if (body.serviceType === "delivery") {
    if (body.deliveryCostOverride) {
      deliveryCost = String(body.deliveryCostOverride);
    } else if (body.deliveryColoniaId) {
      const cost = await getColoniaDeliveryCost(body.deliveryColoniaId);
      if (cost) deliveryCost = cost;
    }
  }

  const totals = calculateOrderTotals({
    items: items.map((i) => ({
      basePrice: i.unitPrice,
      quantity: i.quantity,
      extras: [],
    })),
    deliveryCost,
  });

  const order = await createOrder({
    serviceType: body.serviceType,
    customerPhone: body.customerPhone,
    customerName: body.customerName ?? "",
    deliveryAddress: body.deliveryAddress,
    deliveryColoniaId: body.deliveryColoniaId,
    deliveryCostOverride: body.deliveryCostOverride,
    deliveryCost,
    subtotal: totals.subtotal,
    total: totals.total,
    source: body.source ?? "staff",
    notes: body.notes ?? "",
    items,
  });

  emitEvent("order_created", order);
  return NextResponse.json({ ok: true, data: order });
}
