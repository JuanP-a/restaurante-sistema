import { err, ok, type Result } from "@/core/result";
import type { DriveInfo } from "./drives";

export type DriveListError = { kind: "invalid_output"; message: string };

// Win32_LogicalDisk.DriveType 2 = extraíble. Access 1 = solo lectura.
const DRIVE_TYPE_REMOVABLE = 2;
const ACCESS_READ_ONLY = 1;

function toDrive(row: unknown): DriveInfo | null {
  if (typeof row !== "object" || row === null) return null;
  if (!("id" in row) || typeof row.id !== "string" || row.id === "") return null;
  if (!("type" in row) || typeof row.type !== "number") return null;
  if (!("usb" in row) || typeof row.usb !== "boolean") return null;
  if (!("access" in row) || typeof row.access !== "number") return null;
  return {
    isRemovable: row.type === DRIVE_TYPE_REMOVABLE,
    isUSB: row.usb,
    isReadOnly: row.access === ACCESS_READ_ONLY,
    mountpoints: [{ path: `${row.id}\\` }],
  };
}

// Parsea el JSON que imprime el script de PowerShell. Una entrada inválida se descarta
// sin esconder las buenas; solo una salida que no es un array es un error.
export function parseWindowsDrives(raw: string): Result<DriveInfo[], DriveListError> {
  if (raw.trim() === "") return ok([]);
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return err({ kind: "invalid_output", message: "La salida de PowerShell no es JSON" });
  }
  if (!Array.isArray(data)) {
    return err({ kind: "invalid_output", message: "La salida de PowerShell no es una lista" });
  }
  const drives = data.map(toDrive).filter((drive): drive is DriveInfo => drive !== null);
  return ok(drives);
}
