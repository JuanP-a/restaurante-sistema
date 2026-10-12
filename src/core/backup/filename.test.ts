import { describe, expect, test } from "vitest";
import { backupFileName, isBackupFileName } from "./filename";

describe("backupFileName", () => {
  test("formatea la fecha local con campos zero-padded", () => {
    const name = backupFileName(new Date(2026, 9, 8, 3, 7)); // 8 oct 2026, 03:07
    expect(name).toBe("restaurante-2026-10-08-0307.sql");
  });

  test("nombres distintos ordenan lexicográficamente por tiempo", () => {
    const older = backupFileName(new Date(2026, 9, 8, 3, 7));
    const newer = backupFileName(new Date(2026, 9, 8, 3, 8));
    expect(older < newer).toBe(true);
  });
});

describe("isBackupFileName", () => {
  test("acepta nombres válidos", () => {
    expect(isBackupFileName("restaurante-2026-10-08-0307.sql")).toBe(true);
  });

  test("rechaza nombres que no son backup", () => {
    expect(isBackupFileName("README.md")).toBe(false);
    expect(isBackupFileName("restaurante-2026-10-08.sql")).toBe(false);
    expect(isBackupFileName("restaurante-2026-10-08-0307.sql.bak")).toBe(false);
  });
});
