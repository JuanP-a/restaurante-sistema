// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { parseMenuImport } from "@/core/menu/parse-import";
import type { MenuImport } from "@/core/menu/types";
import { getDb } from "@/infra/db/client";
import { categories, products } from "@/infra/db/schema";
import { importMenu } from "@/infra/db/menu-repository";

function loadRealMenu(): MenuImport {
  const raw = JSON.parse(readFileSync("docs/import/lilians-menu.json", "utf8"));
  const parsed = parseMenuImport(raw);
  if (!parsed.ok) {
    throw new Error(`el menú real debe parsear: ${parsed.error.message}`);
  }
  return parsed.value;
}

describe("importMenu con el menú real de Lilian's", () => {
  it("importa todas las categorías y productos", async () => {
    const menu = loadRealMenu();
    const report = await importMenu(menu, { mode: "replace" });

    expect(report.categories).toBe(menu.categories.length);
    expect(report.products).toBe(
      menu.categories.reduce((sum, c) => sum + c.products.length, 0),
    );

    const db = getDb();
    const cats = await db.select().from(categories);
    expect(cats.length).toBe(menu.categories.length);
  });

  it("append es idempotente por slug y agrega categorías nuevas", async () => {
    const menu = loadRealMenu();
    await importMenu(menu, { mode: "replace" });

    const extra: MenuImport = {
      categories: [
        {
          name: "Bebidas",
          includes: "",
          extras: [],
          optionGroups: [],
          products: [{ name: "Agua", basePrice: "20", description: "" }],
        },
      ],
    };

    const first = await importMenu(extra, { mode: "append" });
    expect(first.categories).toBe(1);
    expect(first.products).toBe(1);

    const second = await importMenu(extra, { mode: "append" });
    expect(second.categories).toBe(0);
    expect(second.products).toBe(0);

    const db = getDb();
    const cats = await db.select().from(categories);
    expect(cats.length).toBe(menu.categories.length + 1);
  });

  it("cada producto queda ligado a su categoría", async () => {
    const menu = loadRealMenu();
    await importMenu(menu, { mode: "replace" });

    const db = getDb();
    const [hamburguesas] = await db
      .select()
      .from(categories)
      .where(eq(categories.slug, "hamburguesas"));
    if (!hamburguesas) throw new Error("falta categoría Hamburguesas");

    const rows = await db
      .select()
      .from(products)
      .where(eq(products.categoryId, hamburguesas.id));
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((p) => p.basePrice !== "0.00")).toBe(true);
  });
});
