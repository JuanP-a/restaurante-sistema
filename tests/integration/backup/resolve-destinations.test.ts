// @vitest-environment node
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { resolveDestinations } from "@/infra/backup/resolve-destinations";
import type { DriveInfo } from "@/infra/backup/usb-destinations";

describe("resolveDestinations", () => {
  test("siempre incluye la carpeta sincronizada", async () => {
    const dests = await resolveDestinations({
      backupDir: "/tmp/backups",
      listDrives: async () => [],
    });
    expect(dests.map((d) => d.id)).toEqual(["folder"]);
    expect(dests[0]?.label).toBe("Carpeta sincronizada");
  });

  test("agrega una carpeta por unidad USB removible", async () => {
    const drives: DriveInfo[] = [
      { isRemovable: true, isUSB: true, isReadOnly: false, mountpoints: [{ path: join("/tmp", "usb1") }] },
      { isRemovable: false, isUSB: null, isReadOnly: false, mountpoints: [{ path: "/" }] },
    ];
    const dests = await resolveDestinations({ backupDir: "/tmp/backups", listDrives: async () => drives });

    expect(dests.map((d) => d.id)).toEqual(["folder", `usb:${join("/tmp", "usb1")}`]);
  });
});
