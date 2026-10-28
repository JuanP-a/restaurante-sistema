// @vitest-environment node
import { sql } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { getDb } from "@/infra/db/client";
import { setAdminPasswordHash } from "@/infra/db/settings-repository";
import { resetEnvCacheForTests } from "@/env";

const db = getDb();
const originalHash = process.env.ADMIN_PASSWORD_HASH;

beforeEach(async () => {
  // El gate solo debe pedir setup cuando NO hay hash en ninguno de los dos
  // lugares; el .env.local de dev sí trae uno, así que lo sacamos.
  delete process.env.ADMIN_PASSWORD_HASH;
  resetEnvCacheForTests();
  await db.execute(sql`TRUNCATE TABLE settings`);
});

afterEach(async () => {
  if (originalHash === undefined) delete process.env.ADMIN_PASSWORD_HASH;
  else process.env.ADMIN_PASSWORD_HASH = originalHash;
  resetEnvCacheForTests();
  await db.execute(sql`TRUNCATE TABLE settings`);
});

describe("isSetupRequired", () => {
  test("true cuando no hay hash en settings ni en env", async () => {
    const { isSetupRequired } = await import("@/infra/settings/setup-state");
    expect(await isSetupRequired()).toBe(true);
  });

  test("false cuando hay hash en settings", async () => {
    await setAdminPasswordHash("$2a$10$abcdefghijklmnopqrstuv");
    const { isSetupRequired } = await import("@/infra/settings/setup-state");
    expect(await isSetupRequired()).toBe(false);
  });
});
