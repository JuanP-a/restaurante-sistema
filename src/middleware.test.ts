// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { resetEnvCacheForTests } from "@/env";
import { middleware } from "./middleware";

// El middleware lee getEnv(). Sin fijar estas variables el test dependía de .env.local
// (que vitest.setup.ts carga) y fallaba en CI, donde ese archivo no existe.
beforeEach(() => {
  vi.stubEnv("SESSION_SECRET", "a".repeat(32));
  vi.stubEnv("DB_DRIVER", "pglite");
  resetEnvCacheForTests();
});

afterEach(() => {
  vi.unstubAllEnvs();
  resetEnvCacheForTests();
});

describe("middleware: rutas protegidas", () => {
  // /api/settings/printer abre TCP a un host que elige quien llama: sin sesión no puede ser alcanzable.
  test.each(["/api/settings/printer", "/api/settings/printer/test"])(
    "%s exige sesión",
    (path) => {
      const res = middleware(new NextRequest(`http://localhost${path}`));
      expect(res.status).toBe(401);
    },
  );
});
