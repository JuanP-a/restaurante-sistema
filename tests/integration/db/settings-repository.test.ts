// @vitest-environment node
import { sql } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { getDb } from "@/infra/db/client";
import {
  ADMIN_PASSWORD_HASH_KEY,
  getAdminPasswordHash,
  getSetting,
  setAdminPasswordHash,
  setSetting,
} from "@/infra/db/settings-repository";

const db = getDb();

beforeEach(async () => {
  await db.execute(sql`TRUNCATE TABLE settings`);
});

afterEach(async () => {
  await db.execute(sql`TRUNCATE TABLE settings`);
});

describe("settings-repository", () => {
  test("get devuelve null si no existe", async () => {
    expect(await getSetting("nope")).toBeNull();
  });

  test("set y get hacen upsert", async () => {
    await setSetting("clave", "uno");
    await setSetting("clave", "dos");
    expect(await getSetting("clave")).toBe("dos");
  });

  test("admin password hash: get/set", async () => {
    expect(await getAdminPasswordHash()).toBeNull();
    await setAdminPasswordHash("$2a$10$abcdefghijklmnopqrstuv");
    expect(await getAdminPasswordHash()).toBe("$2a$10$abcdefghijklmnopqrstuv");
    expect(ADMIN_PASSWORD_HASH_KEY).toBe("admin_password_hash");
  });
});
