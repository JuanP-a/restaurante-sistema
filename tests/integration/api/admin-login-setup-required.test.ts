// @vitest-environment node
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import type { NextRequest } from "next/server";
import { resetEnvCacheForTests } from "@/env";

const originalHash = process.env.ADMIN_PASSWORD_HASH;

function makeReq(password: string, ip: string): NextRequest {
  return new Request("http://localhost/api/admin/login", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify({ password }),
  }) as unknown as NextRequest;
}

beforeEach(() => {
  // Desktop sin wizard completo: no hay hash en env (el de settings lo cubre Task 5).
  delete process.env.ADMIN_PASSWORD_HASH;
  resetEnvCacheForTests();
});

afterEach(() => {
  if (originalHash === undefined) delete process.env.ADMIN_PASSWORD_HASH;
  else process.env.ADMIN_PASSWORD_HASH = originalHash;
  resetEnvCacheForTests();
});

describe("login sin contraseña configurada", () => {
  test("responde 409 setup_required en vez de reventar", async () => {
    const { POST } = await import("@/app/api/admin/login/route");
    const res = await POST(makeReq("cualquiera", "10.9.0.1"));

    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("setup_required");
  });
});
