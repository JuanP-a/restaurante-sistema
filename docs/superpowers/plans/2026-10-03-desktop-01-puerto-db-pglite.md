# Fase 1 — Puerto de Base de Datos + PGlite Embebido — Plan de Implementación

> **Para workers agénticos:** REQUIRED SUB-SKILL: usar `superpowers:subagent-driven-development` (recomendado) o `superpowers:executing-plans` para implementar task-by-task. Steps usan checkbox (`- [ ]`) para tracking.

**Goal:** Hacer que la app corra contra una base Postgres embebida (PGlite) sin servidor, conservando intactos los repositorios y la lógica de negocio, y dejando el camino abierto para que el futuro SaaS use node-postgres con el mismo código.

**Architecture:** Se introduce un **puerto DB** en `src/infra/db/client.ts` tipado contra el tipo base `PgDatabase` de `drizzle-orm/pg-core` (que tanto `NodePgDatabase` como `PgliteDatabase` satisfacen). La selección de adapter ocurre por `env.DB_DRIVER`. PGlite se inicializa una vez al arrancar el server (hook `instrumentation.ts`), corre migraciones y queda en un singleton de proceso. Los 5 repositorios existentes no se tocan.

**Tech Stack:** Next.js 16, TypeScript estricto, Drizzle ORM, `@electric-sql/pglite`, `drizzle-orm/pglite`, Vitest.

---

## Global Constraints

Copiadas de `AGENTS.md` — aplican a TODA task:

- TypeScript estricto. Prohibido `any`, non-null assertion (`!`), type assertions (`as Tipo`). Usar `satisfies` para shape checking.
- Functional core, imperative shell: sin I/O en `src/core/`.
- TDD: test rojo → implementación mínima → verde → refactor. Target ≥80% coverage.
- Sin mocks del core; adapters con fakes in-memory o infra real (PGlite in-memory califica como infra real).
- YAGNI.
- Comentarios solo para el "por qué" no obvio.
- **pnpm**, nunca npm/npx.
- Commits chicos convencionales. Nunca commitear sin verificar.
- Nombres de dominio en español, tecnología en inglés.

## Estructura de archivos (Fase 1)

```
/
├── drizzle.config.ts                    # MODIFICAR: schema path roto + driver pglite
├── next.config.ts                       # MODIFICAR: serverExternalPackages
├── vitest.setup.ts                      # MODIFICAR: initDb() antes de los tests
├── .env.example                         # MODIFICAR: DB_DRIVER, DB_PATH, MIGRATIONS_PATH
├── package.json                         # MODIFICAR: nueva dep @electric-sql/pglite
├── src/
│   ├── instrumentation.ts               # CREAR: initDb() en boot del server
│   ├── env.ts                           # MODIFICAR: DB_DRIVER/DB_PATH/MIGRATIONS_PATH/DATABASE_URL opcional
│   ├── env.test.ts                      # MODIFICAR: casos nuevos
│   └── infra/db/
│       ├── client.ts                    # REESCRIBIR: puerto Db + initDb/getDb
│       ├── adapters/
│       │   ├── postgres.ts              # CREAR: node-postgres (SaaS)
│       │   └── pglite.ts                # CREAR: PGlite embebido (desktop)
│       └── order-repository.ts          # MODIFICAR: secuencia portable (Task 6)
└── tests/integration/db/
    └── pglite-viability.test.ts         # CREAR: spike go/no-go
```

## Interfaces entre tasks

- **Task 3 produce:** `type Db = PgDatabase<PgQueryResultHKT, typeof schema>`, `initDb(): Promise<Db>`, `getDb(): Db`, `createPostgresDb(connectionString: string): Db`.
- **Task 4 produce:** `createPgliteDb(input: { dataDir: string; migrationsFolder: string }): Promise<Db>`.
- **Task 6 produce:** `nextSequentialNumber(): Promise<number>` (misma firma, implementación portable).

---

### Task 1: Spike de viabilidad PGlite (go/no-go)

**Por qué:** Todo el plan depende de que PGlite corra el schema real, las migraciones y la secuencia `nextval`. Si esto falla, el plan cambia a SQLite (+1–2 semanas). Este task es el portero.

**Files:**
- Modify: `package.json`
- Create: `tests/integration/db/pglite-viability.test.ts`

