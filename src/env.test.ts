import { describe, it, expect } from "vitest";
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