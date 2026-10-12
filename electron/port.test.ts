// @vitest-environment node
import { describe, expect, test } from "vitest";
import { pickPort } from "./port";

describe("pickPort", () => {
  test("devuelve start si está libre", async () => {
    expect(await pickPort(3210, async () => true)).toBe(3210);
  });
  test("avanza hasta el primer libre", async () => {
    const taken = new Set([3210, 3211]);
    expect(await pickPort(3210, async (p) => !taken.has(p))).toBe(3212);
  });
  test("lanza si no encuentra libre en el rango", async () => {
    await expect(pickPort(3210, async () => false, 3)).rejects.toThrow(/no hay puerto libre/);
  });
});
