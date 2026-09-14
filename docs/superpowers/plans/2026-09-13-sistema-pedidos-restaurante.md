# Sistema de Pedidos del Restaurante — Plan de Implementación

> **Para workers agénticos:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) o superpowers:executing-plans para implementar este plan task-by-task. Steps usan checkbox (`- [ ]`) para tracking.

**Goal:** Construir un sistema web de pedidos para restaurante con captura por staff, bot de WhatsApp, e impresión térmica 80mm, deployado en la nube.

**Architecture:** Next.js 15 full-stack con App Router. Drizzle ORM sobre Postgres (Neon). Functional core (cálculos, state machines) en `src/core/`, adapters de I/O en `src/infra/`. Bot de WhatsApp via 360dialog. Impresión con HTML/PDF desde el navegador. SSE para dashboard en tiempo real.

**Tech Stack:** Next.js 15, TypeScript estricto, Drizzle, Postgres (Neon), Tailwind, shadcn/ui, 360dialog, Vitest, Playwright, Render.

---

## Estructura de archivos

```
/
├── package.json
├── tsconfig.json
├── next.config.ts
├── tailwind.config.ts
├── postcss.config.js
├── drizzle.config.ts
├── vitest.config.ts
├── vitest.setup.ts
├── playwright.config.ts
├── eslint.config.mjs
├── .env.example
├── .env.local                    # gitignored
├── src/
│   ├── env.ts                    # Zod-validated env vars
│   ├── db.ts                     # Drizzle client
│   ├── schema.ts                 # Drizzle schema
│   ├── middleware.ts             # Auth middleware
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── globals.css
│   │   ├── page.tsx              # Landing
│   │   ├── login/page.tsx
│   │   ├── (admin)/
│   │   │   ├── layout.tsx
│   │   │   ├── orders/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── new/page.tsx
│   │   │   │   └── [id]/page.tsx
│   │   │   ├── menu/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── categories/page.tsx
│   │   │   │   └── products/[id]/page.tsx
│   │   │   ├── delivery-zones/page.tsx
│   │   │   └── import/page.tsx
│   │   ├── print/
│   │   │   └── [id]/
│   │   │       ├── kitchen/page.tsx
│   │   │       └── bill/page.tsx
│   │   └── api/
│   │       ├── orders/
│   │       │   ├── route.ts
│   │       │   └── [id]/
│   │       │       ├── route.ts
│   │       │       ├── status/route.ts
│   │       │       ├── print-kitchen/route.ts
│   │       │       └── print-bill/route.ts
│   │       ├── menu/
│   │       │   ├── categories/route.ts
│   │       │   ├── categories/[id]/route.ts
│   │       │   ├── products/route.ts
│   │       │   └── products/[id]/route.ts
│   │       ├── delivery-zones/
│   │       │   ├── route.ts
│   │       │   ├── [id]/route.ts
│   │       │   ├── colonias/route.ts
│   │       │   └── colonias/[id]/route.ts
│   │       ├── admin/
│   │       │   ├── login/route.ts
│   │       │   ├── logout/route.ts
│   │       │   └── import/route.ts
│   │       ├── events/route.ts
│   │       └── webhooks/whatsapp/route.ts
│   ├── core/                     # Pure business logic
│   │   ├── pricing/calculate-order.ts
│   │   ├── order/state-machine.ts
│   │   ├── order/validate.ts
│   │   ├── delivery/validate-cost.ts
│   │   ├── bot/state-machine.ts
│   │   └── bot/build-reply.ts
│   ├── infra/
│   │   ├── auth/password.ts
│   │   ├── auth/session.ts
│   │   ├── db/menu-repository.ts
│   │   ├── db/order-repository.ts
│   │   ├── db/delivery-repository.ts
│   │   ├── whatsapp/client.ts
│   │   ├── whatsapp/webhook-verify.ts
│   │   ├── whatsapp/session-store.ts
│   │   └── events/event-bus.ts
│   └── lib/utils.ts
├── drizzle/                      # Generated migrations
└── tests/
    ├── unit/                     # mirrors src/core
    └── e2e/order-flow.spec.ts
```

---

# Phase 0: Foundation

## Task 0.1: Initialize Next.js project

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css`

- [ ] **Step 1: Run create-next-app**

```bash
cd "/Volumes/M2 Mac/proyectos/Restaurante-sistema"
pnpm dlx create-next-app@latest . --typescript --tailwind --app --src-dir --import-alias "@/*" --no-eslint --use-pnpm
```

If prompted about non-empty directory, type `y` to proceed.

- [ ] **Step 2: Verify dev server**

```bash
pnpm dev
```

Visit `http://localhost:3000`, see default Next.js page. Ctrl+C.

- [ ] **Step 3: Commit**

```bash
git add .
git commit -m "chore: bootstrap Next.js 15 project"
```

---

## Task 0.2: Configure TypeScript strict and Vitest

**Files:**
- Modify: `tsconfig.json`
- Create: `vitest.config.ts`, `vitest.setup.ts`

- [ ] **Step 1: Update tsconfig for strict mode**

In `tsconfig.json` compilerOptions, set:

```json
{
  "strict": true,
  "noUncheckedIndexedAccess": true,
  "noImplicitOverride": true,
  "verbatimModuleSyntax": true,
  "paths": { "@/*": ["./src/*"] }
}
```

- [ ] **Step 2: Install test tooling**

```bash
pnpm add -D vitest @vitest/coverage-v8 happy-dom
```

- [ ] **Step 3: Create vitest config**

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "happy-dom",
    globals: true,
    include: ["src/**/*.test.ts"],
    exclude: ["node_modules", ".next", "tests/e2e/**"],
  },
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
});
```

Create `vitest.setup.ts`:

```ts
export {};
```

- [ ] **Step 4: Add scripts to package.json**

In `package.json` scripts, add:

```json
"test": "vitest run",
"test:watch": "vitest",
"typecheck": "tsc --noEmit"
```

- [ ] **Step 5: Verify**

```bash
pnpm typecheck
pnpm test
```

Expected: typecheck OK, 0 tests passing.

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "chore: configure strict TypeScript and Vitest"
```

---

## Task 0.3: Environment validation with Zod

**Files:**
- Create: `src/env.ts`, `src/env.test.ts`, `.env.example`

- [ ] **Step 1: Install Zod**

```bash
pnpm add zod
```

- [ ] **Step 2: Write failing test**

Create `src/env.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseEnv } from "./env";

describe("parseEnv", () => {
  it("requires DATABASE_URL", () => {
    expect(() => parseEnv({})).toThrow();
  });

  it("rejects non-bcrypt hash", () => {
    expect(() =>
      parseEnv({ DATABASE_URL: "postgres://x", ADMIN_PASSWORD_HASH: "nope", SESSION_SECRET: "a".repeat(32) })
    ).toThrow();
  });

  it("parses valid env with defaults", () => {
    const env = parseEnv({
      DATABASE_URL: "postgres://x",
      ADMIN_PASSWORD_HASH: "$2a$10$abcdefghijklmnopqrstuv",
      SESSION_SECRET: "a".repeat(32),
    });
    expect(env.DATABASE_URL).toBe("postgres://x");
    expect(env.DEFAULT_PREP_TIME_MINUTES).toBe(25);
  });
});
```

- [ ] **Step 3: Run, verify fails**

```bash
pnpm test src/env.test.ts
```

- [ ] **Step 4: Implement**

Create `src/env.ts`:

```ts
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  ADMIN_PASSWORD_HASH: z.string().regex(/^\$2[aby]\$10\$/, "debe ser hash bcrypt"),
  SESSION_SECRET: z.string().min(32, "mínimo 32 caracteres"),
  WHATSAPP_BSP_API_KEY: z.string().min(1).optional(),
  WHATSAPP_BSP_URL: z.string().url().default("https://waba.360dialog.io/v1"),
  WHATSAPP_VERIFY_TOKEN: z.string().min(1).optional(),
  BUSINESS_NAME: z.string().default("Mi Restaurante"),
  BUSINESS_ADDRESS: z.string().default(""),
  BUSINESS_PHONE: z.string().default(""),
  DEFAULT_PREP_TIME_MINUTES: z.coerce.number().int().min(1).default(25),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: Record<string, string | undefined>): Env {
  return envSchema.parse(source);
}

let cached: Env | null = null;
export function getEnv(): Env {
  if (cached) return cached;
  cached = parseEnv(process.env);
  return cached;
}
```

- [ ] **Step 5: Run, verify passes**

```bash
pnpm test src/env.test.ts
```

- [ ] **Step 6: Create .env.example**

```
DATABASE_URL=
ADMIN_PASSWORD_HASH=
SESSION_SECRET=
WHATSAPP_BSP_API_KEY=
WHATSAPP_BSP_URL=https://waba.360dialog.io/v1
WHATSAPP_VERIFY_TOKEN=
BUSINESS_NAME=
BUSINESS_ADDRESS=
BUSINESS_PHONE=
DEFAULT_PREP_TIME_MINUTES=25
```

- [ ] **Step 7: Commit**

```bash
git add .
git commit -m "feat(env): Zod-validated environment variables"
```

---

# Phase 1: Database schema

## Task 1.1: Install Drizzle and create client

**Files:**
- Create: `drizzle.config.ts`, `src/db.ts`

- [ ] **Step 1: Install Drizzle and pg**

```bash
pnpm add drizzle-orm postgres
pnpm add -D drizzle-kit @types/pg
pnpm add pg
```

- [ ] **Step 2: Create drizzle.config.ts**

```ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
});
```

- [ ] **Step 3: Create Drizzle client**

Create `src/db.ts`:

```ts
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { getEnv } from "./env";
import * as schema from "./schema";

let pool: Pool | null = null;

export function getDb() {
  if (pool) return drizzle(pool, { schema });
  const env = getEnv();
  pool = new Pool({ connectionString: env.DATABASE_URL, max: 10 });
  return drizzle(pool, { schema });
}

export type Db = ReturnType<typeof getDb>;
```

- [ ] **Step 4: Add db scripts**

In `package.json` scripts, add:

```json
"drizzle:generate": "drizzle-kit generate",
"drizzle:migrate": "drizzle-kit migrate"
```

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat(db): setup Drizzle ORM and Postgres client"
```

---

## Task 1.2: Define Drizzle schema for all entities

**Files:**
- Create: `src/schema.ts`

- [ ] **Step 1: Write the full schema**

Create `src/schema.ts`:

```ts
import {
  pgTable, uuid, text, integer, boolean, decimal, jsonb, timestamp, pgEnum, index,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

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
}, (t) => ({ pk: sql`PRIMARY KEY (${t.productId}, ${t.ingredientId})` }));

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
```

- [ ] **Step 2: Generate migration**

```bash
pnpm drizzle:generate
```

Expected: file `drizzle/0000_*.sql` created.

- [ ] **Step 3: Commit**

```bash
git add .
git commit -m "feat(db): define full schema"
```

---

## Task 1.3: Provision Neon database and apply migration

**Files:** none (cloud setup, not tracked in git)

- [ ] **Step 1: Create Neon project**

1. Visit https://console.neon.tech, create account.
2. Create a new project named "restaurante-pedidos".
3. Copy the connection string to `.env.local` as `DATABASE_URL`.

- [ ] **Step 2: Generate bcrypt hash for admin password**

```bash
pnpm add -D bcrypt-cli
node -e "const b=require('bcryptjs'); console.log(b.hashSync('TU_CONTRASEÑA_AQUI', 10))"
```

Copy the hash to `.env.local` as `ADMIN_PASSWORD_HASH`.

- [ ] **Step 3: Generate session secret**

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy to `.env.local` as `SESSION_SECRET`.

- [ ] **Step 4: Apply migration**

```bash
pnpm drizzle:migrate
```

Expected: "Applying migration 0000_*.sql".

- [ ] **Step 5: Commit any env example changes**

```bash
git status
git add .env.example 2>/dev/null || true
git diff --cached --quiet || git commit -m "chore: update env example"
```

(Only commit if there are actual changes.)

---

# Phase 2: Pure core logic (TDD)

## Task 2.1: Price calculation

**Files:**
- Create: `src/core/pricing/calculate-order.ts`
- Test: `src/core/pricing/calculate-order.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/core/pricing/calculate-order.test.ts
import { describe, it, expect } from "vitest";
import { calculateOrderTotals } from "./calculate-order";

describe("calculateOrderTotals", () => {
  it("returns zeros for empty cart", () => {
    const r = calculateOrderTotals({ items: [], deliveryCost: "0" });
    expect(r.subtotal).toBe("0.00");
    expect(r.total).toBe("0.00");
  });

  it("sums base price times quantity", () => {
    const r = calculateOrderTotals({
      items: [
        { basePrice: "100.00", quantity: 2, extras: [] },
        { basePrice: "50.00", quantity: 1, extras: [] },
      ],
      deliveryCost: "0",
    });
    expect(r.subtotal).toBe("250.00");
    expect(r.total).toBe("250.00");
  });

  it("adds extras cost per unit", () => {
    const r = calculateOrderTotals({
      items: [
        { basePrice: "100.00", quantity: 2, extras: [{ price: "15.00" }, { price: "10.00" }] },
      ],
      deliveryCost: "0",
    });
    expect(r.subtotal).toBe("250.00");
  });

  it("adds delivery cost to total", () => {
    const r = calculateOrderTotals({
      items: [{ basePrice: "100.00", quantity: 1, extras: [] }],
      deliveryCost: "20.00",
    });
    expect(r.subtotal).toBe("100.00");
    expect(r.total).toBe("120.00");
  });

  it("rounds to 2 decimals", () => {
    const r = calculateOrderTotals({
      items: [{ basePrice: "33.33", quantity: 3, extras: [] }],
      deliveryCost: "0",
    });
    expect(r.subtotal).toBe("99.99");
  });
});
```

- [ ] **Step 2: Run, verify fails**

```bash
pnpm test src/core/pricing
```

- [ ] **Step 3: Implement**

```ts
// src/core/pricing/calculate-order.ts
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
```

- [ ] **Step 4: Run, verify passes**

```bash
pnpm test src/core/pricing
```

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat(core): order total calculation with extras and delivery"
```

