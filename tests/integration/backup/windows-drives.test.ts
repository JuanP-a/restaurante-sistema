// @vitest-environment node
import { describe, expect, test } from "vitest";
import { parseWindowsDrives } from "@/core/backup/windows-drives";
import { DRIVES_SCRIPT, listDrives, runPowerShell } from "@/infra/backup/windows-drives";

// Ejecuta el script CIM real. No exige que haya un USB conectado: comprueba que
// PowerShell arranca, el script no tiene errores y no cuelga la página de backups.
describe.skipIf(process.platform !== "win32")("PowerShell real", () => {
  // listDrives degrada a [] ante cualquier fallo, así que este test ejecuta el script
  // directamente: si tuviera un error de sintaxis, aquí se vería.
  test("el script imprime JSON parseable en menos de 5 s", async () => {
    const started = Date.now();
    const parsed = parseWindowsDrives(await runPowerShell(DRIVES_SCRIPT));
    expect(parsed.ok).toBe(true);
    expect(Date.now() - started).toBeLessThan(5000);
  });

  test("el disco del sistema no se ofrece como destino de backup", async () => {
    const drives = await listDrives();
    const systemDrive = `${process.env.SystemDrive ?? "C:"}\\`;
    const mounts = drives.flatMap((drive) => drive.mountpoints.map((m) => m.path));
    expect(mounts).not.toContain(systemDrive);
  });
});
