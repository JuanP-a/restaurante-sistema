import { mkdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "@/infra/db/schema";
import type { DbHandle } from "@/infra/db/types";
import { createPgliteBackupSource } from "@/infra/backup/pglite-source";

export async function createPgliteDb(input: {
  dataDir: string;
  migrationsFolder: string;
}): Promise<DbHandle> {
  // "memory://" runs ephemeral (tests). Any other value persists to disk.
  if (input.dataDir !== "memory://") {
    // PGlite only mkdirs the leaf directory, so a fresh clone (`DB_PATH=./.data/pglite`)
    // would fail to boot with ENOENT on the missing parent.
    await mkdir(input.dataDir, { recursive: true });
  }
  const client = input.dataDir === "memory://" ? new PGlite() : new PGlite(input.dataDir);
  try {
    const db = drizzle(client, { schema });
    await migrate(db, { migrationsFolder: input.migrationsFolder });
    return { db, close: () => client.close(), backupSource: createPgliteBackupSource(client) };
  } catch (error) {
    // Release the client before surfacing the failure, otherwise the data dir
    // lock is held for the life of the process.
    await client.close();
    throw error;
  }
}
