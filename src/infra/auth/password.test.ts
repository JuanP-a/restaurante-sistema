import { describe, it, expect } from "vitest";
import bcrypt from "bcryptjs";
import { verifyPassword } from "./password";

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