import { NextRequest, NextResponse } from "next/server";
import { getEnv } from "@/env";
import { startAdminSession } from "@/infra/auth/admin-session";
import { verifyPassword } from "@/infra/auth/password";
import { SESSION_COOKIE } from "@/infra/auth/session";
import { getAdminPasswordHash } from "@/infra/db/settings-repository";
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
  // En desktop el hash lo setea el wizard en `settings`; en cloud viene de
  // env. Si ambos existen, settings gana. Sin ninguno, falta el setup.
  const hash = (await getAdminPasswordHash()) ?? env.ADMIN_PASSWORD_HASH;
  if (!hash) {
    return NextResponse.json(
      { ok: false, error: { code: "setup_required", message: "Falta configurar la contraseña" } },
      { status: 409 },
    );
  }
  const ok = await verifyPassword(password, hash);
  if (!ok) {
    return NextResponse.json(
      { ok: false, error: { code: "unauthorized", message: "Contraseña incorrecta" } },
      { status: 401 },
    );
  }
  loginLimiter.reset(ip);
  const { token, expiresAt } = await startAdminSession(env.SESSION_SECRET);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.SESSION_COOKIE_SECURE,
    expires: expiresAt,
    path: "/",
  });
  return res;
}
