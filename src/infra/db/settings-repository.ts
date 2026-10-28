import { eq } from "drizzle-orm";
import { getDb } from "@/infra/db/client";
import { settings } from "@/infra/db/schema";

export const ADMIN_PASSWORD_HASH_KEY = "admin_password_hash";
export const SETUP_COMPLETED_KEY = "setup_completed_at";

export async function getSetting(key: string): Promise<string | null> {
  const [row] = await getDb().select().from(settings).where(eq(settings.key, key));
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await getDb()
    .insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date() } });
}

export function getAdminPasswordHash(): Promise<string | null> {
  return getSetting(ADMIN_PASSWORD_HASH_KEY);
}

export function setAdminPasswordHash(hash: string): Promise<void> {
  return setSetting(ADMIN_PASSWORD_HASH_KEY, hash);
}
