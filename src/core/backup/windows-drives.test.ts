import { describe, expect, test } from "vitest";
import { selectUsbMounts } from "./drives";
import { parseWindowsDrives } from "./windows-drives";

type Row = { id?: unknown; type?: unknown; usb?: unknown; access?: unknown };

function mountsOf(rows: Row[]): string[] {
  const parsed = parseWindowsDrives(JSON.stringify(rows));
  if (!parsed.ok) throw new Error(`no parseó: ${parsed.error.message}`);
  return selectUsbMounts(parsed.value);
}

describe("parseWindowsDrives", () => {
  test("un pendrive (DriveType 2) es destino y su mount termina en barra", () => {
    expect(mountsOf([{ id: "E:", type: 2, usb: true, access: 3 }])).toEqual(["E:\\"]);
  });

  // Windows marca los discos duros USB como "fijos" (3); sin mirar el bus USB se perderían.
  test("un disco duro USB (DriveType 3, bus USB) es destino", () => {
    expect(mountsOf([{ id: "F:", type: 3, usb: true, access: 3 }])).toEqual(["F:\\"]);
  });

  test("el disco del sistema y las unidades de red no son destino", () => {
    expect(
      mountsOf([
        { id: "C:", type: 3, usb: false, access: 0 },
        { id: "Z:", type: 4, usb: false, access: 0 },
      ]),
    ).toEqual([]);
  });

  test("una unidad de solo lectura (Access 1) se excluye; 0 (desconocido) y 3 se aceptan", () => {
    expect(
      mountsOf([
        { id: "E:", type: 2, usb: true, access: 1 },
        { id: "F:", type: 2, usb: true, access: 0 },
        { id: "G:", type: 2, usb: true, access: 3 },
      ]),
    ).toEqual(["F:\\", "G:\\"]);
  });

  test.each([["", "salida vacía"], ["  \r\n", "solo espacios"], ["[]", "array vacío"]])(
    "sin unidades (%j: %s) devuelve lista vacía",
    (raw) => {
      expect(parseWindowsDrives(raw)).toEqual({ ok: true, value: [] });
    },
  );

  // Una entrada rara no debe esconder un USB válido que viene a su lado.
  test("descarta las entradas inválidas y conserva las buenas", () => {
    expect(
      mountsOf([
        { id: 5, type: 2, usb: true, access: 3 },
        { type: 2, usb: true, access: 3 },
        { id: "E:", type: "2", usb: true, access: 3 },
        { id: "F:", type: 2, usb: true, access: 3 },
      ]),
    ).toEqual(["F:\\"]);
  });

  test.each([["no es json", "{no"], ["un objeto suelto", '{"id":"E:"}'], ["un número", "42"]])(
    "salida ilegible (%s) devuelve error",
    (_name, raw) => {
      const parsed = parseWindowsDrives(raw);
      expect(parsed.ok).toBe(false);
      if (!parsed.ok) expect(parsed.error.kind).toBe("invalid_output");
    },
  );
});
