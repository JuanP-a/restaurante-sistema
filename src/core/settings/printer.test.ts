import { describe, expect, test } from "vitest";
import { parsePrinterSettings } from "./printer";

function parse(host: string, port: string | number = "") {
  return parsePrinterSettings({ host, port });
}

describe("parsePrinterSettings", () => {
  test("acepta una IPv4 y usa el puerto por defecto 9100 (raw ESC/POS)", () => {
    expect(parse("192.168.1.50")).toEqual({
      ok: true,
      value: { host: "192.168.1.50", port: 9100 },
    });
  });

  test("acepta un hostname", () => {
    expect(parse("impresora.local")).toEqual({
      ok: true,
      value: { host: "impresora.local", port: 9100 },
    });
  });

  test("quita espacios alrededor del host", () => {
    expect(parse("  192.168.1.50  ")).toEqual({
      ok: true,
      value: { host: "192.168.1.50", port: 9100 },
    });
  });

  test("host vacío o en blanco = impresora desactivada (fallback al navegador)", () => {
    expect(parse("")).toEqual({ ok: true, value: { host: "", port: 9100 } });
    expect(parse("   ")).toEqual({ ok: true, value: { host: "", port: 9100 } });
  });

  test("acepta el puerto como texto o número", () => {
    expect(parse("10.0.0.2", "9101")).toEqual({ ok: true, value: { host: "10.0.0.2", port: 9101 } });
    expect(parse("10.0.0.2", 9101)).toEqual({ ok: true, value: { host: "10.0.0.2", port: 9101 } });
  });

  // Un error de tecleo guardado haría fallar toda comanda con 502: se rechaza antes.
  test.each(["http://192.168.1.50", "192.168.1.50:9100", "mi impresora", "a/b", "999.1.1.1", "1.2.3", "01.1.1.1", "192.168.001.050"])(
    "rechaza host %j",
    (host) => {
      const r = parse(host);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.kind).toBe("invalid_host");
    },
  );

  // Number() acepta "0x2384" (=9092) y "1e3" (=1000): se guardaría un puerto que nadie tecleó.
  test.each(["0", "70000", "abc", "1.5", "-1", "0x2384", "1e3", "9100.0"])("rechaza puerto %j", (port) => {
    const r = parse("192.168.1.50", port);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("invalid_port");
  });

  test("rechaza puerto numérico fuera de rango o no entero", () => {
    expect(parse("192.168.1.50", 0).ok).toBe(false);
    expect(parse("192.168.1.50", 65536).ok).toBe(false);
    expect(parse("192.168.1.50", 1.5).ok).toBe(false);
  });

  test("con host vacío ignora el puerto (nada que validar)", () => {
    expect(parse("", "abc")).toEqual({ ok: true, value: { host: "", port: 9100 } });
  });
});