**Interfaces:**
- Consumes: `drizzle/` migraciones existentes, `src/infra/db/schema.ts`.
- Produces: veredicto go/no-go.

- [ ] **Step 1: Instalar PGlite**

```bash
pnpm add @electric-sql/pglite
```

- [ ] **Step 2: Escribir el test de viabilidad**

Crea `tests/integration/db/pglite-viability.test.ts`:

```ts
// @vitest-environment node
import { describe, expect, test } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { sql } from "drizzle-orm";
import * as schema from "@/infra/db/schema";

describe("PGlite viability", () => {
  test("migra el schema real, inserta vía builder y usa la secuencia", async () => {
    const client = new PGlite();
    const db = drizzle(client, { schema });

    await migrate(db, { migrationsFolder: "./drizzle" });

    const [cat] = await db
      .insert(schema.categories)
      .values({ name: "Tacos", slug: "tacos" })
      .returning();
    expect(cat?.id).toBeTruthy();

    const [prod] = await db
      .insert(schema.products)
      .values({ categoryId: cat.id, name: "Pastor", basePrice: "50.00", description: "" })
      .returning();
    expect(prod?.name).toBe("Pastor");

    const seq = await db.execute<{ next: string }>(
      sql`SELECT nextval('orders_sequential_number_seq') as next`,
    );
    expect(Number(seq.rows[0]?.next)).toBe(1);

    await db.transaction(async (tx) => {
      await tx.insert(schema.orders).values({
        sequentialNumber: 99,
        serviceType: "local",
        customerPhone: "555",
        customerName: "",
        deliveryCost: "0",
        subtotal: "10.00",
        total: "10.00",
        source: "staff",
        notes: "",
      });
    });
    const count = await db.execute<{ count: string }>(
      sql`SELECT count(*)::text as count FROM orders WHERE sequential_number = 99`,
    );
    expect(Number(count.rows[0]?.count)).toBe(1);

    await client.close();
  }, 30000);
});
```

- [ ] **Step 3: Correr el spike**

Run: `pnpm vitest run --no-file-parallelism tests/integration/db/pglite-viability.test.ts`
Expected: PASS.

- [ ] **Step 4: Decidir**

- PASS → continuar. Dejar el test en el repo (sirve de guardia de regresión de la viabilidad).
- FAIL → **detener el plan**. Reportar el error exacto. El fallback documentado es adapter SQLite (drizzle sqlite dialect): reescribir el schema a `sqlite-core` (pgEnum→text+check, jsonb→text json, uuid→text, decimal→numeric) y adaptar `nextSequentialNumber`. Abrir conversación antes de continuar.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml tests/integration/db/pglite-viability.test.ts
git commit -m "test: spike viabilidad de PGlite contra schema y migraciones reales"
```

---

### Task 2: Arreglar `drizzle.config.ts` + variables de entorno

**Por qué:** `drizzle.config.ts` apunta a `./src/schema.ts`, que **no existe** (el schema real está en `./src/infra/db/schema.ts`). Además `DATABASE_URL` es obligatorio hoy, y en desktop no existe. Se añade selección de driver por env.

**Files:**
- Modify: `drizzle.config.ts`
- Modify: `src/env.ts`
- Modify: `src/env.test.ts`
- Modify: `.env.example`

**Interfaces:**
- Produces: `env.DB_DRIVER: "pglite" | "postgres"`, `env.DB_PATH: string`, `env.MIGRATIONS_PATH: string`, `env.DATABASE_URL?: string`.

- [ ] **Step 1: Escribir los tests de env primero (rojo)**

En `src/env.test.ts`, reemplazar el test `"requires DATABASE_URL"` y añadir casos. Nota: `parseEnv({})` sigue fallando porque faltan `ADMIN_PASSWORD_HASH` y `SESSION_SECRET`.

```ts
  it("acepta modo pglite sin DATABASE_URL", () => {
    const env = parseEnv({
      DB_DRIVER: "pglite",
      ADMIN_PASSWORD_HASH: "$2a$10$abcdefghijklmnopqrstuv",
      SESSION_SECRET: "a".repeat(32),
    });
    expect(env.DB_DRIVER).toBe("pglite");
    expect(env.DB_PATH).toBe("./.data/pglite");
    expect(env.DATABASE_URL).toBeUndefined();
  });

  it("exige DATABASE_URL en modo postgres", () => {
    expect(() =>
      parseEnv({
        DB_DRIVER: "postgres",
        ADMIN_PASSWORD_HASH: "$2a$10$abcdefghijklmnopqrstuv",
        SESSION_SECRET: "a".repeat(32),
      }),
    ).toThrow();
  });

  it("modo postgres por defecto con DATABASE_URL válida", () => {
    const env = parseEnv({
      DATABASE_URL: "postgres://x",
      ADMIN_PASSWORD_HASH: "$2a$10$abcdefghijklmnopqrstuv",
      SESSION_SECRET: "a".repeat(32),
    });
    expect(env.DB_DRIVER).toBe("postgres");
  });
