import { describe, it, expect } from "vitest";
import { validateDeliveryCost, DELIVERY_COST_MIN, DELIVERY_COST_MAX } from "./validate-cost";

describe("validateDeliveryCost", () => {
  it("rejects below 10", () => {
    const r = validateDeliveryCost("9.99");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("below-min");
  });

  it("rejects above 30", () => {
    const r = validateDeliveryCost("30.01");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("above-max");
  });

  it("accepts the lower bound", () => {
    expect(validateDeliveryCost("10").ok).toBe(true);
  });

  it("accepts the upper bound", () => {
    expect(validateDeliveryCost("30").ok).toBe(true);
  });

  it("rejects non-numeric", () => {
    const r = validateDeliveryCost("abc");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("invalid-number");
  });

  it("rejects empty string", () => {
    const r = validateDeliveryCost("");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("invalid-number");
  });

  it("exports the configured min and max for UI hints", () => {
    expect(DELIVERY_COST_MIN).toBe(10);
    expect(DELIVERY_COST_MAX).toBe(30);
  });
});