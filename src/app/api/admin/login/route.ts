import { NextRequest, NextResponse } from "next/server";
import { getEnv } from "@/env";
import { verifyPassword } from "@/infra/auth/password";
import { createSessionToken, SESSION_COOKIE } from "@/infra/auth/session";
import { getDb } from "@/infra/db/client";
import { adminSessions } from "@/infra/db/schema";

export async function POST(req: NextRequest) {
  const env = getEnv();
  const { password } = await req.json();
  if (typeof password !== "string") {
    return NextResponse.json(
      { ok: false, error: { code: "bad_input", message: "Falta contraseña" } },
      { status: 400 },
    );
  }
  const ok = await verifyPassword(password, env.ADMIN_PASSWORD_HASH);
  if (!ok) {
    return NextResponse.json(
      { ok: false, error: { code: "unauthorized", message: "Contraseña incorrecta" } },
      { status: 401 },
    );
  }
  const token = createSessionToken(env.SESSION_SECRET);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const db = getDb();
  await db.insert(adminSessions).values({ token, expiresAt });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    expires: expiresAt,
    path: "/",
  });
  return res;
}