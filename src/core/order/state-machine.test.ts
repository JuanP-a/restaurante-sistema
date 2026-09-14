import { describe, it, expect } from "vitest";
import { canTransition, nextState, type OrderStatus } from "./state-machine";

describe("order state machine", () => {
  it("allows received to delivered", () => {
    expect(canTransition("received", "delivered")).toBe(true);
  });
  it("allows received to cancelled", () => {
    expect(canTransition("received", "cancelled")).toBe(true);
  });
  it("does not allow delivered to received", () => {
    expect(canTransition("delivered", "received")).toBe(false);
  });
  it("does not allow delivered to cancelled", () => {
    expect(canTransition("delivered", "cancelled")).toBe(false);
  });
  it("does not allow cancelled transitions", () => {
    expect(canTransition("cancelled", "received")).toBe(false);
    expect(canTransition("cancelled", "delivered")).toBe(false);
  });
  it("nextState returns ok on valid transition", () => {
    const r = nextState("received", "delivered");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe("delivered");
  });
  it("nextState returns err on invalid transition", () => {
    const r = nextState("delivered", "received");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("invalid-transition");
  });
});

export type _Status = OrderStatus;