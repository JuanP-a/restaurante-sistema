import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { getEnv } from "@/env";
import { verifyWebhookSignature } from "@/infra/whatsapp/webhook-verify";
import {
  applyEvent,
  getSession,
  resetSession,
  withPhoneLock,
} from "@/infra/whatsapp/session-store";
import { sendButtons, sendList, sendText } from "@/infra/whatsapp/client";
import { type BotEvent, type BotState } from "@/core/bot/state-machine";
import {
  type BotContext,
  buildBotReply,
} from "@/core/bot/build-reply";
import { calculateOrderTotals } from "@/core/pricing/calculate-order";
import { colonias, deliveryZones, orderEvents } from "@/infra/db/schema";
import {
  getProduct,
  listAllProducts,
  listCategories,
} from "@/infra/db/menu-repository";
import { listColoniasWithZone } from "@/infra/db/delivery-repository";
import { createOrder } from "@/infra/db/order-repository";
import { emitEvent } from "@/infra/events/event-bus";
import { getDb } from "@/infra/db/client";

export async function POST(req: NextRequest): Promise<Response> {
  const env = getEnv();
  const raw = await req.text();
  const sig =
    req.headers.get("x-hub-signature-256")?.replace(/^sha256=/, "") ?? "";
  // Verify signature whenever a verify token is configured, regardless of
  // NODE_ENV. Staging typically runs as "development" but is reachable from
  // the public internet and needs the same auth as prod.
  if (
    env.WHATSAPP_VERIFY_TOKEN &&
    !verifyWebhookSignature(raw, sig, env.WHATSAPP_VERIFY_TOKEN)
  ) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: true });
  }

  const msg = (
    body as {
      entry?: Array<{
        changes?: Array<{
          value?: { messages?: Array<Record<string, unknown>> };
        }>;
      }>;
    }
  )?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  if (!msg) return NextResponse.json({ ok: true });

  const phone = String(msg.from ?? "");
  if (!phone) return NextResponse.json({ ok: true });

  const type = msg.type as string;
  let raw_input = "";
  if (type === "text") {
    raw_input = String(((msg.text as { body?: string }).body) ?? "");
  } else if (type === "interactive") {
    const interactive = msg.interactive as {
      type?: string;
      list_reply?: { id?: string };
      button_reply?: { id?: string };
    };
    if (interactive.type === "list_reply") {
      raw_input = interactive.list_reply?.id ?? "";
    } else if (interactive.type === "button_reply") {
      raw_input = interactive.button_reply?.id ?? "";
    }
  } else {
    raw_input = String((msg[type] as { body?: string })?.body ?? "");
  }

  await withPhoneLock(phone, () => processMessage(phone, raw_input));
  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest): Promise<Response> {
  const env = getEnv();
  const mode = req.nextUrl.searchParams.get("hub.mode");
  const token = req.nextUrl.searchParams.get("hub.verify_token");
  const challenge = req.nextUrl.searchParams.get("hub.challenge");
  if (mode === "subscribe" && token && token === env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(challenge ?? "", { status: 200 });
  }
  return new Response("forbidden", { status: 403 });
}

async function processMessage(phone: string, raw_input: string): Promise<void> {
  const state = getSession(phone);
  const event = toBotEvent(state, raw_input);
  if (!event) return;

  const next = applyEvent(phone, event);

  const ctx: BotContext = { state: next };

  if (next.state === "idle" || next.state === "browsing_category") {
    const cats = await listCategories(true);
    ctx.categories = cats.map((c) => ({ id: c.id, name: c.name }));
  } else if (next.state === "browsing_product" && next.payload.categoryId) {
    const products = await listAllProducts(true);
    ctx.products = products
      .filter((p) => p.categoryId === next.payload.categoryId)
      .map((p) => ({ id: p.id, name: p.name, basePrice: p.basePrice }));
  } else if (next.state === "awaiting_colonia") {
    const cs = await listColoniasWithZone();
    ctx.colonias = cs.map((c) => ({
      id: c.id,
      name: c.name,
      zoneName: c.zoneName,
      zoneCost: c.zoneCost,
    }));
  }

  if (event.type === "confirm_order" && next.payload.cart) {
    const order = await createOrderFromBot(phone, next);
    if (order) {
      ctx.orderSummary = {
        sequentialNumber: order.sequentialNumber,
        total: order.total,
      };
      await sendText(
        phone,
        `Pedido #${order.sequentialNumber} recibido. Tiempo estimado: 25 min.`,
      );
      const db = getDb();
      await db
        .insert(orderEvents)
        .values({ orderId: order.id, kind: "notified", payload: { to: phone } });
      emitEvent("order_created", order);
      resetSession(phone);
      const reply = buildBotReply(ctx);
      for (const action of reply.actions) {
        if (action.kind === "sendText") await sendText(phone, action.text);
      }
      return;
    }
  }

  const reply = buildBotReply(ctx);
  for (const action of reply.actions) {
    if (action.kind === "sendText") await sendText(phone, action.text);
    else if (action.kind === "sendList") await sendList(phone, action.body);
    else if (action.kind === "sendButtons")
      await sendButtons(phone, action.body);
  }
}

