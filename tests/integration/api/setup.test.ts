// @vitest-environment node
import { sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, test } from "vitest";
import { resetEnvCacheForTests } from "@/env";
import { getDb } from "@/infra/db/client";

const db = getDb();

function post(body: unknown): Request {
  return new Request("http://localhost/api/setup", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(async () => {
  await db.execute(sql`TRUNCATE TABLE settings`);
  // `.env.local` trae ADMIN_PASSWORD_HASH; el setup debe partir de "sin hash
  // en ninguna fuente" salvo en el test que lo setea a propósito.
  delete process.env.ADMIN_PASSWORD_HASH;
  resetEnvCacheForTests();
});
afterAll(async () => {
  await db.execute(sql`TRUNCATE TABLE settings`);
});

describe("POST /api/setup", () => {
  test("setea el hash y luego responde 409 (one-shot)", async () => {
    const { POST } = await import("@/app/api/setup/route");

    const first = await POST(post({ password: "clave-dura" }));
    expect(first.status).toBe(200);

    const second = await POST(post({ password: "otra-clave" }));
    expect(second.status).toBe(409);
    const body = (await second.json()) as { error: { code: string } };
    expect(body.error.code).toBe("already_setup");
  });

  test("rechaza contraseña débil con 400", async () => {
    const { POST } = await import("@/app/api/setup/route");
    const res = await POST(post({ password: "123" }));
    expect(res.status).toBe(400);
  });

  test("409 si hay hash en env (no permite override en cloud)", async () => {
    const original = process.env.ADMIN_PASSWORD_HASH;
    process.env.ADMIN_PASSWORD_HASH = "$2a$10$abcdefghijklmnopqrstuv";
    resetEnvCacheForTests();
    try {
      const { POST } = await import("@/app/api/setup/route");
      const res = await POST(post({ password: "clave-dura" }));
      expect(res.status).toBe(409);
    } finally {
      if (original === undefined) delete process.env.ADMIN_PASSWORD_HASH;
      else process.env.ADMIN_PASSWORD_HASH = original;
      resetEnvCacheForTests();
    }
  });

  test("en éxito setea cookie de sesión (auto-login)", async () => {
    const { POST } = await import("@/app/api/setup/route");
    const res = await POST(post({ password: "clave-dura-2" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie") ?? "").toContain("admin_session=");
  });
});
