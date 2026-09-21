export type Product = {
  id: string;
  categoryId: string;
  name: string;
  basePrice: string;
  active: boolean;
  description?: string;
};

export type Category = {
  id: string;
  name: string;
  active: boolean;
  slug?: string;
  sortOrder?: number;
};

export type Colonia = {
  id: string;
  name: string;
  zoneId: string;
  active: boolean;
  zoneName: string;
  zoneCost: string;
};

export type CartItem = {
  productId: string;
  name: string;
  basePrice: string;
  quantity: number;
  extras: { name: string; price: string }[];
  removed: string[];
};

export type OrderRow = {
  id: string;
  sequentialNumber: number;
  status: "received" | "delivered" | "cancelled";
  serviceType: "local" | "delivery";
  customerPhone: string;
  customerName: string;
  total: string;
  createdAt: Date | string;
};

export type OrderItemRow = {
  id: string;
  productId: string;
  productNameSnapshot: string;
  basePriceSnapshot: string;
  unitPrice: string;
  quantity: number;
  removedIngredients: string[];
  extraIngredients: { name: string; price: string }[];
  itemTotal: string;
};

export type OrderDetail = {
  order: OrderRow & {
    deliveryAddress: string | null;
    deliveryColoniaId: string | null;
    deliveryCost: string;
    deliveryCostOverride: string | null;
    subtotal: string;
    source: "whatsapp" | "staff";
    notes: string;
    createdAt: string;
    updatedAt: string;
    deliveredAt: string | null;
  };
  items: OrderItemRow[];
};
