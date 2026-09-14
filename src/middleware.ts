import { NextRequest, NextResponse } from "next/server";
import { getEnv } from "@/env";
import { parseSessionCookie } from "@/infra/auth/session";

const PROTECTED_PREFIXES = [
  "/admin",
  "/api/admin",
  "/api/orders",
  "/api/menu",
  "/api/delivery-zones",
  "/api/events",
];
const PUBLIC_PATHS = ["/login", "/api/admin/login", "/api/webhooks/whatsapp"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }
  const isProtected = PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
  if (!isProtected) return NextResponse.next();
  const env = getEnv();
  const cookie = req.headers.get("cookie") ?? "";
  try {
    parseSessionCookie(cookie, env.SESSION_SECRET);
    return NextResponse.next();
  } catch {
    if (pathname.startsWith("/api")) {
      return NextResponse.json(
        { ok: false, error: { code: "unauthorized", message: "No autenticado" } },
        { status: 401 },
      );
    }
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/api/admin/:path*",
    "/api/orders/:path*",
    "/api/menu/:path*",
    "/api/delivery-zones/:path*",
    "/api/events",
  ],
  runtime: "nodejs",
};