// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, test } from "vitest";
import { sql } from "drizzle-orm";
import { createPgliteDb } from "./pglite";
import * as schema from "@/infra/db/schema";

const dir = mkdtempSync(join(tmpdir(), "pglite-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("createPgliteDb", () => {
  test("crea la DB, migra y permite insertar/leer en un data dir", async () => {
    const db = await createPgliteDb({ dataDir: dir, migrationsFolder: "./drizzle" });
    const [cat] = await db
      .insert(schema.categories)
      .values({ name: "Bebidas", slug: "bebidas" })
      .returning();
    expect(cat?.id).toBeTruthy();
    const rows = await db.execute<{ count: string }>(
      sql`SELECT count(*)::text as count FROM categories`,
    );
    expect(Number(rows.rows[0]?.count)).toBe(1);
  }, 30000);
});
