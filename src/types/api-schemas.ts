import { z } from "zod";
import type { Category, Colonia, OrderDetail, OrderItemRow, OrderRow, Product } from "@/types/domain";

const ProductSchema = z.object({
  id: z.string(),
  categoryId: z.string(),
  name: z.string(),
  basePrice: z.string(),
  active: z.boolean(),
  description: z.string().optional(),
}) satisfies z.ZodType<Product>;

const CategorySchema = z.object({
  id: z.string(),
  name: z.string(),
  active: z.boolean(),
  slug: z.string().optional(),
  sortOrder: z.number().optional(),
}) satisfies z.ZodType<Category>;

const ColoniaSchema = z.object({
  id: z.string(),
  name: z.string(),
  zoneId: z.string(),
  active: z.boolean(),
  zoneName: z.string(),
  zoneCost: z.string(),
}) satisfies z.ZodType<Colonia>;

const OrderRowSchema = z.object({
  id: z.string(),
  sequentialNumber: z.number(),
  status: z.enum(["received", "delivered", "cancelled"]),
  serviceType: z.enum(["local", "delivery"]),
  customerPhone: z.string(),
  customerName: z.string(),
  total: z.string(),
  createdAt: z.union([z.date(), z.string()]),
}) satisfies z.ZodType<OrderRow>;

const OrderItemRowSchema = z.object({
  id: z.string(),
  productId: z.string(),
  productNameSnapshot: z.string(),
  basePriceSnapshot: z.string(),
  unitPrice: z.string(),
  quantity: z.number(),
  removedIngredients: z.array(z.string()),
  extraIngredients: z.array(z.object({ name: z.string(), price: z.string() })),
  itemTotal: z.string(),
}) satisfies z.ZodType<OrderItemRow>;

const OrderDetailSchema = z.object({
  order: OrderRowSchema.extend({
    deliveryAddress: z.string().nullable(),
    deliveryColoniaId: z.string().nullable(),
    deliveryCost: z.string(),
    deliveryCostOverride: z.string().nullable(),
    subtotal: z.string(),
    source: z.enum(["whatsapp", "staff"]),
    notes: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
    deliveredAt: z.string().nullable(),
  }),
  items: z.array(OrderItemRowSchema),
}) satisfies z.ZodType<OrderDetail>;

export const ProductListResponse = z.object({
  ok: z.literal(true),
  data: z.array(ProductSchema),
});
export const CategoryListResponse = z.object({
  ok: z.literal(true),
  data: z.array(CategorySchema),
});
export const ColoniaListResponse = z.object({
  ok: z.literal(true),
  data: z.array(ColoniaSchema),
});
export const OrderRowListResponse = z.object({
  ok: z.literal(true),
  data: z.array(OrderRowSchema),
});
export const OrderDetailResponse = z.object({
  ok: z.literal(true),
  data: OrderDetailSchema,
});
export const ProductResponse = z.object({
  ok: z.literal(true),
  data: ProductSchema.optional(),
});

export const ErrorResponse = z.object({
  ok: z.literal(false),
  error: z.object({
    code: z.string().optional(),
    message: z.string(),
  }),
});

export async function parseErrorMessage(res: Response): Promise<string> {
  try {
    const body = ErrorResponse.parse(await res.json());
    return body.error.message;
  } catch {
    return `Error ${res.status}`;
  }
}

export type ParsedResponse<T> = { ok: true; data: T } | { ok: false; error: { message: string } };
