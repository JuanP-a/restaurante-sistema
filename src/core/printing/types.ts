export type TicketItem = {
  quantity: number;
  name: string;
  removed: string[];
  extras: { name: string; price: string }[];
  itemTotal: string;
};

export type KitchenTicketData = {
  serviceType: "local" | "delivery";
  sequentialNumber: number;
  createdAt: Date;
  items: TicketItem[];
  notes: string;
};

export type BillTicketData = {
  businessName: string;
  businessAddress: string;
  businessPhone: string;
  serviceType: "local" | "delivery";
  sequentialNumber: number;
  createdAt: Date;
  deliveryAddress?: string;
  items: TicketItem[];
  subtotal: string;
  deliveryCost: string;
  total: string;
};
