// @vitest-environment node
import { sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, test } from "vitest";
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

  // El wizard es el primer arranque del local: dejar al operador en /login
  // justo después de definir la contraseña es fricción gratis.
  test("deja sesión iniciada (cookie) al terminar el setup", async () => {
    const { POST } = await import("@/app/api/setup/route");
    const res = await POST(post({ password: "clave-dura" }));
    expect(res.status).toBe(200);
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("admin_session=");
    expect(cookie.toLowerCase()).toContain("httponly");
  });
});
