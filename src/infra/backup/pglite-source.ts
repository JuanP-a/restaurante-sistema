import type { PGlite } from "@electric-sql/pglite";
import { pgDump } from "@electric-sql/pglite-tools/pg_dump";
import { err, ok, type Result } from "@/core/result";
import type { BackupError } from "@/core/backup/types";
import type { BackupSource } from "./port";

export function createPgliteBackupSource(client: PGlite): BackupSource {
  return {
    async dump(): Promise<Result<string, BackupError>> {
      try {
        const file = await pgDump({ pg: client });
        return ok(await file.text());
      } catch (cause) {
        return err({
          kind: "dump_failed",
          message: cause instanceof Error ? cause.message : "dump falló",
        });
      }
    },
  };
}
