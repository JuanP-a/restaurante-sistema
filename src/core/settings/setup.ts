import { err, ok, type Result } from "@/core/result";

export type SetupError = { kind: "weak_password"; message: string };

const MIN_PASSWORD_LENGTH = 6;

export function requiresSetup(hasSettingsHash: boolean, envHash: string | undefined): boolean {
  return !hasSettingsHash && !envHash;
}

export function validatePassword(password: string): Result<string, SetupError> {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return err({
      kind: "weak_password",
      message: `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`,
    });
  }
  return ok(password);
}
