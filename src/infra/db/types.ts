import type { PgDatabase } from "drizzle-orm/pg-core";
import type { NodePgQueryResultHKT } from "drizzle-orm/node-postgres";
import type { PgliteQueryResultHKT } from "drizzle-orm/pglite";
import type * as schema from "@/infra/db/schema";

// Base Postgres type: both NodePgDatabase and PgliteDatabase satisfy it.
// The HKT is a union of both concrete result kinds so `db.execute<T>().rows`
// stays typed (the bare PgQueryResultHKT base erases it to `unknown`).
export type Db = PgDatabase<NodePgQueryResultHKT | PgliteQueryResultHKT, typeof schema>;
