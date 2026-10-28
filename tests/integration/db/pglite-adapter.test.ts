// @vitest-environment node
import { afterEach, describe, expect, test } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { createPgliteDb } from "@/infra/db/adapters/pglite";

describe("createPgliteDb con DB_PATH en disco", () => {
  const roots: string[] = [];

  afterEach(async () => {
    await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
    roots.length = 0;
  });

  // Primer arranque en un clon limpio: DB_PATH apunta a `.data/pglite`, y ni
  // `.data` ni el directorio hoja existen. PGlite no crea directorios
  // intermedios, así que el adapter tiene que hacerlo o la app no arranca.
  test("crea el directorio de datos cuando el padre no existe", async () => {
    const root = await mkdtemp(join(tmpdir(), "pglite-adapter-"));
    roots.push(root);
    const dataDir = join(root, "no-existe", "pglite");

    const handle = await createPgliteDb({ dataDir, migrationsFolder: "./drizzle" });

    try {
      const result = await handle.db.execute<{ count: string }>(
        sql`SELECT count(*)::text AS count FROM categories`,
      );
      expect(result.rows).toHaveLength(1);
    } finally {
      await handle.close();
    }
  }, 60000);
});
