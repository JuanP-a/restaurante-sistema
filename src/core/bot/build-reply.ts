import type { BotState } from "./state-machine";

export type SendTextAction = { kind: "sendText"; text: string };
export type SendListAction = {
  kind: "sendList";
  body: {
    text: string;
    buttonText: string;
    sections: {
      title: string;
      rows: { id: string; title: string; description?: string }[];
    }[];
  };
};
export type SendButtonsAction = {
  kind: "sendButtons";
  body: {
    text: string;
    buttons: { id: string; title: string }[];
  };
};

export type ReplyAction = SendTextAction | SendListAction | SendButtonsAction;

export type BotContext = {
  state: BotState;
  categories?: { id: string; name: string }[];
  products?: { id: string; name: string; basePrice: string }[];
  colonias?: { id: string; name: string; zoneName: string; zoneCost: string }[];
  orderSummary?: { sequentialNumber: number; total: string };
};

export type BotReply = { actions: ReplyAction[]; newState: BotState };

export function buildBotReply(ctx: BotContext): BotReply {
  const { state } = ctx;
  switch (state.state) {
    case "idle":
    case "browsing_category": {
      const sections = [
        {
          title: "Menú",
          rows: (ctx.categories ?? []).map((c) => ({
            id: `cat:${c.id}`,
            title: c.name,
          })),
        },
      ];
      return {
        actions: [
          {
            kind: "sendList",
            body: {
              text: "¿Qué te gustaría ordenar hoy?",
              buttonText: "Ver menú",
              sections,
            },
          },
        ],
        newState: { state: "browsing_category", payload: {} },
      };
    }
    case "browsing_product": {
      const sections = [
        {
          title: "Productos",
          rows: (ctx.products ?? []).map((p) => ({
            id: `prod:${p.id}`,
            title: `${p.name} - $${p.basePrice}`,
            description: p.name,
          })),
        },
      ];
      return {
        actions: [
          {
            kind: "sendList",
            body: {
              text: "Elige un producto",
              buttonText: "Elegir",
              sections,
            },
          },
        ],
        newState: state,
      };
    }
    case "customizing_product": {
      return {
        actions: [
          {
            kind: "sendButtons",
            body: {
              text: "¿Cómo lo preparamos?",
              buttons: [{ id: "add:ok", title: "Agregar al carrito" }],
            },
          },
        ],
        newState: state,
      };
    }
    case "in_cart": {
      const n = state.payload.cart?.length ?? 0;
      return {
        actions: [
          {
            kind: "sendButtons",
            body: {
              text: `Tienes ${n} producto(s) en tu carrito.`,
              buttons: [
                { id: "cart:add_more", title: "Agregar otro" },
                { id: "cart:finalize", title: "Finalizar" },
              ],
            },
          },
        ],
        newState: state,
      };
    }
    case "choosing_service_type": {
      return {
        actions: [
          {
            kind: "sendButtons",
            body: {
              text: "¿Cómo lo recibes?",
              buttons: [
                { id: "svc:local", title: "En local" },
                { id: "svc:delivery", title: "A domicilio" },
              ],
            },
          },
        ],
        newState: state,
      };
    }
    case "awaiting_colonia": {
      const sections = [
        {
          title: "Colonias",
          rows: (ctx.colonias ?? []).map((c) => ({
            id: `col:${c.id}`,
            title: c.name,
            description: `${c.zoneName} · envío $${c.zoneCost}`,
          })),
        },
      ];
      return {
        actions: [
          {
            kind: "sendList",
            body: {
              text: "¿En qué colonia?",
              buttonText: "Elegir colonia",
              sections,
            },
          },
        ],
        newState: state,
      };
    }
    case "awaiting_address": {
      return {
        actions: [
          {
            kind: "sendText",
            text: "Escribe tu dirección completa (calle, número, referencias).",
          },
        ],
        newState: state,
      };
    }
    case "confirming_order": {
      const cart = state.payload.cart ?? [];
      const lines = cart.map((i) => `• ${i.quantity} ${i.productName}`).join("\n");
      const total = ctx.orderSummary?.total ?? "—";
      return {
        actions: [
          {
            kind: "sendText",
            text: `Resumen de tu pedido:\n${lines}\n\nTotal: $${total}`,
          },
          {
            kind: "sendButtons",
            body: {
              text: "¿Confirmas?",
              buttons: [{ id: "ok:confirm", title: "Sí, confirmar" }],
            },
          },
        ],
        newState: state,
      };
    }
  }
}
