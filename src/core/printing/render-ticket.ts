import { encodeCp850 } from "./cp850";
import { align, bold, cut, feed, init, selectCp850 } from "./escpos-bytes";
import type { BillTicketData, KitchenTicketData, TicketItem } from "./types";

const WIDTH = 48;

export function formatDateTime(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function formatMoney(amount: string): string {
  return `$${amount}`;
}

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 3))}...`;
}

export function twoColumns(left: string, right: string, width = WIDTH): string {
  const space = Math.max(1, width - left.length - right.length);
  return `${left}${" ".repeat(space)}${right}`;
}

function text(value: string): number[] {
  return [...encodeCp850(value), 0x0a];
}

function renderItems(items: TicketItem[], withPrices: boolean): number[] {
  const out: number[] = [];
  for (const item of items) {
    const name = `${item.quantity}x ${item.name}`;
    if (withPrices) {
      out.push(...text(twoColumns(truncate(name, WIDTH - 10), formatMoney(item.itemTotal))));
    } else {
      out.push(...bold(true), ...text(truncate(name, WIDTH)), ...bold(false));
    }
    for (const removed of item.removed) out.push(...text(`   - sin ${removed}`));
    for (const extra of item.extras) {
      out.push(...text(
        withPrices
          ? twoColumns(`   + ${truncate(extra.name, WIDTH - 14)}`, formatMoney(extra.price))
          : `   + extra ${extra.name}`,
      ));
    }
  }
  return out;
}

export function renderKitchenTicket(data: KitchenTicketData): Uint8Array {
  const out: number[] = [
    ...init(),
    ...selectCp850(),
    ...align("center"),
    ...bold(true),
    ...text(data.serviceType === "delivery" ? "DOMICILIO" : "LOCAL"),
    ...text(`PEDIDO #${data.sequentialNumber}`),
    ...bold(false),
    ...text(formatDateTime(data.createdAt)),
    ...align("left"),
    ...text(""),
  ];
  out.push(...renderItems(data.items, false));
  if (data.notes) out.push(...text(""), ...text(`NOTAS: ${data.notes}`));
  out.push(...feed(3), ...cut());
  return Uint8Array.from(out);
}

export function renderBillTicket(data: BillTicketData): Uint8Array {
  const out: number[] = [
    ...init(),
    ...selectCp850(),
    ...align("center"),
    ...bold(true),
    ...text(data.businessName),
    ...bold(false),
  ];
  if (data.businessAddress) out.push(...text(data.businessAddress));
  if (data.businessPhone) out.push(...text(data.businessPhone));
  out.push(
    ...align("left"),
    ...text(""),
    ...text(data.serviceType === "delivery" ? "DOMICILIO" : "LOCAL"),
    ...text(`PEDIDO #${data.sequentialNumber}`),
    ...text(formatDateTime(data.createdAt)),
  );
  if (data.deliveryAddress) out.push(...text(data.deliveryAddress));
  out.push(
    ...text(""),
    ...renderItems(data.items, true),
    ...text(""),
    ...text(twoColumns("SUBTOTAL", formatMoney(data.subtotal))),
    ...text(twoColumns("ENVIO", formatMoney(data.deliveryCost))),
    ...bold(true),
    ...text(twoColumns("TOTAL", formatMoney(data.total))),
    ...bold(false),
    ...feed(3),
    ...cut(),
  );
  return Uint8Array.from(out);
}
