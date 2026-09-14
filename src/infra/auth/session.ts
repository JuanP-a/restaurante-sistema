import crypto from "node:crypto";

export const SESSION_COOKIE = "admin_session";
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function createSessionToken(secret: string): string {
  const expires = Date.now() + TOKEN_TTL_MS;
  const random = crypto.randomBytes(24).toString("base64url");
  const payload = `${random}.${expires}`;
  const sig = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyToken(token: string, secret: string): boolean {
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [random, expiresStr, sig] = parts;
  if (!random || !expiresStr || !sig) return false;
  if (Number(expiresStr) < Date.now()) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${random}.${expiresStr}`).digest("base64url");
  try {
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}

export function parseSessionCookie(cookieHeader: string, secret: string): string {
  const match = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${SESSION_COOKIE}=`));
  if (!match) throw new Error("no session cookie");
  const token = match.substring(SESSION_COOKIE.length + 1);
  if (!verifyToken(token, secret)) throw new Error("invalid session");
  return token;
}