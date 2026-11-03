import { getEnv } from "@/env";
import { getBackupSource } from "@/infra/db/client";
import { resolveDestinations } from "./resolve-destinations";
import { listDrives } from "./windows-drives";
import type { BackupDeps } from "./http-routes";

export function realBackupDeps(): BackupDeps {
  return {
    getSource: () => getBackupSource(),
    resolveDestinations: () =>
      resolveDestinations({
        backupDir: getEnv().BACKUP_DIR,
        listDrives,
      }),
    keep: () => getEnv().BACKUP_KEEP,
    now: () => new Date(),
  };
}
