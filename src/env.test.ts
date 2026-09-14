import { describe, it, expect } from "vitest";
import { parseEnv } from "./env";

describe("parseEnv", () => {
  it("requires DATABASE_URL", () => {
    expect(() => parseEnv({})).toThrow();
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