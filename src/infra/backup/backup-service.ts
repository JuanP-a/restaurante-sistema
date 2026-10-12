import { backupFileName } from "@/core/backup/filename";
import { selectForDeletion } from "@/core/backup/rotation";
import { err, ok, type Result } from "@/core/result";
import type { BackupError } from "@/core/backup/types";
import type { BackupDestination, BackupSource } from "./port";

export type BackupReport = {
  name: string;
  bytes: number;
  written: { destinationId: string; label: string }[];
  failures: { destinationId: string; label: string; error: BackupError }[];
  rotated: { destinationId: string; removed: string[] }[];
};

export async function runBackup(input: {
  source: BackupSource;
  destinations: BackupDestination[];
  keep: number;
  now: Date;
}): Promise<Result<BackupReport, BackupError>> {
  const dump = await input.source.dump();
  if (!dump.ok) return err(dump.error);

  const name = backupFileName(input.now);
  const bytes = new TextEncoder().encode(dump.value);
  const written: BackupReport["written"] = [];
  const failures: BackupReport["failures"] = [];
  const rotated: BackupReport["rotated"] = [];

  for (const destination of input.destinations) {
    const stored = await destination.write(name, bytes);
    if (!stored.ok) {
      failures.push({
        destinationId: destination.id,
        label: destination.label,
        error: stored.error,
      });
      continue;
    }
    written.push({ destinationId: destination.id, label: destination.label });

    const listed = await destination.list();
    if (!listed.ok) continue;
    const removed: string[] = [];
    for (const file of selectForDeletion(listed.value, input.keep)) {
      const result = await destination.remove(file.name);
      if (result.ok) removed.push(file.name);
    }
    rotated.push({ destinationId: destination.id, removed });
  }

  return ok({ name, bytes: bytes.length, written, failures, rotated });
}
