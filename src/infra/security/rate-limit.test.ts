import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createRateLimiter } from "./rate-limit";

describe("createRateLimiter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("permite requests hasta maxRequests, después rechaza", () => {
    const rl = createRateLimiter({ maxRequests: 3, windowMs: 60_000 });
    expect(rl.check("ip-1")).toBe(true);
    expect(rl.check("ip-1")).toBe(true);
    expect(rl.check("ip-1")).toBe(true);
    expect(rl.check("ip-1")).toBe(false);
    expect(rl.check("ip-1")).toBe(false);
  });

  it("resetea bucket cuando pasa la ventana", () => {
    const rl = createRateLimiter({ maxRequests: 2, windowMs: 1000 });
    expect(rl.check("ip-1")).toBe(true);
    expect(rl.check("ip-1")).toBe(true);
    expect(rl.check("ip-1")).toBe(false);
    vi.advanceTimersByTime(1001);
    expect(rl.check("ip-1")).toBe(true);
  });

  it("keys distintas tienen buckets independientes", () => {
    const rl = createRateLimiter({ maxRequests: 1, windowMs: 60_000 });
    expect(rl.check("ip-1")).toBe(true);
    expect(rl.check("ip-2")).toBe(true);
    expect(rl.check("ip-1")).toBe(false);
    expect(rl.check("ip-2")).toBe(false);
  });

  it("reset limpia el bucket de la key", () => {
    const rl = createRateLimiter({ maxRequests: 1, windowMs: 60_000 });
    expect(rl.check("ip-1")).toBe(true);
    expect(rl.check("ip-1")).toBe(false);
    rl.reset("ip-1");
    expect(rl.check("ip-1")).toBe(true);
  });
});
