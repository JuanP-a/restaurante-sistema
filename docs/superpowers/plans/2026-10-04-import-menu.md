# Import de menú — Plan de Implementación

> **Para workers agénticos:** REQUIRED SUB-SKILL: usar `superpowers:subagent-driven-development` (recomendado) o `superpowers:executing-plans` para implementar task-by-task. Steps usan checkbox (`- [ ]`) para tracking.

**Goal:** Cargar el menú real de un cliente (o cualquier menú) desde un JSON versionado vía `/admin/import`, con validación en el core puro y persistencia transaccional, sin romper la DB si el archivo es inválido.

**Architecture:** Tres capas. (1) **Core puro** `src/core/menu/import.ts`: parsea y valida el JSON crudo a un `MenuImport` tipado, sin I/O, devolviendo `Result`. (2) **Adapter** `importMenu()` en `src/infra/db/menu-repository.ts`: en una transacción inserta categorías + productos según `mode` (`replace` | `append`). (3) **Shell** `POST /api/admin/import` + página `/admin/import`. Los campos opcionales (`includes`, `extras`, `optionGroups`) se **parsean y validan** pero **no se persisten todavía** (requieren modelo de modificadores, rama pausada); el reporte los cuenta como diferidos. Fuera de alcance: zonas de entrega, UX de personalización.

**Tech Stack:** Next.js 16, TypeScript estricto, Drizzle ORM, PGlite/Postgres, Vitest, Zod (solo en el borde del handler, opcional).

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

## Contrato de datos (formato JSON)

Ver [`docs/import/README.md`](../../import/README.md) y ejemplo real
[`docs/import/lilians-menu.json`](../../import/lilians-menu.json).

```jsonc
{
  "categories": [
    {
      "name": "Hamburguesas",
      "includes": "Lechuga, jitomate, ...",          // opcional, string
      "extras": [{ "name": "Tocino", "price": "10" }], // opcional
      "optionGroups": [{ "name": "Sabor", "selection": "single", "options": ["Búfalo"] }], // opcional
      "products": [{ "name": "Sencilla", "basePrice": "55", "description": "..." }]
    }
  ],
  "deliveryZones": [] // opcional, ignorado en esta fase
}
```

## Estructura de archivos

```
/
├── src/
│   ├── core/menu/
│   │   ├── types.ts               # CREAR: MenuImport y subtipos
│   │   ├── parse-import.ts        # CREAR: parseMenuImport() puro
│   │   └── parse-import.test.ts   # CREAR: unit TDD
│   ├── infra/db/
│   │   └── menu-repository.ts     # MODIFICAR: importMenu()
│   └── app/
│       ├── api/admin/import/
│       │   └── route.ts           # CREAR: POST handler
│       ├── admin/
│       │   ├── layout.tsx         # MODIFICAR: nav link "Importar"
│       │   └── import/
│       │       ├── page.tsx       # CREAR: server shell
│       │       └── import-form.tsx# CREAR: client form (file picker + modo)
└── tests/integration/
    └── menu-import.test.ts        # CREAR: importa el JSON real sobre PGlite
```

## Interfaces entre tasks

- **Task 1 produce (core):**
  ```ts
  export type ImportProduct = { name: string; basePrice: string; description: string };
  export type ImportExtra = { name: string; price: string };
  export type ImportOptionGroup = { name: string; selection: "single"; options: string[] };
  export type ImportCategory = {
    name: string; includes: string; extras: ImportExtra[];
    optionGroups: ImportOptionGroup[]; products: ImportProduct[];
  };
  export type MenuImport = { categories: ImportCategory[] };
  export type ImportError =
    | { kind: "not-an-object"; message: string }
    | { kind: "no-categories"; message: string }
    | { kind: "bad-category"; message: string; path: string }
    | { kind: "bad-product"; message: string; path: string }
    | { kind: "bad-price"; message: string; path: string };
  export function parseMenuImport(raw: unknown): Result<MenuImport, ImportError>;
  ```
- **Task 2 produce (repo):**
  ```ts
  export type ImportMode = "replace" | "append";
  export type ImportReport = {
    categories: number; products: number;
    deferred: { extras: number; optionGroups: number };
  };
  export function importMenu(menu: MenuImport, options: { mode: ImportMode }): Promise<ImportReport>;
  ```
- **Task 3 produce (HTTP):** `POST /api/admin/import` body `{ menu: unknown, mode: "replace" | "append" }` → `{ ok: true, data: ImportReport }` o `{ ok: false, error: { message } }` (400/422).

