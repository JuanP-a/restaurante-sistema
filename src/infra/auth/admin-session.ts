import { createSessionToken } from "@/infra/auth/session";
import { getDb } from "@/infra/db/client";
import { adminSessions } from "@/infra/db/schema";

const TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function startAdminSession(secret: string): Promise<{ token: string; expiresAt: Date }> {
  const token = createSessionToken(secret);
  const expiresAt = new Date(Date.now() + TTL_MS);
  await getDb().insert(adminSessions).values({ token, expiresAt });
  return { token, expiresAt };
}
