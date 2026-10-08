import { getEnv } from "@/env";
import { renderBillTicket, renderKitchenTicket } from "@/core/printing/render-ticket";
import type { TicketItem } from "@/core/printing/types";
import { getDb } from "@/infra/db/client";
import { orderEvents, type Order, type OrderItem } from "@/infra/db/schema";
import type { PrintError, PrintTransport } from "./transport";

export type PrintKind = "kitchen" | "bill";

export type PrintOutcome =
  | { printed: "server" }
  | { printed: "browser" }
  | { printed: "failed"; error: PrintError };

export type PrintOptions = { attempts: number; backoffMs: number[] };

export const DEFAULT_PRINT_OPTIONS: PrintOptions = { attempts: 3, backoffMs: [250, 500, 1000] };

export type PrintOrderData = { order: Order; items: OrderItem[] };

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function toTicketItem(item: OrderItem): TicketItem {
  return {
    quantity: item.quantity,
    name: item.productNameSnapshot,
    removed: item.removedIngredients,
    extras: item.extraIngredients,
    itemTotal: item.itemTotal,
  };
}

async function logEvent(
  orderId: string,
  kind: "printed_kitchen" | "printed_bill" | "print_failed",
  payload: Record<string, unknown>,
): Promise<void> {
  await getDb().insert(orderEvents).values({ orderId, kind, payload });
}

export async function printOrder(
  data: PrintOrderData,
  kind: PrintKind,
  transport: PrintTransport | null,
  options: PrintOptions = DEFAULT_PRINT_OPTIONS,
): Promise<PrintOutcome> {
  const { order, items } = data;
  const eventKind = kind === "kitchen" ? "printed_kitchen" : "printed_bill";

  if (!transport) {
    await logEvent(order.id, eventKind, { printed: "browser" });
    return { printed: "browser" };
  }

  const env = getEnv();
  const bytes =
    kind === "kitchen"
      ? renderKitchenTicket({
          serviceType: order.serviceType,
          sequentialNumber: order.sequentialNumber,
          createdAt: order.createdAt,
          items: items.map(toTicketItem),
          notes: order.notes,
        })
      : renderBillTicket({
          businessName: env.BUSINESS_NAME,
          businessAddress: env.BUSINESS_ADDRESS,
          businessPhone: env.BUSINESS_PHONE,
          serviceType: order.serviceType,
          sequentialNumber: order.sequentialNumber,
          createdAt: order.createdAt,
          deliveryAddress: order.deliveryAddress ?? undefined,
          items: items.map(toTicketItem),
          subtotal: order.subtotal,
          deliveryCost: order.deliveryCost,
          total: order.total,
        });

  let lastError: PrintError = { kind: "connection", message: "sin intentos" };
  for (let attempt = 0; attempt < options.attempts; attempt += 1) {
    const result = await transport.send(bytes);
    if (result.ok) {
      await logEvent(order.id, eventKind, { printed: "server" });
      return { printed: "server" };
    }
    lastError = result.error;
    if (attempt < options.attempts - 1) await wait(options.backoffMs[attempt] ?? 0);
  }

  await logEvent(order.id, "print_failed", { kind, error: lastError });
  return { printed: "failed", error: lastError };
}
