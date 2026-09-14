import {
  pgTable, uuid, text, integer, boolean, decimal, jsonb, timestamp, pgEnum, index, primaryKey,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const orderStatusEnum = pgEnum("order_status", ["received", "delivered", "cancelled"]);
export const serviceTypeEnum = pgEnum("service_type", ["local", "delivery"]);
export const orderSourceEnum = pgEnum("order_source", ["whatsapp", "staff"]);
export const ingredientTypeEnum = pgEnum("ingredient_type", ["removable", "extra"]);
export const eventKindEnum = pgEnum("event_kind", [
  "created", "status_change", "printed_kitchen", "printed_bill", "notified",
]);

export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  sortOrder: integer("sort_order").notNull().default(0),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Category = typeof categories.$inferSelect;
export type CategoryNew = typeof categories.$inferInsert;

export const products = pgTable("products", {
  id: uuid("id").primaryKey().defaultRandom(),
  categoryId: uuid("category_id").notNull().references(() => categories.id),
  name: text("name").notNull(),
  basePrice: decimal("base_price", { precision: 10, scale: 2 }).notNull(),
  description: text("description").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({ categoryIdx: index("products_category_idx").on(t.categoryId) }));

export type Product = typeof products.$inferSelect;
export type ProductNew = typeof products.$inferInsert;

export const ingredients = pgTable("ingredients", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  type: ingredientTypeEnum("type").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull().default("0"),
  active: boolean("active").notNull().default(true),
});

export const productIngredients = pgTable("product_ingredients", {
  productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  ingredientId: uuid("ingredient_id").notNull().references(() => ingredients.id),
  defaultIncluded: boolean("default_included").notNull().default(true),
}, (t) => ({
  pk: primaryKey({ columns: [t.productId, t.ingredientId] }),
}));

export const deliveryZones = pgTable("delivery_zones", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  cost: decimal("cost", { precision: 10, scale: 2 }).notNull(),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const colonias = pgTable("colonias", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  zoneId: uuid("zone_id").notNull().references(() => deliveryZones.id, { onDelete: "cascade" }),
  active: boolean("active").notNull().default(true),
}, (t) => ({ zoneIdx: index("colonias_zone_idx").on(t.zoneId) }));

export const orders = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  sequentialNumber: integer("sequential_number").notNull(),
  status: orderStatusEnum("status").notNull().default("received"),
  serviceType: serviceTypeEnum("service_type").notNull(),
  customerPhone: text("customer_phone").notNull(),
  customerName: text("customer_name").notNull().default(""),
  deliveryAddress: text("delivery_address"),
  deliveryColoniaId: uuid("delivery_colonia_id").references(() => colonias.id),
  deliveryCostOverride: decimal("delivery_cost_override", { precision: 10, scale: 2 }),
  deliveryCost: decimal("delivery_cost", { precision: 10, scale: 2 }).notNull().default("0"),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  source: orderSourceEnum("source").notNull(),
  notes: text("notes").notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  deliveredAt: timestamp("delivered_at"),
}, (t) => ({
  statusIdx: index("orders_status_idx").on(t.status),
  seqIdx: index("orders_seq_idx").on(t.sequentialNumber),
}));

export const orderItems = pgTable("order_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  productId: uuid("product_id").notNull().references(() => products.id),
  productNameSnapshot: text("product_name_snapshot").notNull(),
  basePriceSnapshot: decimal("base_price_snapshot", { precision: 10, scale: 2 }).notNull(),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  quantity: integer("quantity").notNull(),
  removedIngredients: jsonb("removed_ingredients").$type<string[]>().notNull().default([]),
  extraIngredients: jsonb("extra_ingredients").$type<{ name: string; price: string }[]>().notNull().default([]),
  itemTotal: decimal("item_total", { precision: 10, scale: 2 }).notNull(),
}, (t) => ({ orderIdx: index("order_items_order_idx").on(t.orderId) }));

export const orderEvents = pgTable("order_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  kind: eventKindEnum("kind").notNull(),
  payload: jsonb("payload").notNull().default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({ orderIdx: index("order_events_order_idx").on(t.orderId) }));

export const adminSessions = pgTable("admin_sessions", {
  token: text("token").primaryKey(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
});

export const auditLog = pgTable("audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  entity: text("entity").notNull(),
  entityId: text("entity_id").notNull(),
  action: text("action").notNull(),
  beforeData: jsonb("before_data"),
  afterData: jsonb("after_data"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const categoriesRelations = relations(categories, ({ many }) => ({ products: many(products) }));
export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, { fields: [products.categoryId], references: [categories.id] }),
  ingredients: many(productIngredients),
}));