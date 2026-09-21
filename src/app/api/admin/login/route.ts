import { NextRequest, NextResponse } from "next/server";
import { getEnv } from "@/env";
import { verifyPassword } from "@/infra/auth/password";
import { createSessionToken, SESSION_COOKIE } from "@/infra/auth/session";
import { getDb } from "@/infra/db/client";
import { adminSessions } from "@/infra/db/schema";
import { createRateLimiter } from "@/infra/security/rate-limit";

const loginLimiter = createRateLimiter({
  maxRequests: 5,
  windowMs: 5 * 60 * 1000,
});

export async function POST(req: NextRequest) {
  const env = getEnv();
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";
  if (!loginLimiter.check(ip)) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "rate_limited",
          message: "Demasiados intentos. Espera unos minutos.",
        },
      },
      { status: 429 },
    );
  }

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
  loginLimiter.reset(ip);
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
