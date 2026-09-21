import { describe, it, expect } from "vitest";
import crypto from "node:crypto";
import { verifyWebhookSignature } from "./webhook-verify";

describe("verifyWebhookSignature", () => {
  it("acepta signature válido", () => {
    const secret = "shhh";
    const body = '{"test":1}';
    const sig = crypto
      .createHmac("sha256", secret)
      .update(body)
      .digest("hex");
    expect(verifyWebhookSignature(body, sig, secret)).toBe(true);
  });

  it("rechaza signature incorrecto", () => {
    expect(verifyWebhookSignature("{}", "wrong", "shhh")).toBe(false);
  });

  it("rechaza signature vacío", () => {
    expect(verifyWebhookSignature("{}", "", "shhh")).toBe(false);
  });

  it("rechaza signature con body modificado", () => {
    const secret = "k";
    const sig = crypto
      .createHmac("sha256", secret)
      .update("original")
      .digest("hex");
    expect(verifyWebhookSignature("tampered", sig, secret)).toBe(false);
  });
});
