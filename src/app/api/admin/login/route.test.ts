import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

// Candado de fuente: el contrato del cookie y del guard de setup debe
// sobrevivir a refactors. No se puede ejercitar por HTTP sin montar el
// route handler, así que se asserta sobre el propio archivo.
const routeSource = readFileSync("src/app/api/admin/login/route.ts", "utf8");

describe("login usa SESSION_COOKIE_SECURE (no NODE_ENV)", () => {
  it("el route no deriva secure de NODE_ENV", () => {
    expect(routeSource).toContain("secure: env.SESSION_COOKIE_SECURE");
    expect(routeSource).not.toContain('NODE_ENV === "production"');
  });

  it("el guard de setup devuelve code setup_required", () => {
    expect(routeSource).toContain('code: "setup_required"');
  });
});
