import { err, ok, type Result } from "@/core/result";
import type { BackupError, BackupFile } from "@/core/backup/types";
import type { BackupDestination, BackupSource } from "./port";

export function createFakeSource(sql: string): BackupSource {
  return {
    async dump() {
      return ok(sql);
    },
  };
}

export function createFailingSource(error: BackupError): BackupSource {
  return {
    async dump() {
      return err(error);
    },
  };
}

export type FakeDestination = BackupDestination & { files: Map<string, string> };

export function createFakeDestination(input: {
  id: string;
  label: string;
  initial?: BackupFile[];
  failWrite?: boolean;
}): FakeDestination {
  const files = new Map(input.initial?.map((f) => [f.name, ""]) ?? []);
  return {
    id: input.id,
    label: input.label,
    files,

    async write(name, bytes) {
      if (input.failWrite) return err({ kind: "write_failed", message: "simulado" });
      files.set(name, new TextDecoder().decode(bytes));
      return ok(undefined);
    },
    async list(): Promise<Result<BackupFile[], BackupError>> {
      return ok(
        [...files].map(([name, content]) => ({
          name,
          bytes: content.length,
          modifiedAt: new Date(0),
        })),
      );
    },
    async read(name) {
      const value = files.get(name);
      return value === undefined ? err({ kind: "read_failed", message: "no existe" }) : ok(value);
    },
    async remove(name) {
      files.delete(name);
      return ok(undefined);
    },
  };
}
