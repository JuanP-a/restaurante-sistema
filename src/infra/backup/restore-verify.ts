import { PGlite } from "@electric-sql/pglite";
import { err, ok, type Result } from "@/core/result";
import type { BackupError } from "@/core/backup/types";

export type VerifyReport = { tables: { name: string; rows: number }[] };

const CHECKED_TABLES = ["orders", "products", "categories"] as const;

export async function verifyBackup(sql: string): Promise<Result<VerifyReport, BackupError>> {
  const client = new PGlite();
  try {
    await client.exec(sql);
    const tables: VerifyReport["tables"] = [];
    for (const name of CHECKED_TABLES) {
      // pgDump emite `SELECT set_config('search_path', '', false)` y cualifica
      // las tablas como `public.*`, así que hay que consultarlas cualificadas.
      const result = await client.query<{ count: number }>(
        `SELECT count(*)::int AS count FROM public.${name}`,
      );
      tables.push({ name, rows: result.rows[0]?.count ?? 0 });
    }
    return ok({ tables });
  } catch (cause) {
    return err({
      kind: "verify_failed",
      message: cause instanceof Error ? cause.message : "no restaurable",
    });
  } finally {
    await client.close();
  }
}
