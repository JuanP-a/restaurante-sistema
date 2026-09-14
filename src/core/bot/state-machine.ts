export type BotStateName =
  | "idle"
  | "browsing_category"
  | "browsing_product"
  | "customizing_product"
  | "in_cart"
  | "choosing_service_type"
  | "awaiting_colonia"
  | "awaiting_address"
  | "confirming_order";

export type CartItem = {
  productId: string;
  productName: string;
  basePrice: string;
  quantity: number;
  removed: string[];
  extras: { name: string; price: string }[];
};

export type BotPayload = {
  categoryId?: string;
  productDraft?: { id: string; name: string; basePrice: string; quantity: number };
  cart?: CartItem[];
  serviceType?: "local" | "delivery";
  coloniaId?: string;
  address?: string;
  created?: boolean;
};

export type BotState = { state: BotStateName; payload: BotPayload };

export function initialState(): BotState {
  return { state: "idle", payload: {} };
}

export type BotEvent =
  | { type: "message"; text: string }
  | { type: "category_picked"; categoryId: string }
  | { type: "product_picked"; product: { id: string; name: string; basePrice: string }; quantity: number }
  | { type: "confirm_item"; removed: string[]; extras: { name: string; price: string }[] }
  | { type: "add_more" }
  | { type: "finalize" }
  | { type: "service_picked"; serviceType: "local" | "delivery" }
  | { type: "colonia_picked"; coloniaId: string }
  | { type: "address_typed"; address: string }
  | { type: "confirm_order" };

export function applyBotEvent(s: BotState, ev: BotEvent): BotState {
  switch (s.state) {
    case "idle":
      if (ev.type === "message") return { state: "browsing_category", payload: {} };
      return s;
    case "browsing_category":
      if (ev.type === "category_picked") {
        return { state: "browsing_product", payload: { ...s.payload, categoryId: ev.categoryId } };
      }
      return s;
    case "browsing_product":
      if (ev.type === "product_picked") {
        return {
          state: "customizing_product",
          payload: { ...s.payload, productDraft: { ...ev.product, quantity: ev.quantity } },
        };
      }
      return s;
    case "customizing_product": {
      if (ev.type === "confirm_item" && s.payload.productDraft) {
        const draft = s.payload.productDraft;
        const newItem: CartItem = {
          productId: draft.id,
          productName: draft.name,
          basePrice: draft.basePrice,
          quantity: draft.quantity,
          removed: ev.removed,
          extras: ev.extras,
        };
        const cart = [...(s.payload.cart ?? []), newItem];
        return { state: "in_cart", payload: { ...s.payload, cart, productDraft: undefined } };
      }
      return s;
    }
    case "in_cart":
      if (ev.type === "add_more") {
        return { state: "browsing_category", payload: { ...s.payload, productDraft: undefined } };
      }
      if (ev.type === "finalize") return { state: "choosing_service_type", payload: s.payload };
      return s;
    case "choosing_service_type":
      if (ev.type === "service_picked") {
        if (ev.serviceType === "local") {
          return { state: "confirming_order", payload: { ...s.payload, serviceType: "local" } };
        }
        return { state: "awaiting_colonia", payload: { ...s.payload, serviceType: "delivery" } };
      }
      return s;
    case "awaiting_colonia":
      if (ev.type === "colonia_picked") {
        return { state: "awaiting_address", payload: { ...s.payload, coloniaId: ev.coloniaId } };
      }
      return s;
    case "awaiting_address":
      if (ev.type === "address_typed") {
        return { state: "confirming_order", payload: { ...s.payload, address: ev.address } };
      }
      return s;
    case "confirming_order":
      if (ev.type === "confirm_order") {
        return { state: "idle", payload: { ...s.payload, created: true } };
      }
      return s;
  }
}