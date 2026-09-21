import { afterAll, beforeEach, describe, expect, test } from "vitest";
import { sql } from "drizzle-orm";
import { getDb } from "@/infra/db/client";
import type { NextRequest } from "next/server";

const db = getDb();

beforeEach(async () => {
  await db.execute(
    sql`TRUNCATE TABLE colonias, delivery_zones RESTART IDENTITY CASCADE`,
  );
});

afterAll(async () => {
  await db.execute(
    sql`TRUNCATE TABLE colonias, delivery_zones RESTART IDENTITY CASCADE`,
  );
});

function makeRequest(url: string, init?: RequestInit): NextRequest {
  return new Request(url, init) as unknown as NextRequest;
}

describe("GET /api/delivery-zones", () => {
  test("lista zonas vacía inicialmente", async () => {
    const { GET } = await import("@/app/api/delivery-zones/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.data).toEqual([]);
  });
});

describe("POST /api/delivery-zones", () => {
  test("crea zona con costo válido", async () => {
    const { POST } = await import("@/app/api/delivery-zones/route");
    const res = await POST(
      makeRequest("http://localhost/api/delivery-zones", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Centro", cost: "20.00" }),
      }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.data.name).toBe("Centro");
    expect(json.data.cost).toBe("20.00");
  });

  test("rechaza sin nombre (400)", async () => {
    const { POST } = await import("@/app/api/delivery-zones/route");
    const res = await POST(
      makeRequest("http://localhost/api/delivery-zones", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cost: "20.00" }),
      }),
    );
    expect(res.status).toBe(400);
  });

  test("rechaza costo fuera de 10-30 (400)", async () => {
    const { POST } = await import("@/app/api/delivery-zones/route");
    const res = await POST(
      makeRequest("http://localhost/api/delivery-zones", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Centro", cost: "5" }),
      }),
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.ok).toBe(false);
  });
});

describe("PATCH /api/delivery-zones/[id]", () => {
  test("actualiza cost y active", async () => {
    const { POST } = await import("@/app/api/delivery-zones/route");
    const create = await POST(
      makeRequest("http://localhost/api/delivery-zones", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Centro", cost: "20.00" }),
      }),
    );
    const { data } = await create.json();

    const { PATCH } = await import("@/app/api/delivery-zones/[id]/route");
    const res = await PATCH(
      makeRequest(`http://localhost/api/delivery-zones/${data.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cost: "25.00", active: false }),
      }),
      { params: Promise.resolve({ id: data.id }) },
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.cost).toBe("25.00");
    expect(json.data.active).toBe(false);
  });

  test("rechaza cost inválido en patch", async () => {
    const { POST } = await import("@/app/api/delivery-zones/route");
    const create = await POST(
      makeRequest("http://localhost/api/delivery-zones", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Centro", cost: "20.00" }),
      }),
    );
    const { data } = await create.json();

    const { PATCH } = await import("@/app/api/delivery-zones/[id]/route");
    const res = await PATCH(
      makeRequest(`http://localhost/api/delivery-zones/${data.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cost: "5" }),
      }),
      { params: Promise.resolve({ id: data.id }) },
    );
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/delivery-zones/[id]", () => {
  test("borra zona existente", async () => {
    const { POST } = await import("@/app/api/delivery-zones/route");
    const create = await POST(
      makeRequest("http://localhost/api/delivery-zones", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Centro", cost: "20.00" }),
      }),
    );
    const { data } = await create.json();

    const { DELETE } = await import("@/app/api/delivery-zones/[id]/route");
    const res = await DELETE(
      makeRequest(`http://localhost/api/delivery-zones/${data.id}`, {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: data.id }) },
    );
    expect(res.status).toBe(200);

    const { GET } = await import("@/app/api/delivery-zones/route");
    const list = await GET();
    const listJson = await list.json();
    expect(listJson.data).toEqual([]);
  });
});

describe("GET /api/delivery-zones/colonias", () => {
  test("lista colonias con datos de zona", async () => {
    const { POST: POSTZone } = await import("@/app/api/delivery-zones/route");
    const z = await POSTZone(
      makeRequest("http://localhost/api/delivery-zones", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Centro", cost: "20.00" }),
      }),
    );
    const { data: zoneData } = await z.json();

    const { POST: POSTCol } = await import(
      "@/app/api/delivery-zones/colonias/route"
    );
    await POSTCol(
      makeRequest("http://localhost/api/delivery-zones/colonias", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Roma", zoneId: zoneData.id }),
      }),
    );

    const { GET } = await import(
      "@/app/api/delivery-zones/colonias/route"
    );
    const res = await GET();
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.data).toHaveLength(1);
    expect(json.data[0].name).toBe("Roma");
    expect(json.data[0].zoneName).toBe("Centro");
    expect(json.data[0].zoneCost).toBe("20.00");
  });
});

describe("POST /api/delivery-zones/colonias", () => {
  test("crea colonia", async () => {
    const { POST: POSTZone } = await import("@/app/api/delivery-zones/route");
    const z = await POSTZone(
      makeRequest("http://localhost/api/delivery-zones", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Centro", cost: "20.00" }),
      }),
    );
    const { data: zoneData } = await z.json();

    const { POST } = await import(
      "@/app/api/delivery-zones/colonias/route"
    );
    const res = await POST(
      makeRequest("http://localhost/api/delivery-zones/colonias", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Roma", zoneId: zoneData.id }),
      }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.name).toBe("Roma");
  });

  test("rechaza sin name o zoneId (400)", async () => {
    const { POST } = await import(
      "@/app/api/delivery-zones/colonias/route"
    );
    const res = await POST(
      makeRequest("http://localhost/api/delivery-zones/colonias", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Roma" }),
      }),
    );
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/delivery-zones/colonias/[id]", () => {
  test("borra colonia", async () => {
    const { POST: POSTZone } = await import("@/app/api/delivery-zones/route");
    const z = await POSTZone(
      makeRequest("http://localhost/api/delivery-zones", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Centro", cost: "20.00" }),
      }),
    );
    const { data: zoneData } = await z.json();

    const { POST: POSTCol } = await import(
      "@/app/api/delivery-zones/colonias/route"
    );
    const create = await POSTCol(
      makeRequest("http://localhost/api/delivery-zones/colonias", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Roma", zoneId: zoneData.id }),
      }),
    );
    const { data: colonia } = await create.json();

    const { DELETE } = await import(
      "@/app/api/delivery-zones/colonias/[id]/route"
    );
    const res = await DELETE(
      makeRequest(`http://localhost/api/delivery-zones/colonias/${colonia.id}`, {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: colonia.id }) },
    );
    expect(res.status).toBe(200);

    const { GET } = await import(
      "@/app/api/delivery-zones/colonias/route"
    );
    const list = await GET();
    const listJson = await list.json();
    expect(listJson.data).toEqual([]);
  });
});