```

- [ ] **Step 2: Correr y ver fallar**

Run: `pnpm vitest run src/env.test.ts`
Expected: FAIL — `DB_DRIVER` no existe / `DATABASE_URL` sigue requerido.

- [ ] **Step 3: Implementar el schema de env**

Reemplaza el contenido de `src/env.ts`:

```ts
import { z } from "zod";

const envSchema = z
  .object({
    DB_DRIVER: z.enum(["pglite", "postgres"]).default("postgres"),
    DATABASE_URL: z.string().url().optional(),
    DB_PATH: z.string().default("./.data/pglite"),
    MIGRATIONS_PATH: z.string().default("./drizzle"),
    ADMIN_PASSWORD_HASH: z.string().regex(/^\$2[aby]\$10\$.+/, "debe ser hash bcrypt"),
    SESSION_SECRET: z.string().min(32, "mínimo 32 caracteres"),
    WHATSAPP_BSP_API_KEY: z.string().optional(),
    WHATSAPP_BSP_URL: z.string().url().default("https://waba-v2.360dialog.io"),
    WHATSAPP_VERIFY_TOKEN: z.string().optional(),
    BUSINESS_NAME: z.string().default("Mi Restaurante"),
    BUSINESS_ADDRESS: z.string().default(""),
    BUSINESS_PHONE: z.string().default(""),
    DEFAULT_PREP_TIME_MINUTES: z.coerce.number().int().min(1).default(25),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  })
  .superRefine((val, ctx) => {
    if (val.DB_DRIVER === "postgres" && !val.DATABASE_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["DATABASE_URL"],
        message: "DATABASE_URL es obligatoria cuando DB_DRIVER=postgres",
      });
    }
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

- [ ] **Step 4: Correr tests y ver verde**

Run: `pnpm vitest run src/env.test.ts`
Expected: PASS.

- [ ] **Step 5: Arreglar `drizzle.config.ts`**

Reemplaza `schema` por la ruta real:

```ts
import { config as loadEnv } from "dotenv";
import { defineConfig } from "drizzle-kit";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

export default defineConfig({
  schema: "./src/infra/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL ?? "postgres://localhost:5432/restaurante" },
});
```

- [ ] **Step 6: Documentar en `.env.example`**

Añade arriba de `DATABASE_URL`:

```bash
# "pglite" (desktop, DB embebida sin servidor) o "postgres" (SaaS/cloud).
# En pglite, DATABASE_URL no se usa; DB_PATH apunta al directorio de datos.
DB_DRIVER=postgres
DB_PATH=./.data/pglite
MIGRATIONS_PATH=./drizzle
```

- [ ] **Step 7: Verificar typecheck**

Run: `pnpm typecheck`
Expected: sin errores.

- [ ] **Step 8: Commit**

```bash
git add drizzle.config.ts src/env.ts src/env.test.ts .env.example
git commit -m "fix(db): corrige schema path de drizzle-kit y añade selección de driver por env"
```

---

### Task 3: Puerto DB + adapter Postgres + boot

**Por qué:** Hoy `client.ts` acopla `pg` directo. Se introduce el tipo compartido `Db` y la inicialización explícita.

**Files:**
- Create: `src/infra/db/adapters/postgres.ts`
- Rewrite: `src/infra/db/client.ts`
- Create: `src/instrumentation.ts`
- Modify: `next.config.ts`

**Interfaces:**
- Consumes: `env.DB_DRIVER`, `env.DATABASE_URL`, `env.DB_PATH`, `env.MIGRATIONS_PATH` (Task 2).
- Produces: `type Db`, `initDb(): Promise<Db>`, `getDb(): Db`, `createPostgresDb(connectionString: string): Db`.

