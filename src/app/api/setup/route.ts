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

function isLocalHost(host: string | null): boolean {
  if (!host) return false;
  const hostname = host.replace(/:\d+$/, "").replace(/^\[|\]$/g, "");
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

export async function POST(req: Request) {
  // El wizard siempre corre en la máquina host (la ventana de Electron carga
  // http://127.0.0.1:<puerto>). Con bind a la LAN, sin este guard cualquiera en
  // la red podría reclamar el admin durante la ventana de primer arranque.
  // El header Host no está disponible en un Request construido a mano (es
  // forbidden header), así que caemos al host de la URL.
  if (!isLocalHost(req.headers.get("host") ?? new URL(req.url).host)) {
    return NextResponse.json(
      { ok: false, error: { code: "forbidden_host", message: "El setup solo se puede hacer localmente" } },
      { status: 403 },
    );
  }

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
