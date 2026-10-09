// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { afterEach, describe, expect, test } from "vitest";
import { createPgliteBackupSource } from "@/infra/backup/pglite-source";
import { verifyBackup } from "@/infra/backup/restore-verify";

let client: PGlite | null = null;

afterEach(async () => {
  if (client) await client.close();
  client = null;
});

describe("verifyBackup", () => {
  test("un dump con datos se restaura y reporta conteos", async () => {
    client = new PGlite();
    await client.exec(`
      CREATE TABLE categories (id serial primary key, name text);
      CREATE TABLE products (id serial primary key, name text);
      CREATE TABLE orders (id serial primary key, total text);
      INSERT INTO categories (name) VALUES ('Bebidas'), ('Tacos');
      INSERT INTO orders (total) VALUES ('100');
    `);
    const dump = await createPgliteBackupSource(client).dump();
    if (!dump.ok) throw new Error("dump falló");

    const result = await verifyBackup(dump.value);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const byName = Object.fromEntries(result.value.tables.map((t) => [t.name, t.rows]));
    expect(byName).toEqual({ orders: 1, products: 0, categories: 2 });
  });

  test("un SQL inválido devuelve verify_failed", async () => {
    const result = await verifyBackup("esto no es sql;");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("verify_failed");
  });
});