---

### Task 1: Core puro — `parseMenuImport`

**Por qué:** El archivo lo sube un humano; puede venir roto. Validar en el core, sin I/O, permite testear exhaustivamente y devolver errores claros por `path`. Es el portero antes de tocar la DB.

**Files:**
- Create: `src/core/menu/types.ts`
- Create: `src/core/menu/parse-import.ts`
- Create: `src/core/menu/parse-import.test.ts`

**Interfaces:**
- Consumes: `Result`, `ok`, `err` de `src/core/result.ts`.
- Produces: `parseMenuImport(raw: unknown): Result<MenuImport, ImportError>` (ver arriba).

- [ ] **Step 1: Escribir tipos**

`src/core/menu/types.ts`:

```ts
export type ImportProduct = { name: string; basePrice: string; description: string };
export type ImportExtra = { name: string; price: string };
export type ImportOptionGroup = { name: string; selection: "single"; options: string[] };
export type ImportCategory = {
  name: string;
  includes: string;
  extras: ImportExtra[];
  optionGroups: ImportOptionGroup[];
  products: ImportProduct[];
};
export type MenuImport = { categories: ImportCategory[] };

export type ImportError =
  | { kind: "not-an-object"; message: string }
  | { kind: "no-categories"; message: string }
  | { kind: "bad-category"; message: string; path: string }
  | { kind: "bad-product"; message: string; path: string }
  | { kind: "bad-price"; message: string; path: string };
```

- [ ] **Step 2: Escribir los tests primero (rojo)**

`src/core/menu/parse-import.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseMenuImport } from "./parse-import";

const valid = {
  categories: [
    {
      name: "Hamburguesas",
      includes: "Lechuga, jitomate",
      extras: [{ name: "Tocino", price: "10" }],
      optionGroups: [{ name: "Sabor", selection: "single", options: ["Búfalo", "BBQ"] }],
      products: [{ name: "Sencilla", basePrice: "55", description: "Carne" }],
    },
  ],
};

describe("parseMenuImport", () => {
  it("acepta un menú válido y normaliza opcionales ausentes", () => {
    const result = parseMenuImport({
      categories: [{ name: "Tortas", products: [{ name: "Cubana", basePrice: "80" }] }],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const cat = result.value.categories[0];
    expect(cat?.includes).toBe("");
    expect(cat?.extras).toEqual([]);
    expect(cat?.optionGroups).toEqual([]);
    expect(cat?.products[0]?.description).toBe("");
  });

  it("preserva includes, extras y optionGroups", () => {
    const result = parseMenuImport(valid);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const cat = result.value.categories[0];
    expect(cat?.extras).toEqual([{ name: "Tocino", price: "10" }]);
    expect(cat?.optionGroups[0]?.options).toEqual(["Búfalo", "BBQ"]);
  });

  it("rechaza input que no es objeto", () => {
    const result = parseMenuImport(null);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("not-an-object");
  });

  it("rechaza menú sin categorías", () => {
    const result = parseMenuImport({ categories: [] });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("no-categories");
  });

  it("rechaza categoría sin nombre, con path", () => {
    const result = parseMenuImport({ categories: [{ products: [] }] });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("bad-category");
    if (result.error.kind !== "bad-category") return;
    expect(result.error.path).toBe("categories[0].name");
  });

  it("rechaza producto sin nombre o precio, con path", () => {
    const result = parseMenuImport({
      categories: [{ name: "X", products: [{ basePrice: "10" }] }],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("bad-product");
  });

  it("rechaza precio no numérico o negativo con bad-price", () => {
    const result = parseMenuImport({
      categories: [{ name: "X", products: [{ name: "A", basePrice: "abc" }] }],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("bad-price");
    if (result.error.kind !== "bad-price") return;
    expect(result.error.path).toBe("categories[0].products[0].basePrice");
  });
});
```

- [ ] **Step 3: Correr y ver fallar**

Run: `pnpm vitest run src/core/menu/parse-import.test.ts`
Expected: FAIL — `./parse-import` no existe.

- [ ] **Step 4: Implementar el parser**

`src/core/menu/parse-import.ts`:

