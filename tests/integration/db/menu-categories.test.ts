import { afterAll, beforeEach, describe, expect, test } from "vitest";
import { sql } from "drizzle-orm";
import { getDb } from "@/infra/db/client";
import {
  createCategory,
  listCategories,
  updateCategory,
  deleteCategory,
} from "@/infra/db/menu-repository";

const db = getDb();

beforeEach(async () => {
  await db.execute(sql`TRUNCATE TABLE products, categories RESTART IDENTITY CASCADE`);
});

afterAll(async () => {
  await db.execute(sql`TRUNCATE TABLE products, categories RESTART IDENTITY CASCADE`);
});

describe("menu repository / categories", () => {
  test("createCategory genera slug desde el nombre y persiste", async () => {
    const row = await createCategory({ name: "Tacos de Pastor" });

    expect(row.id).toBeTypeOf("string");
    expect(row.name).toBe("Tacos de Pastor");
    expect(row.slug).toBe("tacos-de-pastor");
    expect(row.active).toBe(true);
    expect(row.sortOrder).toBe(0);
  });

  test("listCategories ordena por sortOrder y luego nombre", async () => {
    await createCategory({ name: "Bebidas", sortOrder: 5 });
    await createCategory({ name: "Tacos", sortOrder: 1 });
    await createCategory({ name: "Antojitos", sortOrder: 1 });

    const all = await listCategories();
    expect(all.map((c) => c.name)).toEqual(["Antojitos", "Tacos", "Bebidas"]);
  });

  test("listCategories con activeOnly=true filtra desactivadas", async () => {
    const cat = await createCategory({ name: "Hamburguesas" });
    await createCategory({ name: "Papas" });
    await updateCategory(cat.id, { active: false });

    const active = await listCategories(true);
    expect(active.map((c) => c.name)).toEqual(["Papas"]);
  });

  test("updateCategory modifica campos y refresca updatedAt", async () => {
    const created = await createCategory({ name: "Original" });
    const originalUpdatedAt = created.updatedAt;

    await new Promise((r) => setTimeout(r, 10));
    const updated = await updateCategory(created.id, { name: "Renombrado", sortOrder: 7 });

    expect(updated.name).toBe("Renombrado");
    expect(updated.sortOrder).toBe(7);
    expect(updated.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
  });

  test("deleteCategory elimina la fila", async () => {
    const created = await createCategory({ name: "Eliminar" });

    await deleteCategory(created.id);
    const remaining = await listCategories();
    expect(remaining).toHaveLength(0);
  });
});