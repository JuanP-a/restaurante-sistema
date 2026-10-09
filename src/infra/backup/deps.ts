import { getEnv } from "@/env";
import { getBackupSource } from "@/infra/db/client";
import { resolveDestinations } from "./resolve-destinations";
import { listDrivesFromDrivelist } from "./usb-destinations";
import type { BackupDeps } from "./http-routes";

export function realBackupDeps(): BackupDeps {
  return {
    getSource: () => getBackupSource(),
    resolveDestinations: () =>
      resolveDestinations({
        backupDir: getEnv().BACKUP_DIR,
        listDrives: listDrivesFromDrivelist,
      }),
    keep: () => getEnv().BACKUP_KEEP,
    now: () => new Date(),
  };
}