---

## Task 2.2: Order state machine

**Files:**
- Create: `src/core/result.ts` (shared `Result<T, E>` type)
- Create: `src/core/order/state-machine.ts`
- Test: `src/core/order/state-machine.test.ts`

> **Note:** El plan original usaba `throw` para errores de transición. Se reemplaza por `Result<T, E>` para mantener consistencia con la regla no negociable de `AGENTS.md` ("Errores explícitos con Result/Either en el core"). Las Tasks 2.3 y 2.4 ya seguían este patrón.

- [ ] **Step 1: Write failing tests**

```ts
// src/core/order/state-machine.test.ts
import { describe, it, expect } from "vitest";
import { canTransition, nextState, type OrderStatus } from "./state-machine";

describe("order state machine", () => {
  it("allows received to delivered", () => {
    expect(canTransition("received", "delivered")).toBe(true);
  });
  it("allows received to cancelled", () => {
    expect(canTransition("received", "cancelled")).toBe(true);
  });
  it("does not allow delivered to received", () => {
    expect(canTransition("delivered", "received")).toBe(false);
  });
  it("does not allow delivered to cancelled", () => {
    expect(canTransition("delivered", "cancelled")).toBe(false);
  });
  it("does not allow cancelled transitions", () => {
    expect(canTransition("cancelled", "received")).toBe(false);
    expect(canTransition("cancelled", "delivered")).toBe(false);
  });
  it("nextState returns ok on valid transition", () => {
    const r = nextState("received", "delivered");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe("delivered");
  });
  it("nextState returns err on invalid transition", () => {
    const r = nextState("delivered", "received");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("invalid-transition");
  });
});

export type _Status = OrderStatus;
```

- [ ] **Step 2: Run, verify fails**

- [ ] **Step 3: Implement**

```ts
// src/core/result.ts
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

// src/core/order/state-machine.ts
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
```

- [ ] **Step 4: Run, verify passes**

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat(core): order state machine with Result"
```

---

## Task 2.3: Order validation

**Files:**
- Create: `src/core/order/validate.ts`
- Test: `src/core/order/validate.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/core/order/validate.test.ts
import { describe, it, expect } from "vitest";
import { validateNewOrder } from "./validate";

