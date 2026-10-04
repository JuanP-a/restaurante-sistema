import { config } from "dotenv";
import { initDb } from "@/infra/db/client";

config({ path: ".env.local", override: false });

// dotenv keeps `\$` literal in double-quoted strings, but Next.js (via
// dotenv-expand) processes escape sequences so `$VAR` references aren't
// truncated. Strip the literal backslashes that protect `$` characters so
// tests see the same shape as production.
for (const [key, value] of Object.entries(process.env)) {
  if (typeof value === "string" && value.includes("\\$")) {
    process.env[key] = value.replace(/\\\$/g, "$");
  }
}

// Only integration tests touch the DB. `test` and `test:integration` set
// VITEST_INIT_DB=1; `test:unit` does not, keeping unit runs pure and fast.
// To run integration against a real Postgres (SaaS parity), export
// DB_DRIVER=postgres + DATABASE_URL before `pnpm test:integration`.
if (process.env.VITEST_INIT_DB === "1") {
  if (!process.env.DB_DRIVER) process.env.DB_DRIVER = "pglite";
  if (process.env.DB_DRIVER === "pglite") {
    process.env.DB_PATH = "memory://";
    process.env.MIGRATIONS_PATH = "./drizzle";
  }
  await initDb();
}