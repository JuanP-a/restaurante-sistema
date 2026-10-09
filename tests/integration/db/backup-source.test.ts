// @vitest-environment node
import { describe, expect, test } from "vitest";
import { getBackupSource } from "@/infra/db/client";

describe("getBackupSource", () => {
  test("en modo pglite hay una fuente de backup", () => {
    const source = getBackupSource();
    expect(source).not.toBeNull();
  });

  test("la fuente produce un dump restaurable", async () => {
    const source = getBackupSource();
    if (!source) throw new Error("sin fuente");
    const dump = await source.dump();
    expect(dump.ok).toBe(true);
    if (!dump.ok) return;
    expect(dump.value).toContain("CREATE TABLE");
  });
});
