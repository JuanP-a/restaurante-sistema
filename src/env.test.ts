import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseEnv } from "./env";

describe("parseEnv", () => {
  it("acepta modo pglite sin DATABASE_URL", () => {
    const env = parseEnv({
      DB_DRIVER: "pglite",
      ADMIN_PASSWORD_HASH: "$2a$10$abcdefghijklmnopqrstuv",
      SESSION_SECRET: "a".repeat(32),
    });
    expect(env.DB_DRIVER).toBe("pglite");
    expect(env.DB_PATH).toBe("./.data/pglite");
    expect(env.DATABASE_URL).toBeUndefined();
  });

  it("exige DATABASE_URL en modo postgres", () => {
    expect(() =>
      parseEnv({
        DB_DRIVER: "postgres",
        ADMIN_PASSWORD_HASH: "$2a$10$abcdefghijklmnopqrstuv",
        SESSION_SECRET: "a".repeat(32),
      }),
    ).toThrow();
  });

  it("modo postgres por defecto con DATABASE_URL válida", () => {
    const env = parseEnv({
      DATABASE_URL: "postgres://x",
      ADMIN_PASSWORD_HASH: "$2a$10$abcdefghijklmnopqrstuv",
      SESSION_SECRET: "a".repeat(32),
    });
    expect(env.DB_DRIVER).toBe("postgres");
  });

  it("rejects non-bcrypt hash", () => {
    expect(() =>
      parseEnv({ DATABASE_URL: "postgres://x", ADMIN_PASSWORD_HASH: "nope", SESSION_SECRET: "a".repeat(32) })
    ).toThrow();
  });

  it("parses valid env with defaults", () => {
    const env = parseEnv({
      DATABASE_URL: "postgres://x",
      ADMIN_PASSWORD_HASH: "$2a$10$abcdefghijklmnopqrstuv",
      SESSION_SECRET: "a".repeat(32),
    });
    expect(env.DATABASE_URL).toBe("postgres://x");
    expect(env.DEFAULT_PREP_TIME_MINUTES).toBe(25);
  });

  it("accepts a full-length real bcrypt hash", () => {
    const realHash = "$2b$10$YoEEXhwQhn5gKntCyJDQZ.aNl60oRDzKiRtoLGM6JUkuPXKrUCSSG";
    const env = parseEnv({
      DATABASE_URL: "postgres://x",
      ADMIN_PASSWORD_HASH: realHash,
      SESSION_SECRET: "a".repeat(32),
    });
    expect(env.ADMIN_PASSWORD_HASH).toBe(realHash);
  });

  it("accepts WHATSAPP_BSP_API_KEY as empty string in dev", () => {
    const env = parseEnv({
      DATABASE_URL: "postgres://x",
      ADMIN_PASSWORD_HASH: "$2a$10$abcdefghijklmnopqrstuv",
      SESSION_SECRET: "a".repeat(32),
      WHATSAPP_BSP_API_KEY: "",
      WHATSAPP_VERIFY_TOKEN: "",
    });
    expect(env.WHATSAPP_BSP_API_KEY).toBe("");
  });
});

describe("env de backup", () => {
  const base = {
    DATABASE_URL: "postgres://x",
    ADMIN_PASSWORD_HASH: "$2a$10$abcdefghijklmnopqrstuv",
    SESSION_SECRET: "a".repeat(32),
  };

  it("usa defaults de backup", () => {
    const env = parseEnv(base);
    expect(env.BACKUP_DIR).toBe("./.data/backups");
    expect(env.BACKUP_KEEP).toBe(7);
  });

  it("rechaza BACKUP_KEEP menor a 1", () => {
    expect(() => parseEnv({ ...base, BACKUP_KEEP: "0" })).toThrow();
  });
});

describe("env de Fase 4 (desktop)", () => {
  const base = {
    DATABASE_URL: "postgres://x",
    SESSION_SECRET: "a".repeat(32),
  };

  it("ADMIN_PASSWORD_HASH es opcional", () => {
    const env = parseEnv(base);
    expect(env.ADMIN_PASSWORD_HASH).toBeUndefined();
  });

  // Un `ADMIN_PASSWORD_HASH=` vacío en el .env.local del local (antes del
  // wizard) no puede tumbar el arranque ni contar como hash configurado.
  it("ADMIN_PASSWORD_HASH vacío cuenta como no configurado", () => {
    const env = parseEnv({ ...base, ADMIN_PASSWORD_HASH: "" });
    expect(env.ADMIN_PASSWORD_HASH).toBeUndefined();
  });

  it("SESSION_COOKIE_SECURE default true y parsea 'false'", () => {
    expect(parseEnv(base).SESSION_COOKIE_SECURE).toBe(true);
    expect(parseEnv({ ...base, SESSION_COOKIE_SECURE: "false" }).SESSION_COOKIE_SECURE).toBe(false);
  });

  it("DESKTOP_LAN_URL es opcional", () => {
    expect(parseEnv(base).DESKTOP_LAN_URL).toBeUndefined();
    expect(parseEnv({ ...base, DESKTOP_LAN_URL: "http://192.168.1.5:3210" }).DESKTOP_LAN_URL).toBe(
      "http://192.168.1.5:3210",
    );
  });
});

describe("login usa SESSION_COOKIE_SECURE (no NODE_ENV)", () => {
  it("el route no deriva secure de NODE_ENV", () => {
    const src = readFileSync("src/app/api/admin/login/route.ts", "utf8");
    expect(src).toContain("secure: env.SESSION_COOKIE_SECURE");
    expect(src).not.toContain('NODE_ENV === "production"');
  });
});

describe("páginas que leen infraestructura son force-dynamic", () => {
  it("/admin/backup declara force-dynamic", () => {
    const src = readFileSync("src/app/admin/backup/page.tsx", "utf8");
    expect(src).toContain('export const dynamic = "force-dynamic"');
  });
});