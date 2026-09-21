"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import type { OrderRow } from "@/types/domain";
import { Button } from "@/ui/Button";
import { CardList, CardListItem } from "@/ui/Card";

export function OrdersList({ initial }: { initial: OrderRow[] }) {
  const [orders, setOrders] = useState<OrderRow[]>(initial);
  const [isNew, setIsNew] = useState<Record<string, boolean>>({});

  async function load(): Promise<void> {
    const r = await fetch("/api/orders?status=received");
    const d = (await r.json()) as { data: OrderRow[] };
    setOrders(d.data);
  }

  useEffect(() => {
    const ev = new EventSource("/api/events");
    const timers = new Map<string, ReturnType<typeof setTimeout>>();
    ev.addEventListener("order_created", (e: MessageEvent) => {
      const o = JSON.parse(e.data) as OrderRow;
      setOrders((prev) => [o, ...prev.filter((x) => x.id !== o.id)]);
      setIsNew((prev) => ({ ...prev, [o.id]: true }));
      const t = setTimeout(() => {
        setIsNew((prev) => ({ ...prev, [o.id]: false }));
        timers.delete(o.id);
      }, 30000);
      timers.set(o.id, t);
    });
    return () => {
      ev.close();
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
    };
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
    <>
      <div aria-live="polite" className="sr-only">
        {Object.values(isNew).filter(Boolean).length > 0 &&
          "Nuevo pedido recibido"}
      </div>
      <CardList>
        {orders.map((o) => (
          <CardListItem
            key={o.id}
            className={`p-4 ${isNew[o.id] ? "ring-2 ring-yellow-400" : ""}`}
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
            <Button
              variant="primary"
              onClick={() => void markDelivered(o.id)}
              className="ml-4 bg-green-600 text-sm"
            >
              Entregado
            </Button>
          </CardListItem>
        ))}
      </CardList>
    </>
  );
}
