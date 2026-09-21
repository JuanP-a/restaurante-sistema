"use client";
import { useEffect, useState } from "react";

type Data = {
  order: {
    sequentialNumber: number;
    serviceType: string;
    deliveryAddress?: string;
    deliveryColoniaName?: string;
    subtotal: string;
    deliveryCost: string;
    total: string;
    createdAt: string;
  };
  items: {
    quantity: number;
    productNameSnapshot: string;
    itemTotal: string;
    extraIngredients: { name: string; price: string }[];
  }[];
};

export default function BillPrint({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [data, setData] = useState<Data | null>(null);
  const [biz, setBiz] = useState({
    name: "Mi Restaurante",
    address: "",
    phone: "",
  });

  useEffect(() => {
    setBiz({
      name: process.env.NEXT_PUBLIC_BUSINESS_NAME ?? "Mi Restaurante",
      address: process.env.NEXT_PUBLIC_BUSINESS_ADDRESS ?? "",
      phone: process.env.NEXT_PUBLIC_BUSINESS_PHONE ?? "",
    });
    void params.then(({ id }) => {
      void fetch(`/api/orders/${id}`)
        .then((r) => r.json())
        .then((d: { data: Data }) => {
          setData(d.data);
          void fetch(`/api/orders/${id}/print-bill`, { method: "POST" });
          setTimeout(() => window.print(), 500);
        });
    });
  }, [params]);

  if (!data) return <div>Cargando...</div>;
  return (
    <div className="p-2 font-mono text-sm">
      <div className="text-center font-bold">{biz.name}</div>
      {biz.address && <div className="text-center text-xs">{biz.address}</div>}
      {biz.phone && <div className="text-center text-xs">{biz.phone}</div>}
      <div className="my-2 border-t-2 border-dashed" />
      <div>{data.order.serviceType === "delivery" ? "DOMICILIO" : "LOCAL"}</div>
      <div>PEDIDO #{data.order.sequentialNumber}</div>
      <div className="text-xs">
        {new Date(data.order.createdAt).toLocaleString()}
      </div>
      {data.order.deliveryAddress && (
        <div className="mt-1 text-xs">{data.order.deliveryAddress}</div>
      )}
      <div className="my-2 border-t border-dashed" />
      {data.items.map((i, idx) => (
        <div key={idx} className="mb-1">
          <div className="flex justify-between">
            <span>
              {i.quantity} {i.productNameSnapshot}
            </span>
            <span>${i.itemTotal}</span>
          </div>
          {i.extraIngredients.map((e) => (
            <div key={e.name} className="flex justify-between pl-3 text-xs">
              <span>+ {e.name}</span>
              <span>${e.price}</span>
            </div>
          ))}
        </div>
      ))}
      <div className="my-2 border-t border-dashed" />
      <div className="flex justify-between">
        <span>SUBTOTAL</span>
        <span>${data.order.subtotal}</span>
      </div>
      <div className="flex justify-between">
        <span>ENVIO</span>
        <span>${data.order.deliveryCost}</span>
      </div>
      <div className="flex justify-between font-bold">
        <span>TOTAL</span>
        <span>${data.order.total}</span>
      </div>
      <style>{`@page { size: 80mm auto; margin: 0 } @media print { body { width: 80mm } }`}</style>
    </div>
  );
}
