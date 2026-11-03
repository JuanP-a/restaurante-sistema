// @vitest-environment node
import { sql } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { getDb } from "@/infra/db/client";
import {
  ADMIN_PASSWORD_HASH_KEY,
  getAdminPasswordHash,
  getPrinterSettings,
  getSetting,
  PRINTER_HOST_KEY,
  PRINTER_PORT_KEY,
  setAdminPasswordHash,
  setPrinterSettings,
  setSetting,
} from "@/infra/db/settings-repository";

const db = getDb();

beforeEach(async () => {
  await db.execute(sql`TRUNCATE TABLE settings`);
});

afterEach(async () => {
  await db.execute(sql`TRUNCATE TABLE settings`);
});

describe("settings-repository", () => {
  test("get devuelve null si no existe", async () => {
    expect(await getSetting("nope")).toBeNull();
  });

  test("set y get hacen upsert", async () => {
    await setSetting("clave", "uno");
    await setSetting("clave", "dos");
    expect(await getSetting("clave")).toBe("dos");
  });

  test("admin password hash: get/set", async () => {
    expect(await getAdminPasswordHash()).toBeNull();
    await setAdminPasswordHash("$2a$10$abcdefghijklmnopqrstuv");
    expect(await getAdminPasswordHash()).toBe("$2a$10$abcdefghijklmnopqrstuv");
    expect(ADMIN_PASSWORD_HASH_KEY).toBe("admin_password_hash");
  });
});

describe("settings-repository: impresora", () => {
  test("sin filas devuelve null (la config cae al env)", async () => {
    expect(await getPrinterSettings()).toBeNull();
  });

  test("guardar y leer devuelve lo guardado; guardar de nuevo actualiza", async () => {
    await setPrinterSettings({ host: "192.168.1.50", port: 9100 });
    expect(await getPrinterSettings()).toEqual({ host: "192.168.1.50", port: 9100 });
    await setPrinterSettings({ host: "192.168.1.51", port: 9101 });
    expect(await getPrinterSettings()).toEqual({ host: "192.168.1.51", port: 9101 });
  });

  // Host vacío guardado = "desactivada a propósito", distinto de "sin configurar" (null):
  // así el operador puede apagar la impresora aunque el env tenga una IP.
  test("host vacío se lee como desactivada, no como null", async () => {
    await setPrinterSettings({ host: "", port: 9100 });
    expect(await getPrinterSettings()).toEqual({ host: "", port: 9100 });
  });

  test("dato corrupto en la DB devuelve null en vez de lanzar", async () => {
    await setSetting(PRINTER_HOST_KEY, "192.168.1.50");
    await setSetting(PRINTER_PORT_KEY, "abc");
    expect(await getPrinterSettings()).toBeNull();
    await setSetting(PRINTER_HOST_KEY, "http://x");
    await setSetting(PRINTER_PORT_KEY, "9100");
    expect(await getPrinterSettings()).toBeNull();
  });

  test("host guardado sin puerto usa el 9100", async () => {
    await setSetting(PRINTER_HOST_KEY, "192.168.1.50");
    expect(await getPrinterSettings()).toEqual({ host: "192.168.1.50", port: 9100 });
  });
});
