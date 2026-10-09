import type { Env } from "@/env";
import { createTcpTransport } from "./tcp";
import type { PrintTransport } from "./transport";

export function resolveTransport(
  env: Pick<Env, "PRINTER_HOST" | "PRINTER_PORT">,
): PrintTransport | null {
  if (!env.PRINTER_HOST) return null;
  return createTcpTransport({ host: env.PRINTER_HOST, port: env.PRINTER_PORT });
}
