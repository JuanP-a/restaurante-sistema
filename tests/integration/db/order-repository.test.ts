import { afterAll, beforeEach, describe, expect, test } from "vitest";
import { sql } from "drizzle-orm";
import { getDb } from "@/infra/db/client";
import { createCategory, createProduct } from "@/infra/db/menu-repository";
import {
  nextSequentialNumber,
  createOrder,
  listOrders,
  getOrder,
  updateOrderStatus,
} from "@/infra/db/order-repository";

const db = getDb();

async function resetSequence(value: number): Promise<void> {
  await db.execute(
    sql`SELECT setval('orders_sequential_number_seq', ${value}, false)`,
  );
}

beforeEach(async () => {
  await db.execute(
    sql`TRUNCATE TABLE order_events, order_items, orders, products, categories, colonias, delivery_zones RESTART IDENTITY CASCADE`,
  );
  await resetSequence(1);
});

afterAll(async () => {
  await db.execute(
    sql`TRUNCATE TABLE order_events, order_items, orders, products, categories, colonias, delivery_zones RESTART IDENTITY CASCADE`,
  );
});

async function seedProduct(): Promise<string> {
  const cat = await createCategory({ name: "Tacos" });
  const product = await createProduct({
    categoryId: cat.id,
    name: "Pastor",
    basePrice: "50.00",
  });
  return product.id;
}

describe("order repository / nextSequentialNumber", () => {
  test("devuelve números monotónicos crecientes", async () => {
    const a = await nextSequentialNumber();
    const b = await nextSequentialNumber();
    const c = await nextSequentialNumber();
    expect(b).toBe(a + 1);
    expect(c).toBe(b + 1);
  });

  test("inicia en 1 después de reset", async () => {
    const n = await nextSequentialNumber();
    expect(n).toBe(1);
  });
});

describe("order repository / createOrder", () => {
  test("persiste order, items y evento 'created'", async () => {
    const productId = await seedProduct();
    const order = await createOrder({
      serviceType: "local",
      customerPhone: "5551234567",
      customerName: "Juan",
      deliveryCost: "0",
      subtotal: "100.00",
      total: "100.00",
      source: "staff",
      notes: "",
      items: [
        {
          productId: productId,
          productNameSnapshot: "Taco",
          basePriceSnapshot: "50.00",
          unitPrice: "50.00",
          quantity: 2,
          removedIngredients: [],
          extraIngredients: [],
          itemTotal: "100.00",
        },
      ],
    });

    expect(order.sequentialNumber).toBe(1);
    expect(order.status).toBe("received");
    expect(order.source).toBe("staff");

    const fetched = await getOrder(order.id);
    expect(fetched).not.toBeNull();
    expect(fetched?.items.length).toBe(1);
    expect(fetched?.items[0]?.productNameSnapshot).toBe("Taco");
    expect(fetched?.items[0]?.quantity).toBe(2);

    const events = await db.execute(
      sql`SELECT kind FROM order_events WHERE order_id = ${order.id}`,
    );
    const kinds = (events as any).rows.map((r: any) => r.kind);
    expect(kinds).toContain("created");
  });

  test("asigna sequentialNumber único e incremental en sucesivas llamadas", async () => {
    const o1 = await createOrder({
      serviceType: "local", customerPhone: "1", customerName: "",
      deliveryCost: "0", subtotal: "10.00", total: "10.00",
      source: "staff", notes: "", items: [],
    });
    const o2 = await createOrder({
      serviceType: "local", customerPhone: "2", customerName: "",
      deliveryCost: "0", subtotal: "20.00", total: "20.00",
      source: "staff", notes: "", items: [],
    });
    expect(o2.sequentialNumber).toBe(o1.sequentialNumber + 1);
  });
});

describe("order repository / listOrders", () => {
  test("devuelve orders desc por createdAt", async () => {
    const a = await createOrder({
      serviceType: "local", customerPhone: "1", customerName: "",
      deliveryCost: "0", subtotal: "10.00", total: "10.00",
      source: "staff", notes: "", items: [],
    });
    await new Promise((r) => setTimeout(r, 5));
    const b = await createOrder({
      serviceType: "local", customerPhone: "2", customerName: "",
      deliveryCost: "0", subtotal: "20.00", total: "20.00",
      source: "staff", notes: "", items: [],
    });
    const rows = await listOrders();
    expect(rows[0]?.id).toBe(b.id);
    expect(rows[1]?.id).toBe(a.id);
  });

  test("filtra por status cuando se pasa", async () => {
    const a = await createOrder({
      serviceType: "local", customerPhone: "1", customerName: "",
      deliveryCost: "0", subtotal: "10.00", total: "10.00",
      source: "staff", notes: "", items: [],
    });
    await createOrder({
      serviceType: "local", customerPhone: "2", customerName: "",
      deliveryCost: "0", subtotal: "20.00", total: "20.00",
      source: "staff", notes: "", items: [],
    });
    await updateOrderStatus(a.id, "cancelled");

    const received = await listOrders({ status: "received" });
    const cancelled = await listOrders({ status: "cancelled" });
    expect(received.length).toBe(1);
    expect(cancelled.length).toBe(1);
    expect(cancelled[0]?.id).toBe(a.id);
  });
});

describe("order repository / updateOrderStatus", () => {
  test("cambia status y registra evento status_change", async () => {
    const order = await createOrder({
      serviceType: "local", customerPhone: "1", customerName: "",
      deliveryCost: "0", subtotal: "10.00", total: "10.00",
      source: "staff", notes: "", items: [],
    });

    const updated = await updateOrderStatus(order.id, "delivered");
    expect(updated.status).toBe("delivered");
    expect(updated.deliveredAt).toBeInstanceOf(Date);

    const events = await db.execute(
      sql`SELECT kind, payload FROM order_events WHERE order_id = ${order.id} ORDER BY created_at`,
    );
    const all = (events as any).rows;
    expect(all.length).toBe(2);
    expect(all[1].kind).toBe("status_change");
    expect(all[1].payload.to).toBe("delivered");
  });

  test("no asigna deliveredAt para transiciones que no son delivered", async () => {
    const order = await createOrder({
      serviceType: "local", customerPhone: "1", customerName: "",
      deliveryCost: "0", subtotal: "10.00", total: "10.00",
      source: "staff", notes: "", items: [],
    });
    const updated = await updateOrderStatus(order.id, "cancelled");
    expect(updated.status).toBe("cancelled");
    expect(updated.deliveredAt).toBeNull();
  });
});
