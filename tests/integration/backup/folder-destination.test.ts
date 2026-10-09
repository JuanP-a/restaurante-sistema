// @vitest-environment node
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { createFolderDestination } from "@/infra/backup/folder-destination";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "backup-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("createFolderDestination", () => {
  test("write crea el directorio y el archivo", async () => {
    const dest = createFolderDestination({ id: "folder", label: "Carpeta", dir: join(dir, "sub") });
    const result = await dest.write("restaurante-2026-10-08-0300.sql", new TextEncoder().encode("SELECT 1;"));

    expect(result.ok).toBe(true);
    const read = await dest.read("restaurante-2026-10-08-0300.sql");
    expect(read.ok && read.value).toBe("SELECT 1;");
  });

  test("list devuelve vacío si el directorio no existe", async () => {
    const dest = createFolderDestination({ id: "folder", label: "Carpeta", dir: join(dir, "nope") });
    const result = await dest.list();
    expect(result).toEqual({ ok: true, value: [] });
  });

  test("list solo incluye nombres de backup, con tamaño y fecha", async () => {
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, "restaurante-2026-10-08-0300.sql"), "x");
    await writeFile(join(dir, "notas.txt"), "y");
    const dest = createFolderDestination({ id: "folder", label: "Carpeta", dir });

    const result = await dest.list();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.map((f) => f.name)).toEqual(["restaurante-2026-10-08-0300.sql"]);
    expect(result.value[0]?.bytes).toBe(1);
    expect(result.value[0]?.modifiedAt).toBeInstanceOf(Date);
  });

  test("remove borra el archivo", async () => {
    const dest = createFolderDestination({ id: "folder", label: "Carpeta", dir });
    await dest.write("restaurante-2026-10-08-0300.sql", new TextEncoder().encode("x"));
    const removed = await dest.remove("restaurante-2026-10-08-0300.sql");
    expect(removed.ok).toBe(true);
    const listed = await dest.list();
    expect(listed.ok && listed.value).toEqual([]);
  });
});