function toBotEvent(state: BotState, raw: string): BotEvent | null {
  if (!raw) return null;
  if (raw.startsWith("cat:")) {
    return { type: "category_picked", categoryId: raw.slice(4) };
  }
  if (raw.startsWith("prod:")) {
    return {
      type: "product_picked",
      product: { id: raw.slice(5), name: "x", basePrice: "0" },
      quantity: 1,
    };
  }
  if (raw.startsWith("col:")) {
    return { type: "colonia_picked", coloniaId: raw.slice(4) };
  }
  if (raw === "svc:local") return { type: "service_picked", serviceType: "local" };
  if (raw === "svc:delivery") return { type: "service_picked", serviceType: "delivery" };
  if (raw === "add:ok") return { type: "confirm_item", removed: [], extras: [] };
  if (raw === "cart:add_more") return { type: "add_more" };
  if (raw === "cart:finalize") return { type: "finalize" };
  if (raw === "ok:confirm") return { type: "confirm_order" };
  if (state.state === "awaiting_address") {
    return { type: "address_typed", address: raw };
  }
  return { type: "message", text: raw };
}

async function createOrderFromBot(
  phone: string,
  state: BotState,
): Promise<Awaited<ReturnType<typeof createOrder>> | null> {
  const cart = state.payload.cart ?? [];
  if (cart.length === 0) return null;
  const items: Array<{
    productId: string;
    productNameSnapshot: string;
    basePriceSnapshot: string;
    unitPrice: string;
    quantity: number;
    removedIngredients: string[];
    extraIngredients: { name: string; price: string }[];
    itemTotal: string;
  }> = [];
  for (const c of cart) {
    const product = await getProduct(c.productId);
    if (!product) return null;
    const extrasTotal = c.extras.reduce(
      (sum, e) => sum + Number(e.price),
      0,
    );
    const unitPrice = (Number(product.basePrice) + extrasTotal).toFixed(2);
    const itemTotal = (Number(unitPrice) * c.quantity).toFixed(2);
    items.push({
      productId: c.productId,
      productNameSnapshot: product.name,
      basePriceSnapshot: product.basePrice,
      unitPrice,
      quantity: c.quantity,
      removedIngredients: c.removed,
      extraIngredients: c.extras,
      itemTotal,
    });
  }

  let deliveryCost = "0";
  let deliveryColoniaId: string | undefined;
  if (state.payload.serviceType === "delivery" && state.payload.coloniaId) {
    deliveryColoniaId = state.payload.coloniaId;
    const db = getDb();
    const [row] = await db
      .select({ cost: deliveryZones.cost })
      .from(colonias)
      .innerJoin(deliveryZones, eq(colonias.zoneId, deliveryZones.id))
      .where(eq(colonias.id, state.payload.coloniaId));
    if (row) deliveryCost = row.cost;
  }

  const totals = calculateOrderTotals({
    items: items.map((i) => ({
      basePrice: i.unitPrice,
      quantity: i.quantity,
      extras: [],
    })),
    deliveryCost,
  });

  return createOrder({
    serviceType: state.payload.serviceType ?? "local",
    customerPhone: phone,
    customerName: "",
    deliveryAddress: state.payload.address,
    deliveryColoniaId,
    deliveryCost,
    subtotal: totals.subtotal,
    total: totals.total,
    source: "whatsapp",
    notes: "",
    items,
  });
}
