import { afterAll, beforeEach, describe, expect, test } from "vitest";
import { sql } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { getDb } from "@/infra/db/client";
import { createCategory, createProduct } from "@/infra/db/menu-repository";
import { createOrder } from "@/infra/db/order-repository";

const db = getDb();

beforeEach(async () => {
  await db.execute(
    sql`TRUNCATE TABLE order_events, order_items, orders, products, categories, colonias, delivery_zones RESTART IDENTITY CASCADE`,
  );
  await db.execute(sql`SELECT setval('orders_sequential_number_seq', 1, false)`);
});

afterAll(async () => {
  await db.execute(
    sql`TRUNCATE TABLE order_events, order_items, orders, products, categories, colonias, delivery_zones RESTART IDENTITY CASCADE`,
  );
});

async function seedOrder(): Promise<string> {
  const cat = await createCategory({ name: "Tacos" });
  const product = await createProduct({
    categoryId: cat.id,
    name: "Pastor",
    basePrice: "50.00",
  });
  const order = await createOrder({
    serviceType: "local",
    customerPhone: "1",
    customerName: "",
    deliveryCost: "0",
    subtotal: "50.00",
    total: "50.00",
    source: "staff",
    notes: "",
    items: [
      {
        productId: product.id,
        productNameSnapshot: product.name,
        basePriceSnapshot: product.basePrice,
        unitPrice: "50.00",
        quantity: 1,
        removedIngredients: [],
        extraIngredients: [],
        itemTotal: "50.00",
      },
    ],
  });
  return order.id;
}

function makePost(url: string): NextRequest {
  return new Request(url, { method: "POST" }) as unknown as NextRequest;
}

describe("POST /api/orders/[id]/print-kitchen", () => {
  test("registra evento printed_kitchen", async () => {
    const id = await seedOrder();
    const { POST } = await import("@/app/api/orders/[id]/print-kitchen/route");
    const res = await POST(makePost(`http://localhost/api/orders/${id}/print-kitchen`), {
      params: Promise.resolve({ id }),
    });
    expect(res.status).toBe(200);

    const events = await db.execute(
      sql`SELECT kind FROM order_events WHERE order_id = ${id}`,
    );
    const kinds = (events as unknown as { rows: { kind: string }[] }).rows.map(
      (r) => r.kind,
    );
    expect(kinds).toContain("printed_kitchen");
  });
});

describe("POST /api/orders/[id]/print-bill", () => {
  test("registra evento printed_bill", async () => {
    const id = await seedOrder();
    const { POST } = await import("@/app/api/orders/[id]/print-bill/route");
    const res = await POST(makePost(`http://localhost/api/orders/${id}/print-bill`), {
      params: Promise.resolve({ id }),
    });
    expect(res.status).toBe(200);

    const events = await db.execute(
      sql`SELECT kind FROM order_events WHERE order_id = ${id}`,
    );
    const kinds = (events as unknown as { rows: { kind: string }[] }).rows.map(
      (r) => r.kind,
    );
    expect(kinds).toContain("printed_bill");
  });

  test("los dos endpoints son independientes (cada uno registra su propio evento)", async () => {
    const id = await seedOrder();
    const { POST: POST_K } = await import(
      "@/app/api/orders/[id]/print-kitchen/route"
    );
    const { POST: POST_B } = await import(
      "@/app/api/orders/[id]/print-bill/route"
    );
    await POST_K(makePost(`http://localhost/api/orders/${id}/print-kitchen`), {
      params: Promise.resolve({ id }),
    });
    await POST_B(makePost(`http://localhost/api/orders/${id}/print-bill`), {
      params: Promise.resolve({ id }),
    });

    const events = await db.execute(
      sql`SELECT kind FROM order_events WHERE order_id = ${id} ORDER BY created_at`,
    );
    const kinds = (events as unknown as { rows: { kind: string }[] }).rows.map(
      (r) => r.kind,
    );
    expect(kinds).toEqual(["created", "printed_kitchen", "printed_bill"]);
  });
});
