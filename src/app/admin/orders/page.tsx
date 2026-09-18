"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

type OrderRow = {
  id: string;
  sequentialNumber: number;
  status: string;
  serviceType: string;
  total: string;
  createdAt: string;
};

export default function OrdersDashboard() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [isNew, setIsNew] = useState<Record<string, boolean>>({});

  async function load(): Promise<void> {
    const r = await fetch("/api/orders?status=received");
    const d = (await r.json()) as { data: OrderRow[] };
    setOrders(d.data);
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    const ev = new EventSource("/api/events");
    ev.addEventListener("order_created", (e: MessageEvent) => {
      const o = JSON.parse(e.data) as OrderRow;
      setOrders((prev) => [o, ...prev.filter((x) => x.id !== o.id)]);
      setIsNew((prev) => ({ ...prev, [o.id]: true }));
      setTimeout(
        () => setIsNew((prev) => ({ ...prev, [o.id]: false })),
        30000,
      );
    });
    return () => ev.close();
  }, []);

  async function markDelivered(id: string): Promise<void> {
    await fetch(`/api/orders/${id}/status`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "delivered" }),
    });
    await load();
  }

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Pedidos activos ({orders.length})</h1>
        <Link
          href="/admin/orders/new"
          className="rounded bg-black px-4 py-2 text-white"
        >
          + Nuevo pedido
        </Link>
      </div>
      <ul className="space-y-2">
        {orders.map((o) => (
          <li
            key={o.id}
            className={`flex items-center justify-between rounded border bg-white p-4 ${isNew[o.id] ? "ring-2 ring-yellow-400" : ""}`}
          >
            <Link href={`/admin/orders/${o.id}`} className="flex-1">
              <div className="font-bold">
                #{o.sequentialNumber}{" "}
                <span className="text-sm font-normal text-gray-600">
                  {o.serviceType === "delivery" ? "Domicilio" : "Local"}
                </span>
              </div>
              <div className="text-sm text-gray-500">
                {new Date(o.createdAt).toLocaleTimeString()}
              </div>
            </Link>
            <div className="text-lg font-semibold">${o.total}</div>
            <button
              onClick={() => void markDelivered(o.id)}
              className="ml-4 rounded bg-green-600 px-3 py-1 text-sm text-white"
            >
              Entregado
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
