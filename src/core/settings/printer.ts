import { err, ok, type Result } from "@/core/result";

export type PrinterSettings = { host: string; port: number };

export type PrinterSettingsError = {
  kind: "invalid_host" | "invalid_port";
  message: string;
};

// Puerto raw ESC/POS estándar de las térmicas de red.
export const DEFAULT_PRINTER_PORT = 9100;

const HOSTNAME = /^[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?)*$/;
const LOOKS_NUMERIC = /^[\d.]+$/;
// Sin ceros a la izquierda: "010" se lee como octal según el sistema.
const IPV4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
const DIGITS = /^\d+$/;

function isValidHost(host: string): boolean {
  // "999.1.1.1" encajaría como hostname y fallaría recién al conectar.
  if (LOOKS_NUMERIC.test(host)) return IPV4.test(host);
  return HOSTNAME.test(host);
}

function parsePort(port: string | number): number | null {
  if (typeof port === "string") {
    const text = port.trim();
    if (text === "") return DEFAULT_PRINTER_PORT;
    // Number() aceptaría "0x2384" o "1e3".
    if (!DIGITS.test(text)) return null;
  }
  const value = typeof port === "number" ? port : Number(port);
  return Number.isInteger(value) && value >= 1 && value <= 65535 ? value : null;
}

export function parsePrinterSettings(input: {
  host: string;
  port: string | number;
}): Result<PrinterSettings, PrinterSettingsError> {
  const host = input.host.trim();
  // Sin host = impresora desactivada: no hay nada más que validar.
  if (host === "") return ok({ host: "", port: DEFAULT_PRINTER_PORT });

  if (!isValidHost(host)) {
    return err({
      kind: "invalid_host",
      message: "La IP no es válida. Escríbela sin http:// ni puerto (ej. 192.168.1.50)",
    });
  }
  const port = parsePort(input.port);
  if (port === null) {
    return err({ kind: "invalid_port", message: "El puerto debe ser un número entre 1 y 65535" });
  }
  return ok({ host, port });
}