- [ ] **Step 1: Crear el adapter Postgres**

`src/infra/db/adapters/postgres.ts`:

```ts
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@/infra/db/schema";
import type { Db } from "@/infra/db/client";

export function createPostgresDb(connectionString: string): Db {
  const pool = new Pool({ connectionString, max: 10 });
  return drizzle(pool, { schema });
}
```

- [ ] **Step 2: Reescribir el puerto `client.ts`**

`src/infra/db/client.ts`:

```ts
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { getEnv } from "@/env";
import * as schema from "@/infra/db/schema";
import { createPostgresDb } from "@/infra/db/adapters/postgres";

// Base Postgres type: both NodePgDatabase and PgliteDatabase satisfy it.
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

// Survives Next.js HMR module reloads in dev.
declare global {
  // eslint-disable-next-line no-var
  var __db: Db | undefined;
}

export async function initDb(): Promise<Db> {
  if (globalThis.__db) return globalThis.__db;
  const env = getEnv();
  if (env.DB_DRIVER === "pglite") {
    const { createPgliteDb } = await import("@/infra/db/adapters/pglite");
    globalThis.__db = await createPgliteDb({
      dataDir: env.DB_PATH,
      migrationsFolder: env.MIGRATIONS_PATH,
    });
  } else {
    if (!env.DATABASE_URL) throw new Error("DATABASE_URL requerida para DB_DRIVER=postgres");
    globalThis.__db = createPostgresDb(env.DATABASE_URL);
  }
  return globalThis.__db;
}

export function getDb(): Db {
  if (!globalThis.__db) {
    throw new Error("getDb() llamado antes de initDb(). Ver src/instrumentation.ts.");
  }
  return globalThis.__db;
}
```

> **Nota de tipo:** si `PgDatabase`/`PgQueryResultHKT` no se exportan desde `drizzle-orm/pg-core` en la versión instalada, verificar con `pnpm typecheck` y, como fallback, importar los tipos desde `drizzle-orm/pg-core` directamente con el nombre exacto que reporte el error. No usar `as`.

- [ ] **Step 3: Crear el hook de arranque**

`src/instrumentation.ts`:

```ts
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initDb } = await import("@/infra/db/client");
    await initDb();
  }
}
```

- [ ] **Step 4: Permitir PGlite fuera del bundler**

`next.config.ts`:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
};

export default nextConfig;
```

- [ ] **Step 5: Verificar que los repos siguen compilando**

Run: `pnpm typecheck`
Expected: sin errores. Los 5 repos no se tocaron y siguen usando `getDb()`.

- [ ] **Step 6: Verificar que la app arranca (modo postgres, dev con Docker)**

Run: `docker compose up -d && pnpm dev`
Expected: arranca sin error de `initDb`. Detener con Ctrl-C.

> Si Docker no está disponible, saltar este step; Task 5 valida la app por otra vía.

- [ ] **Step 7: Commit**

```bash
git add src/infra/db/adapters/postgres.ts src/infra/db/client.ts src/instrumentation.ts next.config.ts
git commit -m "refactor(db): introduce puerto Db con initDb/getDb y adapter postgres"
```

---

### Task 4: Adapter PGlite con migración en boot

**Files:**
- Create: `src/infra/db/adapters/pglite.ts`
- Create: `src/infra/db/adapters/pglite.test.ts`

**Interfaces:**
- Consumes: `Db` (Task 3).
- Produces: `createPgliteDb(input: { dataDir: string; migrationsFolder: string }): Promise<Db>`.

- [ ] **Step 1: Escribir el test primero (rojo)**

`src/infra/db/adapters/pglite.test.ts`:

```ts
// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, test } from "vitest";
import { sql } from "drizzle-orm";
import { createPgliteDb } from "./pglite";
import * as schema from "@/infra/db/schema";

