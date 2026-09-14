// @vitest-environment node
import { afterAll, beforeEach, describe, expect, test } from "vitest";
import { sql } from "drizzle-orm";
import { getDb } from "@/infra/db/client";
import { GET as listCategories, POST as createCategory } from "@/app/api/menu/categories/route";
import { PATCH as updateCategoryById, DELETE as deleteCategoryById } from "@/app/api/menu/categories/[id]/route";

const db = getDb();

beforeEach(async () => {
  await db.execute(sql`TRUNCATE TABLE products, categories RESTART IDENTITY CASCADE`);
});

afterAll(async () => {
  await db.execute(sql`TRUNCATE TABLE products, categories RESTART IDENTITY CASCADE`);
});

async function readJson(response: Response) {
  return (await response.json()) as { ok: boolean; data?: unknown; error?: { message: string } };
}

describe("GET /api/menu/categories", () => {
  test("devuelve lista vacía cuando no hay categorías", async () => {
    const res = await listCategories();
    const body = await readJson(res);

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data).toEqual([]);
  });

  test("devuelve categorías existentes", async () => {
    await createCategory(new Request("http://test", { method: "POST", body: JSON.stringify({ name: "Tacos" }) }));

    const res = await listCategories();
    const body = await readJson(res);

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data).toHaveLength(1);
    expect((body.data as Array<{ name: string }>)[0]?.name).toBe("Tacos");
  });
});

describe("POST /api/menu/categories", () => {
  test("crea categoría con sortOrder por defecto 0", async () => {
    const res = await createCategory(
      new Request("http://test", { method: "POST", body: JSON.stringify({ name: "Bebidas" }) }),
    );
    const body = await readJson(res);

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    const row = body.data as { name: string; sortOrder: number; slug: string };
    expect(row.name).toBe("Bebidas");
    expect(row.slug).toBe("bebidas");
    expect(row.sortOrder).toBe(0);
  });

  test("acepta sortOrder explícito", async () => {
    const res = await createCategory(
      new Request("http://test", { method: "POST", body: JSON.stringify({ name: "Postres", sortOrder: 5 }) }),
    );
    const body = await readJson(res);

    const row = body.data as { sortOrder: number };
    expect(row.sortOrder).toBe(5);
  });

  test("rechaza request sin nombre con 400", async () => {
    const res = await createCategory(
      new Request("http://test", { method: "POST", body: JSON.stringify({}) }),
    );
    const body = await readJson(res);

    expect(res.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.error?.message).toMatch(/nombre/i);
  });
});

describe("PATCH /api/menu/categories/[id]", () => {
  test("actualiza active=false y refleja en GET", async () => {
    const created = await createCategory(
      new Request("http://test", { method: "POST", body: JSON.stringify({ name: "Snacks" }) }),
    );
    const createdBody = (await readJson(created)) as { data: { id: string } };

    const params = Promise.resolve({ id: createdBody.data.id });
    const patchRes = await updateCategoryById(
      new Request("http://test", { method: "PATCH", body: JSON.stringify({ active: false }) }),
      { params },
    );
    const patchBody = await readJson(patchRes);

    expect(patchRes.status).toBe(200);
    expect(patchBody.ok).toBe(true);
    expect((patchBody.data as { active: boolean }).active).toBe(false);
  });

  test("responde 500 cuando la categoría no existe", async () => {
    const params = Promise.resolve({ id: "00000000-0000-0000-0000-000000000000" });

    await expect(
      updateCategoryById(
        new Request("http://test", { method: "PATCH", body: JSON.stringify({ active: false }) }),
        { params },
      ),
    ).rejects.toThrow();
  });
});

describe("DELETE /api/menu/categories/[id]", () => {
  test("elimina la categoría y desaparece de la lista", async () => {
    const created = await createCategory(
      new Request("http://test", { method: "POST", body: JSON.stringify({ name: "Eliminar" }) }),
    );
    const createdBody = (await readJson(created)) as { data: { id: string } };

    const params = Promise.resolve({ id: createdBody.data.id });
    const delRes = await deleteCategoryById(new Request("http://test", { method: "DELETE" }), { params });
    const delBody = await readJson(delRes);

    expect(delRes.status).toBe(200);
    expect(delBody.ok).toBe(true);

    const listRes = await listCategories();
    const listBody = await readJson(listRes);
    expect(listBody.data).toEqual([]);
  });
});