import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@/infra/db/schema";
import type { Db } from "@/infra/db/types";

export function createPostgresDb(connectionString: string): Db {
  const pool = new Pool({ connectionString, max: 10 });
  return drizzle(pool, { schema });
}
