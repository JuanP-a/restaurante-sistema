import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "@/infra/db/schema";
import type { Db } from "@/infra/db/types";

export async function createPgliteDb(input: {
  dataDir: string;
  migrationsFolder: string;
}): Promise<Db> {
  // "memory://" runs ephemeral (tests). Any other value persists to disk.
  const client = input.dataDir === "memory://" ? new PGlite() : new PGlite(input.dataDir);
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: input.migrationsFolder });
  return db;
}
