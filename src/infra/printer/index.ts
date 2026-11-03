import type { Env } from "@/env";
import { getPrinterSettings } from "@/infra/db/settings-repository";
import { createTcpTransport } from "./tcp";
import type { PrintTransport } from "./transport";

type PrinterConfig = Pick<Env, "PRINTER_HOST" | "PRINTER_PORT">;

export function resolveTransport(env: PrinterConfig): PrintTransport | null {
  if (!env.PRINTER_HOST) return null;
  return createTcpTransport({ host: env.PRINTER_HOST, port: env.PRINTER_PORT });
}

// La DB gana sobre el env: el .exe no tiene env y se configura desde la UI; cloud
// sigue con PRINTER_HOST. Se lee por request para no exigir reinicio tras editar.
export async function loadPrinterConfig(env: PrinterConfig): Promise<PrinterConfig> {
  const stored = await getPrinterSettings();
  if (!stored) return { PRINTER_HOST: env.PRINTER_HOST, PRINTER_PORT: env.PRINTER_PORT };
  return { PRINTER_HOST: stored.host, PRINTER_PORT: stored.port };
}
