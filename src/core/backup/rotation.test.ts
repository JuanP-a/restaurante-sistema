import { describe, expect, test } from "vitest";
import type { BackupFile } from "./types";
import { selectForDeletion } from "./rotation";

function file(name: string): BackupFile {
  return { name, bytes: 10, modifiedAt: new Date() };
}

describe("selectForDeletion", () => {
  test("no borra nada si no se excede el límite", () => {
    const files = [file("restaurante-2026-10-08-0300.sql")];
    expect(selectForDeletion(files, 7)).toEqual([]);
  });

  test("borra los más viejos cuando se excede el límite", () => {
    const files = [
      file("restaurante-2026-10-08-0302.sql"),
      file("restaurante-2026-10-08-0300.sql"),
      file("restaurante-2026-10-08-0301.sql"),
    ];
    const removed = selectForDeletion(files, 2).map((f) => f.name);
    expect(removed).toEqual(["restaurante-2026-10-08-0300.sql"]);
  });

  test("no muta la lista de entrada", () => {
    const files = [file("b.sql"), file("a.sql")];
    const snapshot = [...files];
    selectForDeletion(files, 1);
    expect(files).toEqual(snapshot);
  });
});