const dir = mkdtempSync(join(tmpdir(), "pglite-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("createPgliteDb", () => {
  test("crea la DB, migra y permite insertar/leer en un data dir", async () => {
    const db = await createPgliteDb({ dataDir: dir, migrationsFolder: "./drizzle" });
    const [cat] = await db
      .insert(schema.categories)
      .values({ name: "Bebidas", slug: "bebidas" })
      .returning();
    expect(cat?.id).toBeTruthy();
    const rows = await db.execute<{ count: string }>(
      sql`SELECT count(*)::text as count FROM categories`,
    );
    expect(Number(rows.rows[0]?.count)).toBe(1);
  }, 30000);
});
```

- [ ] **Step 2: Correr y ver fallar**

Run: `pnpm vitest run --no-file-parallelism src/infra/db/adapters/pglite.test.ts`
Expected: FAIL — `./pglite` no existe.

- [ ] **Step 3: Implementar el adapter**

`src/infra/db/adapters/pglite.ts`:

```ts
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "@/infra/db/schema";
import type { Db } from "@/infra/db/client";

export async function createPgliteDb(input: {
  dataDir: string;
  migrationsFolder: string;
}): Promise<Db> {
  // "memory://" runs ephemeral (tests). Any other value persists to disk.
  const client = input.dataDir === "memory://" ? new PGlite() : new PGlite(input.dataDir);
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: input.migrationsFolder });
  return db;
}
```

- [ ] **Step 4: Correr y ver verde**

Run: `pnpm vitest run --no-file-parallelism src/infra/db/adapters/pglite.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/infra/db/adapters/pglite.ts src/infra/db/adapters/pglite.test.ts
git commit -m "feat(db): adapter PGlite embebido con migración en boot"
```

---

### Task 5: Suite de integración contra PGlite (sin Docker)

**Por qué:** Con PGlite in-memory los tests de integración corren sin Docker y sin Postgres. Es la prueba de que el port funciona end-to-end.

**Files:**
- Modify: `vitest.setup.ts`
- Modify: `package.json` (scripts `test` y `test:integration`)

**Interfaces:**
- Consumes: `initDb()` (Task 3), `createPgliteDb` (Task 4).

- [ ] **Step 1: Inicializar la DB solo cuando corre integración**

Inicializar PGlite para cada archivo de *unit* test es caro y acerca el bug R2 (crash V8 por crear/cerrar muchas instancias WASM). El setup solo inicializa cuando el script lo pide vía `VITEST_INIT_DB`.

Añade al final de `vitest.setup.ts`:

```ts
import { initDb } from "@/infra/db/client";

// Only integration tests touch the DB. `test` and `test:integration` set
// VITEST_INIT_DB=1; `test:unit` does not, keeping unit runs pure and fast.
// To run integration against a real Postgres (SaaS parity), export
// DB_DRIVER=postgres + DATABASE_URL before `pnpm test:integration`.
if (process.env.VITEST_INIT_DB === "1") {
  if (!process.env.DB_DRIVER) process.env.DB_DRIVER = "pglite";
  if (process.env.DB_DRIVER === "pglite") {
    process.env.DB_PATH = "memory://";
    process.env.MIGRATIONS_PATH = "./drizzle";
  }
  await initDb();
}
```

- [ ] **Step 2: Marcar los scripts que necesitan DB**

En `package.json`:

```json
    "test": "VITEST_INIT_DB=1 vitest run --passWithNoTests --no-file-parallelism",
    "test:integration": "VITEST_INIT_DB=1 vitest run --passWithNoTests --no-file-parallelism tests/integration",
