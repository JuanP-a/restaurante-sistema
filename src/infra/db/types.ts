import type { PgDatabase } from "drizzle-orm/pg-core";
import type { NodePgQueryResultHKT } from "drizzle-orm/node-postgres";
import type { PgliteQueryResultHKT } from "drizzle-orm/pglite";
import type * as schema from "@/infra/db/schema";
import type { BackupSource } from "@/infra/backup/port";

// Base Postgres type: both NodePgDatabase and PgliteDatabase satisfy it.
// The HKT is a union of both concrete result kinds so `db.execute<T>().rows`
// stays typed (the bare PgQueryResultHKT base erases it to `unknown`).
export type Db = PgDatabase<NodePgQueryResultHKT | PgliteQueryResultHKT, typeof schema>;

// Adapter factories own a connection resource (Pool / PGlite handle) that the
// opaque `Db` type cannot expose, so they return it alongside the db: callers
// and tests can release it deterministically.
export type DbHandle = {
  db: Db;
  close: () => Promise<void>;
  backupSource?: BackupSource;
};
