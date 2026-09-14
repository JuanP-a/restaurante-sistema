import { afterAll, beforeEach, describe, expect, test } from "vitest";
import { sql } from "drizzle-orm";
import { getDb } from "@/infra/db/client";
import {
  createCategory,
  listAllProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
} from "@/infra/db/menu-repository";

const db = getDb();

beforeEach(async () => {
  await db.execute(sql`TRUNCATE TABLE products, categories RESTART IDENTITY CASCADE`);
});

afterAll(async () => {
  await db.execute(sql`TRUNCATE TABLE products, categories RESTART IDENTITY CASCADE`);
});

describe("menu repository / products", () => {
  test("createProduct requiere categoryId, persiste con active=true y descripción vacía", async () => {
    const cat = await createCategory({ name: "Tacos" });

    const row = await createProduct({
      categoryId: cat.id,
      name: "Pastor",
      basePrice: "45.00",
    });

    expect(row.categoryId).toBe(cat.id);
    expect(row.name).toBe("Pastor");
    expect(row.basePrice).toBe("45.00");
    expect(row.description).toBe("");
    expect(row.active).toBe(true);
    expect(row.sortOrder).toBe(0);
  });

  test("createProduct acepta descripción opcional", async () => {
    const cat = await createCategory({ name: "Tacos" });

    const row = await createProduct({
      categoryId: cat.id,
      name: "Bistec",
      basePrice: "50.00",
      description: "Con cebolla y cilantro",
    });

    expect(row.description).toBe("Con cebolla y cilantro");
  });

  test("listAllProducts con activeOnly=true filtra agotados", async () => {
    const cat = await createCategory({ name: "Tacos" });
    const a = await createProduct({ categoryId: cat.id, name: "Pastor", basePrice: "45.00" });
    await createProduct({ categoryId: cat.id, name: "Bistec", basePrice: "50.00" });
    await updateProduct(a.id, { active: false });

    const active = await listAllProducts(true);
    expect(active.map((p) => p.name)).toEqual(["Bistec"]);
  });

  test("getProduct devuelve null si no existe", async () => {
    const result = await getProduct("00000000-0000-0000-0000-000000000000");
    expect(result).toBeNull();
  });

  test("updateProduct permite mover de categoría", async () => {
    const tacos = await createCategory({ name: "Tacos" });
    const burgers = await createCategory({ name: "Burgers" });
    const producto = await createProduct({
      categoryId: tacos.id,
      name: "Pastor",
      basePrice: "45.00",
    });

    const updated = await updateProduct(producto.id, { categoryId: burgers.id, basePrice: "48.00" });

    expect(updated.categoryId).toBe(burgers.id);
    expect(updated.basePrice).toBe("48.00");
  });

  test("deleteProduct elimina la fila", async () => {
    const cat = await createCategory({ name: "Tacos" });
    const producto = await createProduct({
      categoryId: cat.id,
      name: "Pastor",
      basePrice: "45.00",
    });

    await deleteProduct(producto.id);
    const remaining = await listAllProducts();
    expect(remaining).toHaveLength(0);
  });
});