// @vitest-environment node
import { describe, expect, test } from "vitest";
import { runBackup } from "@/infra/backup/backup-service";
import {
  createFakeDestination,
  createFakeSource,
  createFailingSource,
} from "@/infra/backup/fake";

const NOW = new Date(2026, 9, 8, 3, 0);
const NAME = "restaurante-2026-10-08-0300.sql";

describe("runBackup", () => {
  test("escribe el dump en cada destino y reporta", async () => {
    const a = createFakeDestination({ id: "folder", label: "Carpeta" });
    const b = createFakeDestination({ id: "usb:E:", label: "USB (E:)" });

    const result = await runBackup({
      source: createFakeSource("CREATE TABLE t (id int);"),
      destinations: [a, b],
      keep: 7,
      now: NOW,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.written.map((w) => w.destinationId)).toEqual(["folder", "usb:E:"]);
    expect(a.files.get(NAME)).toBe("CREATE TABLE t (id int);");
    expect(b.files.get(NAME)).toBe("CREATE TABLE t (id int);");
  });

  test("rota los backups viejos por encima de keep", async () => {
    const dest = createFakeDestination({
      id: "folder",
      label: "Carpeta",
      initial: [
        { name: "restaurante-2026-10-08-0258.sql", bytes: 1, modifiedAt: NOW },
        { name: "restaurante-2026-10-08-0259.sql", bytes: 1, modifiedAt: NOW },
      ],
    });

    const result = await runBackup({
      source: createFakeSource("x"),
      destinations: [dest],
      keep: 2,
      now: NOW,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.rotated[0]?.removed).toEqual(["restaurante-2026-10-08-0258.sql"]);
    expect(dest.files.has("restaurante-2026-10-08-0258.sql")).toBe(false);
  });

  test("si el dump falla no escribe y devuelve el error", async () => {
    const dest = createFakeDestination({ id: "folder", label: "Carpeta" });
    const result = await runBackup({
      source: createFailingSource({ kind: "dump_failed", message: "boom" }),
      destinations: [dest],
      keep: 7,
      now: NOW,
    });

    expect(result.ok).toBe(false);
    expect(dest.files.size).toBe(0);
  });

  test("éxito parcial: un destino falla y el otro escribe", async () => {
    const okDest = createFakeDestination({ id: "folder", label: "Carpeta" });
    const badDest = createFakeDestination({ id: "usb:E:", label: "USB (E:)", failWrite: true });

    const result = await runBackup({
      source: createFakeSource("x"),
      destinations: [okDest, badDest],
      keep: 7,
      now: NOW,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.written).toHaveLength(1);
    expect(result.value.failures).toHaveLength(1);
  });
});
