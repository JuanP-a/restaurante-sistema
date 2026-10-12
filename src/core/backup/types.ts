export type BackupError =
  | { kind: "no_source" }
  | { kind: "dump_failed"; message: string }
  | { kind: "write_failed"; message: string }
  | { kind: "read_failed"; message: string }
  | { kind: "delete_failed"; message: string }
  | { kind: "verify_failed"; message: string };

export type BackupFile = {
  name: string;
  bytes: number;
  modifiedAt: Date;
};
