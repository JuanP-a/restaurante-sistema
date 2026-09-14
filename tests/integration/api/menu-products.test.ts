// @vitest-environment node
import { afterAll, beforeEach, describe, expect, test } from "vitest";
import { sql } from "drizzle-orm";
import { getDb } from "@/infra/db/client";
import { GET as listProducts, POST as createProductRoute } from "@/app/api/menu/products/route";
import { GET as getProductById, PATCH as updateProductById, DELETE as deleteProductById } from "@/app/api/menu/products/[id]/route";
import { createCategory } from "@/infra/db/menu-repository";

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

async function bootstrapCategory(name = "Tacos"): Promise<{ id: string }> {
  const row = await createCategory({ name });
  return row;
}

describe("GET /api/menu/products", () => {
  test("devuelve lista vacía", async () => {
    const res = await listProducts(new Request("http://test"));
    const body = await readJson(res);

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data).toEqual([]);
  });

  test("acepta ?active=true y filtra agotados", async () => {
    const cat = await bootstrapCategory();
    const create = await createProductRoute(
      new Request("http://test", {
        method: "POST",
        body: JSON.stringify({ categoryId: cat.id, name: "Pastor", basePrice: "45.00" }),
      }),
    );
    const createdBody = (await readJson(create)) as { data: { id: string } };
    await createProductRoute(
      new Request("http://test", {
        method: "POST",
        body: JSON.stringify({ categoryId: cat.id, name: "Bistec", basePrice: "50.00" }),
      }),
    );
    await updateProductById(
      new Request("http://test", { method: "PATCH", body: JSON.stringify({ active: false }) }),
      { params: Promise.resolve({ id: createdBody.data.id }) },
    );

    const all = await listProducts(new Request("http://test"));
    const allBody = await readJson(all);
    expect((allBody.data as unknown[]).length).toBe(2);

    const onlyActive = await listProducts(new Request("http://test?active=true"));
    const onlyActiveBody = await readJson(onlyActive);
    const items = onlyActiveBody.data as Array<{ name: string }>;
    expect(items).toHaveLength(1);
    expect(items[0]?.name).toBe("Bistec");
  });
});

describe("POST /api/menu/products", () => {
  test("crea producto con descripción opcional", async () => {
    const cat = await bootstrapCategory();

    const res = await createProductRoute(
      new Request("http://test", {
        method: "POST",
        body: JSON.stringify({
          categoryId: cat.id,
          name: "Pastor",
          basePrice: "45.00",
          description: "Con piña",
        }),
      }),
    );
    const body = await readJson(res);

    expect(res.status).toBe(200);
    const row = body.data as { name: string; basePrice: string; description: string; active: boolean };
    expect(row.name).toBe("Pastor");
    expect(row.basePrice).toBe("45.00");
    expect(row.description).toBe("Con piña");
    expect(row.active).toBe(true);
  });

  test("rechaza payload incompleto con 400", async () => {
    const res = await createProductRoute(
      new Request("http://test", {
        method: "POST",
        body: JSON.stringify({ name: "Sin categoría" }),
      }),
    );
    const body = await readJson(res);

    expect(res.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.error?.message).toMatch(/Faltan campos/);
  });
});

describe("GET /api/menu/products/[id]", () => {
  test("devuelve el producto cuando existe", async () => {
    const cat = await bootstrapCategory();
    const created = await createProductRoute(
      new Request("http://test", {
        method: "POST",
        body: JSON.stringify({ categoryId: cat.id, name: "Pastor", basePrice: "45.00" }),
      }),
    );
    const createdBody = (await readJson(created)) as { data: { id: string } };

    const res = await getProductById(new Request("http://test"), {
      params: Promise.resolve({ id: createdBody.data.id }),
    });
    const body = await readJson(res);

    expect(res.status).toBe(200);
    expect((body.data as { name: string }).name).toBe("Pastor");
  });

  test("responde 404 cuando no existe", async () => {
    const res = await getProductById(new Request("http://test"), {
      params: Promise.resolve({ id: "00000000-0000-0000-0000-000000000000" }),
    });
    const body = await readJson(res);

    expect(res.status).toBe(404);
    expect(body.ok).toBe(false);
  });
});

describe("PATCH /api/menu/products/[id]", () => {
  test("actualiza nombre y precio", async () => {
    const cat = await bootstrapCategory();
    const created = await createProductRoute(
      new Request("http://test", {
        method: "POST",
        body: JSON.stringify({ categoryId: cat.id, name: "Pastor", basePrice: "45.00" }),
      }),
    );
    const createdBody = (await readJson(created)) as { data: { id: string } };

    const res = await updateProductById(
      new Request("http://test", {
        method: "PATCH",
        body: JSON.stringify({ name: "Pastor Especial", basePrice: "55.00" }),
      }),
      { params: Promise.resolve({ id: createdBody.data.id }) },
    );
    const body = await readJson(res);

    const row = body.data as { name: string; basePrice: string };
    expect(res.status).toBe(200);
    expect(row.name).toBe("Pastor Especial");
    expect(row.basePrice).toBe("55.00");
  });
});

describe("DELETE /api/menu/products/[id]", () => {
  test("elimina el producto", async () => {
    const cat = await bootstrapCategory();
    const created = await createProductRoute(
      new Request("http://test", {
        method: "POST",
        body: JSON.stringify({ categoryId: cat.id, name: "Borrar", basePrice: "10.00" }),
      }),
    );
    const createdBody = (await readJson(created)) as { data: { id: string } };

    const res = await deleteProductById(new Request("http://test", { method: "DELETE" }), {
      params: Promise.resolve({ id: createdBody.data.id }),
    });
    const body = await readJson(res);

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);

    const list = await listProducts(new Request("http://test"));
    const listBody = await readJson(list);
    expect(listBody.data).toEqual([]);
  });
});