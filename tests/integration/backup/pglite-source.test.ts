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
    // PGlite dump arranca un worker WASM; en Windows supera los 5 s por defecto.
  }, 30000);

  // pg_dump corre con default_transaction_read_only=on y comparte la sesión del
  // cliente vivo: sin restaurar el flag, todo INSERT posterior falla con
  // "cannot execute INSERT in a read-only transaction" (el login devolvía 500
  // hasta reiniciar la app).
  test("después del dump la conexión sigue aceptando escrituras", async () => {
    client = new PGlite();
    await client.exec("CREATE TABLE demo_write (id int primary key);");

    const source = createPgliteBackupSource(client);
    const result = await source.dump();
    expect(result.ok).toBe(true);

    await client.exec("INSERT INTO demo_write (id) VALUES (1);");

    const count = await client.query<{ c: number }>("select count(*)::int as c from demo_write");
    expect(count.rows[0]?.c).toBe(1);
  }, 30000);
});
