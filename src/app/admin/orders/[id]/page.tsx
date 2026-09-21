import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getOrder } from "@/infra/db/order-repository";
import type { OrderDetail, OrderItemRow } from "@/types/domain";
import { Card, CardList, CardListItem } from "@/ui/Card";
import { PageContainer } from "@/ui/PageContainer";
import { PageHeading } from "@/ui/PageHeading";
import { OrderActions } from "./order-actions";

// Server-side DB access needs DATABASE_URL at build time; skip prerender so
// `next build` in CI (no .env) doesn't blow up on env.ts Zod parse.
export const dynamic = "force-dynamic";

type RouteParams = { id: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>;
}): Promise<Metadata> {
  const { id } = await params;
  const data = await getOrder(id);
  if (!data) return { title: "Pedido no encontrado · Restaurante" };
  return {
    title: `Pedido #${data.order.sequentialNumber} · Restaurante`,
  };
}

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { id } = await params;
  const data = await getOrder(id);
  if (!data) notFound();

  const o = data.order;
  const detail: OrderDetail = {
    order: {
      id: o.id,
      sequentialNumber: o.sequentialNumber,
      status: o.status,
      serviceType: o.serviceType,
      customerPhone: o.customerPhone,
      customerName: o.customerName,
      total: o.total,
      deliveryAddress: o.deliveryAddress,
      deliveryColoniaId: o.deliveryColoniaId,
      deliveryCost: o.deliveryCost,
      deliveryCostOverride: o.deliveryCostOverride,
      subtotal: o.subtotal,
      source: o.source,
      notes: o.notes,
      createdAt: o.createdAt.toISOString(),
      updatedAt: o.updatedAt.toISOString(),
      deliveredAt: o.deliveredAt ? o.deliveredAt.toISOString() : null,
    },
    items: data.items.map(
      (it): OrderItemRow => ({
        id: it.id,
        productId: it.productId,
        productNameSnapshot: it.productNameSnapshot,
        basePriceSnapshot: it.basePriceSnapshot,
        unitPrice: it.unitPrice,
        quantity: it.quantity,
        removedIngredients: it.removedIngredients,
        extraIngredients: it.extraIngredients,
        itemTotal: it.itemTotal,
      }),
    ),
  };

  return (
    <PageContainer width="sm" className="space-y-4">
      <PageHeading>Pedido #{detail.order.sequentialNumber}</PageHeading>
      <Card className="p-4">
        <p>
          <b>Estado:</b> {detail.order.status}
        </p>
        <p>
          <b>Tipo:</b>{" "}
          {detail.order.serviceType === "delivery" ? "Domicilio" : "Local"}
        </p>
        <p>
          <b>Cliente:</b> {detail.order.customerName || "—"} ·{" "}
          {detail.order.customerPhone}
        </p>
        {detail.order.deliveryAddress && (
          <p>
            <b>Dirección:</b> {detail.order.deliveryAddress}
          </p>
        )}
        {detail.order.notes && (
          <p>
            <b>Notas:</b> {detail.order.notes}
          </p>
        )}
        <p className="text-sm text-gray-500">
          {new Date(detail.order.createdAt).toLocaleString()}
        </p>
      </Card>
      <CardList>
        {detail.items.map((it) => (
          <CardListItem key={it.id} className="block p-3">
            <div className="flex justify-between">
              <span>
                {it.quantity}x {it.productNameSnapshot}
              </span>
              <span>${it.itemTotal}</span>
            </div>
            {it.removedIngredients.map((r) => (
              <div key={r} className="pl-3 text-xs text-gray-500">
                - sin {r}
              </div>
            ))}
            {it.extraIngredients.map((e) => (
              <div key={e.name} className="pl-3 text-xs text-gray-500">
                + {e.name} (${e.price})
              </div>
            ))}
          </CardListItem>
        ))}
      </CardList>
      <Card className="p-4 text-right">
        <p>Subtotal: ${detail.order.subtotal}</p>
        <p>Envío: ${detail.order.deliveryCost}</p>
        <p className="text-xl font-bold">Total: ${detail.order.total}</p>
      </Card>
      <OrderActions
        orderId={detail.order.id}
        status={detail.order.status}
        hasSubtotal={detail.order.subtotal !== "0.00"}
      />
    </PageContainer>
  );
}
