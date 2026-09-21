import { desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/infra/db/client";
import {
  orders,
  orderItems,
  orderEvents,
  type Order,
  type OrderItem,
  type OrderStatus,
} from "@/infra/db/schema";

export type CreateOrderItemInput = {
  productId: string;
  productNameSnapshot: string;
  basePriceSnapshot: string;
  unitPrice: string;
  quantity: number;
  removedIngredients: string[];
  extraIngredients: { name: string; price: string }[];
  itemTotal: string;
};

export type CreateOrderInput = {
  serviceType: "local" | "delivery";
  customerPhone: string;
  customerName: string;
  deliveryAddress?: string;
  deliveryColoniaId?: string;
  deliveryCostOverride?: string;
  deliveryCost: string;
  subtotal: string;
  total: string;
  source: "whatsapp" | "staff";
  notes: string;
  items: CreateOrderItemInput[];
};

export async function nextSequentialNumber(): Promise<number> {
  const db = getDb();
  const result = await db.execute<{ next: string | number }>(
    sql`SELECT nextval('orders_sequential_number_seq') as next`,
  );
  const rows = (result as unknown as { rows: { next: string | number }[] }).rows;
  return Number(rows[0]?.next ?? 1);
}

export async function createOrder(input: CreateOrderInput): Promise<Order> {
  const db = getDb();
  const sequentialNumber = await nextSequentialNumber();
  const [order] = await db
    .insert(orders)
    .values({
      sequentialNumber,
      serviceType: input.serviceType,
      customerPhone: input.customerPhone,
      customerName: input.customerName,
      deliveryAddress: input.deliveryAddress,
      deliveryColoniaId: input.deliveryColoniaId,
      deliveryCostOverride: input.deliveryCostOverride,
      deliveryCost: input.deliveryCost,
      subtotal: input.subtotal,
      total: input.total,
      source: input.source,
      notes: input.notes,
    })
    .returning();
  if (!order) throw new Error("createOrder: insert returned no row");

  for (const item of input.items) {
    await db.insert(orderItems).values({ orderId: order.id, ...item });
  }
  await db
    .insert(orderEvents)
    .values({ orderId: order.id, kind: "created", payload: { source: input.source } });
  return order;
}

export async function listOrders(filter?: {
  status?: OrderStatus;
}): Promise<Order[]> {
  const db = getDb();
  if (filter?.status) {
    return db
      .select()
      .from(orders)
      .where(eq(orders.status, filter.status))
      .orderBy(desc(orders.createdAt));
  }
  return db.select().from(orders).orderBy(desc(orders.createdAt));
}

export async function getOrder(
  id: string,
): Promise<{ order: Order; items: OrderItem[] } | null> {
  const db = getDb();
  const [order] = await db.select().from(orders).where(eq(orders.id, id));
  if (!order) return null;
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, id));
  return { order, items };
}

export async function updateOrderStatus(
  id: string,
  status: OrderStatus,
): Promise<Order> {
  const db = getDb();
  const [order] = await db
    .update(orders)
    .set({
      status,
      updatedAt: new Date(),
      deliveredAt: status === "delivered" ? new Date() : null,
    })
    .where(eq(orders.id, id))
    .returning();
  if (!order) throw new Error(`updateOrderStatus: order ${id} not found`);
  await db.insert(orderEvents).values({
    orderId: id,
    kind: "status_change",
    payload: { to: status },
  });
  return order;
}
