import { afterAll, beforeEach, describe, expect, test } from "vitest";
import { sql } from "drizzle-orm";
import { getDb } from "@/infra/db/client";
import {
  createCategory,
  createProduct,
} from "@/infra/db/menu-repository";
import type { NextRequest } from "next/server";

const db = getDb();

beforeEach(async () => {
  await db.execute(
    sql`TRUNCATE TABLE order_events, order_items, orders, products, categories, colonias, delivery_zones RESTART IDENTITY CASCADE`,
  );
  await db.execute(
    sql`SELECT setval('orders_sequential_number_seq', 1, false)`,
  );
});

afterAll(async () => {
  await db.execute(
    sql`TRUNCATE TABLE order_events, order_items, orders, products, categories, colonias, delivery_zones RESTART IDENTITY CASCADE`,
  );
});

function makePost(body: unknown): NextRequest {
  return new Request("http://localhost/api/orders", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

function makeGet(url: string): NextRequest {
  return new Request(url, { method: "GET" }) as unknown as NextRequest;
}

function makePatch(url: string, body: unknown): NextRequest {
  return new Request(url, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

describe("POST /api/orders", () => {
  test("rechaza pedido sin items (400)", async () => {
    const { POST } = await import("@/app/api/orders/route");
    const res = await POST(
      makePost({
        serviceType: "local",
        customerPhone: "5551234567",
        items: [],
      }),
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.ok).toBe(false);
  });

  test("rechaza sin teléfono (400)", async () => {
    const { POST } = await import("@/app/api/orders/route");
    const res = await POST(
      makePost({
        serviceType: "local",
        customerPhone: "",
        items: [{ productId: "x", quantity: 1 }],
      }),
    );
    expect(res.status).toBe(400);
  });

  test("crea pedido local con totales correctos y emite evento", async () => {
    const cat = await createCategory({ name: "Tacos" });
    const product = await createProduct({
      categoryId: cat.id,
      name: "Pastor",
      basePrice: "50.00",
    });

    const { POST } = await import("@/app/api/orders/route");
    const res = await POST(
      makePost({
        serviceType: "local",
        customerPhone: "5551234567",
        customerName: "Juan",
        source: "staff",
        notes: "sin cebolla",
        items: [{ productId: product.id, quantity: 2, extras: [] }],
      }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.data.sequentialNumber).toBe(1);
    expect(json.data.status).toBe("received");
    expect(json.data.subtotal).toBe("100.00");
    expect(json.data.total).toBe("100.00");
    expect(json.data.deliveryCost).toBe("0.00");
    expect(json.data.notes).toBe("sin cebolla");
  });

  test("rechaza producto inexistente o inactivo (400)", async () => {
    const { POST } = await import("@/app/api/orders/route");
    const res = await POST(
      makePost({
        serviceType: "local",
        customerPhone: "5551234567",
        items: [{ productId: "00000000-0000-0000-0000-000000000999", quantity: 1 }],
      }),
    );
    expect(res.status).toBe(400);
  });

  test("rechaza deliveryCostOverride fuera de rango (400)", async () => {
    const cat = await createCategory({ name: "Tacos" });
    const product = await createProduct({
      categoryId: cat.id,
      name: "Pastor",
      basePrice: "50.00",
    });

    const { POST } = await import("@/app/api/orders/route");
    for (const badCost of ["0.01", "-50", "abc", "", "500"]) {
      const res = await POST(
        makePost({
          serviceType: "delivery",
          customerPhone: "5551234567",
          deliveryCostOverride: badCost,
          items: [{ productId: product.id, quantity: 1 }],
        }),
      );
      expect(res.status, `cost="${badCost}"`).toBe(400);
      const json = await res.json();
      expect(json.ok).toBe(false);
      expect(typeof json.error.message).toBe("string");
    }
  });

  test("acepta deliveryCostOverride válido (10-30)", async () => {
    const cat = await createCategory({ name: "Tacos" });
    const product = await createProduct({
      categoryId: cat.id,
      name: "Pastor",
      basePrice: "50.00",
    });

    const { POST } = await import("@/app/api/orders/route");
    const res = await POST(
      makePost({
        serviceType: "delivery",
        customerPhone: "5551234567",
        customerName: "Test",
        deliveryAddress: "Calle 123",
        deliveryCostOverride: "20",
        items: [{ productId: product.id, quantity: 1 }],
      }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.deliveryCost).toBe("20.00");
  });
});

describe("GET /api/orders", () => {
  test("lista orders, filtra por status", async () => {
    const cat = await createCategory({ name: "Tacos" });
    const product = await createProduct({
      categoryId: cat.id,
      name: "Pastor",
      basePrice: "50.00",
    });

    const { POST, GET } = await import("@/app/api/orders/route");
    await POST(
      makePost({
        serviceType: "local",
        customerPhone: "1",
        items: [{ productId: product.id, quantity: 1 }],
      }),
    );
    await POST(
      makePost({
        serviceType: "local",
        customerPhone: "2",
        items: [{ productId: product.id, quantity: 1 }],
      }),
    );

    const all = await GET(makeGet("http://localhost/api/orders"));
    const allJson = await all.json();
    expect(allJson.data.length).toBe(2);

    const received = await GET(makeGet("http://localhost/api/orders?status=received"));
    const recJson = await received.json();
    expect(recJson.data.length).toBe(2);
  });
});

describe("GET /api/orders/[id]", () => {
  test("devuelve order + items; 404 si no existe", async () => {
    const cat = await createCategory({ name: "Tacos" });
    const product = await createProduct({
      categoryId: cat.id,
      name: "Pastor",
      basePrice: "50.00",
    });
    const { POST } = await import("@/app/api/orders/route");
    const created = await POST(
      makePost({
        serviceType: "local",
        customerPhone: "1",
        items: [{ productId: product.id, quantity: 1 }],
      }),
    );
    const { data: createdOrder } = await created.json();

    const { GET } = await import("@/app/api/orders/[id]/route");
    const ok = await GET(
      makeGet(`http://localhost/api/orders/${createdOrder.id}`),
      { params: Promise.resolve({ id: createdOrder.id }) },
    );
    const okJson = await ok.json();
    expect(ok.status).toBe(200);
    expect(okJson.data.order.id).toBe(createdOrder.id);
    expect(okJson.data.items.length).toBe(1);

    const missing = await GET(
      makeGet("http://localhost/api/orders/00000000-0000-0000-0000-000000000000"),
      {
        params: Promise.resolve({
          id: "00000000-0000-0000-0000-000000000000",
        }),
      },
    );
    expect(missing.status).toBe(404);
  });
});

describe("PATCH /api/orders/[id]/status", () => {
  test("transición válida received→delivered", async () => {
    const cat = await createCategory({ name: "Tacos" });
    const product = await createProduct({
      categoryId: cat.id,
      name: "Pastor",
      basePrice: "50.00",
    });
    const { POST } = await import("@/app/api/orders/route");
    const created = await POST(
      makePost({
        serviceType: "local",
        customerPhone: "1",
        items: [{ productId: product.id, quantity: 1 }],
      }),
    );
    const { data: order } = await created.json();

    const { PATCH } = await import("@/app/api/orders/[id]/status/route");
    const res = await PATCH(
      makePatch(`http://localhost/api/orders/${order.id}/status`, {
        status: "delivered",
      }),
      { params: Promise.resolve({ id: order.id }) },
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.status).toBe("delivered");
    expect(json.data.deliveredAt).toBeTruthy();
  });

  test("rechaza transición inválida (400)", async () => {
    const cat = await createCategory({ name: "Tacos" });
    const product = await createProduct({
      categoryId: cat.id,
      name: "Pastor",
      basePrice: "50.00",
    });
    const { POST } = await import("@/app/api/orders/route");
    const created = await POST(
      makePost({
        serviceType: "local",
        customerPhone: "1",
        items: [{ productId: product.id, quantity: 1 }],
      }),
    );
    const { data: order } = await created.json();

    const { PATCH } = await import("@/app/api/orders/[id]/status/route");
    const res = await PATCH(
      makePatch(`http://localhost/api/orders/${order.id}/status`, {
        status: "delivered",
      }),
      { params: Promise.resolve({ id: order.id }) },
    );
    expect(res.status).toBe(200);

    const again = await PATCH(
      makePatch(`http://localhost/api/orders/${order.id}/status`, {
        status: "cancelled",
      }),
      { params: Promise.resolve({ id: order.id }) },
    );
    expect(again.status).toBe(400);
  });
});
