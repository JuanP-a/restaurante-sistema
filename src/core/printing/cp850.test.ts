import { describe, expect, test } from "vitest";
import { encodeCp850 } from "./cp850";

describe("encodeCp850", () => {
  test("ASCII pasa sin cambios", () => {
    expect(encodeCp850("Hamburguesa 2x")).toEqual([
      0x48, 0x61, 0x6d, 0x62, 0x75, 0x72, 0x67, 0x75, 0x65, 0x73, 0x61, 0x20,
      0x32, 0x78,
    ]);
  });

  test("mapea acentos y signos del español", () => {
    expect(encodeCp850("ñáé")).toEqual([0xa4, 0xa0, 0x82]);
    expect(encodeCp850("¿¡")).toEqual([0xa8, 0xad]);
    expect(encodeCp850("ÁÉÍÓÚÜÑ")).toEqual([0xb5, 0x90, 0xd6, 0xe0, 0xe9, 0x9a, 0xa5]);
  });

  test("salto de línea es 0x0a", () => {
    expect(encodeCp850("a\nb")).toEqual([0x61, 0x0a, 0x62]);
  });

  test("carácter no mapeado cae a '?'", () => {
    expect(encodeCp850("→")).toEqual([0x3f]);
  });
});
