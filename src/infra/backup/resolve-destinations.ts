import { join } from "node:path";
import { createFolderDestination } from "./folder-destination";
import { selectUsbMounts, type DriveInfo } from "./usb-destinations";
import type { BackupDestination } from "./port";

export async function resolveDestinations(input: {
  backupDir: string;
  listDrives: () => Promise<DriveInfo[]>;
}): Promise<BackupDestination[]> {
  const folder = createFolderDestination({
    id: "folder",
    label: "Carpeta sincronizada",
    dir: input.backupDir,
  });

  const mounts = selectUsbMounts(await input.listDrives());
  const usb = mounts.map((mount) =>
    createFolderDestination({
      id: `usb:${mount}`,
      label: `USB (${mount})`,
      dir: join(mount, "restaurante-backups"),
    }),
  );

  return [folder, ...usb];
}
