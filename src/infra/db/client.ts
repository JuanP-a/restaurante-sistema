import { getEnv } from "@/env";
import { createPostgresDb } from "@/infra/db/adapters/postgres";
import type { Db } from "@/infra/db/types";

export type { Db } from "@/infra/db/types";

// Survives Next.js HMR module reloads in dev.
declare global {
  // eslint-disable-next-line no-var
  var __db: Db | undefined;
}

export async function initDb(): Promise<Db> {
  if (globalThis.__db) return globalThis.__db;
  const env = getEnv();
  if (env.DB_DRIVER === "pglite") {
    const { createPgliteDb } = await import("@/infra/db/adapters/pglite");
    globalThis.__db = await createPgliteDb({
      dataDir: env.DB_PATH,
      migrationsFolder: env.MIGRATIONS_PATH,
    });
  } else {
    if (!env.DATABASE_URL) throw new Error("DATABASE_URL requerida para DB_DRIVER=postgres");
    globalThis.__db = createPostgresDb(env.DATABASE_URL);
  }
  return globalThis.__db;
}

export function getDb(): Db {
  if (!globalThis.__db) {
    throw new Error("getDb() llamado antes de initDb(). Ver src/instrumentation.ts.");
  }
  return globalThis.__db;
}
