// @vitest-environment node
import { beforeEach, describe, expect, test } from "vitest";
import { eq, sql } from "drizzle-orm";
import { getDb } from "@/infra/db/client";
import { categories, orderEvents, products } from "@/infra/db/schema";
import { init } from "@/core/printing/escpos-bytes";
import { createOrder } from "@/infra/db/order-repository";
import { setPrinterSettings } from "@/infra/db/settings-repository";
import { startCaptureServer } from "./capture-server";
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
    sql`TRUNCATE TABLE order_events, order_items, orders, products, categories, settings RESTART IDENTITY CASCADE`,
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

describe("endpoints de impresión con config de la DB", () => {
  test.each([
    ["comanda", printKitchen],
    ["cuenta", printBill],
  ] as const)("%s sale por ESC/POS a la impresora configurada en la DB, sin reiniciar", async (_name, handler) => {
    const printer = await startCaptureServer();
    try {
      await setPrinterSettings({ host: printer.host, port: printer.port });
      const id = await seedOrder();

      const res = await callRoute(handler, id);
      const body = (await res.json()) as { ok: boolean; printed?: string };

      expect(res.status).toBe(200);
      expect(body.printed).toBe("server");
      expect([...(await printer.received()).subarray(0, 2)]).toEqual([...init()]);
    } finally {
      await printer.close();
    }
  });

  test("con la impresora apagada responde 502", async () => {
    const printer = await startCaptureServer();
    const { host, port } = printer;
    await printer.close();
    await setPrinterSettings({ host, port });
    const id = await seedOrder();

    const res = await callRoute(printKitchen, id);

    expect(res.status).toBe(502);
  }, 15000);
});
