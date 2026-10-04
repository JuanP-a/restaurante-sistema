import { getEnv } from "@/env";
import { createPostgresDb } from "@/infra/db/adapters/postgres";
import type { Db } from "@/infra/db/types";

export type { Db } from "@/infra/db/types";

// Survives Next.js HMR module reloads in dev.
declare global {
  // eslint-disable-next-line no-var
  var __db: Db | undefined;
  // eslint-disable-next-line no-var
  var __dbInit: Promise<Db> | undefined;
}

async function createDb(): Promise<Db> {
  const env = getEnv();
  if (env.DB_DRIVER === "pglite") {
    const { createPgliteDb } = await import("@/infra/db/adapters/pglite");
    const { db } = await createPgliteDb({
      dataDir: env.DB_PATH,
      migrationsFolder: env.MIGRATIONS_PATH,
    });
    return db;
  }
  if (!env.DATABASE_URL) throw new Error("DATABASE_URL requerida para DB_DRIVER=postgres");
  return createPostgresDb(env.DATABASE_URL).db;
}

export async function initDb(): Promise<Db> {
  if (globalThis.__db) return globalThis.__db;
  if (!globalThis.__dbInit) {
    const pending = createDb().then((db) => {
      globalThis.__db = db;
      return db;
    });
    globalThis.__dbInit = pending;
    // Clear the in-flight slot on failure so a later caller can retry instead
    // of awaiting a permanently rejected promise.
    pending.catch(() => {
      if (globalThis.__dbInit === pending) globalThis.__dbInit = undefined;
    });
  }
  return globalThis.__dbInit;
}

export function getDb(): Db {
  if (!globalThis.__db) {
    throw new Error("getDb() llamado antes de initDb(). Ver src/instrumentation.ts.");
  }
  return globalThis.__db;
}
