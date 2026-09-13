import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { getEnv } from "@/env";
import * as schema from "@/schema";

type Db = ReturnType<typeof createDb>;
const g = globalThis as unknown as { __dbPool?: Pool };
let db: Db | undefined;

function createDb() {
  const env = getEnv();
  if (!g.__dbPool) g.__dbPool = new Pool({ connectionString: env.DATABASE_URL, // pool size: fits within Neon free-tier connection limit
    max: 10 });
  return drizzle(g.__dbPool, { schema });
}

export function getDb(): Db {
  if (!db) db = createDb();
  return db;
}

export type { Db };