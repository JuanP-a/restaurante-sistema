import { describe, it, expect } from "vitest";
import { validateNewOrder } from "./validate";

describe("validateNewOrder", () => {
  it("requires at least one item", () => {
    const r = validateNewOrder({ items: [], customerPhone: "555", serviceType: "local" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("no-items");
  });

  it("requires customerPhone", () => {
    const r = validateNewOrder({ items: [{ quantity: 1 }], customerPhone: "", serviceType: "local" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("missing-phone");
  });

  it("rejects whitespace-only phone", () => {
    const r = validateNewOrder({ items: [{ quantity: 1 }], customerPhone: "   ", serviceType: "local" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("missing-phone");
  });

  it("requires address for delivery", () => {
    const r = validateNewOrder({
      items: [{ quantity: 1 }],
      customerPhone: "555",
      serviceType: "delivery",
      deliveryAddress: "",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("missing-address");
  });

  it("requires colonia OR override for delivery", () => {
    const r = validateNewOrder({
      items: [{ quantity: 1 }],
      customerPhone: "555",
      serviceType: "delivery",
      deliveryAddress: "Calle 1",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("missing-zona");
  });

  it("accepts valid local order", () => {
    const r = validateNewOrder({
      items: [{ quantity: 1 }],
      customerPhone: "555",
      serviceType: "local",
    });
    expect(r.ok).toBe(true);
  });

  it("accepts valid delivery with colonia", () => {
    const r = validateNewOrder({
      items: [{ quantity: 1 }],
      customerPhone: "555",
      serviceType: "delivery",
      deliveryAddress: "Calle 1",
      deliveryColoniaId: "col1",
    });
    expect(r.ok).toBe(true);
  });

  it("accepts valid delivery with manual cost override", () => {
    const r = validateNewOrder({
      items: [{ quantity: 1 }],
      customerPhone: "555",
      serviceType: "delivery",
      deliveryAddress: "Calle 1",
      deliveryCostOverride: "50.00",
    });
    expect(r.ok).toBe(true);
  });

  it("rejects quantity 0", () => {
    const r = validateNewOrder({
      items: [{ quantity: 0 }],
      customerPhone: "555",
      serviceType: "local",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("invalid-quantity");
  });

  it("rejects negative quantity", () => {
    const r = validateNewOrder({
      items: [{ quantity: -3 }],
      customerPhone: "555",
      serviceType: "local",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("invalid-quantity");
  });

  it("rejects non-integer quantity", () => {
    const r = validateNewOrder({
      items: [{ quantity: 1.5 }],
      customerPhone: "555",
      serviceType: "local",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("invalid-quantity");
  });

  it("rejects cuando algún item del array es inválido", () => {
    const r = validateNewOrder({
      items: [{ quantity: 1 }, { quantity: -1 }],
      customerPhone: "555",
      serviceType: "local",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("invalid-quantity");
  });
});