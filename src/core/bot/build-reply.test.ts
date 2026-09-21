import { describe, it, expect } from "vitest";
import { buildBotReply } from "./build-reply";
import { initialState, type BotState } from "./state-machine";

describe("buildBotReply", () => {
  it("idle envía list y pasa a browsing_category", () => {
    const r = buildBotReply({
      state: initialState(),
      categories: [{ id: "c1", name: "Hamburguesas" }],
    });
    expect(r.actions.some((a: { kind: string }) => a.kind === "sendList")).toBe(true);
    expect(r.newState.state).toBe("browsing_category");
  });

  it("browsing_product envía list de productos", () => {
    const state: BotState = {
      state: "browsing_product",
      payload: { categoryId: "c1" },
    };
    const r = buildBotReply({
      state,
      products: [{ id: "p1", name: "Sencilla", basePrice: "50" }],
    });
    expect(r.actions[0]?.kind).toBe("sendList");
  });

  it("customizing_product envía botones", () => {
    const state: BotState = {
      state: "customizing_product",
      payload: {
        productDraft: {
          id: "p1",
          name: "X",
          basePrice: "50",
          quantity: 1,
        },
      },
    };
    const r = buildBotReply({ state });
    expect(r.actions[0]?.kind).toBe("sendButtons");
  });

  it("in_cart envía botones add_more/finalize", () => {
    const state: BotState = {
      state: "in_cart",
      payload: {
        cart: [
          {
            productId: "p1",
            productName: "X",
            basePrice: "10",
            quantity: 1,
            removed: [],
            extras: [],
          },
        ],
      },
    };
    const r = buildBotReply({ state });
    expect(r.actions[0]?.kind).toBe("sendButtons");
    if (r.actions[0]?.kind === "sendButtons") {
      const ids = r.actions[0].body.buttons.map((b: { id: string }) => b.id);
      expect(ids).toContain("cart:add_more");
      expect(ids).toContain("cart:finalize");
    }
  });

  it("choosing_service_type envía botones local/delivery", () => {
    const state: BotState = {
      state: "choosing_service_type",
      payload: { cart: [] },
    };
    const r = buildBotReply({ state });
    expect(r.actions[0]?.kind).toBe("sendButtons");
    if (r.actions[0]?.kind === "sendButtons") {
      const ids = r.actions[0].body.buttons.map((b: { id: string }) => b.id);
      expect(ids).toContain("svc:local");
      expect(ids).toContain("svc:delivery");
    }
  });

  it("awaiting_colonia envía list de colonias", () => {
    const state: BotState = {
      state: "awaiting_colonia",
      payload: { serviceType: "delivery" },
    };
    const r = buildBotReply({
      state,
      colonias: [
        { id: "col1", name: "Centro", zoneName: "Centro", zoneCost: "15" },
      ],
    });
    expect(r.actions[0]?.kind).toBe("sendList");
  });

  it("awaiting_address pide texto", () => {
    const state: BotState = {
      state: "awaiting_address",
      payload: { coloniaId: "col1" },
    };
    const r = buildBotReply({ state });
    expect(r.actions[0]?.kind).toBe("sendText");
  });

  it("confirming_order envía resumen + botón confirmar", () => {
    const state: BotState = {
      state: "confirming_order",
      payload: {
        cart: [
          {
            productId: "p1",
            productName: "X",
            basePrice: "50",
            quantity: 1,
            removed: [],
            extras: [],
          },
        ],
        serviceType: "local",
      },
    };
    const r = buildBotReply({ state });
    expect(r.actions.some((a: { kind: string }) => a.kind === "sendButtons")).toBe(true);
    expect(r.actions.some((a: { kind: string }) => a.kind === "sendText")).toBe(true);
  });
});
