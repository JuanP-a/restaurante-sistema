import { NextResponse } from "next/server";
import { parsePrinterSettings, type PrinterSettings } from "@/core/settings/printer";
import { renderTestTicket } from "@/core/printing/render-ticket";
import { getEnv, type Env } from "@/env";
import { setPrinterSettings } from "@/infra/db/settings-repository";
import { loadPrinterConfig } from "./index";
import { createTcpTransport } from "./tcp";
import type { PrintError } from "./transport";

type PrinterEnv = Pick<Env, "PRINTER_HOST" | "PRINTER_PORT">;

export type PrinterRouteDeps = {
  isDesktop: () => boolean;
  env: () => PrinterEnv;
  now: () => Date;
};

export function realPrinterRouteDeps(): PrinterRouteDeps {
  return {
    isDesktop: () => getEnv().DB_DRIVER === "pglite",
    env: getEnv,
    now: () => new Date(),
  };
}

// Un solo intento y timeout corto: el operador espera frente a la pantalla y los 3
// reintentos con backoff del print-service retrasarían el error.
const TEST_TIMEOUT_MS = 3000;

const fail = (message: string, status: number) =>
  NextResponse.json({ ok: false, error: { message } }, { status });

const NOT_DESKTOP = "Los ajustes de impresora solo existen en la versión de escritorio";

function printErrorMessage(error: PrintError, host: string, port: number): string {
  const target = `${host}:${port}`;
  switch (error.kind) {
    case "timeout":
      return `La impresora ${target} no respondió a tiempo. Revisa que esté encendida y en la misma red`;
    case "connection":
      return `No se pudo conectar con la impresora ${target}. Revisa la IP y que esté encendida`;
    case "io":
      return `Se perdió la conexión con la impresora ${target}`;
    case "not_configured":
      return "No hay impresora configurada";
  }
}

// El cuerpo llega sin tipar: se valida la forma antes de pasar al parser de dominio.
async function readBody(req: Request): Promise<{ host: string; port: string | number } | null> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return null;
  }
  if (typeof body !== "object" || body === null) return null;
  const host = "host" in body ? body.host : undefined;
  const port = "port" in body ? body.port : "";
  if (typeof host !== "string") return null;
  if (typeof port !== "string" && typeof port !== "number") return null;
  return { host, port };
}

async function readSettings(req: Request): Promise<NextResponse | PrinterSettings> {
  const body = await readBody(req);
  if (!body) return fail("Cuerpo inválido: se espera { host, port }", 400);
  const parsed = parsePrinterSettings(body);
  return parsed.ok ? parsed.value : fail(parsed.error.message, 400);
}

export function createPrinterSettingsRoutes(deps: PrinterRouteDeps): {
  GET: () => Promise<Response>;
  PUT: (req: Request) => Promise<Response>;
  TEST: (req: Request) => Promise<Response>;
} {
  async function GET(): Promise<Response> {
    if (!deps.isDesktop()) return fail(NOT_DESKTOP, 409);
    const config = await loadPrinterConfig(deps.env());
    return NextResponse.json({
      ok: true,
      data: { host: config.PRINTER_HOST, port: config.PRINTER_PORT },
    });
  }

  async function PUT(req: Request): Promise<Response> {
    if (!deps.isDesktop()) return fail(NOT_DESKTOP, 409);
    const settings = await readSettings(req);
    if (settings instanceof NextResponse) return settings;
    await setPrinterSettings(settings);
    return NextResponse.json({ ok: true, data: settings });
  }

  async function TEST(req: Request): Promise<Response> {
    if (!deps.isDesktop()) return fail(NOT_DESKTOP, 409);
    const settings = await readSettings(req);
    if (settings instanceof NextResponse) return settings;
    if (settings.host === "") return fail("Escribe la IP de la impresora para probarla", 400);
    const transport = createTcpTransport({ ...settings, timeoutMs: TEST_TIMEOUT_MS });
    const sent = await transport.send(renderTestTicket(deps.now()));
    if (!sent.ok) return fail(printErrorMessage(sent.error, settings.host, settings.port), 502);
    return NextResponse.json({ ok: true });
  }

  return { GET, PUT, TEST };
}
