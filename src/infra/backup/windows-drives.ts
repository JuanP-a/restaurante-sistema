import { execFile } from "node:child_process";
import type { DriveInfo } from "@/core/backup/drives";
import { parseWindowsDrives } from "@/core/backup/windows-drives";

export type RunPowerShell = (script: string) => Promise<string>;

// Constante: no hay entradas del usuario que interpolar. Windows marca los discos duros
// USB como DriveType 3 (fijo), por eso se mira también el bus del disco físico.
// CIM tarda ~0,4 s; Get-Disk/Get-Partition tardaba 8,5 s (spec DT-018).
export const DRIVES_SCRIPT = [
  `$usb = @(Get-CimInstance Win32_DiskDrive -Filter "InterfaceType='USB'" | ForEach-Object { Get-CimAssociatedInstance -InputObject $_ -ResultClassName Win32_DiskPartition | ForEach-Object { Get-CimAssociatedInstance -InputObject $_ -ResultClassName Win32_LogicalDisk } } | ForEach-Object { $_.DeviceID })`,
  `$rows = @(Get-CimInstance Win32_LogicalDisk | Where-Object { $_.DriveType -eq 2 -or $usb -contains $_.DeviceID } | ForEach-Object { [pscustomobject]@{ id = $_.DeviceID; type = [int]$_.DriveType; usb = ($usb -contains $_.DeviceID); access = [int]$_.Access } })`,
  `ConvertTo-Json -InputObject $rows -Compress`,
].join("\n");

const TIMEOUT_MS = 5000;

export const runPowerShell: RunPowerShell = (script) =>
  new Promise((resolve, reject) => {
    // execFile, no shell: el script viaja como un único argumento.
    execFile(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", script],
      { timeout: TIMEOUT_MS, windowsHide: true },
      (error, stdout) => (error ? reject(error) : resolve(stdout)),
    );
  });

// Si PowerShell falla (bloqueado, timeout) degradamos a "sin USB": la carpeta
// sincronizada sigue siendo un destino válido y el backup no se rompe.
export function createDriveLister(deps: {
  run: RunPowerShell;
  platform: string;
  warn: (message: string, cause: unknown) => void;
}): () => Promise<DriveInfo[]> {
  return async () => {
    if (deps.platform !== "win32") return [];
    try {
      const parsed = parseWindowsDrives(await deps.run(DRIVES_SCRIPT));
      if (parsed.ok) return parsed.value;
      deps.warn("No se pudo leer la lista de unidades, se omite el destino USB:", parsed.error);
    } catch (cause) {
      deps.warn("PowerShell no disponible, se omite el destino USB:", cause);
    }
    return [];
  };
}

export const listDrives = createDriveLister({
  run: runPowerShell,
  platform: process.platform,
  warn: (message, cause) => console.warn(message, cause),
});
