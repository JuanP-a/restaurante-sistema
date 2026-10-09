import type { Result } from "@/core/result";
import type { BackupError, BackupFile } from "@/core/backup/types";

export type BackupSource = {
  dump(): Promise<Result<string, BackupError>>;
};

export type BackupDestination = {
  id: string;
  label: string;
  write(name: string, bytes: Uint8Array): Promise<Result<void, BackupError>>;
  list(): Promise<Result<BackupFile[], BackupError>>;
  read(name: string): Promise<Result<string, BackupError>>;
  remove(name: string): Promise<Result<void, BackupError>>;
};
