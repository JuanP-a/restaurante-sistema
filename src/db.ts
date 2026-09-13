import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { getEnv } from "./env";
import * as schema from "./schema";

let pool: Pool | null = null;

export function getDb() {
  if (pool) return drizzle(pool, { schema });
  const env = getEnv();
  pool = new Pool({ connectionString: env.DATABASE_URL, max: 10 });
  return drizzle(pool, { schema });
}

export type Db = ReturnType<typeof getDb>;
