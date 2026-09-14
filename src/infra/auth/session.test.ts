import { describe, it, expect } from "vitest";
import { createSessionToken, verifyToken, SESSION_COOKIE, parseSessionCookie } from "./session";

describe("session", () => {
  it("creates a verifiable token", () => {
    const t = createSessionToken("secret");
    expect(verifyToken(t, "secret")).toBe(true);
  });
  it("rejects wrong secret", () => {
    const t = createSessionToken("secret");
    expect(verifyToken(t, "wrong")).toBe(false);
  });
  it("rejects tampered token", () => {
    const t = createSessionToken("secret");
    const tampered = t.slice(0, -1) + "X";
    expect(verifyToken(tampered, "secret")).toBe(false);
  });
  it("rejects malformed token", () => {
    expect(verifyToken("not-a-token", "secret")).toBe(false);
  });
  it("rejects token with only two parts", () => {
    expect(verifyToken("abc.def", "secret")).toBe(false);
  });
  it("SESSION_COOKIE is exported", () => {
    expect(typeof SESSION_COOKIE).toBe("string");
    expect(SESSION_COOKIE.length).toBeGreaterThan(0);
  });
  it("parseSessionCookie extracts a valid token from the cookie header", () => {
    const t = createSessionToken("secret");
    const cookie = `${SESSION_COOKIE}=${t}; foo=bar`;
    expect(parseSessionCookie(cookie, "secret")).toBe(t);
  });
  it("parseSessionCookie throws when the cookie is missing", () => {
    expect(() => parseSessionCookie("foo=bar", "secret")).toThrow();
  });
  it("parseSessionCookie throws when the token is invalid", () => {
    const cookie = `${SESSION_COOKIE}=garbage`;
    expect(() => parseSessionCookie(cookie, "secret")).toThrow();
  });
});