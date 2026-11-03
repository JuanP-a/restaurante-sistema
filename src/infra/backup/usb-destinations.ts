import type { DriveInfo } from "@/core/backup/drives";

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
