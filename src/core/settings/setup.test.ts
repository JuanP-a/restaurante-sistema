import { describe, expect, test } from "vitest";
import { requiresSetup, validatePassword } from "./setup";

describe("requiresSetup", () => {
  test("requiere setup si no hay hash ni en settings ni en env", () => {
    expect(requiresSetup(false, undefined)).toBe(true);
  });
  test("no requiere si hay hash en settings", () => {
    expect(requiresSetup(true, undefined)).toBe(false);
  });
  test("no requiere si hay hash en env (cloud)", () => {
    expect(requiresSetup(false, "$2a$10$abcdefghijklmnopqrstuv")).toBe(false);
  });
  test("no requiere si hay ambos", () => {
    expect(requiresSetup(true, "$2a$10$abcdefghijklmnopqrstuv")).toBe(false);
  });
});

describe("validatePassword", () => {
  test("acepta una contraseña suficiente", () => {
    expect(validatePassword("clave-larga").ok).toBe(true);
  });
  test("rechaza vacía", () => {
    const r = validatePassword("");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("weak_password");
  });
  test("rechaza menor a 6 caracteres", () => {
    expect(validatePassword("12345").ok).toBe(false);
    expect(validatePassword("123456").ok).toBe(true);
  });
});
