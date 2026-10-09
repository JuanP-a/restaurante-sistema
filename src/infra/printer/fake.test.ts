import { describe, expect, test } from "vitest";
import { createFakeTransport } from "./fake";

describe("createFakeTransport", () => {
  test("captura los bytes enviados", async () => {
    const transport = createFakeTransport();
    const bytes = Uint8Array.from([0x1b, 0x40]);
    const result = await transport.send(bytes);
    expect(result.ok).toBe(true);
    expect(transport.sent).toEqual([bytes]);
  });

  test("falla las primeras N veces y luego acepta", async () => {
    const transport = createFakeTransport({ failTimes: 2 });
    const bytes = Uint8Array.from([0x01]);
    expect((await transport.send(bytes)).ok).toBe(false);
    expect((await transport.send(bytes)).ok).toBe(false);
    expect((await transport.send(bytes)).ok).toBe(true);
    expect(transport.sent).toEqual([bytes]);
  });
});