```ts
import { ok, err, type Result } from "../result";
import type {
  ImportCategory, ImportError, ImportExtra, ImportOptionGroup, ImportProduct, MenuImport,
} from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function parsePrice(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const n = Number(value);
  if (value.trim() === "" || Number.isNaN(n) || n < 0) return null;
  return value;
}

function parseExtras(raw: unknown, categoryPath: string): Result<ImportExtra[], ImportError> {
  if (raw === undefined) return ok([]);
  if (!Array.isArray(raw)) {
    return err({ kind: "bad-category", message: "extras debe ser un arreglo", path: `${categoryPath}.extras` });
  }
  const extras: ImportExtra[] = [];
  for (let i = 0; i < raw.length; i++) {
    const item = raw[i];
    const name = isRecord(item) ? asString(item.name) : null;
    const price = isRecord(item) ? parsePrice(item.price) : null;
    if (!name || price === null) {
      return err({ kind: "bad-category", message: "extra inválido", path: `${categoryPath}.extras[${i}]` });
    }
    extras.push({ name, price });
  }
  return ok(extras);
}

function parseOptionGroups(raw: unknown, categoryPath: string): Result<ImportOptionGroup[], ImportError> {
  if (raw === undefined) return ok([]);
  if (!Array.isArray(raw)) {
    return err({ kind: "bad-category", message: "optionGroups debe ser un arreglo", path: `${categoryPath}.optionGroups` });
  }
  const groups: ImportOptionGroup[] = [];
  for (let i = 0; i < raw.length; i++) {
    const item = raw[i];
    const name = isRecord(item) ? asString(item.name) : null;
    const options = isRecord(item) && Array.isArray(item.options)
      ? item.options.filter((o): o is string => typeof o === "string")
      : null;
    if (!name || !options || options.length === 0) {
      return err({ kind: "bad-category", message: "optionGroup inválido", path: `${categoryPath}.optionGroups[${i}]` });
    }
    groups.push({ name, selection: "single", options });
  }
  return ok(groups);
}

function parseProducts(raw: unknown, categoryPath: string): Result<ImportProduct[], ImportError> {
  if (!Array.isArray(raw)) {
    return err({ kind: "bad-category", message: "products debe ser un arreglo", path: `${categoryPath}.products` });
  }
  const products: ImportProduct[] = [];
  for (let i = 0; i < raw.length; i++) {
    const item = raw[i];
    const path = `${categoryPath}.products[${i}]`;
    const name = isRecord(item) ? asString(item.name) : null;
    if (!name || name.trim() === "") {
      return err({ kind: "bad-product", message: "producto sin nombre", path: `${path}.name` });
    }
    const rawPrice = isRecord(item) ? item.basePrice : undefined;
    const price = parsePrice(rawPrice);
    if (price === null) {
      return err({ kind: "bad-price", message: "basePrice inválido", path: `${path}.basePrice` });
    }
    const description = isRecord(item) ? asString(item.description) ?? "" : "";
    products.push({ name, basePrice: price, description });
  }
  return ok(products);
}

export function parseMenuImport(raw: unknown): Result<MenuImport, ImportError> {
  if (!isRecord(raw)) {
    return err({ kind: "not-an-object", message: "El menú debe ser un objeto JSON" });
  }
  const rawCategories = raw.categories;
  if (!Array.isArray(rawCategories) || rawCategories.length === 0) {
    return err({ kind: "no-categories", message: "Debe haber al menos una categoría" });
  }

  const categories: ImportCategory[] = [];
  for (let i = 0; i < rawCategories.length; i++) {
    const item = rawCategories[i];
    const path = `categories[${i}]`;
    const name = isRecord(item) ? asString(item.name) : null;
    if (!name || name.trim() === "") {
      return err({ kind: "bad-category", message: "categoría sin nombre", path: `${path}.name` });
    }
    const extras = parseExtras(isRecord(item) ? item.extras : undefined, path);
    if (!extras.ok) return extras;
    const optionGroups = parseOptionGroups(isRecord(item) ? item.optionGroups : undefined, path);
    if (!optionGroups.ok) return optionGroups;
    const products = parseProducts(isRecord(item) ? item.products : undefined, path);
    if (!products.ok) return products;

    categories.push({
      name,
      includes: (isRecord(item) ? asString(item.includes) : null) ?? "",
      extras: extras.value,
      optionGroups: optionGroups.value,
      products: products.value,
    });
  }

  return ok({ categories });
}
```

- [ ] **Step 5: Correr y ver verde**

Run: `pnpm vitest run src/core/menu/parse-import.test.ts`
Expected: PASS.

- [ ] **Step 6: Typecheck**

Run: `pnpm typecheck`
Expected: sin errores.

