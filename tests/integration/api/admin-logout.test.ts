import { afterAll, beforeEach, describe, expect, test } from "vitest";
import { sql } from "drizzle-orm";
import { getDb } from "@/infra/db/client";
import { adminSessions } from "@/infra/db/schema";
import type { NextRequest } from "next/server";

const db = getDb();

async function insertSession(token: string, expiresIn: number): Promise<void> {
  await db.insert(adminSessions).values({
    token,
    expiresAt: new Date(Date.now() + expiresIn),
  });
}

beforeEach(async () => {
  await db.execute(
    sql`TRUNCATE TABLE admin_sessions RESTART IDENTITY CASCADE`,
  );
});

afterAll(async () => {
  await db.execute(
    sql`TRUNCATE TABLE admin_sessions RESTART IDENTITY CASCADE`,
  );
});

describe("POST /api/admin/logout", () => {
  test("prune opportunista: borra sesiones expiradas", async () => {
    await insertSession("expired-token", -1000);
    await insertSession("valid-token", 60_000);

    const { POST } = await import("@/app/api/admin/logout/route");
    const req = new Request("http://localhost/api/admin/logout", {
      method: "POST",
    }) as unknown as NextRequest;
    const res = await POST(req);
    expect(res.status).toBe(200);

    const rows = await db.select().from(adminSessions);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.token).toBe("valid-token");
  });

  test("sin cookie válida: 200 + set-cookie clear", async () => {
    const { POST } = await import("@/app/api/admin/logout/route");
    const req = new Request("http://localhost/api/admin/logout", {
      method: "POST",
    }) as unknown as NextRequest;
    const res = await POST(req);
    expect(res.status).toBe(200);
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toMatch(/Max-Age=0/);
  });

  test("el handler retorna cookie cleared siempre", async () => {
    // Verifica que el contrato del endpoint incluye clear de cookie
    // independientemente del estado de la sesión.
    const { POST } = await import("@/app/api/admin/logout/route");
    const req = new Request("http://localhost/api/admin/logout", {
      method: "POST",
    }) as unknown as NextRequest;
    const res = await POST(req);
    expect(res.headers.get("set-cookie")).toMatch(/admin_session=;/);
  });
});
