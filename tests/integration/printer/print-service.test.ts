// @vitest-environment node
import { beforeEach, describe, expect, test } from "vitest";
import { eq, sql } from "drizzle-orm";
import { getDb } from "@/infra/db/client";
import { categories, orderEvents, products } from "@/infra/db/schema";
import { createOrder, getOrder } from "@/infra/db/order-repository";
import { createFakeTransport } from "@/infra/printer/fake";
import { printOrder } from "@/infra/printer/print-service";

const db = getDb();
const FAST = { attempts: 3, backoffMs: [0, 0, 0] };

async function seedOrder(): Promise<string> {
  const [category] = await db
    .insert(categories)
    .values({ name: "Test", slug: `test-${Date.now()}` })
    .returning();
  if (!category) throw new Error("categoría no creada");
  const [product] = await db
    .insert(products)
    .values({ categoryId: category.id, name: "Hamburguesa", basePrice: "100" })
    .returning();
  if (!product) throw new Error("producto no creado");
  const order = await createOrder({
    serviceType: "local",
    customerPhone: "555",
    customerName: "Cliente",
    deliveryCost: "0",
    subtotal: "200.00",
    total: "200.00",
    source: "staff",
    notes: "",
    items: [
      {
        productId: product.id,
        productNameSnapshot: "Hamburguesa",
        basePriceSnapshot: "100.00",
        unitPrice: "100.00",
        quantity: 2,
        removedIngredients: ["cebolla"],
        extraIngredients: [{ name: "queso", price: "10.00" }],
        itemTotal: "200.00",
      },
    ],
  });
  return order.id;
}

async function eventKinds(orderId: string): Promise<string[]> {
  const rows = await db.select().from(orderEvents).where(eq(orderEvents.orderId, orderId));
  return rows.map((row) => row.kind);
}

beforeEach(async () => {
  await db.execute(
    sql`TRUNCATE TABLE order_events, order_items, orders, products, categories RESTART IDENTITY CASCADE`,
  );
});

describe("printOrder", () => {
  test("sin transport registra evento y hace fallback al navegador", async () => {
    const id = await seedOrder();
    const data = await getOrder(id);
    if (!data) throw new Error("orden no encontrada");

    const outcome = await printOrder(data, "kitchen", null);

    expect(outcome).toEqual({ printed: "browser" });
    expect(await eventKinds(id)).toContain("printed_kitchen");
  });

  test("con transport OK imprime server-side y registra evento", async () => {
    const id = await seedOrder();
    const data = await getOrder(id);
    if (!data) throw new Error("orden no encontrada");
    const transport = createFakeTransport();

    const outcome = await printOrder(data, "bill", transport, FAST);

    expect(outcome).toEqual({ printed: "server" });
    expect(transport.sent).toHaveLength(1);
    expect(await eventKinds(id)).toContain("printed_bill");
  });

  test("reintenta ante fallo y termina OK", async () => {
    const id = await seedOrder();
    const data = await getOrder(id);
    if (!data) throw new Error("orden no encontrada");
    const transport = createFakeTransport({ failTimes: 2 });

    const outcome = await printOrder(data, "kitchen", transport, FAST);

    expect(outcome).toEqual({ printed: "server" });
    expect(transport.sent).toHaveLength(1);
  });

  test("si falla siempre registra print_failed y devuelve failed", async () => {
    const id = await seedOrder();
    const data = await getOrder(id);
    if (!data) throw new Error("orden no encontrada");
    const transport = createFakeTransport({ failTimes: 99 });

    const outcome = await printOrder(data, "kitchen", transport, FAST);

    expect(outcome.printed).toBe("failed");
    expect(await eventKinds(id)).toContain("print_failed");
  });
});
