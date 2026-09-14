export type OrderItemInput = {
  basePrice: string;
  quantity: number;
  extras: { price: string }[];
};

export type OrderTotals = { subtotal: string; total: string };

export function calculateOrderTotals(input: {
  items: OrderItemInput[];
  deliveryCost: string;
}): OrderTotals {
  const subtotal = input.items.reduce((acc, item) => {
    const base = Number(item.basePrice);
    const extras = item.extras.reduce((s, e) => s + Number(e.price), 0);
    return acc + (base + extras) * item.quantity;
  }, 0);
  const total = subtotal + Number(input.deliveryCost);
  return {
    subtotal: subtotal.toFixed(2),
    total: total.toFixed(2),
  };
}