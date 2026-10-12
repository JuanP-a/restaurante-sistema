import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("/admin/backup es force-dynamic", () => {
  it("declara force-dynamic", () => {
    const src = readFileSync("src/app/admin/backup/page.tsx", "utf8");
    expect(src).toContain('export const dynamic = "force-dynamic"');
  });
});
