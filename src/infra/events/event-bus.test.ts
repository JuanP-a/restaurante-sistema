import { describe, expect, test, vi } from "vitest";
import { emitEvent, subscribe } from "@/infra/events/event-bus";

describe("event bus", () => {
  test("delivers event data to subscriber", () => {
    const received: unknown[] = [];
    subscribe("ping", (data) => received.push(data));

    emitEvent("ping", { value: 42 });

    expect(received).toEqual([{ value: 42 }]);
  });

  test("supports multiple subscribers on same kind", () => {
    const a: unknown[] = [];
    const b: unknown[] = [];
    subscribe("ping", (d) => a.push(d));
    subscribe("ping", (d) => b.push(d));

    emitEvent("ping", "x");

    expect(a).toEqual(["x"]);
    expect(b).toEqual(["x"]);
  });

  test("unsubscribe stops further deliveries", () => {
    const spy = vi.fn();
    const unsub = subscribe("ping", spy);

    emitEvent("ping", 1);
    unsub();
    emitEvent("ping", 2);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(1);
  });

  test("does not leak listeners across kinds", () => {
    const aSpy = vi.fn();
    const bSpy = vi.fn();
    subscribe("alpha", aSpy);
    subscribe("beta", bSpy);

    emitEvent("alpha", 1);

    expect(aSpy).toHaveBeenCalledWith(1);
    expect(bSpy).not.toHaveBeenCalled();
  });
});
