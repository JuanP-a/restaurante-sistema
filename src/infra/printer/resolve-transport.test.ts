import { describe, expect, test } from "vitest";
import { resolveTransport } from "./index";

describe("resolveTransport", () => {
  test("devuelve null sin PRINTER_HOST (fallback al navegador)", () => {
    expect(resolveTransport({ PRINTER_HOST: "", PRINTER_PORT: 9100 })).toBeNull();
  });
});
