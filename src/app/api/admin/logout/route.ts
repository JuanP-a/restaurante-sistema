import { NextRequest, NextResponse } from "next/server";
import { eq, lt } from "drizzle-orm";
import { getDb } from "@/infra/db/client";
import { adminSessions } from "@/infra/db/schema";
import { SESSION_COOKIE, parseSessionCookie } from "@/infra/auth/session";
import { getEnv } from "@/env";

export async function POST(req: NextRequest): Promise<Response> {
  const env = getEnv();
  const db = getDb();
  const cookieHeader = req.headers.get("cookie") ?? "";
  let token: string | null = null;
  if (cookieHeader) {
    try {
      token = parseSessionCookie(cookieHeader, env.SESSION_SECRET);
    } catch {
      // Invalid or missing cookie — proceed to prune + clear cookie anyway.
    }
  }

  // Opportunistic prune of expired sessions. Cheap (indexed on expires_at).
  // Combined with the DELETE on the caller's token, this keeps the table
  // bounded over time without needing a separate cron.
  await db.delete(adminSessions).where(lt(adminSessions.expiresAt, new Date()));
  if (token) {
    await db.delete(adminSessions).where(eq(adminSessions.token, token));
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}
