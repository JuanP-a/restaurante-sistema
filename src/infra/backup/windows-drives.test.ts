import { describe, expect, test } from "vitest";
import { createDriveLister, DRIVES_SCRIPT, type RunPowerShell } from "./windows-drives";

const USB_JSON = '[{"id":"E:","type":2,"usb":true,"access":3}]';

function lister(run: RunPowerShell, platform = "win32") {
  const warnings: string[] = [];
  const listDrives = createDriveLister({ run, platform, warn: (message) => warnings.push(message) });
  return { listDrives, warnings };
}

describe("createDriveLister", () => {
  test("devuelve las unidades que imprime PowerShell", async () => {
    const { listDrives } = lister(async () => USB_JSON);
    expect(await listDrives()).toEqual([
      { isRemovable: true, isUSB: true, isReadOnly: false, mountpoints: [{ path: "E:\\" }] },
    ]);
  });

  test("ejecuta el script fijo, sin nada interpolado", async () => {
    const received: string[] = [];
    const { listDrives } = lister(async (script) => {
      received.push(script);
      return "[]";
    });
    await listDrives();
    expect(received).toEqual([DRIVES_SCRIPT]);
  });

  // PowerShell bloqueado o con timeout no puede romper el backup a carpeta.
  test("si PowerShell falla devuelve lista vacía y avisa una vez", async () => {
    const { listDrives, warnings } = lister(async () => {
      throw new Error("timeout");
    });
    expect(await listDrives()).toEqual([]);
    expect(warnings).toHaveLength(1);
  });

  test("si la salida es ilegible devuelve lista vacía y avisa", async () => {
    const { listDrives, warnings } = lister(async () => "esto no es json");
    expect(await listDrives()).toEqual([]);
    expect(warnings).toHaveLength(1);
  });

  test("fuera de Windows no ejecuta nada", async () => {
    let calls = 0;
    const { listDrives } = lister(async () => {
      calls += 1;
      return USB_JSON;
    }, "linux");
    expect(await listDrives()).toEqual([]);
    expect(calls).toBe(0);
  });
});
