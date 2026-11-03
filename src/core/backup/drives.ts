export type DriveInfo = {
  isRemovable: boolean;
  isUSB: boolean | null;
  isReadOnly: boolean;
  mountpoints: { path: string }[];
};

export function selectUsbMounts(drives: DriveInfo[]): string[] {
  return drives
    .filter((d) => (d.isRemovable || d.isUSB === true) && !d.isReadOnly)
    .flatMap((d) => d.mountpoints.map((m) => m.path));
}
