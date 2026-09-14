import { describe, it, expect } from "vitest";
import { calculateOrderTotals } from "./calculate-order";

describe("calculateOrderTotals", () => {
  it("returns zeros for empty cart", () => {
    const r = calculateOrderTotals({ items: [], deliveryCost: "0" });
    expect(r.subtotal).toBe("0.00");
    expect(r.total).toBe("0.00");
  });

  it("sums base price times quantity", () => {
    const r = calculateOrderTotals({
      items: [
        { basePrice: "100.00", quantity: 2, extras: [] },
        { basePrice: "50.00", quantity: 1, extras: [] },
      ],
      deliveryCost: "0",
    });
    expect(r.subtotal).toBe("250.00");
    expect(r.total).toBe("250.00");
  });

  it("adds extras cost per unit", () => {
    const r = calculateOrderTotals({
      items: [
        { basePrice: "100.00", quantity: 2, extras: [{ price: "15.00" }, { price: "10.00" }] },
      ],
      deliveryCost: "0",
    });
    expect(r.subtotal).toBe("250.00");
  });

  it("adds delivery cost to total", () => {
    const r = calculateOrderTotals({
      items: [{ basePrice: "100.00", quantity: 1, extras: [] }],
      deliveryCost: "20.00",
    });
    expect(r.subtotal).toBe("100.00");
    expect(r.total).toBe("120.00");
  });

  it("rounds to 2 decimals", () => {
    const r = calculateOrderTotals({
      items: [{ basePrice: "33.33", quantity: 3, extras: [] }],
      deliveryCost: "0",
    });
    expect(r.subtotal).toBe("99.99");
  });
});