// @vitest-environment node
import { afterAll, beforeEach, describe, expect, test } from "vitest";
import { sql } from "drizzle-orm";
import { getDb } from "@/infra/db/client";
import { POST as importRoute } from "@/app/api/admin/import/route";

const db = getDb();

beforeEach(async () => {
  await db.execute(sql`TRUNCATE TABLE products, categories RESTART IDENTITY CASCADE`);
});

afterAll(async () => {
  await db.execute(sql`TRUNCATE TABLE products, categories RESTART IDENTITY CASCADE`);
});

function makePost(body: unknown): Request {
  return new Request("http://test/api/admin/import", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function readJson(response: Response) {
  return (await response.json()) as {
    ok: boolean;
    data?: { categories: number; products: number };
    error?: { message: string; path?: string };
  };
}

const validMenu = {
  categories: [
    {
      name: "Bebidas",
      products: [{ name: "Agua", basePrice: "20", description: "" }],
    },
  ],
};

describe("POST /api/admin/import", () => {
  test("importa un menú válido y devuelve el reporte", async () => {
    const res = await importRoute(makePost({ menu: validMenu, mode: "replace" }));
    const body = await readJson(res);

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data).toEqual({
      categories: 1,
      products: 1,
      deferred: { extras: 0, optionGroups: 0 },
    });
  });

  test("responde 422 con menú inválido y expone path", async () => {
    const res = await importRoute(makePost({ menu: { categories: [] } }));
    const body = await readJson(res);

    expect(res.status).toBe(422);
    expect(body.ok).toBe(false);
    expect(body.error?.message).toMatch(/categoría/i);
  });

  test("responde 400 con body malformado", async () => {
    const res = await importRoute(
      new Request("http://test/api/admin/import", { method: "POST", body: "{no json" }),
    );
    const body = await readJson(res);

    expect(res.status).toBe(400);
    expect(body.ok).toBe(false);
  });

  test("modo append por defecto es idempotente", async () => {
    await importRoute(makePost({ menu: validMenu, mode: "replace" }));
    const first = await importRoute(makePost({ menu: validMenu }));
    const second = await importRoute(makePost({ menu: validMenu }));

    const firstBody = await readJson(first);
    const secondBody = await readJson(second);

    expect(firstBody.data?.categories).toBe(0);
    expect(secondBody.data?.categories).toBe(0);
  });
});
