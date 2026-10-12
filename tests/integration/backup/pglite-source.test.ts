// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { afterEach, describe, expect, test } from "vitest";
import { createPgliteBackupSource } from "@/infra/backup/pglite-source";

let client: PGlite | null = null;

afterEach(async () => {
  if (client) await client.close();
  client = null;
});

describe("createPgliteBackupSource", () => {
  test("dump devuelve SQL con CREATE TABLE e INSERT", async () => {
    client = new PGlite();
    await client.exec("CREATE TABLE demo (id int primary key, nombre text);");
    await client.exec("INSERT INTO demo (id, nombre) VALUES (1, 'taco');");

    const source = createPgliteBackupSource(client);
    const result = await source.dump();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toContain("CREATE TABLE");
    expect(result.value).toContain("INSERT INTO");
    expect(result.value).toContain("taco");
  });
});
