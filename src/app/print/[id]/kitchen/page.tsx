"use client";
import { useEffect, useState } from "react";

type Data = {
  order: {
    sequentialNumber: number;
    serviceType: string;
    notes: string;
    createdAt: string;
  };
  items: {
    quantity: number;
    productNameSnapshot: string;
    removedIngredients: string[];
    extraIngredients: { name: string }[];
  }[];
};

export default function KitchenPrint({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [data, setData] = useState<Data | null>(null);

  useEffect(() => {
    void params.then(({ id }) => {
      void fetch(`/api/orders/${id}`)
        .then((r) => r.json())
        .then((d: { data: Data }) => {
          setData(d.data);
          void fetch(`/api/orders/${id}/print-kitchen`, { method: "POST" });
          setTimeout(() => window.print(), 500);
        });
    });
  }, [params]);

  if (!data) return <div>Cargando...</div>;
  return (
    <div className="p-2 font-mono text-sm">
      <div className="border-b-2 border-dashed pb-1 text-center font-bold">
        {data.order.serviceType === "delivery" ? "DOMICILIO" : "LOCAL"}
      </div>
      <div className="text-center">PEDIDO #{data.order.sequentialNumber}</div>
      <div className="text-center text-xs">
        {new Date(data.order.createdAt).toLocaleString()}
      </div>
      <div className="my-2 border-t-2 border-dashed" />
      {data.items.map((i, idx) => (
        <div key={idx} className="mb-2">
          <div className="font-bold">
            {i.quantity}x {i.productNameSnapshot}
          </div>
          {i.removedIngredients.map((r) => (
            <div key={r} className="pl-3 text-xs">
              - sin {r}
            </div>
          ))}
          {i.extraIngredients.map((e) => (
            <div key={e.name} className="pl-3 text-xs">
              + extra {e.name}
            </div>
          ))}
        </div>
      ))}
      {data.order.notes && (
        <>
          <div className="my-2 border-t border-dashed" />
          <div className="text-xs">NOTAS: {data.order.notes}</div>
        </>
      )}
      <style>{`@page { size: 80mm auto; margin: 0 } @media print { body { width: 80mm } }`}</style>
    </div>
  );
}
