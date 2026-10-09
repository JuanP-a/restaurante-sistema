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

// drivelist es un addon nativo; si no está disponible (CI, build sin toolchain)
// degradamos a "sin USB" en vez de romper el backup — la carpeta sincronizada
// sigue siendo un destino válido.
export async function listDrivesFromDrivelist(): Promise<DriveInfo[]> {
  try {
    const { list } = await import("drivelist");
    return await list();
  } catch (cause) {
    console.warn("drivelist no disponible, se omite el destino USB:", cause);
    return [];
  }
}
