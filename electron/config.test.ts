// @vitest-environment node
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { loadConfig, resolveDefaultBackupDir, saveConfig } from "./config";

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "cfg-"));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("loadConfig", () => {
  test("genera un secreto si no existe config.json", async () => {
    expect((await loadConfig(dir)).sessionSecret.length).toBeGreaterThanOrEqual(32);
  });
  test("persiste y relee el secreto", async () => {
    const first = await loadConfig(dir);
    expect((await loadConfig(dir)).sessionSecret).toBe(first.sessionSecret);
  });
  test("config corrupta no impide arrancar (regenera)", async () => {
    await writeFile(join(dir, "config.json"), "{ no es json");
    expect((await loadConfig(dir)).sessionSecret.length).toBeGreaterThanOrEqual(32);
  });
});

describe("saveConfig", () => {
  test("guarda lastPort", async () => {
    await saveConfig(dir, { sessionSecret: "s".repeat(32), lastPort: 3211 });
    expect((await loadConfig(dir)).lastPort).toBe(3211);
  });
});

describe("resolveDefaultBackupDir", () => {
  test("vive bajo Documentos", () => {
    expect(resolveDefaultBackupDir("/home/user/Documents")).toBe("/home/user/Documents/restaurante-backups");
  });
});
