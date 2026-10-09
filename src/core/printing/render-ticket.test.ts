import { describe, expect, test } from "vitest";
import { GS } from "./escpos-bytes";
import {
  formatDateTime,
  formatMoney,
  renderBillTicket,
  renderKitchenTicket,
  truncate,
  twoColumns,
} from "./render-ticket";
import type { KitchenTicketData } from "./types";

function includesSequence(haystack: Uint8Array, needle: number[]): boolean {
  outer: for (let i = 0; i + needle.length <= haystack.length; i += 1) {
    for (let j = 0; j < needle.length; j += 1) {
      if (haystack[i + j] !== needle[j]) continue outer;
    }
    return true;
  }
  return false;
}

const baseKitchen: KitchenTicketData = {
  serviceType: "local",
  sequentialNumber: 7,
  createdAt: new Date(2026, 9, 7, 15, 30),
  notes: "sin picante",
  items: [
    { quantity: 2, name: "Hamburguesa", removed: ["cebolla"], extras: [{ name: "queso", price: "10.00" }], itemTotal: "200.00" },
  ],
};

describe("helpers de formato", () => {
  test("formatDateTime usa dd/MM/yyyy HH:mm", () => {
    expect(formatDateTime(new Date(2026, 9, 7, 9, 5))).toBe("07/10/2026 09:05");
  });
  test("formatMoney antepone $", () => {
    expect(formatMoney("180.00")).toBe("$180.00");
  });
  test("truncate recorta con puntos suspensivos ASCII", () => {
    expect(truncate("abcdef", 5)).toBe("ab...");
    expect(truncate("abc", 5)).toBe("abc");
  });
  test("twoColumns alinea a la derecha en 48 columnas", () => {
    const line = twoColumns("TOTAL", "$210.00");
    expect(line).toHaveLength(48);
    expect(line.startsWith("TOTAL")).toBe(true);
    expect(line.endsWith("$210.00")).toBe(true);
  });
});

describe("renderKitchenTicket", () => {
  test("incluye servicio, número, ítem, notas y corte; sin precios", () => {
    const bytes = renderKitchenTicket(baseKitchen);
    expect(includesSequence(bytes, [0x50, 0x45, 0x44, 0x49, 0x44, 0x4f, 0x20, 0x23, 0x37])).toBe(true); // "PEDIDO #7"
    expect(includesSequence(bytes, [0x2d, 0x20, 0x73, 0x69, 0x6e, 0x20])).toBe(true); // "- sin "
    expect(includesSequence(bytes, [0x0a])).toBe(true);
    expect(bytes.includes(0x24)).toBe(false); // sin '$'
    expect(bytes[bytes.length - 3]).toBe(GS);
  });
});

describe("renderBillTicket", () => {
  test("incluye precios, totales y nombre del negocio", () => {
    const bytes = renderBillTicket({
      businessName: "Taquería Ñ",
      businessAddress: "Calle 1",
      businessPhone: "555",
      serviceType: "delivery",
      sequentialNumber: 12,
      createdAt: new Date(2026, 9, 7, 15, 30),
      deliveryAddress: "Av. Reforma 10",
      subtotal: "200.00",
      deliveryCost: "30.00",
      total: "230.00",
      items: [
        { quantity: 2, name: "Taco", removed: [], extras: [{ name: "queso", price: "10.00" }], itemTotal: "200.00" },
      ],
    });
    expect(includesSequence(bytes, [0x24, 0x32, 0x33, 0x30, 0x2e, 0x30, 0x30])).toBe(true); // "$230.00"
    expect(includesSequence(bytes, [0x54, 0x4f, 0x54, 0x41, 0x4c])).toBe(true); // "TOTAL"
    expect(bytes.includes(0xa5)).toBe(true); // 'Ñ' en CP850
  });
});