describe("validateNewOrder", () => {
  it("requires at least one item", () => {
    const r = validateNewOrder({ items: [], customerPhone: "555", serviceType: "local" });
    expect(r.ok).toBe(false);
  });
  it("requires customerPhone", () => {
    const r = validateNewOrder({ items: [{ quantity: 1 }], customerPhone: "", serviceType: "local" });
    expect(r.ok).toBe(false);
  });
  it("requires address for delivery", () => {
    const r = validateNewOrder({
      items: [{ quantity: 1 }], customerPhone: "555", serviceType: "delivery", deliveryAddress: "",
    });
    expect(r.ok).toBe(false);
  });
  it("requires colonia OR override for delivery", () => {
    const r = validateNewOrder({
      items: [{ quantity: 1 }], customerPhone: "555", serviceType: "delivery", deliveryAddress: "Calle 1",
    });
    expect(r.ok).toBe(false);
  });
  it("accepts valid local order", () => {
    const r = validateNewOrder({
      items: [{ quantity: 1 }], customerPhone: "555", serviceType: "local",
    });
    expect(r.ok).toBe(true);
  });
  it("accepts valid delivery with colonia", () => {
    const r = validateNewOrder({
      items: [{ quantity: 1 }], customerPhone: "555", serviceType: "delivery",
      deliveryAddress: "Calle 1", deliveryColoniaId: "col1",
    });
    expect(r.ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run, verify fails**

- [ ] **Step 3: Implement**

```ts
// src/core/order/validate.ts
export type NewOrderInput = {
  items: { quantity: number }[];
  customerPhone: string;
  serviceType: "local" | "delivery";
  deliveryAddress?: string;
  deliveryColoniaId?: string;
  deliveryCostOverride?: string;
};

export type ValidationResult = { ok: true } | { ok: false; error: string };

export function validateNewOrder(input: NewOrderInput): ValidationResult {
  if (!input.items || input.items.length === 0) {
    return { ok: false, error: "El pedido debe tener al menos un producto" };
  }
  if (!input.customerPhone || input.customerPhone.trim() === "") {
    return { ok: false, error: "Falta el teléfono del cliente" };
  }
  if (input.serviceType === "delivery") {
    if (!input.deliveryAddress || input.deliveryAddress.trim() === "") {
      return { ok: false, error: "Falta la dirección de entrega" };
    }
    if (!input.deliveryColoniaId && !input.deliveryCostOverride) {
      return { ok: false, error: "Falta la colonia o un costo de envío manual" };
    }
  }
  return { ok: true };
}
```

- [ ] **Step 4: Run, verify passes**

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat(core): order input validation"
```

---

## Task 2.4: Delivery cost range validation

**Files:**
- Create: `src/core/delivery/validate-cost.ts`
- Test: `src/core/delivery/validate-cost.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/core/delivery/validate-cost.test.ts
import { describe, it, expect } from "vitest";
import { validateDeliveryCost } from "./validate-cost";

describe("validateDeliveryCost", () => {
  it("rejects below 10", () => expect(validateDeliveryCost("9.99").ok).toBe(false));
  it("rejects above 30", () => expect(validateDeliveryCost("30.01").ok).toBe(false));
  it("accepts 10", () => expect(validateDeliveryCost("10").ok).toBe(true));
  it("accepts 30", () => expect(validateDeliveryCost("30").ok).toBe(true));
  it("rejects non-numeric", () => expect(validateDeliveryCost("abc").ok).toBe(false));
});
```

- [ ] **Step 2: Run, verify fails**

- [ ] **Step 3: Implement**

```ts
// src/core/delivery/validate-cost.ts
export type ValidationResult = { ok: true } | { ok: false; error: string };

export const DELIVERY_COST_MIN = 10;
export const DELIVERY_COST_MAX = 30;

export function validateDeliveryCost(cost: string): ValidationResult {
  const n = Number(cost);
  if (Number.isNaN(n)) return { ok: false, error: "Costo inválido" };
  if (n < DELIVERY_COST_MIN) return { ok: false, error: `Costo mínimo: $${DELIVERY_COST_MIN}` };
  if (n > DELIVERY_COST_MAX) return { ok: false, error: `Costo máximo: $${DELIVERY_COST_MAX}` };
  return { ok: true };
}
```

- [ ] **Step 4: Run, verify passes**

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat(core): delivery cost range validation (10-30)"
```

---

## Task 2.5: Bot state machine

**Files:**
- Create: `src/core/bot/state-machine.ts`
- Test: `src/core/bot/state-machine.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/core/bot/state-machine.test.ts
import { describe, it, expect } from "vitest";
import { applyBotEvent, initialState, type BotState, type BotEvent } from "./state-machine";

describe("bot state machine", () => {
  it("starts in idle", () => {
    expect(initialState().state).toBe("idle");
  });

  it("idle + message -> browsing_category", () => {
    const s = applyBotEvent(initialState(), { type: "message", text: "hola" });
    expect(s.state).toBe("browsing_category");
  });

  it("browsing_category + category_picked -> browsing_product", () => {
    const s = applyBotEvent(
      applyBotEvent(initialState(), { type: "message", text: "hola" }),
      { type: "category_picked", categoryId: "cat-1" }
    );
    expect(s.state).toBe("browsing_product");
    expect(s.payload.categoryId).toBe("cat-1");
  });

  it("browsing_product + product_picked -> customizing_product", () => {
    const s = applyBotEvent(
      applyBotEvent(
        applyBotEvent(initialState(), { type: "message", text: "hola" }),
        { type: "category_picked", categoryId: "c1" }
      ),
      { type: "product_picked", product: { id: "p1", name: "X", basePrice: "50" }, quantity: 1 }
    );
    expect(s.state).toBe("customizing_product");
  });

  it("customizing_product + confirm_item -> in_cart with item", () => {
    let s = applyBotEvent(initialState(), { type: "message", text: "hola" });
    s = applyBotEvent(s, { type: "category_picked", categoryId: "c1" });
    s = applyBotEvent(s, { type: "product_picked", product: { id: "p1", name: "X", basePrice: "10" }, quantity: 1 });
    s = applyBotEvent(s, { type: "confirm_item", removed: [], extras: [] });
    expect(s.state).toBe("in_cart");
    expect(s.payload.cart?.length).toBe(1);
  });

  it("in_cart + add_more -> browsing_category", () => {
    let s = applyBotEvent(initialState(), { type: "message", text: "hola" });
    s = applyBotEvent(s, { type: "category_picked", categoryId: "c1" });
    s = applyBotEvent(s, { type: "product_picked", product: { id: "p1", name: "X", basePrice: "10" }, quantity: 1 });
    s = applyBotEvent(s, { type: "confirm_item", removed: [], extras: [] });
    s = applyBotEvent(s, { type: "add_more" });
    expect(s.state).toBe("browsing_category");
  });

  it("in_cart + finalize -> choosing_service_type", () => {
    let s = applyBotEvent(initialState(), { type: "message", text: "hola" });
    s = applyBotEvent(s, { type: "category_picked", categoryId: "c1" });
    s = applyBotEvent(s, { type: "product_picked", product: { id: "p1", name: "X", basePrice: "10" }, quantity: 1 });
    s = applyBotEvent(s, { type: "confirm_item", removed: [], extras: [] });
    s = applyBotEvent(s, { type: "finalize" });
    expect(s.state).toBe("choosing_service_type");
  });

  it("choosing + local -> confirming_order", () => {
    let s = applyBotEvent(initialState(), { type: "message", text: "hola" });
    s = applyBotEvent(s, { type: "category_picked", categoryId: "c1" });
    s = applyBotEvent(s, { type: "product_picked", product: { id: "p1", name: "X", basePrice: "10" }, quantity: 1 });
    s = applyBotEvent(s, { type: "confirm_item", removed: [], extras: [] });
    s = applyBotEvent(s, { type: "finalize" });
    s = applyBotEvent(s, { type: "service_picked", serviceType: "local" });
    expect(s.state).toBe("confirming_order");
  });

  it("choosing + delivery -> awaiting_colonia", () => {
    let s = applyBotEvent(initialState(), { type: "message", text: "hola" });
    s = applyBotEvent(s, { type: "category_picked", categoryId: "c1" });
    s = applyBotEvent(s, { type: "product_picked", product: { id: "p1", name: "X", basePrice: "10" }, quantity: 1 });
    s = applyBotEvent(s, { type: "confirm_item", removed: [], extras: [] });
    s = applyBotEvent(s, { type: "finalize" });
    s = applyBotEvent(s, { type: "service_picked", serviceType: "delivery" });
    expect(s.state).toBe("awaiting_colonia");
  });

  it("confirming + confirm -> idle with created flag", () => {
    let s = applyBotEvent(initialState(), { type: "message", text: "hola" });
    s = applyBotEvent(s, { type: "category_picked", categoryId: "c1" });
    s = applyBotEvent(s, { type: "product_picked", product: { id: "p1", name: "X", basePrice: "10" }, quantity: 1 });
    s = applyBotEvent(s, { type: "confirm_item", removed: [], extras: [] });
    s = applyBotEvent(s, { type: "finalize" });
    s = applyBotEvent(s, { type: "service_picked", serviceType: "local" });
    s = applyBotEvent(s, { type: "confirm_order" });
    expect(s.state).toBe("idle");
    expect(s.payload.created).toBe(true);
  });
});

export type _S = BotState; export type _E = BotEvent;
```

- [ ] **Step 2: Run, verify fails**

- [ ] **Step 3: Implement**

```ts
// src/core/bot/state-machine.ts
export type BotStateName =
  | "idle" | "browsing_category" | "browsing_product" | "customizing_product"
  | "in_cart" | "choosing_service_type" | "awaiting_colonia"
  | "awaiting_address" | "confirming_order";

export type CartItem = {
  productId: string;
  productName: string;
  basePrice: string;
  quantity: number;
  removed: string[];
  extras: { name: string; price: string }[];
};

export type BotPayload = {
  categoryId?: string;
  productDraft?: { id: string; name: string; basePrice: string; quantity: number };
  cart?: CartItem[];
  serviceType?: "local" | "delivery";
  coloniaId?: string;
  address?: string;
  created?: boolean;
};

export type BotState = { state: BotStateName; payload: BotPayload };

export function initialState(): BotState {
  return { state: "idle", payload: {} };
}

export type BotEvent =
  | { type: "message"; text: string }
  | { type: "category_picked"; categoryId: string }
  | { type: "product_picked"; product: { id: string; name: string; basePrice: string }; quantity: number }
  | { type: "confirm_item"; removed: string[]; extras: { name: string; price: string }[] }
  | { type: "add_more" }
  | { type: "finalize" }
  | { type: "service_picked"; serviceType: "local" | "delivery" }
  | { type: "colonia_picked"; coloniaId: string }
  | { type: "address_typed"; address: string }
  | { type: "confirm_order" };

export function applyBotEvent(s: BotState, ev: BotEvent): BotState {
  switch (s.state) {
    case "idle":
      if (ev.type === "message") return { state: "browsing_category", payload: {} };
      return s;
    case "browsing_category":
      if (ev.type === "category_picked") {
        return { state: "browsing_product", payload: { ...s.payload, categoryId: ev.categoryId } };
      }
      return s;
    case "browsing_product":
      if (ev.type === "product_picked") {
        return {
          state: "customizing_product",
          payload: { ...s.payload, productDraft: { ...ev.product, quantity: ev.quantity } },
        };
      }
      return s;
    case "customizing_product": {
      if (ev.type === "confirm_item" && s.payload.productDraft) {
        const draft = s.payload.productDraft;
        const newItem: CartItem = {
          productId: draft.id, productName: draft.name, basePrice: draft.basePrice,
          quantity: draft.quantity, removed: ev.removed, extras: ev.extras,
        };
        const cart = [...(s.payload.cart ?? []), newItem];
        return { state: "in_cart", payload: { ...s.payload, cart, productDraft: undefined } };
      }
      return s;
    }
    case "in_cart":
      if (ev.type === "add_more") return { state: "browsing_category", payload: { ...s.payload, productDraft: undefined } };
      if (ev.type === "finalize") return { state: "choosing_service_type", payload: s.payload };
      return s;
    case "choosing_service_type":
      if (ev.type === "service_picked") {
        if (ev.serviceType === "local") {
          return { state: "confirming_order", payload: { ...s.payload, serviceType: "local" } };
        }
        return { state: "awaiting_colonia", payload: { ...s.payload, serviceType: "delivery" } };
      }
      return s;
    case "awaiting_colonia":
      if (ev.type === "colonia_picked") {
        return { state: "awaiting_address", payload: { ...s.payload, coloniaId: ev.coloniaId } };
      }
      return s;
    case "awaiting_address":
      if (ev.type === "address_typed") {
        return { state: "confirming_order", payload: { ...s.payload, address: ev.address } };
      }
      return s;
    case "confirming_order":
      if (ev.type === "confirm_order") {
        return { state: "idle", payload: { ...s.payload, created: true } };
      }
      return s;
  }
}
```

- [ ] **Step 4: Run, verify passes**

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat(core): WhatsApp bot state machine"
```

---

# Phase 3: Auth

## Task 3.1: Password verification

**Files:**
- Create: `src/infra/auth/password.ts`
- Test: `src/infra/auth/password.test.ts`

- [ ] **Step 1: Install bcryptjs**

```bash
pnpm add bcryptjs
pnpm add -D @types/bcryptjs
```

- [ ] **Step 2: Write failing test**

```ts
// src/infra/auth/password.test.ts
import { describe, it, expect } from "vitest";
import bcrypt from "bcryptjs";
import { verifyPassword } from "./password";

describe("verifyPassword", () => {
  it("returns true for correct password", async () => {
    const hash = await bcrypt.hash("test", 10);
    expect(await verifyPassword("test", hash)).toBe(true);
  });
  it("returns false for wrong password", async () => {
    const hash = await bcrypt.hash("test", 10);
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });
});
```

- [ ] **Step 3: Run, verify fails**

- [ ] **Step 4: Implement**

```ts
// src/infra/auth/password.ts
import bcrypt from "bcryptjs";

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
```

- [ ] **Step 5: Run, verify passes**

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "feat(auth): password verification with bcrypt"
```

---

## Task 3.2: Session tokens

**Files:**
- Create: `src/infra/auth/session.ts`
- Test: `src/infra/auth/session.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/infra/auth/session.test.ts
import { describe, it, expect } from "vitest";
import { createSessionToken, verifyToken, SESSION_COOKIE } from "./session";

describe("session", () => {
  it("creates a verifiable token", () => {
    const t = createSessionToken("secret");
    expect(verifyToken(t, "secret")).toBe(true);
  });
  it("rejects wrong secret", () => {
    const t = createSessionToken("secret");
    expect(verifyToken(t, "wrong")).toBe(false);
  });
  it("rejects tampered token", () => {
    const t = createSessionToken("secret");
    const tampered = t.slice(0, -1) + "X";
    expect(verifyToken(tampered, "secret")).toBe(false);
  });
  it("rejects malformed token", () => {
    expect(verifyToken("not-a-token", "secret")).toBe(false);
  });
});

export const _C = SESSION_COOKIE;
```

- [ ] **Step 2: Run, verify fails**

- [ ] **Step 3: Implement**

```ts
// src/infra/auth/session.ts
import crypto from "node:crypto";

export const SESSION_COOKIE = "admin_session";
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function createSessionToken(secret: string): string {
  const expires = Date.now() + TOKEN_TTL_MS;
  const random = crypto.randomBytes(24).toString("base64url");
  const payload = `${random}.${expires}`;
  const sig = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyToken(token: string, secret: string): boolean {
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [random, expiresStr, sig] = parts;
  if (!random || !expiresStr || !sig) return false;
  if (Number(expiresStr) < Date.now()) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${random}.${expiresStr}`).digest("base64url");
  try {
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}

export function parseSessionCookie(cookieHeader: string, secret: string): string {
  const match = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${SESSION_COOKIE}=`));
  if (!match) throw new Error("no session cookie");
  const token = match.substring(SESSION_COOKIE.length + 1);
  if (!verifyToken(token, secret)) throw new Error("invalid session");
  return token;
}
```

- [ ] **Step 4: Run, verify passes**

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat(auth): HMAC-signed session tokens"
```

---

## Task 3.3: Login API route

**Files:**
- Create: `src/app/api/admin/login/route.ts`

- [ ] **Step 1: Implement login endpoint**

```ts
// src/app/api/admin/login/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getEnv } from "@/env";
import { verifyPassword } from "@/infra/auth/password";
import { createSessionToken, SESSION_COOKIE } from "@/infra/auth/session";
import { getDb } from "@/db";
import { adminSessions } from "@/schema";

export async function POST(req: NextRequest) {
  const env = getEnv();
  const { password } = await req.json();
  if (typeof password !== "string") {
    return NextResponse.json({ ok: false, error: { code: "bad_input", message: "Falta contraseña" } }, { status: 400 });
  }
  const ok = await verifyPassword(password, env.ADMIN_PASSWORD_HASH);
  if (!ok) {
    return NextResponse.json({ ok: false, error: { code: "unauthorized", message: "Contraseña incorrecta" } }, { status: 401 });
  }
  const token = createSessionToken(env.SESSION_SECRET);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const db = getDb();
  await db.insert(adminSessions).values({ token, expiresAt });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true, sameSite: "lax",
    secure: env.NODE_ENV === "production",
    expires: expiresAt, path: "/",
  });
  return res;
}
```

- [ ] **Step 2: Commit**

```bash
git add .
git commit -m "feat(auth): login API route"
```

---

## Task 3.4: Auth middleware

**Files:**
- Create: `src/middleware.ts`

- [ ] **Step 1: Implement middleware**

```ts
// src/middleware.ts
import { NextRequest, NextResponse } from "next/server";
import { getEnv } from "@/env";
import { parseSessionCookie } from "@/infra/auth/session";

const PROTECTED_PREFIXES = ["/admin", "/api/admin", "/api/orders", "/api/menu", "/api/delivery-zones", "/api/events"];
const PUBLIC_PATHS = ["/login", "/api/admin/login", "/api/webhooks/whatsapp"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (!isProtected) return NextResponse.next();
  const env = getEnv();
  const cookie = req.headers.get("cookie") ?? "";
  try {
    parseSessionCookie(cookie, env.SESSION_SECRET);
    return NextResponse.next();
  } catch {
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ ok: false, error: { code: "unauthorized", message: "No autenticado" } }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*", "/api/orders/:path*", "/api/menu/:path*", "/api/delivery-zones/:path*", "/api/events"],
};
```

- [ ] **Step 2: Commit**

```bash
git add .
git commit -m "feat(auth): middleware protecting admin routes"
```

---

## Task 3.5: Login page

**Files:**
- Create: `src/app/login/page.tsx`

- [ ] **Step 1: Implement login page**

```tsx
// src/app/login/page.tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      router.push("/admin/orders");
    } else {
      const data = await res.json();
      setError(data.error.message);
    }
    setLoading(false);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <form onSubmit={onSubmit} className="w-80 space-y-4 rounded bg-white p-6 shadow">
        <h1 className="text-xl font-bold">Acceso al sistema</h1>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Contraseña"
          className="w-full rounded border px-3 py-2"
          autoFocus
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={loading} className="w-full rounded bg-black py-2 text-white disabled:opacity-50">
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add .
git commit -m "feat(auth): login page"
```

---

# Phase 4: Menu CRUD

## Task 4.1: Menu repository (categories + products)

**Files:**
- Create: `src/infra/db/menu-repository.ts`

- [ ] **Step 1: Implement**

```ts
// src/infra/db/menu-repository.ts
import { eq, asc } from "drizzle-orm";
import { getDb } from "@/db";
import { categories, products, type Category, type Product } from "@/schema";

export async function listCategories(activeOnly = false): Promise<Category[]> {
  const db = getDb();
  return activeOnly
    ? await db.select().from(categories).where(eq(categories.active, true)).orderBy(asc(categories.sortOrder), asc(categories.name))
    : await db.select().from(categories).orderBy(asc(categories.sortOrder), asc(categories.name));
}

export async function createCategory(input: { name: string; sortOrder?: number }): Promise<Category> {
  const db = getDb();
  const slug = input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const [row] = await db.insert(categories).values({ name: input.name, slug, sortOrder: input.sortOrder ?? 0 }).returning();
  return row;
}

export async function updateCategory(id: string, patch: Partial<Pick<Category, "name" | "sortOrder" | "active">>): Promise<Category> {
  const db = getDb();
  const [row] = await db.update(categories).set({ ...patch, updatedAt: new Date() }).where(eq(categories.id, id)).returning();
  return row;
}

export async function deleteCategory(id: string): Promise<void> {
  const db = getDb();
  await db.delete(categories).where(eq(categories.id, id));
}

export async function listAllProducts(activeOnly = false): Promise<Product[]> {
  const db = getDb();
  return activeOnly
    ? await db.select().from(products).where(eq(products.active, true))
    : await db.select().from(products);
}

export async function getProduct(id: string): Promise<Product | null> {
  const db = getDb();
  const [row] = await db.select().from(products).where(eq(products.id, id));
  return row ?? null;
}

export async function createProduct(input: { categoryId: string; name: string; basePrice: string; description?: string }): Promise<Product> {
  const db = getDb();
  const [row] = await db.insert(products).values({
    categoryId: input.categoryId, name: input.name, basePrice: input.basePrice, description: input.description ?? "",
  }).returning();
  return row;
}

export async function updateProduct(id: string, patch: Partial<Pick<Product, "name" | "basePrice" | "description" | "active" | "sortOrder" | "categoryId">>): Promise<Product> {
  const db = getDb();
  const [row] = await db.update(products).set({ ...patch, updatedAt: new Date() }).where(eq(products.id, id)).returning();
  return row;
}

export async function deleteProduct(id: string): Promise<void> {
  const db = getDb();
  await db.delete(products).where(eq(products.id, id));
}
```

- [ ] **Step 2: Commit**

```bash
git add .
git commit -m "feat(db): menu repository"
```

---

## Task 4.2: Categories API

**Files:**
- Create: `src/app/api/menu/categories/route.ts`
- Create: `src/app/api/menu/categories/[id]/route.ts`

- [ ] **Step 1: List and create**

```ts
// src/app/api/menu/categories/route.ts
import { NextResponse } from "next/server";
import { listCategories, createCategory } from "@/infra/db/menu-repository";

export async function GET() {
  const rows = await listCategories();
  return NextResponse.json({ ok: true, data: rows });
}

export async function POST(req: Request) {
  const body = await req.json();
  if (!body.name) return NextResponse.json({ ok: false, error: { message: "Falta nombre" } }, { status: 400 });
  const row = await createCategory({ name: body.name, sortOrder: body.sortOrder ?? 0 });
  return NextResponse.json({ ok: true, data: row });
}
```

- [ ] **Step 2: Update and delete**

```ts
// src/app/api/menu/categories/[id]/route.ts
import { NextResponse } from "next/server";
import { updateCategory, deleteCategory } from "@/infra/db/menu-repository";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const row = await updateCategory(id, body);
  return NextResponse.json({ ok: true, data: row });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await deleteCategory(id);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Commit**

```bash
git add .
git commit -m "feat(api): categories CRUD"
```

---

## Task 4.3: Products API

**Files:**
- Create: `src/app/api/menu/products/route.ts`
- Create: `src/app/api/menu/products/[id]/route.ts`

- [ ] **Step 1: List and create**

```ts
// src/app/api/menu/products/route.ts
import { NextRequest, NextResponse } from "next/server";
import { listAllProducts, createProduct } from "@/infra/db/menu-repository";

export async function GET(req: NextRequest) {
  const activeOnly = req.nextUrl.searchParams.get("active") === "true";
  const rows = await listAllProducts(activeOnly);
  return NextResponse.json({ ok: true, data: rows });
}

export async function POST(req: Request) {
  const body = await req.json();
  if (!body.categoryId || !body.name || !body.basePrice) {
    return NextResponse.json({ ok: false, error: { message: "Faltan campos" } }, { status: 400 });
  }
  const row = await createProduct(body);
  return NextResponse.json({ ok: true, data: row });
}
```

- [ ] **Step 2: Detail, update, delete**

```ts
// src/app/api/menu/products/[id]/route.ts
import { NextResponse } from "next/server";
import { getProduct, updateProduct, deleteProduct } from "@/infra/db/menu-repository";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = await getProduct(id);
  if (!row) return NextResponse.json({ ok: false, error: { message: "No existe" } }, { status: 404 });
  return NextResponse.json({ ok: true, data: row });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const row = await updateProduct(id, body);
  return NextResponse.json({ ok: true, data: row });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await deleteProduct(id);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Commit**

```bash
git add .
git commit -m "feat(api): products CRUD with available toggle"
```

---

## Task 4.4: Categories admin page

**Files:**
- Create: `src/app/(admin)/menu/categories/page.tsx`

- [ ] **Step 1: Implement**

```tsx
// src/app/(admin)/menu/categories/page.tsx
"use client";
import { useEffect, useState } from "react";

type Category = { id: string; name: string; slug: string; sortOrder: number; active: boolean };

export default function CategoriesPage() {
  const [items, setItems] = useState<Category[]>([]);
  const [name, setName] = useState("");

  async function load() {
    const r = await fetch("/api/menu/categories");
    const d = await r.json();
    setItems(d.data);
  }
  useEffect(() => { load(); }, []);

  async function add() {
    if (!name.trim()) return;
    await fetch("/api/menu/categories", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name }),
    });
    setName("");
    load();
  }

  async function toggle(c: Category) {
    await fetch(`/api/menu/categories/${c.id}`, {
      method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ active: !c.active }),
    });
    load();
  }

  async function remove(id: string) {
    if (!confirm("¿Eliminar?")) return;
    await fetch(`/api/menu/categories/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="p-6">
      <h1 className="mb-4 text-2xl font-bold">Categorías</h1>
      <div className="mb-4 flex gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nueva categoría" className="rounded border px-3 py-2" />
        <button onClick={add} className="rounded bg-black px-4 py-2 text-white">Agregar</button>
      </div>
      <ul className="divide-y rounded border bg-white">
        {items.map((c) => (
          <li key={c.id} className="flex items-center justify-between p-3">
            <span className={c.active ? "" : "text-gray-400 line-through"}>{c.name}</span>
            <div className="flex gap-2">
              <button onClick={() => toggle(c)} className="text-sm text-blue-600">{c.active ? "Desactivar" : "Activar"}</button>
              <button onClick={() => remove(c.id)} className="text-sm text-red-600">Eliminar</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add .
git commit -m "feat(admin): categories admin page"
```

---

## Task 4.5: Products list and detail

**Files:**
- Create: `src/app/(admin)/menu/page.tsx`
- Create: `src/app/(admin)/menu/products/[id]/page.tsx`

- [ ] **Step 1: Products list with toggle**

```tsx
// src/app/(admin)/menu/page.tsx
"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

type Product = { id: string; categoryId: string; name: string; basePrice: string; active: boolean };
type Category = { id: string; name: string };

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cats, setCats] = useState<Category[]>([]);

  async function load() {
    const [p, c] = await Promise.all([
      fetch("/api/menu/products").then((r) => r.json()),
      fetch("/api/menu/categories").then((r) => r.json()),
    ]);
    setProducts(p.data);
    setCats(c.data);
  }
  useEffect(() => { load(); }, []);

  async function toggle(p: Product) {
    await fetch(`/api/menu/products/${p.id}`, {
      method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ active: !p.active }),
    });
    load();
  }

  return (
    <div className="p-6">
      <h1 className="mb-4 text-2xl font-bold">Productos</h1>
      {cats.map((cat) => (
        <section key={cat.id} className="mb-6">
          <h2 className="mb-2 text-lg font-semibold">{cat.name}</h2>
          <ul className="divide-y rounded border bg-white">
            {products.filter((p) => p.categoryId === cat.id).map((p) => (
              <li key={p.id} className="flex items-center justify-between p-3">
                <Link href={`/menu/products/${p.id}`} className="flex-1">{p.name} — ${p.basePrice}</Link>
                <button
                  onClick={() => toggle(p)}
                  className={`rounded px-3 py-1 text-xs ${p.active ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-600"}`}
                >{p.active ? "DISPONIBLE" : "AGOTADO"}</button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Product detail editor**

```tsx
// src/app/(admin)/menu/products/[id]/page.tsx
"use client";
import { useEffect, useState } from "react";

type Product = { id: string; name: string; basePrice: string; description: string; active: boolean };

export default function ProductDetail({ params }: { params: Promise<{ id: string }> }) {
  const [p, setP] = useState<Product | null>(null);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [desc, setDesc] = useState("");

  useEffect(() => {
    params.then(({ id }) => {
      fetch(`/api/menu/products/${id}`).then((r) => r.json()).then((d) => {
        setP(d.data); setName(d.data.name); setPrice(d.data.basePrice); setDesc(d.data.description);
      });
    });
  }, [params]);

  async function save() {
    if (!p) return;
    await fetch(`/api/menu/products/${p.id}`, {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, basePrice: price, description: desc }),
    });
    alert("Guardado");
  }

  if (!p) return <div className="p-6">Cargando...</div>;
  return (
    <div className="max-w-2xl space-y-4 p-6">
      <h1 className="text-2xl font-bold">Editar producto</h1>
      <label className="block">
        <span className="text-sm">Nombre</span>
        <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded border px-3 py-2" />
      </label>
      <label className="block">
        <span className="text-sm">Precio base</span>
        <input value={price} onChange={(e) => setPrice(e.target.value)} className="w-full rounded border px-3 py-2" />
      </label>
      <label className="block">
        <span className="text-sm">Descripción</span>
        <textarea value={desc} onChange={(e) => setDesc(e.target.value)} className="w-full rounded border px-3 py-2" />
      </label>
      <button onClick={save} className="rounded bg-black px-4 py-2 text-white">Guardar</button>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add .
git commit -m "feat(admin): products list with toggle and detail editor"
```

---

# Phase 5: Order capture

## Task 5.1: Order repository

**Files:**
- Create: `src/infra/db/order-repository.ts`

- [ ] **Step 1: Implement**

```ts
// src/infra/db/order-repository.ts
import { desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { orders, orderItems, orderEvents, type Order, type OrderItem, type OrderStatus } from "@/schema";

export async function nextSequentialNumber(): Promise<number> {
  const db = getDb();
  const result = await db.execute<{ next: number }>(sql`SELECT nextval('orders_sequential_number_seq') as next`);
  const row = (result as any).rows?.[0] ?? (result as any)[0];
  return row?.next ?? 1;
}

export type CreateOrderInput = {
  serviceType: "local" | "delivery";
  customerPhone: string;
  customerName: string;
  deliveryAddress?: string;
  deliveryColoniaId?: string;
  deliveryCostOverride?: string;
  deliveryCost: string;
  subtotal: string;
  total: string;
  source: "whatsapp" | "staff";
  notes: string;
  items: {
    productId: string;
    productNameSnapshot: string;
    basePriceSnapshot: string;
    unitPrice: string;
    quantity: number;
    removedIngredients: string[];
    extraIngredients: { name: string; price: string }[];
    itemTotal: string;
  }[];
};

export async function createOrder(input: CreateOrderInput): Promise<Order> {
  const db = getDb();
  const sequentialNumber = await nextSequentialNumber();
  const [order] = await db.insert(orders).values({
    sequentialNumber, serviceType: input.serviceType, customerPhone: input.customerPhone,
    customerName: input.customerName, deliveryAddress: input.deliveryAddress,
    deliveryColoniaId: input.deliveryColoniaId, deliveryCostOverride: input.deliveryCostOverride,
    deliveryCost: input.deliveryCost, subtotal: input.subtotal, total: input.total,
    source: input.source, notes: input.notes,
  }).returning();
  for (const item of input.items) {
    await db.insert(orderItems).values({ orderId: order.id, ...item });
  }
  await db.insert(orderEvents).values({ orderId: order.id, kind: "created", payload: { source: input.source } });
  return order;
}

export async function listOrders(filter?: { status?: OrderStatus }): Promise<Order[]> {
  const db = getDb();
  return filter?.status
    ? await db.select().from(orders).where(eq(orders.status, filter.status)).orderBy(desc(orders.createdAt))
    : await db.select().from(orders).orderBy(desc(orders.createdAt));
}

export async function getOrder(id: string): Promise<{ order: Order; items: OrderItem[] } | null> {
  const db = getDb();
  const [order] = await db.select().from(orders).where(eq(orders.id, id));
  if (!order) return null;
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, id));
  return { order, items };
}

export async function updateOrderStatus(id: string, status: OrderStatus): Promise<Order> {
  const db = getDb();
  const [order] = await db.update(orders).set({
    status, updatedAt: new Date(),
    deliveredAt: status === "delivered" ? new Date() : undefined,
  }).where(eq(orders.id, id)).returning();
  await db.insert(orderEvents).values({ orderId: id, kind: "status_change", payload: { to: status } });
  return order;
}
```

- [ ] **Step 2: Commit**

```bash
git add .
git commit -m "feat(db): order repository with sequence and items"
```

---

## Task 5.2: Event bus and SSE

**Files:**
- Create: `src/infra/events/event-bus.ts`
- Create: `src/app/api/events/route.ts`

- [ ] **Step 1: In-process event bus**

```ts
// src/infra/events/event-bus.ts
import { EventEmitter } from "node:events";

const emitter = new EventEmitter();
emitter.setMaxListeners(100);

export function emitEvent(kind: string, data: unknown): void {
  emitter.emit(kind, data);
}

export function subscribe(kind: string, listener: (data: unknown) => void): () => void {
  emitter.on(kind, listener);
  return () => emitter.off(kind, listener);
}
```

- [ ] **Step 2: SSE endpoint**

```ts
// src/app/api/events/route.ts
import { subscribe } from "@/infra/events/event-bus";

export const dynamic = "force-dynamic";

export async function GET() {
  const stream = new ReadableStream({
    start(controller) {
      const enc = new TextEncoder();
      const send = (event: string, data: unknown) => {
        controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };
      send("hello", { ts: Date.now() });
      const unsub = subscribe("order_created", (d) => send("order_created", d));
      const ping = setInterval(() => controller.enqueue(enc.encode(": ping\n\n")), 15000);
      const close = () => {
        clearInterval(ping);
        unsub();
        try { controller.close(); } catch {}
      };
      req_signal: { /* sentinel for type system */ }
      // expose cleanup via teardown when client disconnects
      (controller as any)._close = close;
    },
    cancel() {
      const c: any = this;
      c._close?.();
    },
  });
  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add .
git commit -m "feat(events): in-process event bus and SSE endpoint"
```

---

## Task 5.3: Orders API

**Files:**
- Create: `src/app/api/orders/route.ts`
- Create: `src/app/api/orders/[id]/route.ts`
- Create: `src/app/api/orders/[id]/status/route.ts`

- [ ] **Step 1: List and create orders**

```ts
// src/app/api/orders/route.ts
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { createOrder, listOrders } from "@/infra/db/order-repository";
import { validateNewOrder } from "@/core/order/validate";
import { calculateOrderTotals } from "@/core/pricing/calculate-order";
import { getProduct } from "@/infra/db/menu-repository";
import { getDb } from "@/db";
import { colonias, deliveryZones } from "@/schema";
import { emitEvent } from "@/infra/events/event-bus";

export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get("status");
  const rows = await listOrders(status ? { status: status as any } : undefined);
  return NextResponse.json({ ok: true, data: rows });
}

export async function POST(req: Request) {
  const body = await req.json();
  const validation = validateNewOrder(body);
  if (!validation.ok) {
    return NextResponse.json({ ok: false, error: { message: validation.error } }, { status: 400 });
  }
  const items: any[] = [];
  for (const it of body.items) {
    const product = await getProduct(it.productId);
    if (!product || !product.active) {
      return NextResponse.json({ ok: false, error: { message: `Producto no disponible: ${it.productId}` } }, { status: 400 });
    }
    const extras = it.extras ?? [];
    const extrasCost = extras.reduce((s: number, e: any) => s + Number(e.price), 0);
    const unitPrice = (Number(product.basePrice) + extrasCost).toFixed(2);
    const itemTotal = (Number(unitPrice) * it.quantity).toFixed(2);
    items.push({
      productId: product.id, productNameSnapshot: product.name,
      basePriceSnapshot: product.basePrice, unitPrice, quantity: it.quantity,
      removedIngredients: it.removed ?? [], extraIngredients: extras, itemTotal,
    });
  }
  let deliveryCost = "0";
  if (body.serviceType === "delivery") {
    if (body.deliveryCostOverride) {
      deliveryCost = String(body.deliveryCostOverride);
    } else if (body.deliveryColoniaId) {
      const db = getDb();
      const [col] = await db.select({ cost: deliveryZones.cost })
        .from(colonias).innerJoin(deliveryZones, eq(colonias.zoneId, deliveryZones.id))
        .where(eq(colonias.id, body.deliveryColoniaId));
      if (col) deliveryCost = col.cost;
    }
  }
  const totals = calculateOrderTotals({
    items: items.map((i) => ({ basePrice: i.unitPrice, quantity: i.quantity, extras: [] })),
    deliveryCost,
  });
  const order = await createOrder({
    serviceType: body.serviceType, customerPhone: body.customerPhone,
    customerName: body.customerName ?? "", deliveryAddress: body.deliveryAddress,
    deliveryColoniaId: body.deliveryColoniaId, deliveryCostOverride: body.deliveryCostOverride,
    deliveryCost, subtotal: totals.subtotal, total: totals.total,
    source: body.source ?? "staff", notes: body.notes ?? "", items,
  });
  emitEvent("order_created", order);
  return NextResponse.json({ ok: true, data: order });
}
```

- [ ] **Step 2: Detail endpoint**

```ts
// src/app/api/orders/[id]/route.ts
import { NextResponse } from "next/server";
import { getOrder } from "@/infra/db/order-repository";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getOrder(id);
  if (!data) return NextResponse.json({ ok: false, error: { message: "No existe" } }, { status: 404 });
  return NextResponse.json({ ok: true, data });
}
```

- [ ] **Step 3: Status update**

```ts
// src/app/api/orders/[id]/status/route.ts
import { NextResponse } from "next/server";
import { getOrder, updateOrderStatus } from "@/infra/db/order-repository";
import { canTransition } from "@/core/order/state-machine";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { status } = await req.json();
  const data = await getOrder(id);
  if (!data) return NextResponse.json({ ok: false, error: { message: "No existe" } }, { status: 404 });
  if (!canTransition(data.order.status, status)) {
    return NextResponse.json({ ok: false, error: { message: `Transición inválida: ${data.order.status} -> ${status}` } }, { status: 400 });
  }
  const updated = await updateOrderStatus(id, status);
  return NextResponse.json({ ok: true, data: updated });
}
```

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "feat(api): orders CRUD with state transitions"
```

---

## Task 5.4: Admin layout

**Files:**
- Create: `src/app/(admin)/layout.tsx`

- [ ] **Step 1: Implement admin layout**

```tsx
// src/app/(admin)/layout.tsx
import Link from "next/link";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="border-b bg-white px-6 py-3">
        <div className="mx-auto flex max-w-6xl items-center gap-6">
          <span className="font-bold">Restaurante</span>
          <Link href="/admin/orders" className="text-sm hover:underline">Pedidos</Link>
          <Link href="/admin/orders/new" className="text-sm hover:underline">Nuevo</Link>
          <Link href="/admin/menu" className="text-sm hover:underline">Menú</Link>
          <Link href="/admin/menu/categories" className="text-sm hover:underline">Categorías</Link>
          <Link href="/admin/delivery-zones" className="text-sm hover:underline">Zonas</Link>
        </div>
      </nav>
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add .
git commit -m "feat(admin): admin layout with nav"
```

---

## Task 5.5: Orders dashboard with SSE

**Files:**
- Create: `src/app/(admin)/orders/page.tsx`

- [ ] **Step 1: Implement dashboard**

```tsx
// src/app/(admin)/orders/page.tsx
"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

type Order = {
  id: string; sequentialNumber: number; status: string; serviceType: string;
  total: string; createdAt: string;
};

export default function OrdersDashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isNew, setIsNew] = useState<Record<string, boolean>>({});

  async function load() {
    const r = await fetch("/api/orders?status=received");
    const d = await r.json();
    setOrders(d.data);
  }
  useEffect(() => { load(); }, []);

  useEffect(() => {
    const ev = new EventSource("/api/events");
    ev.addEventListener("order_created", (e: MessageEvent) => {
      const o = JSON.parse(e.data);
      setOrders((prev) => [o, ...prev.filter((x) => x.id !== o.id)]);
      setIsNew((prev) => ({ ...prev, [o.id]: true }));
      setTimeout(() => setIsNew((prev) => ({ ...prev, [o.id]: false })), 30000);
    });
    return () => ev.close();
  }, []);

  async function markDelivered(id: string) {
    await fetch(`/api/orders/${id}/status`, {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "delivered" }),
    });
    load();
  }

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Pedidos activos ({orders.length})</h1>
        <Link href="/admin/orders/new" className="rounded bg-black px-4 py-2 text-white">+ Nuevo pedido</Link>
      </div>
      <ul className="space-y-2">
        {orders.map((o) => (
          <li key={o.id} className={`flex items-center justify-between rounded border bg-white p-4 ${isNew[o.id] ? "ring-2 ring-yellow-400" : ""}`}>
            <Link href={`/admin/orders/${o.id}`} className="flex-1">
              <div className="font-bold">#{o.sequentialNumber} <span className="text-sm font-normal text-gray-600">{o.serviceType === "delivery" ? "Domicilio" : "Local"}</span></div>
              <div className="text-sm text-gray-500">{new Date(o.createdAt).toLocaleTimeString()}</div>
            </Link>
            <div className="text-lg font-semibold">${o.total}</div>
            <button onClick={() => markDelivered(o.id)} className="ml-4 rounded bg-green-600 px-3 py-1 text-sm text-white">Entregado</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add .
git commit -m "feat(admin): orders dashboard with live updates"
```

---

## Task 5.6: New order page (staff capture)

**Files:**
- Create: `src/app/(admin)/orders/new/page.tsx`

- [ ] **Step 1: Implement**

```tsx
// src/app/(admin)/orders/new/page.tsx
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Product = { id: string; categoryId: string; name: string; basePrice: string; active: boolean };
type Category = { id: string; name: string };
type CartItem = { productId: string; name: string; basePrice: string; quantity: number; extras: { name: string; price: string }[]; removed: string[] };
type Colonia = { id: string; name: string; zoneId: string; zoneName: string; zoneCost: string };

export default function NewOrderPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [serviceType, setServiceType] = useState<"local" | "delivery">("local");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [colonias, setColonias] = useState<Colonia[]>([]);
  const [coloniaId, setColoniaId] = useState("");
  const [overrideCost, setOverrideCost] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/menu/products?active=true").then((r) => r.json()),
      fetch("/api/menu/categories").then((r) => r.json()),
      fetch("/api/delivery-zones/colonias").then((r) => r.json()).catch(() => ({ data: [] })),
    ]).then(([p, c, co]) => {
      setProducts(p.data);
      setCategories(c.data.filter((x: any) => x.active));
      if (c.data[0]) setActiveCategory(c.data[0].id);
      setColonias(co.data);
    });
  }, []);

  function addToCart(p: Product) {
    setCart((prev) => {
      const idx = prev.findIndex((i) => i.productId === p.id && i.extras.length === 0 && i.removed.length === 0);
      if (idx >= 0) {
        const copy = [...prev];
        const existing = copy[idx];
        if (existing) copy[idx] = { ...existing, quantity: existing.quantity + 1 };
        return copy;
      }
      return [...prev, { productId: p.id, name: p.name, basePrice: p.basePrice, quantity: 1, extras: [], removed: [] }];
    });
  }

  const filteredProducts = products.filter((p) =>
    (!activeCategory || p.categoryId === activeCategory) && p.name.toLowerCase().includes(search.toLowerCase())
  );

  const subtotal = cart.reduce((s, i) => s + Number(i.basePrice) * i.quantity + i.extras.reduce((e, x) => e + Number(x.price), 0) * i.quantity, 0);
  const selectedColonia = colonias.find((c) => c.id === coloniaId);
  const deliveryCost = overrideCost ? Number(overrideCost) : selectedColonia ? Number(selectedColonia.zoneCost) : 0;
  const total = subtotal + deliveryCost;

  async function submit() {
    setError(null);
    if (cart.length === 0) { setError("Agrega productos al carrito"); return; }
    if (!phone.trim()) { setError("Falta teléfono del cliente"); return; }
    if (serviceType === "delivery" && !address.trim()) { setError("Falta dirección de entrega"); return; }
    if (serviceType === "delivery" && !coloniaId && !overrideCost) { setError("Selecciona colonia o captura costo manual"); return; }
    setSubmitting(true);
    const res = await fetch("/api/orders", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({
        serviceType, customerPhone: phone, customerName,
        deliveryAddress: serviceType === "delivery" ? address : undefined,
        deliveryColoniaId: coloniaId || undefined,
        deliveryCostOverride: overrideCost || undefined, notes, source: "staff",
        items: cart.map((i) => ({ productId: i.productId, quantity: i.quantity, removed: i.removed, extras: i.extras })),
      }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const d = await res.json();
      setError(d.error.message);
      return;
    }
    const { data } = await res.json();
    router.push(`/print/${data.id}/kitchen`);
  }

  return (
    <div className="grid h-screen grid-cols-2 gap-4 p-4">
      <div className="overflow-y-auto">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar producto" className="mb-2 w-full rounded border px-3 py-2" />
        <div className="mb-2 flex gap-1 overflow-x-auto">
          {categories.map((c) => (
            <button key={c.id} onClick={() => setActiveCategory(c.id)}
              className={`rounded px-3 py-1 text-sm ${activeCategory === c.id ? "bg-black text-white" : "bg-gray-200"}`}>
              {c.name}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {filteredProducts.map((p) => (
            <button key={p.id} onClick={() => addToCart(p)} className="rounded border bg-white p-3 text-left hover:bg-gray-50">
              <div className="font-semibold">{p.name}</div>
              <div className="text-sm text-gray-600">${p.basePrice}</div>
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-col overflow-y-auto rounded border bg-white p-4">
        <h2 className="mb-2 text-lg font-bold">Carrito</h2>
        <ul className="mb-4 flex-1 divide-y">
          {cart.map((i, idx) => (
            <li key={idx} className="flex items-center justify-between py-2">
              <span>{i.quantity}x {i.name}</span>
              <span>${(Number(i.basePrice) * i.quantity).toFixed(2)}</span>
              <button onClick={() => setCart(cart.filter((_, j) => j !== idx))} className="text-xs text-red-600">Quitar</button>
            </li>
          ))}
        </ul>
        <div className="space-y-2 border-t pt-3">
          <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Nombre cliente" className="w-full rounded border px-3 py-2" />
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Teléfono *" className="w-full rounded border px-3 py-2" />
          <div className="flex gap-2">
            <label className="flex-1"><input type="radio" checked={serviceType === "local"} onChange={() => setServiceType("local")} /> Local</label>
            <label className="flex-1"><input type="radio" checked={serviceType === "delivery"} onChange={() => setServiceType("delivery")} /> Domicilio</label>
          </div>
          {serviceType === "delivery" && (
            <>
              <textarea value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Dirección completa *" className="w-full rounded border px-3 py-2" rows={2} />
              <select value={coloniaId} onChange={(e) => setColoniaId(e.target.value)} className="w-full rounded border px-3 py-2">
                <option value="">— Seleccionar colonia —</option>
                {colonias.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.zoneName} · ${c.zoneCost})</option>)}
              </select>
              <input value={overrideCost} onChange={(e) => setOverrideCost(e.target.value)} placeholder="Costo envío manual (10-30)" type="number" min={10} max={30} step={0.5} className="w-full rounded border px-3 py-2" />
            </>
          )}
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas" className="w-full rounded border px-3 py-2" rows={2} />
          <div className="text-right text-sm">Subtotal: ${subtotal.toFixed(2)}</div>
          {deliveryCost > 0 && <div className="text-right text-sm">Envío: ${deliveryCost.toFixed(2)}</div>}
          <div className="text-right text-xl font-bold">Total: ${total.toFixed(2)}</div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button onClick={submit} disabled={submitting} className="w-full rounded bg-green-600 py-3 text-white disabled:opacity-50">
            {submitting ? "Creando..." : "Finalizar pedido"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add .
git commit -m "feat(admin): staff order capture page"
```

---

## Task 5.7: Order detail page

**Files:**
- Create: `src/app/(admin)/orders/[id]/page.tsx`

- [ ] **Step 1: Implement**

```tsx
// src/app/(admin)/orders/[id]/page.tsx
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Data = {
  order: { id: string; sequentialNumber: number; status: string; serviceType: string; subtotal: string; deliveryCost: string; total: string; createdAt: string; customerName: string; customerPhone: string; deliveryAddress?: string; notes: string };
  items: { id: string; quantity: number; productNameSnapshot: string; unitPrice: string; itemTotal: string; removedIngredients: string[]; extraIngredients: { name: string; price: string }[] }[];
};

export default function OrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [d, setD] = useState<Data | null>(null);

  useEffect(() => {
    params.then(({ id }) => {
      fetch(`/api/orders/${id}`).then((r) => r.json()).then((res) => setD(res.data));
    });
  }, [params]);

  async function delivered() {
    if (!d) return;
    await fetch(`/api/orders/${d.order.id}/status`, {
      method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: "delivered" }),
    });
    router.push("/admin/orders");
  }

  if (!d) return <div className="p-6">Cargando...</div>;
  return (
    <div className="mx-auto max-w-2xl space-y-4 p-6">
      <h1 className="text-2xl font-bold">Pedido #{d.order.sequentialNumber}</h1>
      <div className="rounded border bg-white p-4">
        <p><b>Estado:</b> {d.order.status}</p>
        <p><b>Tipo:</b> {d.order.serviceType === "delivery" ? "Domicilio" : "Local"}</p>
        <p><b>Cliente:</b> {d.order.customerName || "—"} · {d.order.customerPhone}</p>
        {d.order.deliveryAddress && <p><b>Dirección:</b> {d.order.deliveryAddress}</p>}
        {d.order.notes && <p><b>Notas:</b> {d.order.notes}</p>}
        <p className="text-sm text-gray-500">{new Date(d.order.createdAt).toLocaleString()}</p>
      </div>
      <ul className="divide-y rounded border bg-white">
        {d.items.map((it) => (
          <li key={it.id} className="p-3">
            <div className="flex justify-between">
              <span>{it.quantity}x {it.productNameSnapshot}</span>
              <span>${it.itemTotal}</span>
            </div>
            {it.removedIngredients.map((r) => <div key={r} className="pl-3 text-xs text-gray-500">- sin {r}</div>)}
            {it.extraIngredients.map((e) => <div key={e.name} className="pl-3 text-xs text-gray-500">+ {e.name} (${e.price})</div>)}
          </li>
        ))}
      </ul>
      <div className="rounded border bg-white p-4 text-right">
        <p>Subtotal: ${d.order.subtotal}</p>
        <p>Envío: ${d.order.deliveryCost}</p>
        <p className="text-xl font-bold">Total: ${d.order.total}</p>
      </div>
      <div className="flex gap-2">
        <a href={`/print/${d.order.id}/kitchen`} target="_blank" rel="noreferrer" className="flex-1 rounded bg-gray-800 py-2 text-center text-white">Reimprimir comanda</a>
        <a href={`/print/${d.order.id}/bill`} target="_blank" rel="noreferrer" className="flex-1 rounded bg-gray-800 py-2 text-center text-white">Reimprimir cuenta</a>
      </div>
      {d.order.status === "received" && (
        <button onClick={delivered} className="w-full rounded bg-green-600 py-2 text-white">Marcar como entregado</button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add .
git commit -m "feat(admin): order detail page with reprint actions"
```

---

# Phase 6: Printing

## Task 6.1: Print event endpoints

**Files:**
- Create: `src/app/api/orders/[id]/print-kitchen/route.ts`
- Create: `src/app/api/orders/[id]/print-bill/route.ts`

- [ ] **Step 1: Kitchen print endpoint**

```ts
// src/app/api/orders/[id]/print-kitchen/route.ts
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { orderEvents } from "@/schema";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  await db.insert(orderEvents).values({ orderId: id, kind: "printed_kitchen", payload: {} });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Bill print endpoint**

```ts
// src/app/api/orders/[id]/print-bill/route.ts
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { orderEvents } from "@/schema";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  await db.insert(orderEvents).values({ orderId: id, kind: "printed_bill", payload: {} });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Commit**

```bash
git add .
git commit -m "feat(print): log print events"
```

---

## Task 6.2: Kitchen print template (no prices)

**Files:**
- Create: `src/app/print/[id]/kitchen/page.tsx`

- [ ] **Step 1: Implement**

```tsx
// src/app/print/[id]/kitchen/page.tsx
"use client";
import { useEffect, useState } from "react";

type Data = {
  order: { sequentialNumber: number; serviceType: string; notes: string; createdAt: string };
  items: { quantity: number; productNameSnapshot: string; removedIngredients: string[]; extraIngredients: { name: string }[] }[];
};

export default function KitchenPrint({ params }: { params: Promise<{ id: string }> }) {
  const [data, setData] = useState<Data | null>(null);

  useEffect(() => {
    params.then(({ id }) => {
      fetch(`/api/orders/${id}`).then((r) => r.json()).then((d) => {
        setData(d.data);
        fetch(`/api/orders/${id}/print-kitchen`, { method: "POST" });
        setTimeout(() => window.print(), 500);
      });
    });
  }, [params]);

  if (!data) return <div>Cargando...</div>;
  return (
    <div className="p-2 font-mono text-sm">
      <div className="border-b-2 border-dashed pb-1 text-center font-bold">
        {data.order.serviceType === "delivery" ? "DOMICILIO" : "LOCAL"}
      </div>
      <div className="text-center">PEDIDO #{data.order.sequentialNumber}</div>
      <div className="text-center text-xs">{new Date(data.order.createdAt).toLocaleString()}</div>
      <div className="my-2 border-t-2 border-dashed" />
      {data.items.map((i, idx) => (
        <div key={idx} className="mb-2">
          <div className="font-bold">{i.quantity}x {i.productNameSnapshot}</div>
          {i.removedIngredients.map((r) => <div key={r} className="pl-3 text-xs">- sin {r}</div>)}
          {i.extraIngredients.map((e) => <div key={e.name} className="pl-3 text-xs">+ extra {e.name}</div>)}
        </div>
      ))}
      {data.order.notes && (
        <>
          <div className="my-2 border-t border-dashed" />
          <div className="text-xs">NOTAS: {data.order.notes}</div>
        </>
      )}
      <style>{`@page { size: 80mm auto; margin: 0 } @media print { body { width: 80mm } }`}</style>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add .
git commit -m "feat(print): kitchen ticket template"
```

---

## Task 6.3: Bill print template (with prices)

**Files:**
- Create: `src/app/print/[id]/bill/page.tsx`

- [ ] **Step 1: Implement**

```tsx
// src/app/print/[id]/bill/page.tsx
"use client";
import { useEffect, useState } from "react";

type Data = {
  order: { sequentialNumber: number; serviceType: string; deliveryAddress?: string; deliveryColoniaName?: string; subtotal: string; deliveryCost: string; total: string; createdAt: string };
  items: { quantity: number; productNameSnapshot: string; itemTotal: string; extraIngredients: { name: string; price: string }[] }[];
};

export default function BillPrint({ params }: { params: Promise<{ id: string }> }) {
  const [data, setData] = useState<Data | null>(null);
  const [biz, setBiz] = useState({ name: "Mi Restaurante", address: "", phone: "" });

  useEffect(() => {
    setBiz({
      name: process.env.NEXT_PUBLIC_BUSINESS_NAME ?? "Mi Restaurante",
      address: process.env.NEXT_PUBLIC_BUSINESS_ADDRESS ?? "",
      phone: process.env.NEXT_PUBLIC_BUSINESS_PHONE ?? "",
    });
    params.then(({ id }) => {
      fetch(`/api/orders/${id}`).then((r) => r.json()).then((d) => {
        setData(d.data);
        fetch(`/api/orders/${id}/print-bill`, { method: "POST" });
        setTimeout(() => window.print(), 500);
      });
    });
  }, [params]);

  if (!data) return <div>Cargando...</div>;
  return (
    <div className="p-2 font-mono text-sm">
      <div className="text-center font-bold">{biz.name}</div>
      {biz.address && <div className="text-center text-xs">{biz.address}</div>}
      {biz.phone && <div className="text-center text-xs">{biz.phone}</div>}
      <div className="my-2 border-t-2 border-dashed" />
      <div>{data.order.serviceType === "delivery" ? "DOMICILIO" : "LOCAL"}</div>
      <div>PEDIDO #{data.order.sequentialNumber}</div>
      <div className="text-xs">{new Date(data.order.createdAt).toLocaleString()}</div>
      {data.order.deliveryAddress && <div className="mt-1 text-xs">{data.order.deliveryAddress}</div>}
      <div className="my-2 border-t border-dashed" />
      {data.items.map((i, idx) => (
        <div key={idx} className="mb-1">
          <div className="flex justify-between">
            <span>{i.quantity} {i.productNameSnapshot}</span>
            <span>${i.itemTotal}</span>
          </div>
          {i.extraIngredients.map((e) => (
            <div key={e.name} className="flex justify-between pl-3 text-xs">
              <span>+ {e.name}</span>
              <span>${e.price}</span>
            </div>
          ))}
        </div>
      ))}
      <div className="my-2 border-t border-dashed" />
      <div className="flex justify-between"><span>SUBTOTAL</span><span>${data.order.subtotal}</span></div>
      <div className="flex justify-between"><span>ENVIO</span><span>${data.order.deliveryCost}</span></div>
      <div className="flex justify-between font-bold"><span>TOTAL</span><span>${data.order.total}</span></div>
      <style>{`@page { size: 80mm auto; margin: 0 } @media print { body { width: 80mm } }`}</style>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add .
git commit -m "feat(print): bill ticket template with prices"
```

Note: To expose business info to the client, also add to `.env.example`:

```
NEXT_PUBLIC_BUSINESS_NAME=
NEXT_PUBLIC_BUSINESS_ADDRESS=
NEXT_PUBLIC_BUSINESS_PHONE=
```

---

# Phase 7: Delivery zones

## Task 7.1: Delivery repository

**Files:**
- Create: `src/infra/db/delivery-repository.ts`

- [ ] **Step 1: Implement**

```ts
// src/infra/db/delivery-repository.ts
import { eq, asc } from "drizzle-orm";
import { getDb } from "@/db";
import { deliveryZones, colonias, type DeliveryZone, type Colonia } from "@/schema";

export async function listZones(activeOnly = false): Promise<DeliveryZone[]> {
  const db = getDb();
  return activeOnly
    ? await db.select().from(deliveryZones).where(eq(deliveryZones.active, true)).orderBy(asc(deliveryZones.sortOrder))
    : await db.select().from(deliveryZones).orderBy(asc(deliveryZones.sortOrder));
}

export async function createZone(input: { name: string; cost: string }): Promise<DeliveryZone> {
  const db = getDb();
  const [row] = await db.insert(deliveryZones).values(input).returning();
  return row;
}

export async function updateZone(id: string, patch: Partial<Pick<DeliveryZone, "name" | "cost" | "active" | "sortOrder">>): Promise<DeliveryZone> {
  const db = getDb();
  const [row] = await db.update(deliveryZones).set(patch).where(eq(deliveryZones.id, id)).returning();
  return row;
}

export async function deleteZone(id: string): Promise<void> {
  const db = getDb();
  await db.delete(deliveryZones).where(eq(deliveryZones.id, id));
}

export type ColoniaWithZone = Colonia & { zoneName: string; zoneCost: string };

export async function listColoniasWithZone(): Promise<ColoniaWithZone[]> {
  const db = getDb();
  return db.select({
    id: colonias.id, name: colonias.name, zoneId: colonias.zoneId, active: colonias.active,
    zoneName: deliveryZones.name, zoneCost: deliveryZones.cost,
  }).from(colonias).innerJoin(deliveryZones, eq(colonias.zoneId, deliveryZones.id));
}

export async function createColonia(input: { name: string; zoneId: string }): Promise<Colonia> {
  const db = getDb();
  const [row] = await db.insert(colonias).values(input).returning();
  return row;
}

export async function updateColonia(id: string, patch: Partial<Pick<Colonia, "name" | "active">>): Promise<Colonia> {
  const db = getDb();
  const [row] = await db.update(colonias).set(patch).where(eq(colonias.id, id)).returning();
  return row;
}

export async function deleteColonia(id: string): Promise<void> {
  const db = getDb();
  await db.delete(colonias).where(eq(colonias.id, id));
}
```

- [ ] **Step 2: Commit**

```bash
git add .
git commit -m "feat(db): delivery repository"
```

---

## Task 7.2: Delivery zones API

**Files:**
- Create: `src/app/api/delivery-zones/route.ts`
- Create: `src/app/api/delivery-zones/[id]/route.ts`
- Create: `src/app/api/delivery-zones/colonias/route.ts`
- Create: `src/app/api/delivery-zones/colonias/[id]/route.ts`

- [ ] **Step 1: Zones endpoints**

```ts
// src/app/api/delivery-zones/route.ts
import { NextResponse } from "next/server";
import { listZones, createZone } from "@/infra/db/delivery-repository";
import { validateDeliveryCost } from "@/core/delivery/validate-cost";

export async function GET() {
  const rows = await listZones();
  return NextResponse.json({ ok: true, data: rows });
}

export async function POST(req: Request) {
  const body = await req.json();
  if (!body.name) return NextResponse.json({ ok: false, error: { message: "Falta nombre" } }, { status: 400 });
  const v = validateDeliveryCost(String(body.cost));
  if (!v.ok) return NextResponse.json({ ok: false, error: { message: v.error } }, { status: 400 });
  const row = await createZone({ name: body.name, cost: String(body.cost) });
  return NextResponse.json({ ok: true, data: row });
}
```

```ts
// src/app/api/delivery-zones/[id]/route.ts
import { NextResponse } from "next/server";
import { updateZone, deleteZone } from "@/infra/db/delivery-repository";
import { validateDeliveryCost } from "@/core/delivery/validate-cost";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  if (body.cost) {
    const v = validateDeliveryCost(String(body.cost));
    if (!v.ok) return NextResponse.json({ ok: false, error: { message: v.error } }, { status: 400 });
  }
  const row = await updateZone(id, body);
  return NextResponse.json({ ok: true, data: row });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await deleteZone(id);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Colonias endpoints**

```ts
// src/app/api/delivery-zones/colonias/route.ts
import { NextResponse } from "next/server";
import { listColoniasWithZone, createColonia } from "@/infra/db/delivery-repository";

export async function GET() {
  const rows = await listColoniasWithZone();
  return NextResponse.json({ ok: true, data: rows });
}

export async function POST(req: Request) {
  const body = await req.json();
  if (!body.name || !body.zoneId) return NextResponse.json({ ok: false, error: { message: "Faltan campos" } }, { status: 400 });
  const row = await createColonia(body);
  return NextResponse.json({ ok: true, data: row });
}
```

```ts
// src/app/api/delivery-zones/colonias/[id]/route.ts
import { NextResponse } from "next/server";
import { updateColonia, deleteColonia } from "@/infra/db/delivery-repository";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const row = await updateColonia(id, body);
  return NextResponse.json({ ok: true, data: row });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await deleteColonia(id);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Commit**

```bash
git add .
git commit -m "feat(api): delivery zones and colonias CRUD"
```

---

## Task 7.3: Delivery zones admin page

**Files:**
- Create: `src/app/(admin)/delivery-zones/page.tsx`

- [ ] **Step 1: Implement**

```tsx
// src/app/(admin)/delivery-zones/page.tsx
"use client";
import { useEffect, useState } from "react";

type Zone = { id: string; name: string; cost: string; active: boolean };
type Colonia = { id: string; name: string; zoneId: string; active: boolean; zoneName: string; zoneCost: string };

export default function DeliveryZonesPage() {
  const [zones, setZones] = useState<Zone[]>([]);
  const [colonias, setColonias] = useState<Colonia[]>([]);
  const [newZoneName, setNewZoneName] = useState("");
  const [newZoneCost, setNewZoneCost] = useState("");
  const [newColonia, setNewColonia] = useState<{ [zoneId: string]: string }>({});

  async function load() {
    const [z, c] = await Promise.all([
      fetch("/api/delivery-zones").then((r) => r.json()),
      fetch("/api/delivery-zones/colonias").then((r) => r.json()),
    ]);
    setZones(z.data);
    setColonias(c.data);
  }
  useEffect(() => { load(); }, []);

  async function addZone() {
    if (!newZoneName || !newZoneCost) return;
    const r = await fetch("/api/delivery-zones", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: newZoneName, cost: newZoneCost }),
    });
    if (!r.ok) { const d = await r.json(); alert(d.error.message); return; }
    setNewZoneName(""); setNewZoneCost("");
    load();
  }

  async function addColonia(zoneId: string) {
    const name = newColonia[zoneId];
    if (!name) return;
    await fetch("/api/delivery-zones/colonias", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, zoneId }),
    });
    setNewColonia({ ...newColonia, [zoneId]: "" });
    load();
  }

  return (
    <div className="p-6">
      <h1 className="mb-4 text-2xl font-bold">Zonas de entrega</h1>
      <div className="mb-6 flex gap-2">
        <input value={newZoneName} onChange={(e) => setNewZoneName(e.target.value)} placeholder="Nombre zona" className="rounded border px-3 py-2" />
        <input value={newZoneCost} onChange={(e) => setNewZoneCost(e.target.value)} placeholder="Costo (10-30)" type="number" min={10} max={30} className="rounded border px-3 py-2" />
        <button onClick={addZone} className="rounded bg-black px-4 py-2 text-white">+ Zona</button>
      </div>
      {zones.map((z) => (
        <section key={z.id} className="mb-6 rounded border bg-white p-4">
          <h2 className="mb-2 text-lg font-semibold">{z.name} — ${z.cost}</h2>
          <ul className="mb-2 space-y-1">
            {colonias.filter((c) => c.zoneId === z.id).map((c) => (
              <li key={c.id} className="flex justify-between text-sm">
                <span>{c.name}</span>
                <button onClick={async () => { await fetch(`/api/delivery-zones/colonias/${c.id}`, { method: "DELETE" }); load(); }} className="text-xs text-red-600">Eliminar</button>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <input value={newColonia[z.id] ?? ""} onChange={(e) => setNewColonia({ ...newColonia, [z.id]: e.target.value })} placeholder="Nueva colonia" className="flex-1 rounded border px-3 py-1" />
            <button onClick={() => addColonia(z.id)} className="rounded bg-gray-800 px-3 py-1 text-sm text-white">+ Colonia</button>
          </div>
        </section>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add .
git commit -m "feat(admin): delivery zones management page"
```

---

# Phase 8: WhatsApp bot

## Task 8.1: 360dialog client

**Files:**
- Create: `src/infra/whatsapp/client.ts`

- [ ] **Step 1: Implement client**

```ts
// src/infra/whatsapp/client.ts
import { getEnv } from "@/env";

export type InteractiveListSection = {
  title: string;
  rows: { id: string; title: string; description?: string }[];
};

export async function sendText(to: string, text: string): Promise<void> {
  const env = getEnv();
  if (!env.WHATSAPP_BSP_API_KEY) {
    console.log(`[WA mock] to=${to} text=${text}`);
    return;
  }
  const res = await fetch(`${env.WHATSAPP_BSP_URL}/messages`, {
    method: "POST",
    headers: { authorization: env.WHATSAPP_BSP_API_KEY, "content-type": "application/json" },
    body: JSON.stringify({ to, type: "text", text: { body: text } }),
  });
  if (!res.ok) throw new Error(`WhatsApp send failed: ${res.status}`);
}

export async function sendList(to: string, body: { text: string; buttonText: string; sections: InteractiveListSection[] }): Promise<void> {
  const env = getEnv();
  if (!env.WHATSAPP_BSP_API_KEY) {
    console.log(`[WA mock] to=${to} list=${JSON.stringify(body)}`);
    return;
  }
  const res = await fetch(`${env.WHATSAPP_BSP_URL}/messages`, {
    method: "POST",
    headers: { authorization: env.WHATSAPP_BSP_API_KEY, "content-type": "application/json" },
    body: JSON.stringify({
      to, type: "interactive", interactive: {
        type: "list", body: { text: body.text },
        action: { button: body.buttonText, sections: body.sections },
      },
    }),
  });
  if (!res.ok) throw new Error(`WhatsApp send list failed: ${res.status}`);
}

export async function sendButtons(to: string, body: { text: string; buttons: { id: string; title: string }[] }): Promise<void> {
  const env = getEnv();
  if (!env.WHATSAPP_BSP_API_KEY) {
    console.log(`[WA mock] to=${to} buttons=${JSON.stringify(body)}`);
    return;
  }
  const res = await fetch(`${env.WHATSAPP_BSP_URL}/messages`, {
    method: "POST",
    headers: { authorization: env.WHATSAPP_BSP_API_KEY, "content-type": "application/json" },
    body: JSON.stringify({
      to, type: "interactive", interactive: {
        type: "button", body: { text: body.text },
        action: { buttons: body.buttons.map((b) => ({ type: "reply", reply: { id: b.id, title: b.title } })) },
      },
    }),
  });
  if (!res.ok) throw new Error(`WhatsApp send buttons failed: ${res.status}`);
}
```

- [ ] **Step 2: Commit**

```bash
git add .
git commit -m "feat(whatsapp): 360dialog client with text/list/buttons"
```

---

## Task 8.2: Webhook signature verification

**Files:**
- Create: `src/infra/whatsapp/webhook-verify.ts`
- Test: `src/infra/whatsapp/webhook-verify.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// src/infra/whatsapp/webhook-verify.test.ts
import { describe, it, expect } from "vitest";
import crypto from "node:crypto";
import { verifyWebhookSignature } from "./webhook-verify";

describe("verifyWebhookSignature", () => {
  it("accepts a valid signature", () => {
    const secret = "shhh";
    const body = '{"test":1}';
    const sig = crypto.createHmac("sha256", secret).update(body).digest("hex");
    expect(verifyWebhookSignature(body, sig, secret)).toBe(true);
  });
  it("rejects invalid signature", () => {
    expect(verifyWebhookSignature("{}", "wrong", "shhh")).toBe(false);
  });
});
```

- [ ] **Step 2: Run, verify fails**

- [ ] **Step 3: Implement**

```ts
// src/infra/whatsapp/webhook-verify.ts
import crypto from "node:crypto";

export function verifyWebhookSignature(body: string, signature: string, secret: string): boolean {
  const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");
  if (signature.length !== expected.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: Run, verify passes**

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat(whatsapp): webhook signature verification"
```

---

## Task 8.3: Bot build reply logic

**Files:**
- Create: `src/core/bot/build-reply.ts`
- Test: `src/core/bot/build-reply.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/core/bot/build-reply.test.ts
import { describe, it, expect } from "vitest";
import { buildBotReply } from "./build-reply";
import { initialState, type BotState } from "./state-machine";

describe("buildBotReply", () => {
  it("idle sends list and transitions to browsing_category", () => {
    const r = buildBotReply({ state: initialState(), categories: [{ id: "c1", name: "Hamburguesas" }] });
    expect(r.actions.some((a) => a.kind === "sendList")).toBe(true);
    expect(r.newState.state).toBe("browsing_category");
  });
  it("browsing_product sends product list", () => {
    const state: BotState = { state: "browsing_product", payload: { categoryId: "c1" } };
    const r = buildBotReply({ state, products: [{ id: "p1", name: "Sencilla", basePrice: "50" }] });
    expect(r.actions[0]?.kind).toBe("sendList");
  });
  it("customizing_product sends buttons", () => {
    const state: BotState = { state: "customizing_product", payload: { productDraft: { id: "p1", name: "X", basePrice: "50", quantity: 1 } } };
    const r = buildBotReply({ state });
    expect(r.actions[0]?.kind).toBe("sendButtons");
  });
  it("in_cart sends add_more/finalize buttons", () => {
    const state: BotState = { state: "in_cart", payload: { cart: [{ productId: "p1", productName: "X", basePrice: "10", quantity: 1, removed: [], extras: [] }] } };
    const r = buildBotReply({ state });
    expect(r.actions[0]?.kind).toBe("sendButtons");
  });
  it("choosing_service_type sends local/delivery buttons", () => {
    const state: BotState = { state: "choosing_service_type", payload: { cart: [] } };
    const r = buildBotReply({ state });
    expect(r.actions[0]?.kind).toBe("sendButtons");
  });
  it("awaiting_colonia sends list", () => {
    const state: BotState = { state: "awaiting_colonia", payload: { serviceType: "delivery" } };
    const r = buildBotReply({ state, colonias: [{ id: "col1", name: "Centro", zoneName: "Centro", zoneCost: "15" }] });
    expect(r.actions[0]?.kind).toBe("sendList");
  });
  it("confirming_order sends summary + confirm button", () => {
    const state: BotState = {
      state: "confirming_order",
      payload: { cart: [{ productId: "p1", productName: "X", basePrice: "50", quantity: 1, removed: [], extras: [] }], serviceType: "local" },
    };
    const r = buildBotReply({ state });
    expect(r.actions.some((a) => a.kind === "sendButtons")).toBe(true);
  });
});
```

- [ ] **Step 2: Run, verify fails**

- [ ] **Step 3: Implement**

```ts
// src/core/bot/build-reply.ts
import { type BotState } from "./state-machine";

export type ReplyAction =
  | { kind: "sendText"; text: string }
  | { kind: "sendList"; body: { text: string; buttonText: string; sections: { title: string; rows: { id: string; title: string; description?: string }[] }[] } }
  | { kind: "sendButtons"; body: { text: string; buttons: { id: string; title: string }[] } };

export type BotContext = {
  state: BotState;
  categories?: { id: string; name: string }[];
  products?: { id: string; name: string; basePrice: string }[];
  colonias?: { id: string; name: string; zoneName: string; zoneCost: string }[];
  orderSummary?: { sequentialNumber: number; total: string };
  prepTimeMinutes?: number;
};

export type BotReply = { actions: ReplyAction[]; newState: BotState };

export function buildBotReply(ctx: BotContext): BotReply {
  const { state } = ctx;
  switch (state.state) {
    case "idle":
    case "browsing_category": {
      const sections = [{ title: "Menú", rows: (ctx.categories ?? []).map((c) => ({ id: `cat:${c.id}`, title: c.name })) }];
      return {
        actions: [{ kind: "sendList", body: { text: "¿Qué te gustaría ordenar hoy?", buttonText: "Ver menú", sections } }],
        newState: { state: "browsing_category", payload: {} },
      };
    }
    case "browsing_product": {
      const sections = [{
        title: "Productos",
        rows: (ctx.products ?? []).map((p) => ({ id: `prod:${p.id}`, title: `${p.name} - $${p.basePrice}`, description: p.name })),
      }];
      return {
        actions: [{ kind: "sendList", body: { text: "Elige un producto", buttonText: "Elegir", sections } }],
        newState: state,
      };
    }
    case "customizing_product": {
      return {
        actions: [{ kind: "sendButtons", body: { text: "¿Cómo lo preparamos?", buttons: [{ id: "add:ok", title: "Agregar al carrito" }] } }],
        newState: state,
      };
    }
    case "in_cart": {
      const n = state.payload.cart?.length ?? 0;
      return {
        actions: [{
          kind: "sendButtons",
          body: { text: `Tienes ${n} producto(s) en tu carrito.`, buttons: [
            { id: "cart:add_more", title: "Agregar otro" },
            { id: "cart:finalize", title: "Finalizar" },
          ] },
        }],
        newState: state,
      };
    }
    case "choosing_service_type": {
      return {
        actions: [{
          kind: "sendButtons",
          body: { text: "¿Cómo lo recibes?", buttons: [
            { id: "svc:local", title: "En local" },
            { id: "svc:delivery", title: "A domicilio" },
          ] },
        }],
        newState: state,
      };
    }
    case "awaiting_colonia": {
      const sections = [{
        title: "Colonias",
        rows: (ctx.colonias ?? []).map((c) => ({
          id: `col:${c.id}`, title: c.name, description: `${c.zoneName} · envío $${c.zoneCost}`,
        })),
      }];
      return {
        actions: [{ kind: "sendList", body: { text: "¿En qué colonia?", buttonText: "Elegir colonia", sections } }],
        newState: state,
      };
    }
    case "awaiting_address": {
      return {
        actions: [{ kind: "sendText", text: "Escribe tu dirección completa (calle, número, referencias)." }],
        newState: state,
      };
    }
    case "confirming_order": {
      const cart = state.payload.cart ?? [];
      const lines = cart.map((i) => `• ${i.quantity} ${i.productName}`).join("\n");
      const total = (ctx.orderSummary?.total) ?? "—";
      const summary = `${lines}\n\nTotal: $${total}`;
      return {
        actions: [
          { kind: "sendText", text: `Resumen de tu pedido:\n${summary}` },
          { kind: "sendButtons", body: { text: "¿Confirmas?", buttons: [{ id: "ok:confirm", title: "Sí, confirmar" }] } },
        ],
        newState: state,
      };
    }
  }
}
```

- [ ] **Step 4: Run, verify passes**

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat(core): bot reply builder"
```

---

## Task 8.4: Bot session store and webhook handler

**Files:**
- Create: `src/infra/whatsapp/session-store.ts`
- Create: `src/app/api/webhooks/whatsapp/route.ts`

- [ ] **Step 1: In-memory session store**

```ts
// src/infra/whatsapp/session-store.ts
import type { BotState } from "@/core/bot/state-machine";
import { initialState, applyBotEvent, type BotEvent } from "@/core/bot/state-machine";

const sessions = new Map<string, BotState>();

export function getSession(phone: string): BotState {
  return sessions.get(phone) ?? initialState();
}

export function setSession(phone: string, state: BotState): void {
  sessions.set(phone, state);
}

export function applyEvent(phone: string, event: BotEvent): BotState {
  const next = applyBotEvent(getSession(phone), event);
  setSession(phone, next);
  return next;
}

export function resetSession(phone: string): void {
  sessions.delete(phone);
}
```

- [ ] **Step 2: Webhook handler**

```ts
// src/app/api/webhooks/whatsapp/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getEnv } from "@/env";
import { verifyWebhookSignature } from "@/infra/whatsapp/webhook-verify";
import { applyEvent, getSession, setSession, resetSession } from "@/infra/whatsapp/session-store";
import { buildBotReply } from "@/core/bot/build-reply";
import { sendText, sendList, sendButtons } from "@/infra/whatsapp/client";
import { listCategories, listAllProducts, getProduct } from "@/infra/db/menu-repository";
import { listColoniasWithZone } from "@/infra/db/delivery-repository";
import { createOrder } from "@/infra/db/order-repository";
import { emitEvent } from "@/infra/events/event-bus";
import { getDb } from "@/db";
import { orderEvents } from "@/schema";
import { eq } from "drizzle-orm";
import { colonias, deliveryZones } from "@/schema";

export async function POST(req: NextRequest) {
  const env = getEnv();
  const raw = await req.text();
  const sig = req.headers.get("x-hub-signature-256")?.replace(/^sha256=/, "") ?? "";
  if (env.NODE_ENV === "production" && !verifyWebhookSignature(raw, sig, env.WHATSAPP_VERIFY_TOKEN ?? "")) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const body = JSON.parse(raw);

  // 360dialog format: entry[0].changes[0].value.messages[0]
  const msg = body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  if (!msg) return NextResponse.json({ ok: true });

  const phone = msg.from;
  const type = msg.type;
  let text = "";
  let interactive: any = null;
  if (type === "text") text = msg.text.body;
  else if (type === "interactive") {
    interactive = msg.interactive;
    if (interactive.type === "list_reply") text = interactive.list_reply.id;
    else if (interactive.type === "button_reply") text = interactive.button_reply.id;
  } else {
    text = msg[type]?.body ?? "";
  }

  await processMessage(phone, text);

  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest) {
  const env = getEnv();
  const mode = req.nextUrl.searchParams.get("hub.mode");
  const token = req.nextUrl.searchParams.get("hub.verify_token");
  const challenge = req.nextUrl.searchParams.get("hub.challenge");
  if (mode === "subscribe" && token === env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(challenge ?? "", { status: 200 });
  }
  return new Response("forbidden", { status: 403 });
}

async function processMessage(phone: string, raw: string): Promise<void> {
  const state = getSession(phone);

  // Route to event based on state and input
  const event = toBotEvent(state, raw);
  if (event) {
    const next = applyEvent(phone, event);

    // Load context based on next state
    const ctx: Parameters<typeof buildBotReply>[0] = { state: next };
    if (next.state === "idle" || next.state === "browsing_category") {
      const cats = await listCategories(true);
      ctx.categories = cats.map((c) => ({ id: c.id, name: c.name }));
    } else if (next.state === "browsing_product" && next.payload.categoryId) {
      const products = await listAllProducts(true);
      ctx.products = products.filter((p) => p.categoryId === next.payload.categoryId)
        .map((p) => ({ id: p.id, name: p.name, basePrice: p.basePrice }));
    } else if (next.state === "awaiting_colonia") {
      ctx.colonias = await listColoniasWithZone();
    }

    // Handle confirm_order: actually create the order
    if (event.type === "confirm_order" && next.payload.cart) {
      const order = await createOrderFromBot(phone, next);
      if (order) {
        ctx.orderSummary = { sequentialNumber: order.sequentialNumber, total: order.total };
        await sendText(phone, `Pedido #${order.sequentialNumber} recibido. Tiempo estimado: 25 min.`);
        const db = getDb();
        await db.insert(orderEvents).values({ orderId: order.id, kind: "notified", payload: { to: phone } });
        emitEvent("order_created", order);
        resetSession(phone);
        return;
      }
    }

    const reply = buildBotReply(ctx);
    for (const action of reply.actions) {
      if (action.kind === "sendText") await sendText(phone, action.text);
      else if (action.kind === "sendList") await sendList(phone, action.body);
      else if (action.kind === "sendButtons") await sendButtons(phone, action.body);
    }
  }
}

function toBotEvent(state: ReturnType<typeof getSession>, raw: string): import("@/core/bot/state-machine").BotEvent | null {
  if (raw.startsWith("cat:")) {
    return { type: "category_picked", categoryId: raw.slice(4) };
  }
  if (raw.startsWith("prod:")) {
    return { type: "product_picked", product: { id: raw.slice(5), name: "x", basePrice: "0" }, quantity: 1 };
  }
  if (raw.startsWith("col:")) {
    return { type: "colonia_picked", coloniaId: raw.slice(4) };
  }
  if (raw === "svc:local") return { type: "service_picked", serviceType: "local" };
  if (raw === "svc:delivery") return { type: "service_picked", serviceType: "delivery" };
  if (raw === "add:ok") return { type: "confirm_item", removed: [], extras: [] };
  if (raw === "cart:add_more") return { type: "add_more" };
  if (raw === "cart:finalize") return { type: "finalize" };
  if (raw === "ok:confirm") return { type: "confirm_order" };
  if (state.state === "awaiting_address") return { type: "address_typed", address: raw };
  return { type: "message", text: raw };
}

async function createOrderFromBot(phone: string, state: import("@/core/bot/state-machine").BotState) {
  const cart = state.payload.cart ?? [];
  const items: any[] = [];
  for (const c of cart) {
    const product = await getProduct(c.productId);
    if (!product) return null;
    const unitPrice = (Number(product.basePrice) + c.extras.reduce((s, e) => s + Number(e.price), 0)).toFixed(2);
    const itemTotal = (Number(unitPrice) * c.quantity).toFixed(2);
    items.push({
      productId: c.productId, productNameSnapshot: product.name,
      basePriceSnapshot: product.basePrice, unitPrice, quantity: c.quantity,
      removedIngredients: c.removed, extraIngredients: c.extras, itemTotal,
    });
  }
  let deliveryCost = "0";
  if (state.payload.serviceType === "delivery" && state.payload.coloniaId) {
    const db = getDb();
    const [col] = await db.select({ cost: deliveryZones.cost })
      .from(colonias).innerJoin(deliveryZones, eq(colonias.zoneId, deliveryZones.id))
      .where(eq(colonias.id, state.payload.coloniaId));
    if (col) deliveryCost = col.cost;
  }
  const { calculateOrderTotals } = await import("@/core/pricing/calculate-order");
  const totals = calculateOrderTotals({
    items: items.map((i) => ({ basePrice: i.unitPrice, quantity: i.quantity, extras: [] })),
    deliveryCost,
  });
  return createOrder({
    serviceType: state.payload.serviceType ?? "local",
    customerPhone: phone, customerName: "",
    deliveryAddress: state.payload.address,
    deliveryColoniaId: state.payload.coloniaId, deliveryCost,
    subtotal: totals.subtotal, total: totals.total,
    source: "whatsapp", notes: "", items,
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add .
git commit -m "feat(whatsapp): webhook handler with full bot flow"
```

---

# Phase 9: Polish and deploy

## Task 9.1: Add landing page and admin nav improvements

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Replace landing with link to admin**

```tsx
// src/app/page.tsx
import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="rounded bg-white p-8 text-center shadow">
        <h1 className="mb-4 text-2xl font-bold">Sistema de pedidos</h1>
        <Link href="/login" className="text-blue-600 hover:underline">Acceder al panel</Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add .
git commit -m "feat: landing page links to admin login"
```

---

## Task 9.2: Health check endpoint

**Files:**
- Create: `src/app/api/health/route.ts`

- [ ] **Step 1: Implement**

```ts
// src/app/api/health/route.ts
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ ok: true, ts: Date.now() });
}
```

- [ ] **Step 2: Commit**

```bash
git add .
git commit -m "feat: health check endpoint"
```

---

## Task 9.3: E2E test for order flow

**Files:**
- Create: `playwright.config.ts`
- Create: `tests/e2e/order-flow.spec.ts`

- [ ] **Step 1: Install Playwright**

```bash
pnpm add -D @playwright/test
pnpm exec playwright install chromium
```

- [ ] **Step 2: Create Playwright config**

Create `playwright.config.ts`:

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  retries: 0,
  use: { baseURL: "http://localhost:3000", trace: "on-first-retry" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: { command: "pnpm dev", url: "http://localhost:3000", reuseExistingServer: !process.env.CI },
});
```

- [ ] **Step 3: Write the E2E test**

Create `tests/e2e/order-flow.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

const PASSWORD = process.env.TEST_ADMIN_PASSWORD ?? "test1234";

test("staff can log in, create an order, and see it in dashboard", async ({ page }) => {
  await page.goto("/login");
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/admin\/orders/);

  // Need a category and product seeded. Skip the new-order step in CI if none.
  await page.goto("/admin/orders/new");
  // Add first product if available
  const firstProduct = page.locator(".grid button").first();
  if (await firstProduct.count() > 0) await firstProduct.click();

  await page.fill('input[placeholder*="Teléfono"]', "5551234567");
  // Only test local service (simpler)
  await page.click("text=Local");
  await page.click("text=Finalizar pedido");

  // After create, we redirect to /print/.../kitchen
  await expect(page).toHaveURL(/\/print\//);
});
```

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "test(e2e): basic order flow smoke test"
```

---

## Task 9.4: README with setup instructions

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write README**

```markdown
# Sistema de Pedidos del Restaurante

App web para toma de pedidos, bot de WhatsApp, e impresión térmica 80mm. Ver [`docs/superpowers/specs/2026-09-13-sistema-pedidos-restaurante-design.md`](docs/superpowers/specs/2026-09-13-sistema-pedidos-restaurante-design.md) para el spec completo.

## Setup local

```bash
pnpm install
cp .env.example .env.local
# Edita .env.local con tus valores (DB URL, hash de contraseña, etc.)
pnpm drizzle:migrate
pnpm dev
```

## Tests

```bash
pnpm test            # unit (Vitest)
pnpm test:e2e        # E2E (Playwright)
pnpm typecheck
pnpm lint
```

## Deploy

Ver [`AGENTS.md`](AGENTS.md) para la guía completa.
```

- [ ] **Step 2: Commit**

```bash
git add .
git commit -m "docs: README with setup instructions"
```

---

## Task 9.5: Deploy to Render

**Files:** none (cloud setup)

- [ ] **Step 1: Create Render account and connect repo**

1. Visit https://render.com and sign in with GitHub.
2. New > Web Service > connect this repo.
3. Build command: `pnpm install && pnpm build`
4. Start command: `pnpm start`
5. Add environment variables from `.env.example`.
6. Health check path: `/api/health`.

- [ ] **Step 2: Configure Postgres**

Either use Render's managed Postgres, or point `DATABASE_URL` to your Neon database.

- [ ] **Step 3: Apply migrations in production**

From local, with prod env vars loaded:

```bash
DATABASE_URL=<prod> pnpm drizzle:migrate
```

- [ ] **Step 4: Configure WhatsApp webhook**

In 360dialog dashboard, set webhook URL to `https://<your-app>.onrender.com/api/webhooks/whatsapp` with the verify token from env.

- [ ] **Step 5: Smoke test**

1. Log in to the deployed app.
2. Create a category, product, and zone.
3. Open the WhatsApp number, send "hola", walk through the bot flow.
4. Verify the order appears in the dashboard.

---

# Self-review (run after writing this plan)

**1. Spec coverage:**
- Section 4 (Architecture): all stack components in Phase 0/1 ✓
- Section 5 (Data model): Phase 1.2 ✓
- Section 6.1 (Login + dashboard + new order + detail): Phases 3.5, 5.5, 5.6, 5.7 ✓
- Section 6.2 (Two print templates): Phase 6.2, 6.3 ✓
- Section 6.3 (Bot + state machine + notifications): Phase 2.5, 8.x ✓
- Section 6.4 (Menu CRUD + delivery zones + import): Phases 4, 7 + import deferred to phase 2
- Section 7 (Endpoints): all routes implemented in phases 3-8 ✓
- Section 8 (Error handling): JSON shape `{ok, data/error}` used throughout ✓
- Section 9 (Security): middleware in Phase 3.4, bcrypt in 3.1, signed sessions in 3.2 ✓
- Section 10 (Testing): Vitest unit + Playwright E2E ✓
- Section 11 (Deploy): Phase 9.5 ✓

**2. Placeholder scan:** No TBD/TODO. Every step has code or commands.

**3. Type consistency:** Functions defined before use. `createOrder` signature used in 5.1 and 8.4. `validateNewOrder` used in 5.3. `BotState` and `BotEvent` consistent.

**4. Deferred to a future spec (intentional, documented in section 13 of design spec):**
- JSON bulk import UI (mention only — full implementation deferred)
- Cron job to reset `sequential_number_seq` daily
- `source` filtering in bot: bot uses `whatsapp`, staff uses `staff` — already handled.
- Rate limiting middleware: deferred to phase 2 (not in MVP).

**5. Items to add in phase 2 of THIS plan (not new spec):**
- Bulk JSON import endpoint
- Cron reset of sequence
- KDS (kitchen display)
- Payment and tip capture
