// @vitest-environment node
import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, test } from "vitest";
import { init } from "@/core/printing/escpos-bytes";
import { getDb } from "@/infra/db/client";
import { getPrinterSettings, setPrinterSettings } from "@/infra/db/settings-repository";
import { createPrinterSettingsRoutes, type PrinterRouteDeps } from "@/infra/printer/http-routes";
import { startCaptureServer } from "../printer/capture-server";

const db = getDb();
const NOW = new Date(2026, 10, 3, 14, 5);

function deps(overrides: Partial<PrinterRouteDeps> = {}): PrinterRouteDeps {
  return {
    isDesktop: () => true,
    env: () => ({ PRINTER_HOST: "", PRINTER_PORT: 9100 }),
    now: () => NOW,
    ...overrides,
  };
}

function json(method: string, body: unknown): Request {
  return new Request("http://test/api/settings/printer", {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

type Body = { ok: boolean; data?: { host: string; port: number }; error?: { message: string } };

beforeEach(async () => {
  await db.execute(sql`TRUNCATE TABLE settings`);
});

describe("solo escritorio", () => {
  // En cloud, un endpoint que abre TCP a un host arbitrario sería un vector SSRF.
  test("las tres rutas responden 409 fuera de escritorio", async () => {
    const { GET, PUT, TEST } = createPrinterSettingsRoutes(deps({ isDesktop: () => false }));
    expect((await GET()).status).toBe(409);
    expect((await PUT(json("PUT", { host: "10.0.0.2", port: 9100 }))).status).toBe(409);
    expect((await TEST(json("POST", { host: "10.0.0.2", port: 9100 }))).status).toBe(409);
    expect(await getPrinterSettings()).toBeNull();
  });
});

describe("GET /api/settings/printer", () => {
  test("sin config guardada devuelve la del env", async () => {
    const { GET } = createPrinterSettingsRoutes(
      deps({ env: () => ({ PRINTER_HOST: "10.0.0.9", PRINTER_PORT: 9100 }) }),
    );
    const body = (await (await GET()).json()) as Body;
    expect(body.data).toEqual({ host: "10.0.0.9", port: 9100 });
  });

  test("con config guardada devuelve la guardada", async () => {
    await setPrinterSettings({ host: "192.168.1.50", port: 9101 });
    const { GET } = createPrinterSettingsRoutes(deps());
    const body = (await (await GET()).json()) as Body;
    expect(body.data).toEqual({ host: "192.168.1.50", port: 9101 });
  });
});

describe("PUT /api/settings/printer", () => {
  test("guarda una config válida", async () => {
    const { PUT } = createPrinterSettingsRoutes(deps());
    const res = await PUT(json("PUT", { host: "192.168.1.50", port: "9101" }));
    expect(res.status).toBe(200);
    expect(await getPrinterSettings()).toEqual({ host: "192.168.1.50", port: 9101 });
  });

  test("400 con mensaje en español y sin guardar nada si el host es inválido", async () => {
    const { PUT } = createPrinterSettingsRoutes(deps());
    const res = await PUT(json("PUT", { host: "http://192.168.1.50", port: 9100 }));
    const body = (await res.json()) as Body;
    expect(res.status).toBe(400);
    expect(body.error?.message).toMatch(/IP/);
    expect(await getPrinterSettings()).toBeNull();
  });

  test.each([["no es un objeto", "texto"], ["falta el host", { port: 9100 }], ["host no es texto", { host: 5 }]])(
    "400 si el cuerpo no tiene la forma esperada (%s)",
    async (_name, payload) => {
      const { PUT } = createPrinterSettingsRoutes(deps());
      expect((await PUT(json("PUT", payload))).status).toBe(400);
    },
  );

  test("400 si el cuerpo no es JSON", async () => {
    const { PUT } = createPrinterSettingsRoutes(deps());
    const res = await PUT(new Request("http://test/x", { method: "PUT", body: "{no" }));
    expect(res.status).toBe(400);
  });
});

describe("POST /api/settings/printer/test", () => {
  test("200 y el ticket de prueba llega a la impresora; no guarda nada", async () => {
    const printer = await startCaptureServer();
    try {
      const { TEST } = createPrinterSettingsRoutes(deps());
      const res = await TEST(json("POST", { host: printer.host, port: printer.port }));
      expect(res.status).toBe(200);
      const bytes = await printer.received();
      expect([...bytes.subarray(0, 2)]).toEqual([...init()]);
      expect(await getPrinterSettings()).toBeNull();
    } finally {
      await printer.close();
    }
  });

  test("502 con mensaje claro si no hay nadie escuchando", async () => {
    const printer = await startCaptureServer();
    const { host, port } = printer;
    await printer.close();
    const { TEST } = createPrinterSettingsRoutes(deps());
    const res = await TEST(json("POST", { host, port }));
    const body = (await res.json()) as Body;
    expect(res.status).toBe(502);
    expect(body.error?.message).toMatch(/conectar/i);
  });

  test("400 con host inválido o vacío (no hay nada que probar)", async () => {
    const { TEST } = createPrinterSettingsRoutes(deps());
    expect((await TEST(json("POST", { host: "http://x", port: 9100 }))).status).toBe(400);
    expect((await TEST(json("POST", { host: "", port: 9100 }))).status).toBe(400);
  });
});
