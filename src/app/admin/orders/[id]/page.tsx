"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type OrderData = {
  order: {
    id: string;
    sequentialNumber: number;
    status: string;
    serviceType: string;
    subtotal: string;
    deliveryCost: string;
    total: string;
    createdAt: string;
    customerName: string;
    customerPhone: string;
    deliveryAddress?: string;
    notes: string;
  };
  items: {
    id: string;
    quantity: number;
    productNameSnapshot: string;
    unitPrice: string;
    itemTotal: string;
    removedIngredients: string[];
    extraIngredients: { name: string; price: string }[];
  }[];
};

export default function OrderDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const [d, setD] = useState<OrderData | null>(null);

  useEffect(() => {
    void params.then(({ id }) => {
      fetch(`/api/orders/${id}`)
        .then((r) => r.json())
        .then((res: { data: OrderData }) => setD(res.data));
    });
  }, [params]);

  async function delivered(): Promise<void> {
    if (!d) return;
    await fetch(`/api/orders/${d.order.id}/status`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "delivered" }),
    });
    router.push("/admin/orders");
  }

  if (!d) return <div className="p-6">Cargando...</div>;

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-6">
      <h1 className="text-2xl font-bold">Pedido #{d.order.sequentialNumber}</h1>
      <div className="rounded border bg-white p-4">
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
      </div>
      <ul className="divide-y rounded border bg-white">
        {d.items.map((it) => (
          <li key={it.id} className="p-3">
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
          </li>
        ))}
      </ul>
      <div className="rounded border bg-white p-4 text-right">
        <p>Subtotal: ${d.order.subtotal}</p>
        <p>Envío: ${d.order.deliveryCost}</p>
        <p className="text-xl font-bold">Total: ${d.order.total}</p>
      </div>
      <div className="flex gap-2">
        <a
          href={`/print/${d.order.id}/kitchen`}
          target="_blank"
          rel="noreferrer"
          className="flex-1 rounded bg-gray-800 py-2 text-center text-white"
        >
          Reimprimir comanda
        </a>
        <a
          href={`/print/${d.order.id}/bill`}
          target="_blank"
          rel="noreferrer"
          className="flex-1 rounded bg-gray-800 py-2 text-center text-white"
        >
          Reimprimir cuenta
        </a>
      </div>
      {d.order.status === "received" && (
        <button
          onClick={() => void delivered()}
          className="w-full rounded bg-green-600 py-2 text-white"
        >
          Marcar como entregado
        </button>
      )}
    </div>
  );
}
