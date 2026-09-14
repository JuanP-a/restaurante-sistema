import { describe, it, expect } from "vitest";
import { applyBotEvent, initialState, type BotState, type BotEvent } from "./state-machine";

const PRODUCT = { id: "p1", name: "Taco", basePrice: "10" } as const;

const pathToConfirming = () => {
  let s: BotState = applyBotEvent(initialState(), { type: "message", text: "hola" });
  s = applyBotEvent(s, { type: "category_picked", categoryId: "c1" });
  s = applyBotEvent(s, { type: "product_picked", product: PRODUCT, quantity: 1 });
  s = applyBotEvent(s, { type: "confirm_item", removed: [], extras: [] });
  return s;
};

describe("bot state machine", () => {
  it("starts in idle", () => {
    expect(initialState().state).toBe("idle");
  });

  it("idle + message -> browsing_category", () => {
    const s = applyBotEvent(initialState(), { type: "message", text: "hola" });
    expect(s.state).toBe("browsing_category");
  });

  it("browsing_category + category_picked -> browsing_product with categoryId", () => {
    const s = applyBotEvent(
      applyBotEvent(initialState(), { type: "message", text: "hola" }),
      { type: "category_picked", categoryId: "cat-1" },
    );
    expect(s.state).toBe("browsing_product");
    expect(s.payload.categoryId).toBe("cat-1");
  });

  it("browsing_product + product_picked -> customizing_product", () => {
    const s = applyBotEvent(
      applyBotEvent(
        applyBotEvent(initialState(), { type: "message", text: "hola" }),
        { type: "category_picked", categoryId: "c1" },
      ),
      { type: "product_picked", product: PRODUCT, quantity: 2 },
    );
    expect(s.state).toBe("customizing_product");
    expect(s.payload.productDraft?.quantity).toBe(2);
  });

  it("customizing_product + confirm_item -> in_cart with one item", () => {
    const s = applyBotEvent(pathToConfirming(), { type: "confirm_item", removed: [], extras: [] });
    expect(s.state).toBe("in_cart");
    expect(s.payload.cart?.length).toBe(1);
  });

  it("in_cart accumulates items across multiple product picks", () => {
    let s = applyBotEvent(pathToConfirming(), { type: "confirm_item", removed: [], extras: [] });
    s = applyBotEvent(s, { type: "add_more" });
    s = applyBotEvent(s, { type: "category_picked", categoryId: "c2" });
    s = applyBotEvent(s, { type: "product_picked", product: { id: "p2", name: "Burrito", basePrice: "20" }, quantity: 1 });
    s = applyBotEvent(s, { type: "confirm_item", removed: [], extras: [] });
    expect(s.state).toBe("in_cart");
    expect(s.payload.cart?.length).toBe(2);
  });

  it("in_cart + add_more -> browsing_category", () => {
    let s = pathToConfirming();
    s = applyBotEvent(s, { type: "confirm_item", removed: [], extras: [] });
    s = applyBotEvent(s, { type: "add_more" });
    expect(s.state).toBe("browsing_category");
  });

  it("in_cart + finalize -> choosing_service_type", () => {
    let s = pathToConfirming();
    s = applyBotEvent(s, { type: "confirm_item", removed: [], extras: [] });
    s = applyBotEvent(s, { type: "finalize" });
    expect(s.state).toBe("choosing_service_type");
  });

  it("choosing + local -> confirming_order", () => {
    let s = pathToConfirming();
    s = applyBotEvent(s, { type: "confirm_item", removed: [], extras: [] });
    s = applyBotEvent(s, { type: "finalize" });
    s = applyBotEvent(s, { type: "service_picked", serviceType: "local" });
    expect(s.state).toBe("confirming_order");
    expect(s.payload.serviceType).toBe("local");
  });

  it("choosing + delivery -> awaiting_colonia", () => {
    let s = pathToConfirming();
    s = applyBotEvent(s, { type: "confirm_item", removed: [], extras: [] });
    s = applyBotEvent(s, { type: "finalize" });
    s = applyBotEvent(s, { type: "service_picked", serviceType: "delivery" });
    expect(s.state).toBe("awaiting_colonia");
  });

  it("awaiting_colonia + colonia_picked -> awaiting_address", () => {
    let s = pathToConfirming();
    s = applyBotEvent(s, { type: "confirm_item", removed: [], extras: [] });
    s = applyBotEvent(s, { type: "finalize" });
    s = applyBotEvent(s, { type: "service_picked", serviceType: "delivery" });
    s = applyBotEvent(s, { type: "colonia_picked", coloniaId: "col-1" });
    expect(s.state).toBe("awaiting_address");
    expect(s.payload.coloniaId).toBe("col-1");
  });

  it("awaiting_address + address_typed -> confirming_order", () => {
    let s = pathToConfirming();
    s = applyBotEvent(s, { type: "confirm_item", removed: [], extras: [] });
    s = applyBotEvent(s, { type: "finalize" });
    s = applyBotEvent(s, { type: "service_picked", serviceType: "delivery" });
    s = applyBotEvent(s, { type: "colonia_picked", coloniaId: "col-1" });
    s = applyBotEvent(s, { type: "address_typed", address: "Calle 123" });
    expect(s.state).toBe("confirming_order");
    expect(s.payload.address).toBe("Calle 123");
  });

  it("confirming_order + confirm_order -> idle with created flag", () => {
    let s = pathToConfirming();
    s = applyBotEvent(s, { type: "confirm_item", removed: [], extras: [] });
    s = applyBotEvent(s, { type: "finalize" });
    s = applyBotEvent(s, { type: "service_picked", serviceType: "local" });
    s = applyBotEvent(s, { type: "confirm_order" });
    expect(s.state).toBe("idle");
    expect(s.payload.created).toBe(true);
  });

  it("ignores events that don't apply to current state", () => {
    const idle = initialState();
    const after = applyBotEvent(idle, { type: "finalize" });
    expect(after.state).toBe("idle");
    expect(after).toBe(idle);
  });
});

export type _S = BotState;
export type _E = BotEvent;