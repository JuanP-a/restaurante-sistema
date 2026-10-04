import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@/infra/db/schema";
import type { DbHandle } from "@/infra/db/types";

export function createPostgresDb(connectionString: string): DbHandle {
  const pool = new Pool({ connectionString, max: 10 });
  return { db: drizzle(pool, { schema }), close: () => pool.end() };
}
