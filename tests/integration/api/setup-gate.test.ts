// @vitest-environment node
import { sql } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, test } from "vitest";
import { getDb } from "@/infra/db/client";
import { setAdminPasswordHash } from "@/infra/db/settings-repository";
import { resetEnvCacheForTests } from "@/env";

const db = getDb();

beforeEach(async () => {
  await db.execute(sql`TRUNCATE TABLE settings`);
  delete process.env.ADMIN_PASSWORD_HASH;
  resetEnvCacheForTests();
});
afterEach(async () => {
  await db.execute(sql`TRUNCATE TABLE settings`);
});
afterAll(async () => {
  await db.execute(sql`TRUNCATE TABLE settings`);
});

describe("isSetupRequired", () => {
  test("true cuando no hay hash en settings ni env", async () => {
    const { isSetupRequired } = await import("@/infra/settings/setup-state");
    expect(await isSetupRequired()).toBe(true);
  });

  test("false cuando hay hash en settings", async () => {
    await setAdminPasswordHash("$2a$10$abcdefghijklmnopqrstuv");
    const { isSetupRequired } = await import("@/infra/settings/setup-state");
    expect(await isSetupRequired()).toBe(false);
  });
});
