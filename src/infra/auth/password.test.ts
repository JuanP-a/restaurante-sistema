import { describe, it, expect } from "vitest";
import bcrypt from "bcryptjs";
import { hashPassword, verifyPassword } from "./password";

describe("verifyPassword", () => {
  it("returns true for correct password", async () => {
    const hash = await bcrypt.hash("test", 10);
    expect(await verifyPassword("test", hash)).toBe(true);
  });
  it("returns false for wrong password", async () => {
    const hash = await bcrypt.hash("test", 10);
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });
  it("returns false for empty password against non-empty hash", async () => {
    const hash = await bcrypt.hash("test", 10);
    expect(await verifyPassword("", hash)).toBe(false);
  });
});

describe("hashPassword", () => {
  // El wizard de primer arranque guarda este hash en `settings`; si el cost
  // cambiara, el regex de ADMIN_PASSWORD_HASH (que exige $10$) lo rechazaría.
  it("produce un hash bcrypt cost 10 verificable", async () => {
    const hash = await hashPassword("clave-nueva");
    expect(hash.startsWith("$2")).toBe(true);
    expect(hash).toMatch(/^\$2[aby]\$10\$/);
    expect(await verifyPassword("clave-nueva", hash)).toBe(true);
  });
});