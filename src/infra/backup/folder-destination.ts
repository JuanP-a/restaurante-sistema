import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { err, ok, type Result } from "@/core/result";
import { isBackupFileName } from "@/core/backup/filename";
import type { BackupError, BackupFile } from "@/core/backup/types";
import type { BackupDestination } from "./port";

const message = (cause: unknown): string =>
  cause instanceof Error ? cause.message : "error desconocido";

const isNotFound = (cause: unknown): boolean =>
  typeof cause === "object" && cause !== null && "code" in cause && cause.code === "ENOENT";

// El nombre solo puede venir del universo de backups; validarlo antes de tocar
// el filesystem evita path traversal (`../`) y rechaza cualquier otro archivo.
const outsideUniverse = (name: string): boolean => !isBackupFileName(name);

export function createFolderDestination(input: {
  id: string;
  label: string;
  dir: string;
}): BackupDestination {
  return {
    id: input.id,
    label: input.label,

    async write(name, bytes): Promise<Result<void, BackupError>> {
      if (outsideUniverse(name)) {
        return err({ kind: "write_failed", message: `nombre inválido: ${name}` });
      }
      try {
        await mkdir(input.dir, { recursive: true });
        await writeFile(join(input.dir, name), bytes);
        return ok(undefined);
      } catch (cause) {
        return err({ kind: "write_failed", message: message(cause) });
      }
    },

    async list(): Promise<Result<BackupFile[], BackupError>> {
      try {
        const names = (await readdir(input.dir)).filter(isBackupFileName);
        const files: BackupFile[] = [];
        for (const name of names) {
          const info = await stat(join(input.dir, name));
          files.push({ name, bytes: info.size, modifiedAt: info.mtime });
        }
        return ok(files);
      } catch (cause) {
        if (isNotFound(cause)) return ok([]);
        return err({ kind: "read_failed", message: message(cause) });
      }
    },

    async read(name): Promise<Result<string, BackupError>> {
      if (outsideUniverse(name)) {
        return err({ kind: "read_failed", message: `nombre inválido: ${name}` });
      }
      try {
        return ok(await readFile(join(input.dir, name), "utf8"));
      } catch (cause) {
        return err({ kind: "read_failed", message: message(cause) });
      }
    },

    async remove(name): Promise<Result<void, BackupError>> {
      if (outsideUniverse(name)) {
        return err({ kind: "delete_failed", message: `nombre inválido: ${name}` });
      }
      try {
        await rm(join(input.dir, name));
        return ok(undefined);
      } catch (cause) {
        return err({ kind: "delete_failed", message: message(cause) });
      }
    },
  };
}
