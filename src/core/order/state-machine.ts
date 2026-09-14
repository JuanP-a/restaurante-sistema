import type { Result } from "../result";

export type OrderStatus = "received" | "delivered" | "cancelled";

export type InvalidTransitionError = {
  kind: "invalid-transition";
  from: OrderStatus;
  to: OrderStatus;
};

const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  received: ["delivered", "cancelled"],
  delivered: [],
  cancelled: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function nextState(
  from: OrderStatus,
  to: OrderStatus,
): Result<OrderStatus, InvalidTransitionError> {
  if (!canTransition(from, to)) {
    return { ok: false, error: { kind: "invalid-transition", from, to } };
  }
  return { ok: true, value: to };
}