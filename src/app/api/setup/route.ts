import { NextResponse } from "next/server";
import { getEnv } from "@/env";
import { validatePassword } from "@/core/settings/setup";
import { startAdminSession } from "@/infra/auth/admin-session";
import { hashPassword } from "@/infra/auth/password";
import { SESSION_COOKIE } from "@/infra/auth/session";
import {
  SETUP_COMPLETED_KEY,
  getAdminPasswordHash,
  setAdminPasswordHash,
  setSetting,
} from "@/infra/db/settings-repository";

export async function POST(req: Request) {
  const env = getEnv();
  // No permitir setup si ya hay hash en cualquier fuente. En cloud el hash vive
  // en env y `settings` está vacía: sin este chequeo, el endpoint público
  // permitiría a cualquiera fijar un hash que el login luego prioriza.
  if ((await getAdminPasswordHash()) || env.ADMIN_PASSWORD_HASH) {
    return NextResponse.json(
      { ok: false, error: { code: "already_setup", message: "La contraseña ya está configurada" } },
      { status: 409 },
    );
  }

  const body: unknown = await req.json().catch(() => null);
  const password =
    typeof body === "object" && body !== null && "password" in body && typeof body.password === "string"
      ? body.password
      : null;
  if (password === null) {
    return NextResponse.json(
      { ok: false, error: { code: "bad_input", message: "Falta la contraseña" } },
      { status: 400 },
    );
  }

  const validation = validatePassword(password);
  if (!validation.ok) {
    return NextResponse.json(
      { ok: false, error: { code: "weak_password", message: validation.error.message } },
      { status: 400 },
    );
  }

  await setAdminPasswordHash(await hashPassword(password));
  await setSetting(SETUP_COMPLETED_KEY, new Date().toISOString());
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
