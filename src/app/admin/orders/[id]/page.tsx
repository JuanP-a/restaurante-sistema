"use client";
import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { OrderDetail, OrderItemRow } from "@/types/domain";
import { OrderDetailResponse } from "@/types/api-schemas";
import { Button } from "@/ui/Button";
import { Card, CardList, CardListItem } from "@/ui/Card";
import { Loading } from "@/ui/Loading";
import { PageContainer } from "@/ui/PageContainer";
import { PageHeading } from "@/ui/PageHeading";

export default function OrderDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [d, setD] = useState<OrderDetail | null>(null);

  useEffect(() => {
    fetch(`/api/orders/${id}`)
      .then((r) => r.json())
      .then(OrderDetailResponse.parse)
      .then((res) => setD(res.data));
  }, [id]);

  async function delivered(): Promise<void> {
    if (!d) return;
    await fetch(`/api/orders/${d.order.id}/status`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "delivered" }),
    });
    router.push("/admin/orders");
  }

  if (!d) return <Loading />;

  return (
    <PageContainer width="sm" className="space-y-4">
      <PageHeading>Pedido #{d.order.sequentialNumber}</PageHeading>
      <Card className="p-4">
        <p>
          <b>Estado:</b> {d.order.status}
        </p>
        <p>
          <b>Tipo:</b>{" "}
          {d.order.serviceType === "delivery" ? "Domicilio" : "Local"}
        </p>
        <p>
          <b>Cliente:</b> {d.order.customerName || "—"} ·{" "}
          {d.order.customerPhone}
        </p>
        {d.order.deliveryAddress && (
          <p>
            <b>Dirección:</b> {d.order.deliveryAddress}
          </p>
        )}
        {d.order.notes && (
          <p>
            <b>Notas:</b> {d.order.notes}
          </p>
        )}
        <p className="text-sm text-gray-500">
          {new Date(d.order.createdAt).toLocaleString()}
        </p>
      </Card>
      <CardList>
        {d.items.map((it: OrderItemRow) => (
          <CardListItem key={it.id} className="block p-3">
            <div className="flex justify-between">
              <span>
                {it.quantity}x {it.productNameSnapshot}
              </span>
              <span>${it.itemTotal}</span>
            </div>
            {it.removedIngredients.map((r: string) => (
              <div key={r} className="pl-3 text-xs text-gray-500">
                - sin {r}
              </div>
            ))}
            {it.extraIngredients.map((e: { name: string; price: string }) => (
              <div key={e.name} className="pl-3 text-xs text-gray-500">
                + {e.name} (${e.price})
              </div>
            ))}
          </CardListItem>
        ))}
      </CardList>
      <Card className="p-4 text-right">
        <p>Subtotal: ${d.order.subtotal}</p>
        <p>Envío: ${d.order.deliveryCost}</p>
        <p className="text-xl font-bold">Total: ${d.order.total}</p>
      </Card>
      <div className="flex gap-2">
        <a
          href={`/print/${d.order.id}/kitchen`}
          target="_blank"
          rel="noreferrer"
          className="flex-1"
        >
          <Button variant="secondary" className="w-full py-2">
            Reimprimir comanda
          </Button>
        </a>
        <a
          href={`/print/${d.order.id}/bill`}
          target="_blank"
          rel="noreferrer"
          className="flex-1"
        >
          <Button variant="secondary" className="w-full py-2">
            Reimprimir cuenta
          </Button>
        </a>
      </div>
      {d.order.status === "received" && (
        <Button
          onClick={() => void delivered()}
          variant="primary"
          className="w-full bg-green-600 py-2"
        >
          Marcar como entregado
        </Button>
      )}
    </PageContainer>
  );
}