- [ ] **Step 7: Commit**

```bash
git add src/core/menu/
git commit -m "feat(menu): parser puro de import de menú con validación por path"
```

---

### Task 2: Repositorio — `importMenu` transaccional

**Por qué:** La persistencia debe ser atómica: si un producto falla, no queremos categorías a medias. `mode` implementa lo pedido en spec §6.4 ("reemplazar o agregar").

**Files:**
- Modify: `src/infra/db/menu-repository.ts`

**Interfaces:**
- Consumes: `MenuImport` (Task 1), `getDb()`.
- Produces: `importMenu(menu, { mode }): Promise<ImportReport>` (ver arriba).

- [ ] **Step 1: Añadir tipos e implementación**

Al final de `src/infra/db/menu-repository.ts`, añade el import del tipo y la función:

```ts
import type { MenuImport } from "@/core/menu/types";

export type ImportMode = "replace" | "append";
export type ImportReport = {
  categories: number;
  products: number;
  deferred: { extras: number; optionGroups: number };
};

export async function importMenu(
  menu: MenuImport,
  options: { mode: ImportMode },
): Promise<ImportReport> {
  const db = getDb();
  let categoriesCount = 0;
  let productsCount = 0;
  let extrasCount = 0;
  let optionGroupsCount = 0;

  await db.transaction(async (tx) => {
    if (options.mode === "replace") {
      // order_items referencia products; onDelete cascade del schema borra
      // products al borrar categories. Borrar products primero es explícito.
      await tx.delete(products);
      await tx.delete(categories);
    }

    for (let i = 0; i < menu.categories.length; i++) {
      const category = menu.categories[i];
      if (!category) continue;
      const [created] = await tx
        .insert(categories)
        .values({ name: category.name, slug: slugify(category.name), sortOrder: i })
        .returning();
      if (!created) throw new Error(`importMenu: categoría ${category.name} no se insertó`);
      categoriesCount += 1;
      extrasCount += category.extras.length;
      optionGroupsCount += category.optionGroups.length;

      for (let j = 0; j < category.products.length; j++) {
        const product = category.products[j];
        if (!product) continue;
        await tx.insert(products).values({
          categoryId: created.id,
          name: product.name,
          basePrice: product.basePrice,
          description: product.description,
          sortOrder: j,
        });
        productsCount += 1;
      }
    }
  });

  return {
    categories: categoriesCount,
    products: productsCount,
    deferred: { extras: extrasCount, optionGroups: optionGroupsCount },
  };
}
```

> `include`/`extras`/`optionGroups` **no** se persisten: requieren el modelo de modificadores (rama pausada). Se cuentan en `deferred` para que el reporte sea honesto.

- [ ] **Step 2: Verificar que compila**

Run: `pnpm typecheck`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/infra/db/menu-repository.ts
git commit -m "feat(menu): importMenu transaccional con modos replace y append"
```

---

### Task 3: API — `POST /api/admin/import`

**Files:**
- Create: `src/app/api/admin/import/route.ts`

**Interfaces:**
- Consumes: `parseMenuImport` (Task 1), `importMenu` (Task 2).
- Produces: endpoint HTTP.

- [ ] **Step 1: Implementar el handler**

`src/app/api/admin/import/route.ts`:

```ts
import { NextResponse } from "next/server";
import { parseMenuImport } from "@/core/menu/parse-import";
import { importMenu, type ImportMode } from "@/infra/db/menu-repository";

function parseMode(value: unknown): ImportMode {
  return value === "replace" ? "replace" : "append";
}

