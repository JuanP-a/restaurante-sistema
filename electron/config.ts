import crypto from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export type AppConfig = { sessionSecret: string; lastPort?: number };

function newSecret(): string {
  return crypto.randomBytes(32).toString("base64url");
}

function parseConfig(raw: string): AppConfig | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof data !== "object" || data === null) return null;
  if (!("sessionSecret" in data) || typeof data.sessionSecret !== "string") return null;
  const secret = data.sessionSecret;
  if (secret.length < 32) return null;
  const lastPort =
    "lastPort" in data && typeof data.lastPort === "number" ? data.lastPort : undefined;
  return lastPort === undefined ? { sessionSecret: secret } : { sessionSecret: secret, lastPort };
}

export async function loadConfig(dir: string): Promise<AppConfig> {
  const path = join(dir, "config.json");
  try {
    const parsed = parseConfig(await readFile(path, "utf8"));
    if (parsed) return parsed;
  } catch {
    // ENOENT o ilegible: se regenera abajo.
  }
  const fresh: AppConfig = { sessionSecret: newSecret() };
  await saveConfig(dir, fresh);
  return fresh;
}

export async function saveConfig(dir: string, config: AppConfig): Promise<void> {
  await writeFile(join(dir, "config.json"), JSON.stringify(config, null, 2), "utf8");
}

export function resolveDefaultBackupDir(documentsDir: string): string {
  return join(documentsDir, "restaurante-backups");
}
