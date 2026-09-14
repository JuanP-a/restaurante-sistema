import type { Result } from "../result";

export const DELIVERY_COST_MIN = 10;
export const DELIVERY_COST_MAX = 30;

export type DeliveryCostError =
  | { kind: "invalid-number"; message: string }
  | { kind: "below-min"; message: string }
  | { kind: "above-max"; message: string };

export function validateDeliveryCost(cost: string): Result<true, DeliveryCostError> {
  const n = Number(cost);
  if (cost.trim() === "" || Number.isNaN(n)) {
    return { ok: false, error: { kind: "invalid-number", message: "Costo inválido" } };
  }
  if (n < DELIVERY_COST_MIN) {
    return {
      ok: false,
      error: {
        kind: "below-min",
        message: `Costo mínimo: $${DELIVERY_COST_MIN.toFixed(2)}`,
      },
    };
  }
  if (n > DELIVERY_COST_MAX) {
    return {
      ok: false,
      error: {
        kind: "above-max",
        message: `Costo máximo: $${DELIVERY_COST_MAX.toFixed(2)}`,
      },
    };
  }
  return { ok: true, value: true };
}