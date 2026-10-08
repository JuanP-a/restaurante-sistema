// @vitest-environment node
import { beforeEach, describe, expect, test } from "vitest";
import { eq, sql } from "drizzle-orm";
import { getDb } from "@/infra/db/client";
import { categories, orderEvents, products } from "@/infra/db/schema";
import { createOrder } from "@/infra/db/order-repository";
import { POST as printKitchen } from "@/app/api/orders/[id]/print-kitchen/route";
import { POST as printBill } from "@/app/api/orders/[id]/print-bill/route";

const db = getDb();

function callRoute(handler: typeof printKitchen, id: string): Promise<Response> {
  return handler(new Request(`http://test/api/orders/${id}/print-kitchen`, { method: "POST" }), {
    params: Promise.resolve({ id }),
  });
}

async function seedOrder(): Promise<string> {
  const [category] = await db
    .insert(categories)
    .values({ name: "Test", slug: `test-${Date.now()}` })
    .returning();
  if (!category) throw new Error("sin categoría");
  const [product] = await db
    .insert(products)
    .values({ categoryId: category.id, name: "Taco", basePrice: "50" })
    .returning();
  if (!product) throw new Error("sin producto");
  const order = await createOrder({
    serviceType: "local",
    customerPhone: "555",
    customerName: "Cliente",
    deliveryCost: "0",
    subtotal: "50.00",
    total: "50.00",
    source: "staff",
    notes: "",
    items: [
      {
        productId: product.id,
        productNameSnapshot: "Taco",
        basePriceSnapshot: "50.00",
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

beforeEach(async () => {
  await db.execute(
    sql`TRUNCATE TABLE order_events, order_items, orders, products, categories RESTART IDENTITY CASCADE`,
  );
});

describe("endpoints de impresión", () => {
  test("404 cuando el pedido no existe", async () => {
    const res = await callRoute(printKitchen, "00000000-0000-0000-0000-000000000000");
    expect(res.status).toBe(404);
  });

  test("sin PRINTER_HOST responde fallback al navegador y registra evento", async () => {
    const id = await seedOrder();
    const res = await callRoute(printBill, id);
    const body = (await res.json()) as { ok: boolean; printed?: string };

    expect(res.status).toBe(200);
    expect(body.printed).toBe("browser");
    const events = await db.select().from(orderEvents).where(eq(orderEvents.orderId, id));
    expect(events.map((event) => event.kind)).toContain("printed_bill");
  });
});
