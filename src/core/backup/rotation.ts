import type { BackupFile } from "./types";

export function selectForDeletion(files: BackupFile[], keep: number): BackupFile[] {
  const sorted = [...files].sort((a, b) => a.name.localeCompare(b.name));
  return sorted.slice(0, Math.max(0, sorted.length - keep));
}
