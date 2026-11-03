// @vitest-environment node
import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, test } from "vitest";
import { getDb } from "@/infra/db/client";
import {
  PRINTER_HOST_KEY,
  PRINTER_PORT_KEY,
  setPrinterSettings,
  setSetting,
} from "@/infra/db/settings-repository";
import { loadPrinterConfig } from "@/infra/printer/index";

const db = getDb();
const env = { PRINTER_HOST: "10.0.0.9", PRINTER_PORT: 9100 };

beforeEach(async () => {
  await db.execute(sql`TRUNCATE TABLE settings`);
});

describe("loadPrinterConfig", () => {
  test("sin config en la DB usa el env (cloud)", async () => {
    expect(await loadPrinterConfig(env)).toEqual(env);
  });

  test("la config de la DB gana sobre el env (.exe)", async () => {
    await setPrinterSettings({ host: "192.168.1.50", port: 9101 });
    expect(await loadPrinterConfig(env)).toEqual({ PRINTER_HOST: "192.168.1.50", PRINTER_PORT: 9101 });
  });

  // Sin esto el operador no podría apagar la impresora si el env trae una IP.
  test("host vacío en la DB desactiva la impresora aunque el env tenga host", async () => {
    await setPrinterSettings({ host: "", port: 9100 });
    expect(await loadPrinterConfig(env)).toEqual({ PRINTER_HOST: "", PRINTER_PORT: 9100 });
  });

  test("dato corrupto en la DB cae al env", async () => {
    await setSetting(PRINTER_HOST_KEY, "192.168.1.50");
    await setSetting(PRINTER_PORT_KEY, "abc");
    expect(await loadPrinterConfig(env)).toEqual(env);
  });
});
