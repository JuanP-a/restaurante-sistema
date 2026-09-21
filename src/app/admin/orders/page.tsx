import type { Metadata } from "next";
import Link from "next/link";
import { listOrders } from "@/infra/db/order-repository";
import type { OrderRow } from "@/types/domain";
import { Button } from "@/ui/Button";
import { PageContainer } from "@/ui/PageContainer";
import { PageHeading } from "@/ui/PageHeading";
import { OrdersList } from "./orders-list";

// Server-side DB access needs DATABASE_URL at build time; skip prerender so
// `next build` in CI (no .env) doesn't blow up on env.ts Zod parse.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pedidos · Restaurante",
};

export default async function OrdersDashboard() {
  const initial = await listOrders({ status: "received" });
  const rows: OrderRow[] = initial.map((o) => ({
    id: o.id,
    sequentialNumber: o.sequentialNumber,
    status: o.status,
    serviceType: o.serviceType,
    customerPhone: o.customerPhone,
    customerName: o.customerName,
    total: o.total,
    createdAt: o.createdAt.toISOString(),
  }));

  return (
    <PageContainer width="md">
      <div className="mb-4 flex items-center justify-between">
        <PageHeading>Pedidos activos ({rows.length})</PageHeading>
        <Link href="/admin/orders/new">
          <Button>+ Nuevo pedido</Button>
        </Link>
      </div>
      <OrdersList initial={rows} />
    </PageContainer>
  );
}
