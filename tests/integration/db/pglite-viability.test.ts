// @vitest-environment node
import { describe, expect, test } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { sql } from "drizzle-orm";
import * as schema from "@/infra/db/schema";

describe("PGlite viability", () => {
  test("migra el schema real, inserta vía builder y usa la secuencia", async () => {
    const client = new PGlite();
    const db = drizzle(client, { schema });

    await migrate(db, { migrationsFolder: "./drizzle" });

    const [cat] = await db
      .insert(schema.categories)
      .values({ name: "Tacos", slug: "tacos" })
      .returning();
    if (cat === undefined) throw new Error("category insert returned no row");
    expect(cat.id).toBeTruthy();

    const [prod] = await db
      .insert(schema.products)
      .values({ categoryId: cat.id, name: "Pastor", basePrice: "50.00", description: "" })
      .returning();
    expect(prod?.name).toBe("Pastor");

    const seq = await db.execute<{ next: string }>(
      sql`SELECT nextval('orders_sequential_number_seq') as next`,
    );
    expect(Number(seq.rows[0]?.next)).toBe(1);

    await db.transaction(async (tx) => {
      await tx.insert(schema.orders).values({
        sequentialNumber: 99,
        serviceType: "local",
        customerPhone: "555",
        customerName: "",
        deliveryCost: "0",
        subtotal: "10.00",
        total: "10.00",
        source: "staff",
        notes: "",
      });
    });
    const count = await db.execute<{ count: string }>(
      sql`SELECT count(*)::text as count FROM orders WHERE sequential_number = 99`,
    );
    expect(Number(count.rows[0]?.count)).toBe(1);

    await client.close();
  }, 30000);
});
