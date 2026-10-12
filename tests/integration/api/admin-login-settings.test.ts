// @vitest-environment node
import { sql } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, test } from "vitest";
import type { NextRequest } from "next/server";
import { getDb } from "@/infra/db/client";
import { setAdminPasswordHash } from "@/infra/db/settings-repository";
import { hashPassword } from "@/infra/auth/password";
import { resetEnvCacheForTests } from "@/env";

const db = getDb();

function makeReq(password: string, ip: string): NextRequest {
  return new Request("http://localhost/api/admin/login", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify({ password }),
  }) as unknown as NextRequest;
}

beforeEach(async () => {
  await db.execute(sql`TRUNCATE TABLE settings`);
  await db.execute(sql`TRUNCATE TABLE admin_sessions RESTART IDENTITY CASCADE`);
});
afterEach(async () => {
  await db.execute(sql`TRUNCATE TABLE settings`);
});
afterAll(async () => {
  await db.execute(sql`TRUNCATE TABLE settings`);
  await db.execute(sql`TRUNCATE TABLE admin_sessions RESTART IDENTITY CASCADE`);
});

describe("login con hash en settings", () => {
  test("acepta la contraseña de settings y la prioriza sobre env", async () => {
    await setAdminPasswordHash(await hashPassword("clave-settings"));
    const { POST } = await import("@/app/api/admin/login/route");

    const okRes = await POST(makeReq("clave-settings", "10.1.0.1"));
    expect(okRes.status).toBe(200);

    const wrongRes = await POST(makeReq("no-es-la-clave", "10.1.0.2"));
    expect(wrongRes.status).toBe(401);
  });

  test("sin hash en settings ni env → 409 setup_required", async () => {
    const original = process.env.ADMIN_PASSWORD_HASH;
    delete process.env.ADMIN_PASSWORD_HASH;
    resetEnvCacheForTests();
    try {
      const { POST } = await import("@/app/api/admin/login/route");
      const res = await POST(makeReq("lo-que-sea", "10.1.0.3"));
      expect(res.status).toBe(409);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe("setup_required");
    } finally {
      if (original !== undefined) process.env.ADMIN_PASSWORD_HASH = original;
      resetEnvCacheForTests();
    }
  });
});
