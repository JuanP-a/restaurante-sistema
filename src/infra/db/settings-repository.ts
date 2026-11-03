import { parsePrinterSettings, type PrinterSettings } from "@/core/settings/printer";
import { eq } from "drizzle-orm";
import { getDb } from "@/infra/db/client";
import { settings } from "@/infra/db/schema";

export const ADMIN_PASSWORD_HASH_KEY = "admin_password_hash";
export const SETUP_COMPLETED_KEY = "setup_completed_at";

export async function getSetting(key: string): Promise<string | null> {
  const [row] = await getDb().select().from(settings).where(eq(settings.key, key));
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await getDb()
    .insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date() } });
}

export function getAdminPasswordHash(): Promise<string | null> {
  return getSetting(ADMIN_PASSWORD_HASH_KEY);
}

export function setAdminPasswordHash(hash: string): Promise<void> {
  return setSetting(ADMIN_PASSWORD_HASH_KEY, hash);
}

export const PRINTER_HOST_KEY = "printer_host";
export const PRINTER_PORT_KEY = "printer_port";

// null = sin configurar (la config cae al env). Un host vacío guardado es
// "desactivada a propósito" y gana sobre el env. Un dato corrupto también da
// null: mejor caer al env que romper la impresión de todos los pedidos.
export async function getPrinterSettings(): Promise<PrinterSettings | null> {
  const host = await getSetting(PRINTER_HOST_KEY);
  if (host === null) return null;
  const parsed = parsePrinterSettings({ host, port: (await getSetting(PRINTER_PORT_KEY)) ?? "" });
  return parsed.ok ? parsed.value : null;
}

export async function setPrinterSettings(config: PrinterSettings): Promise<void> {
  // El host va al final: su existencia es lo que activa la config de la DB.
  await setSetting(PRINTER_PORT_KEY, String(config.port));
  await setSetting(PRINTER_HOST_KEY, config.host);
}