```

(`test:unit` queda sin cambios: no inicializa DB.)

> Vitest ejecuta `setupFiles` antes de importar los archivos de test y espera a que resuelvan, así que `const db = getDb()` a nivel de módulo en los tests encuentra la DB lista. Con `--no-file-parallelism` y aislamiento por archivo, cada archivo de integración obtiene su propia DB in-memory.

- [ ] **Step 3: Correr toda la suite de integración contra PGlite**

Run: `pnpm test:integration`
Expected: PASS. (Requisito previo: migraciones en `./drizzle` y `.env.local` con `ADMIN_PASSWORD_HASH` + `SESSION_SECRET`.)

> Si algún test usa sintaxis/semántica no soportada por PGlite, anotar el caso exacto antes de tocar el test. No debilitar aserciones para hacerlo pasar.

- [ ] **Step 4: Correr también los unit tests**

Run: `pnpm test:unit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add vitest.setup.ts package.json
git commit -m "test: corre integración contra PGlite in-memory sin Docker"
```

---

### Task 6: Secuencia portable en `order-repository`

**Por qué:** `nextSequentialNumber` y `createOrder` acceden al resultado crudo de `db.execute` con forma `{ rows }`. Ese shape varía entre el driver `pg` y PGlite. Se usa el query builder de Drizzle (dialect-agnóstico) para desacoplar del driver.

**Files:**
- Modify: `src/infra/db/order-repository.ts:38-56`
- Test: ya cubierto por `tests/integration/db/order-repository.test.ts` (Task 5 lo corre bajo PGlite).

**Interfaces:**
- Produces: `nextSequentialNumber(): Promise<number>` (firma sin cambios).

- [ ] **Step 1: Confirmar el comportamiento actual (verde de referencia)**

Run: `pnpm vitest run --no-file-parallelism tests/integration/db/order-repository.test.ts`
Expected: PASS bajo PGlite.

- [ ] **Step 2: Refactorizar a query builder**

En `src/infra/db/order-repository.ts`, reemplaza `nextSequentialNumber`:

```ts
export async function nextSequentialNumber(): Promise<number> {
  const db = getDb();
  const [row] = await db.select({ next: sql<string>`nextval('orders_sequential_number_seq')` }).from(sql`(SELECT 1) AS t`);
  return Number(row?.next ?? 1);
}
```

Y dentro de `createOrder`, reemplaza el bloque de `tx.execute` por:

```ts
    const [seqRow] = await tx
      .select({ next: sql<string>`nextval('orders_sequential_number_seq')` })
      .from(sql`(SELECT 1) AS t`);
    const sequentialNumber = Number(seqRow?.next ?? 1);
```

> `sql` ya está importado en el archivo (`import { desc, eq, sql } from "drizzle-orm"`).

- [ ] **Step 3: Correr los tests de order-repository**

Run: `pnpm vitest run --no-file-parallelism tests/integration/db/order-repository.test.ts`
Expected: PASS. Los tests de secuencia (`devuelve números monotónicos`, `inicia en 1 después de reset`) cubren el nuevo camino.

- [ ] **Step 4: Decisión pendiente — numeración diaria**

Registrar en el commit o en un ADR: hoy la secuencia es **global** (no reinicia por día). El spec original pedía reinicio diario 4:00 AM vía cron del cloud. En desktop no hay cron. Opciones: (a) dejar global, (b) computar `MAX(sequential_number)+1` del día. **No implementar ahora** (fuera de alcance de Fase 1); dejar constancia de la pregunta abierta del plan maestro.

- [ ] **Step 5: Commit**

```bash
git add src/infra/db/order-repository.ts
git commit -m "refactor(db): secuencia nextval vía query builder, desacoplada del driver"
```

---

### Task 7: Verificación final de la fase

- [ ] **Step 1: Typecheck**

Run: `pnpm typecheck`
Expected: sin errores.

- [ ] **Step 2: Lint**

Run: `pnpm lint`
Expected: sin errores.

- [ ] **Step 3: Tests completos**

Run: `pnpm test`
Expected: PASS (unit + integración, ahora sobre PGlite).

- [ ] **Step 4: Build de producción**

Este Mac (volumen externo) rompe Turbopack con shadow files `._*` (ver AGENTS.md). Limpiar antes:

```bash
find .next -name '._*' -delete
pnpm build
```

Expected: build OK. **Verificar que `drizzle/` se incluye** en la salida standalone:

```bash
ls .next/standalone/drizzle
```

Si `drizzle/` no está, añadir en `next.config.ts` la copia del directorio de migraciones al standalone (o resolver `MIGRATIONS_PATH` absoluto desde `process.resourcesPath` en Fase 4). Anotar el hallazgo.

- [ ] **Step 5: Commit final (si hubo cambios)**

```bash
git add -A
git commit -m "chore(db): verificación de Fase 1 (typecheck, tests, build) sobre PGlite"
```

## Verde para Fase 2

Fase 1 está completa cuando:
- `pnpm test` pasa sin Docker (PGlite in-memory).
- La app arranca en modo `pglite` con `DB_PATH` persistente y migra sola.
- `pnpm typecheck` y `pnpm build` verdes.
- Los 5 repositorios y `src/core/` **sin cambios de comportamiento**.
- El seam `Db`/`getDb()`/`initDb()` está documentado y estable para las fases 2–5.