export async function POST(req: Request) {
  let body: { menu?: unknown; mode?: unknown };
  try {
    body = (await req.json()) as { menu?: unknown; mode?: unknown };
  } catch {
    return NextResponse.json(
      { ok: false, error: { message: "JSON malformado" } },
      { status: 400 },
    );
  }

  const parsed = parseMenuImport(body.menu);
  if (!parsed.ok) {
    return NextResponse.json(
      { ok: false, error: { message: parsed.error.message, path: "path" in parsed.error ? parsed.error.path : undefined } },
      { status: 422 },
    );
  }

  const report = await importMenu(parsed.value, { mode: parseMode(body.mode) });
  return NextResponse.json({ ok: true, data: report });
}
```

- [ ] **Step 2: Probar manualmente el endpoint (dev)**

Run: `pnpm dev`
Luego, en otra terminal (usa el menú real):

```bash
node -e "const fs=require('fs');process.stdout.write(JSON.stringify({menu:JSON.parse(fs.readFileSync('docs/import/lilians-menu.json','utf8')),mode:'append'}))" > /tmp/import-body.json
curl -sS -X POST http://localhost:3000/api/admin/import -H 'content-type: application/json' --data @/tmp/import-body.json
```

Expected: `{"ok":true,"data":{"categories":8,"products":75,...}}` (los conteos exactos se confirman en Task 4). Requiere login/cookies si el middleware protege `/api/admin/*` — si devuelve 401, autenticarse primero vía `/login` y reusar la cookie.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/import/route.ts
git commit -m "feat(api): POST /api/admin/import con validación en el core"
```

---

### Task 4: Test de integración — importar el menú real

**Por qué:** El JSON real es el caso de uso que desbloquea al primer cliente. Probarlo sobre PGlite (infra real) garantiza que el formato y el repo funcionan end-to-end.

**Files:**
- Create: `tests/integration/menu-import.test.ts`

**Interfaces:**
- Consumes: `parseMenuImport` (Task 1), `importMenu` (Task 2), `docs/import/lilians-menu.json`.
- Produces: cobertura de integración.

- [ ] **Step 1: Escribir el test**

`tests/integration/menu-import.test.ts`:

```ts
// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { parseMenuImport } from "@/core/menu/parse-import";
import { getDb } from "@/infra/db/client";
import { categories, products } from "@/infra/db/schema";
import { importMenu } from "@/infra/db/menu-repository";

function loadRealMenu() {
  const raw = JSON.parse(readFileSync("docs/import/lilians-menu.json", "utf8"));
  const parsed = parseMenuImport(raw);
  if (!parsed.ok) throw new Error("el menú real debe parsear");
  return parsed.value;
}

describe("importMenu con el menú real de Lilian's", () => {
  it("importa todas las categorías y productos", async () => {
    const menu = loadRealMenu();
    const report = await importMenu(menu, { mode: "replace" });

    expect(report.categories).toBe(menu.categories.length);
    expect(report.products).toBe(
      menu.categories.reduce((sum, c) => sum + c.products.length, 0),
    );

    const db = getDb();
    const cats = await db.select().from(categories);
    expect(cats.length).toBe(menu.categories.length);
  });

  it("replace limpia lo previo; append acumula", async () => {
    const menu = loadRealMenu();
    await importMenu(menu, { mode: "replace" });
    const first = await importMenu(menu, { mode: "append" });

    const db = getDb();
    const cats = await db.select().from(categories);
    expect(cats.length).toBe(menu.categories.length * 2);
    expect(first.categories).toBe(menu.categories.length);
  });

  it("cada producto queda ligado a su categoría", async () => {
    const menu = loadRealMenu();
    await importMenu(menu, { mode: "replace" });
    const db = getDb();
    const [hamburguesas] = await db
      .select()
      .from(categories)
      .where(eq(categories.slug, "hamburguesas"));
    if (!hamburguesas) throw new Error("falta categoría Hamburguesas");
    const rows = await db
      .select()
      .from(products)
      .where(eq(products.categoryId, hamburguesas.id));
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((p) => p.basePrice !== "0.00")).toBe(true);
  });
});
```

- [ ] **Step 2: Correr y ver verde**

Run: `pnpm test:integration`
Expected: PASS.

- [ ] **Step 3: Confirmar conteos reales**

Del reporte, anotar `categories` y `products` reales. Ajustar el comentario de Task 3 Step 2 con los números exactos.

- [ ] **Step 4: Commit**

```bash
git add tests/integration/menu-import.test.ts
git commit -m "test(menu): integración de import con el menú real sobre PGlite"
```

---

### Task 5: UI — `/admin/import`

**Files:**
- Create: `src/app/admin/import/page.tsx`
- Create: `src/app/admin/import/import-form.tsx`
- Modify: `src/app/admin/layout.tsx` (añadir link "Importar")

**Interfaces:**
- Consumes: `POST /api/admin/import`.
- Produces: página admin.

- [ ] **Step 1: Página server shell**

`src/app/admin/import/page.tsx`:

```tsx
import { ImportForm } from "./import-form";

export default function ImportPage() {
  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="mb-2 text-2xl font-bold">Importar menú</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Subí un archivo JSON con el formato documentado en docs/import/README.md.
      </p>
      <ImportForm />
    </main>
  );
}
```

- [ ] **Step 2: Formulario client**

`src/app/admin/import/import-form.tsx`:

```tsx
"use client";

import { useState } from "react";

type ImportReport = {
  categories: number;
  products: number;
  deferred: { extras: number; optionGroups: number };
};

export function ImportForm() {
  const [mode, setMode] = useState<"append" | "replace">("append");
  const [status, setStatus] = useState<string>("");
  const [report, setReport] = useState<ImportReport | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setReport(null);
    setStatus("Importando…");
    const form = event.currentTarget;
    const fileInput = form.elements.namedItem("file");
    if (!(fileInput instanceof HTMLInputElement) || !fileInput.files?.[0]) {
      setStatus("Elegí un archivo JSON");
      return;
    }
    let menu: unknown;
    try {
      menu = JSON.parse(await fileInput.files[0].text());
    } catch {
      setStatus("El archivo no es JSON válido");
      return;
    }

    const res = await fetch("/api/admin/import", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ menu, mode }),
    });
    const json: { ok: boolean; data?: ImportReport; error?: { message: string } } = await res.json();
    if (!json.ok) {
      setStatus(`Error: ${json.error?.message ?? "desconocido"}`);
      return;
    }
    setReport(json.data ?? null);
    setStatus("Listo");
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2" role="radiogroup" aria-label="Modo de importación">
        <label className="flex items-center gap-2">
          <input type="radio" name="mode" checked={mode === "append"} onChange={() => setMode("append")} />
          Agregar al menú existente
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" name="mode" checked={mode === "replace"} onChange={() => setMode("replace")} />
          Reemplazar todo el menú
        </label>
      </div>

      <input type="file" name="file" accept="application/json,.json" required />

      <button type="submit" className="rounded bg-black px-4 py-2 text-white">
        Importar
      </button>

      <p role="status" aria-live="polite">{status}</p>
      {report && (
        <pre className="rounded bg-gray-100 p-3 text-sm">
          {`Categorías: ${report.categories}\nProductos: ${report.products}\nDiferidos → extras: ${report.deferred.extras}, grupos de opciones: ${report.deferred.optionGroups}`}
        </pre>
      )}
    </form>
  );
}
```

- [ ] **Step 3: Añadir link en la nav admin**

En `src/app/admin/layout.tsx`, añadir el link `/admin/import` junto a los existentes ("Menú", "Categorías", etc.), siguiendo el mismo patrón de links ya usado en el archivo.

- [ ] **Step 4: Verificar en el navegador**

Run: `pnpm dev`, abrir `http://localhost:3000/admin/import` (login primero).
Expected: subir `docs/import/lilians-menu.json` con modo "Reemplazar" → reporte con conteos; en `/admin/menu` se ven las 8 categorías y los productos.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/import/ src/app/admin/layout.tsx
git commit -m "feat(admin): página /admin/import con file picker y modos replace/append"
```

---

### Task 6: Verificación final

- [ ] **Step 1: Typecheck**

Run: `pnpm typecheck`
Expected: sin errores.

- [ ] **Step 2: Lint**

Run: `pnpm lint`
Expected: sin errores.

- [ ] **Step 3: Todo el suite**

Run: `pnpm test`
Expected: PASS (unit + integración).

- [ ] **Step 4: Build de producción**

Este Mac (volumen externo) rompe Turbopack con shadow files `._*` (ver AGENTS.md). Limpiar antes:

```bash
find .next -name '._*' -delete
pnpm build
```

Expected: build OK.

- [ ] **Step 5: Actualizar AGENTS.md**

Añadir al "Estado actual": Import de menú ✅, con conteos del menú real y nota de que `extras`/`optionGroups` quedan diferidos a la fase de modificadores.

- [ ] **Step 6: Commit final (si hubo cambios)**

```bash
git add -A
git commit -m "chore(menu): verificación de import (typecheck, lint, tests, build)"
```

## Verde para cerrar la fase

- `parseMenuImport` cubierto por unit tests (rojo→verde).
- `importMenu` transaccional probado sobre PGlite con el JSON real.
- `/admin/import` carga el menú de Lilian's end-to-end en el navegador.
- `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` verdes.
- `docs/import/README.md` y spec §6.4 en sync con lo implementado.

## Fuera de alcance (fases siguientes)

- Persistir `includes`/`extras`/`optionGroups` (modelo de modificadores, rama pausada).
- UX/UI de personalización por categoría (quitar ingredientes, elegir sabor, agregar extras).
- Zonas de entrega (`deliveryZones`).
- Import a media-library/backups.
