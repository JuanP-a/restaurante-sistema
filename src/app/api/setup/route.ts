import { NextResponse } from "next/server";
import { getEnv } from "@/env";
import { validatePassword } from "@/core/settings/setup";
import { hashPassword } from "@/infra/auth/password";
import { createSessionToken, SESSION_COOKIE } from "@/infra/auth/session";
import { getDb } from "@/infra/db/client";
import { adminSessions } from "@/infra/db/schema";
import {
  SETUP_COMPLETED_KEY,
  getAdminPasswordHash,
  setAdminPasswordHash,
  setSetting,
} from "@/infra/db/settings-repository";

export async function POST(req: Request) {
  if (await getAdminPasswordHash()) {
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

  // Dejar la sesión abierta: acá el operador está parado frente al local
  // recién instalado, no hay nada que ganar mandándolo a /login.
  const env = getEnv();
  const token = createSessionToken(env.SESSION_SECRET);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await getDb().insert(adminSessions).values({ token, expiresAt });

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
