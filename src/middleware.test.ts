// @vitest-environment node
import { NextRequest } from "next/server";
import { describe, expect, test } from "vitest";
import { middleware } from "./middleware";

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
