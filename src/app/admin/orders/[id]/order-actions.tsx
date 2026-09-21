"use client";
import { useRouter } from "next/navigation";
import type { OrderDetail } from "@/types/domain";
import { Button } from "@/ui/Button";

export function OrderActions({
  orderId,
  status,
  hasSubtotal,
}: {
  orderId: string;
  status: OrderDetail["order"]["status"];
  hasSubtotal: boolean;
}) {
  const router = useRouter();

  async function delivered(): Promise<void> {
    await fetch(`/api/orders/${orderId}/status`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "delivered" }),
    });
    router.push("/admin/orders");
    router.refresh();
  }

  return (
    <>
      <div className="flex gap-2">
        <a
          href={`/print/${orderId}/kitchen`}
          target="_blank"
          rel="noreferrer"
          className="flex-1"
        >
          <Button variant="secondary" className="w-full py-2">
            Reimprimir comanda
          </Button>
        </a>
        <a
          href={`/print/${orderId}/bill`}
          target="_blank"
          rel="noreferrer"
          className="flex-1"
        >
          <Button variant="secondary" className="w-full py-2">
            Reimprimir cuenta
          </Button>
        </a>
      </div>
      {hasSubtotal && status === "received" && (
        <Button
          onClick={() => void delivered()}
          variant="primary"
          className="w-full bg-green-600 py-2"
        >
          Marcar como entregado
        </Button>
      )}
    </>
  );
}
