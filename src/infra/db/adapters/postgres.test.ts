// @vitest-environment node
import { describe, expect, test } from "vitest";
import { sql } from "drizzle-orm";
import { createPostgresDb } from "./postgres";

// Opt-in contract test: only runs when a real Postgres is the selected driver.
// Gating on DB_DRIVER (not just DATABASE_URL) keeps it out of the default
// PGlite suite, where .env.local may still define DATABASE_URL.
const databaseUrl =
  process.env.DB_DRIVER === "postgres" ? process.env.DATABASE_URL : undefined;

describe.skipIf(databaseUrl === undefined)("createPostgresDb (opt-in, Postgres real)", () => {
  test("conecta y ejecuta SELECT 1", async () => {
    if (databaseUrl === undefined) throw new Error("DATABASE_URL no definida");
    const { db, close } = createPostgresDb(databaseUrl);
    try {
      const result = await db.execute<{ ok: number }>(sql`SELECT 1 as ok`);
      expect(Number(result.rows[0]?.ok)).toBe(1);
    } finally {
      await close();
    }
  }, 30000);
});
