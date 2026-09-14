import type { Result } from "../result";

export type NewOrderInput = {
  items: { quantity: number }[];
  customerPhone: string;
  serviceType: "local" | "delivery";
  deliveryAddress?: string;
  deliveryColoniaId?: string;
  deliveryCostOverride?: string;
};

export type ValidationError =
  | { kind: "no-items"; message: string }
  | { kind: "missing-phone"; message: string }
  | { kind: "missing-address"; message: string }
  | { kind: "missing-zona"; message: string };

export function validateNewOrder(input: NewOrderInput): Result<true, ValidationError> {
  if (!input.items || input.items.length === 0) {
    return { ok: false, error: { kind: "no-items", message: "El pedido debe tener al menos un producto" } };
  }
  if (!input.customerPhone || input.customerPhone.trim() === "") {
    return { ok: false, error: { kind: "missing-phone", message: "Falta el teléfono del cliente" } };
  }
  if (input.serviceType === "delivery") {
    if (!input.deliveryAddress || input.deliveryAddress.trim() === "") {
      return { ok: false, error: { kind: "missing-address", message: "Falta la dirección de entrega" } };
    }
    if (!input.deliveryColoniaId && !input.deliveryCostOverride) {
      return { ok: false, error: { kind: "missing-zona", message: "Falta la colonia o un costo de envío manual" } };
    }
  }
  return { ok: true, value: true };
}