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
});