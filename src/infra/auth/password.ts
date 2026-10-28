import bcrypt from "bcryptjs";

// Cost 10: mismo que el hash de .env.example y el que espera el regex de
// ADMIN_PASSWORD_HASH en env.ts.
const BCRYPT_COST = 10;

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST);
}