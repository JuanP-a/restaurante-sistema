# Desktop Fase 2 — Impresión ESC/POS server-side — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Imprimir comanda (sin precios) y cuenta (con precios) server-side a una impresora térmica de red (`IP:9100`) vía bytes ESC/POS, con fallback al navegador cuando no hay impresora configurada.

**Architecture:** Renderer **puro** en `src/core/printing/` (pedido → `Uint8Array` ESC/POS, sin I/O). Puerto `PrintTransport` + adapters `tcp`/`fake` en `src/infra/printer/`. `print-service.ts` orquesta render → transport → reintentos → eventos. Los endpoints `POST /api/orders/[id]/print-{kitchen,bill}` auto-detectan por `PRINTER_HOST`: presente → server-side; ausente → comportamiento actual (registra evento, imprime el navegador).

**Tech Stack:** TypeScript estricto, Node `net` (TCP), Drizzle ORM, Vitest, Next.js 16 App Router.

**Spec:** [`docs/superpowers/specs/2026-10-07-desktop-02-print-escpos-design.md`](../specs/2026-10-07-desktop-02-print-escpos-design.md)

## Global Constraints

- TypeScript estricto. **Prohibido** `any`, non-null assertion (`!`), type assertions (`as Tipo`). Usar `satisfies` para shape checking.
- **Functional core, imperative shell:** el renderer y los byte-builders son puros (sin I/O) en `src/core/`; I/O (socket, DB) solo en `src/infra/` y handlers.
- **TDD:** test antes que implementación (red → green → refactor). Target ≥80% coverage. Sin mocks: el `fake` es una implementación in-memory del puerto; el adapter TCP se prueba contra un `net.createServer` real.
- **YAGNI:** nada fuera del spec (USB, 2 impresoras, logo, cajón, auto-update quedan fuera).
- Errores explícitos con `Result` (`src/core/result.ts`) en el core; excepciones solo en la shell.
- Comentarios solo para el "por qué" no obvio.
- **pnpm**, nunca npm/npx. Commits convencionales, chicos y verificables.
- Nombres de dominio en español, tecnología en inglés. (Nota: el código existente usa inglés para entidades — `orders`, `orderItems` — por consistencia con `schema.ts`; se mantiene ese estilo.)
- **Impresora:** 1, ambos tickets. **Corte completo** (`GS V 0`), sin cajón. **48 columnas** (80 mm, Font A). **CP850**.
- Reintentos: 3 intentos, backoff 250/500/1000 ms, timeout 3 s por intento (constantes de código, no env).

---

## File Structure

**Crear:**
```
src/core/printing/
  types.ts             # TicketItem, KitchenTicketData, BillTicketData
  cp850.ts             # encodeCp850(text): number[]
  escpos-bytes.ts      # init, selectCp850, align, bold, doubleSize, feed, cut
  render-ticket.ts     # formatDateTime, formatMoney, truncate, twoColumns, renderKitchenTicket, renderBillTicket
  cp850.test.ts
  escpos-bytes.test.ts
  render-ticket.test.ts
src/infra/printer/
  transport.ts         # PrintTransport port + PrintError
  fake.ts              # createFakeTransport()
  tcp.ts               # createTcpTransport()
  index.ts             # resolveTransport()
  print-service.ts     # printOrder(), PrintKind, PrintOutcome, PrintOptions
  tcp.test.ts
tests/integration/printer/
  print-service.test.ts
  print-routes.test.ts
```

**Modificar:**
- `src/infra/db/schema.ts` — añadir `"print_failed"` a `eventKindEnum`.
- `drizzle/` — migración generada por `pnpm drizzle:generate`.
- `src/env.ts` — `PRINTER_HOST`, `PRINTER_PORT`.
- `.env.example` — documentar las dos vars.
- `src/app/api/orders/[id]/print-kitchen/route.ts` — wire `printOrder`.
- `src/app/api/orders/[id]/print-bill/route.ts` — wire `printOrder`.
- `src/app/print/[id]/kitchen/page.tsx` — `window.print()` solo si `printed === "browser"`.
- `src/app/print/[id]/bill/page.tsx` — idem.
- `AGENTS.md`, `docs/deuda-tecnica.md` — sincronizar estado.

---

## Task 1: Encoder CP850 (core puro)

**Files:**
- Create: `src/core/printing/cp850.ts`
- Test: `src/core/printing/cp850.test.ts`

**Interfaces:**
- Produces: `encodeCp850(text: string): number[]` — bytes CP850; ASCII `0x20–0x7e` y `\n` pasan igual; caracteres del set extendido se mapean; cualquier otro → `0x3f` (`?`).

- [ ] **Step 1: Write the failing test**

```ts
// src/core/printing/cp850.test.ts
import { describe, expect, test } from "vitest";
import { encodeCp850 } from "./cp850";

describe("encodeCp850", () => {
  test("ASCII pasa sin cambios", () => {
    expect(encodeCp850("Hamburguesa 2x")).toEqual([
      0x48, 0x61, 0x6d, 0x62, 0x75, 0x72, 0x67, 0x75, 0x65, 0x73, 0x61, 0x20,
      0x32, 0x78,
    ]);
  });

  test("mapea acentos y signos del español", () => {
    expect(encodeCp850("ñáé")).toEqual([0xa4, 0xa0, 0x82]);
    expect(encodeCp850("¿¡")).toEqual([0xa8, 0xad]);
    expect(encodeCp850("ÁÉÍÓÚÜÑ")).toEqual([0xb5, 0x90, 0xd6, 0xe0, 0xe9, 0x9a, 0xa5]);
  });

  test("salto de línea es 0x0a", () => {
    expect(encodeCp850("a\nb")).toEqual([0x61, 0x0a, 0x62]);
  });

  test("carácter no mapeado cae a '?'", () => {
    expect(encodeCp850("→")).toEqual([0x3f]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/core/printing/cp850.test.ts`
Expected: FAIL — "Cannot find module './cp850'".

- [ ] **Step 3: Write minimal implementation**

```ts
// src/core/printing/cp850.ts
const CP850: Record<string, number> = {
  "Ç": 0x80, "ü": 0x81, "é": 0x82, "â": 0x83, "ä": 0x84, "à": 0x85, "å": 0x86,
  "ç": 0x87, "ê": 0x88, "ë": 0x89, "è": 0x8a, "ï": 0x8b, "î": 0x8c, "ì": 0x8d,
  "Ä": 0x8e, "Å": 0x8f, "É": 0x90, "æ": 0x91, "Æ": 0x92, "ô": 0x93, "ö": 0x94,
  "ò": 0x95, "û": 0x96, "ù": 0x97, "ÿ": 0x98, "Ö": 0x99, "Ü": 0x9a, "ø": 0x9b,
  "£": 0x9c, "Ø": 0x9d, "×": 0x9e, "ƒ": 0x9f, "á": 0xa0, "í": 0xa1, "ó": 0xa2,
  "ú": 0xa3, "ñ": 0xa4, "Ñ": 0xa5, "ª": 0xa6, "º": 0xa7, "¿": 0xa8, "®": 0xa9,
  "¬": 0xaa, "½": 0xab, "¼": 0xac, "¡": 0xad, "«": 0xae, "»": 0xaf, "Á": 0xb5,
  "Í": 0xd6, "Ó": 0xe0, "Ú": 0xe9,
};

export function encodeCp850(text: string): number[] {
  const bytes: number[] = [];
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    if (code >= 0x20 && code <= 0x7e) {
      bytes.push(code);
      continue;
    }
    if (char === "\n") {
      bytes.push(0x0a);
      continue;
    }
    bytes.push(CP850[char] ?? 0x3f);
  }
  return bytes;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/core/printing/cp850.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/printing/cp850.ts src/core/printing/cp850.test.ts
git commit -m "feat(printing): encoder puro UTF-8 -> CP850 para ESC/POS"
```

---

## Task 2: Comandos ESC/POS (core puro)

**Files:**
- Create: `src/core/printing/escpos-bytes.ts`
- Test: `src/core/printing/escpos-bytes.test.ts`

**Interfaces:**
- Produces: `init()`, `selectCp850()`, `align(a: "left"|"center"|"right")`, `bold(on: boolean)`, `doubleSize(on: boolean)`, `feed(lines?: number)`, `cut()` — todas devuelven `number[]`. Constantes `ESC = 0x1b`, `GS = 0x1d`.

- [ ] **Step 1: Write the failing test**

```ts
// src/core/printing/escpos-bytes.test.ts
import { describe, expect, test } from "vitest";
import { ESC, GS, align, bold, cut, doubleSize, feed, init, selectCp850 } from "./escpos-bytes";

describe("escpos-bytes", () => {
  test("init y selectCp850", () => {
    expect(init()).toEqual([ESC, 0x40]);
    expect(selectCp850()).toEqual([ESC, 0x74, 0x02]);
  });

  test("align mapea izquierda/centro/derecha", () => {
    expect(align("left")).toEqual([ESC, 0x61, 0x00]);
    expect(align("center")).toEqual([ESC, 0x61, 0x01]);
    expect(align("right")).toEqual([ESC, 0x61, 0x02]);
  });

  test("bold on/off", () => {
    expect(bold(true)).toEqual([ESC, 0x45, 0x01]);
    expect(bold(false)).toEqual([ESC, 0x45, 0x00]);
  });

  test("doubleSize on/off", () => {
    expect(doubleSize(true)).toEqual([GS, 0x21, 0x11]);
    expect(doubleSize(false)).toEqual([GS, 0x21, 0x00]);
  });

  test("feed con cantidad y corte completo", () => {
    expect(feed()).toEqual([ESC, 0x64, 0x01]);
    expect(feed(3)).toEqual([ESC, 0x64, 0x03]);
    expect(cut()).toEqual([GS, 0x56, 0x00]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/core/printing/escpos-bytes.test.ts`
Expected: FAIL — "Cannot find module './escpos-bytes'".

- [ ] **Step 3: Write minimal implementation**

```ts
// src/core/printing/escpos-bytes.ts
export const ESC = 0x1b;
export const GS = 0x1d;

export function init(): number[] {
  return [ESC, 0x40];
}

export function selectCp850(): number[] {
  return [ESC, 0x74, 0x02];
}

export function align(position: "left" | "center" | "right"): number[] {
  const value = position === "left" ? 0x00 : position === "center" ? 0x01 : 0x02;
  return [ESC, 0x61, value];
}

export function bold(on: boolean): number[] {
  return [ESC, 0x45, on ? 0x01 : 0x00];
}

export function doubleSize(on: boolean): number[] {
  return [GS, 0x21, on ? 0x11 : 0x00];
}

export function feed(lines = 1): number[] {
  return [ESC, 0x64, lines];
}

export function cut(): number[] {
  return [GS, 0x56, 0x00];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/core/printing/escpos-bytes.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/printing/escpos-bytes.ts src/core/printing/escpos-bytes.test.ts
git commit -m "feat(printing): comandos ESC/POS puros (init/align/bold/feed/cut)"
```

---

## Task 3: Renderer de tickets (core puro)

**Files:**
- Create: `src/core/printing/types.ts`, `src/core/printing/render-ticket.ts`
- Test: `src/core/printing/render-ticket.test.ts`

**Interfaces:**
- Consumes: `encodeCp850` (Task 1), comandos ESC/POS (Task 2).
- Produces:
  - Tipos: `TicketItem { quantity: number; name: string; removed: string[]; extras: { name: string; price: string }[]; itemTotal: string }`, `KitchenTicketData`, `BillTicketData`.
  - Helpers puros: `formatDateTime(date: Date): string` (`dd/MM/yyyy HH:mm`), `formatMoney(amount: string): string` (`$<amount>`), `truncate(text: string, max: number): string`, `twoColumns(left: string, right: string, width?: number): string`.
  - `renderKitchenTicket(data: KitchenTicketData): Uint8Array`, `renderBillTicket(data: BillTicketData): Uint8Array`.

- [ ] **Step 1: Write the failing test**

```ts
// src/core/printing/render-ticket.test.ts
import { describe, expect, test } from "vitest";
import { GS } from "./escpos-bytes";
import {
  formatDateTime,
  formatMoney,
  renderBillTicket,
  renderKitchenTicket,
  truncate,
  twoColumns,
} from "./render-ticket";
import type { KitchenTicketData } from "./types";

function includesSequence(haystack: Uint8Array, needle: number[]): boolean {
  outer: for (let i = 0; i + needle.length <= haystack.length; i += 1) {
    for (let j = 0; j < needle.length; j += 1) {
      if (haystack[i + j] !== needle[j]) continue outer;
    }
    return true;
  }
  return false;
}

const baseKitchen: KitchenTicketData = {
  serviceType: "local",
  sequentialNumber: 7,
  createdAt: new Date(2026, 9, 7, 15, 30),
  notes: "sin picante",
  items: [
    { quantity: 2, name: "Hamburguesa", removed: ["cebolla"], extras: [{ name: "queso", price: "10.00" }], itemTotal: "200.00" },
  ],
};

describe("helpers de formato", () => {
  test("formatDateTime usa dd/MM/yyyy HH:mm", () => {
    expect(formatDateTime(new Date(2026, 9, 7, 9, 5))).toBe("07/10/2026 09:05");
  });
  test("formatMoney antepone $", () => {
    expect(formatMoney("180.00")).toBe("$180.00");
  });
  test("truncate recorta con puntos suspensivos ASCII", () => {
    expect(truncate("abcdef", 5)).toBe("ab...");
    expect(truncate("abc", 5)).toBe("abc");
  });
  test("twoColumns alinea a la derecha en 48 columnas", () => {
    const line = twoColumns("TOTAL", "$210.00");
    expect(line).toHaveLength(48);
    expect(line.startsWith("TOTAL")).toBe(true);
    expect(line.endsWith("$210.00")).toBe(true);
  });
});

describe("renderKitchenTicket", () => {
  test("incluye servicio, número, ítem, notas y corte; sin precios", () => {
    const bytes = renderKitchenTicket(baseKitchen);
    expect(includesSequence(bytes, [0x50, 0x45, 0x44, 0x49, 0x44, 0x4f, 0x20, 0x23, 0x37])).toBe(true); // "PEDIDO #7"
    expect(includesSequence(bytes, [0x2d, 0x20, 0x73, 0x69, 0x6e, 0x20])).toBe(true); // "- sin "
    expect(includesSequence(bytes, [0x0a])).toBe(true);
    expect(bytes.includes(0x24)).toBe(false); // sin '$'
    expect(bytes[bytes.length - 3]).toBe(GS);
  });
});

describe("renderBillTicket", () => {
  test("incluye precios, totales y nombre del negocio", () => {
    const bytes = renderBillTicket({
      businessName: "Taquería Ñ",
      businessAddress: "Calle 1",
      businessPhone: "555",
      serviceType: "delivery",
      sequentialNumber: 12,
      createdAt: new Date(2026, 9, 7, 15, 30),
      deliveryAddress: "Av. Reforma 10",
      subtotal: "200.00",
      deliveryCost: "30.00",
      total: "230.00",
      items: [
        { quantity: 2, name: "Taco", removed: [], extras: [{ name: "queso", price: "10.00" }], itemTotal: "200.00" },
      ],
    });
    expect(includesSequence(bytes, [0x24, 0x32, 0x33, 0x30, 0x2e, 0x30, 0x30])).toBe(true); // "$230.00"
    expect(includesSequence(bytes, [0x54, 0x4f, 0x54, 0x41, 0x4c])).toBe(true); // "TOTAL"
    expect(bytes.includes(0xa5)).toBe(true); // 'Ñ' en CP850
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/core/printing/render-ticket.test.ts`
Expected: FAIL — "Cannot find module './render-ticket'".

- [ ] **Step 3: Write minimal implementation**

```ts
// src/core/printing/types.ts
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
```

```ts
// src/core/printing/render-ticket.ts
import { encodeCp850 } from "./cp850";
import { align, bold, cut, feed, init, selectCp850 } from "./escpos-bytes";
import type { BillTicketData, KitchenTicketData, TicketItem } from "./types";

const WIDTH = 48;

export function formatDateTime(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function formatMoney(amount: string): string {
  return `$${amount}`;
}

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 3))}...`;
}

export function twoColumns(left: string, right: string, width = WIDTH): string {
  const space = Math.max(1, width - left.length - right.length);
  return `${left}${" ".repeat(space)}${right}`;
}

function text(value: string): number[] {
  return [...encodeCp850(value), 0x0a];
}

function renderItems(items: TicketItem[], withPrices: boolean): number[] {
  const out: number[] = [];
  for (const item of items) {
    const name = `${item.quantity}x ${item.name}`;
    if (withPrices) {
      out.push(...text(twoColumns(truncate(name, WIDTH - 10), formatMoney(item.itemTotal))));
    } else {
      out.push(...bold(true), ...text(truncate(name, WIDTH)), ...bold(false));
    }
    for (const removed of item.removed) out.push(...text(`   - sin ${removed}`));
    for (const extra of item.extras) {
      out.push(...text(
        withPrices
          ? twoColumns(`   + ${truncate(extra.name, WIDTH - 14)}`, formatMoney(extra.price))
          : `   + extra ${extra.name}`,
      ));
    }
  }
  return out;
}

export function renderKitchenTicket(data: KitchenTicketData): Uint8Array {
  const out: number[] = [
    ...init(),
    ...selectCp850(),
    ...align("center"),
    ...bold(true),
    ...text(data.serviceType === "delivery" ? "DOMICILIO" : "LOCAL"),
    ...text(`PEDIDO #${data.sequentialNumber}`),
    ...bold(false),
    ...text(formatDateTime(data.createdAt)),
    ...align("left"),
    ...text(""),
  ];
  out.push(...renderItems(data.items, false));
  if (data.notes) out.push(...text(""), ...text(`NOTAS: ${data.notes}`));
  out.push(...feed(3), ...cut());
  return Uint8Array.from(out);
}

export function renderBillTicket(data: BillTicketData): Uint8Array {
  const out: number[] = [
    ...init(),
    ...selectCp850(),
    ...align("center"),
    ...bold(true),
    ...text(data.businessName),
    ...bold(false),
  ];
  if (data.businessAddress) out.push(...text(data.businessAddress));
  if (data.businessPhone) out.push(...text(data.businessPhone));
  out.push(
    ...align("left"),
    ...text(""),
    ...text(data.serviceType === "delivery" ? "DOMICILIO" : "LOCAL"),
    ...text(`PEDIDO #${data.sequentialNumber}`),
    ...text(formatDateTime(data.createdAt)),
  );
  if (data.deliveryAddress) out.push(...text(data.deliveryAddress));
  out.push(
    ...text(""),
    ...renderItems(data.items, true),
    ...text(""),
    ...text(twoColumns("SUBTOTAL", formatMoney(data.subtotal))),
    ...text(twoColumns("ENVIO", formatMoney(data.deliveryCost))),
    ...bold(true),
    ...text(twoColumns("TOTAL", formatMoney(data.total))),
    ...bold(false),
    ...feed(3),
    ...cut(),
  );
  return Uint8Array.from(out);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/core/printing/render-ticket.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/printing/types.ts src/core/printing/render-ticket.ts src/core/printing/render-ticket.test.ts
git commit -m "feat(printing): renderer puro de comanda y cuenta a ESC/POS"
```

---

## Task 4: Evento `print_failed` en el schema + migración

**Files:**
- Modify: `src/infra/db/schema.ts:10-12`
- Create: `drizzle/0002_*.sql` (generada)
- Modify: `drizzle/meta/_journal.json` (generada)

**Interfaces:**
- Produces: `eventKindEnum` incluye `"print_failed"`; migración aplicada en boot.

- [ ] **Step 1: Modify the schema**

Reemplazar el enum de eventos:

```ts
export const eventKindEnum = pgEnum("event_kind", [
  "created", "status_change", "printed_kitchen", "printed_bill", "notified", "print_failed",
]);
```

- [ ] **Step 2: Generate the migration**

Run: `pnpm drizzle:generate`
Expected: crea `drizzle/0002_*.sql` y actualiza `drizzle/meta/_journal.json`.

- [ ] **Step 3: Verify the generated SQL**

Abrir el archivo `drizzle/0002_*.sql` generado. Debe contener una sentencia equivalente a:

```sql
ALTER TYPE "public"."event_kind" ADD VALUE 'print_failed';
```

Si el archivo no existe o no contiene esa sentencia, **parar** y revisar (no editar la DB a mano).

- [ ] **Step 4: Verify the migration applies on PGlite**

Run: `pnpm test:integration`
Expected: PASS — la suite arranca la DB en `memory://` y aplica las migraciones en boot. Si el `ALTER TYPE ... ADD VALUE` falla dentro de transacción, este paso lo expone.

- [ ] **Step 5: Commit**

```bash
git add src/infra/db/schema.ts drizzle/
git commit -m "feat(db): agrega evento print_failed para fallos de impresión"
```

---

## Task 5: Puerto `PrintTransport` + fake

**Files:**
- Create: `src/infra/printer/transport.ts`, `src/infra/printer/fake.ts`
- Test: `src/infra/printer/fake.test.ts`

**Interfaces:**
- Consumes: `Result` de `@/core/result`.
- Produces:
  - `PrintError` (unión discriminada: `not_configured` | `timeout` | `connection` | `io`).
  - `PrintTransport { send(bytes: Uint8Array): Promise<Result<void, PrintError>> }`.
  - `createFakeTransport(options?: { failTimes?: number }): FakeTransport` donde `FakeTransport = PrintTransport & { sent: Uint8Array[] }`.

- [ ] **Step 1: Write the failing test**

```ts
// src/infra/printer/fake.test.ts
import { describe, expect, test } from "vitest";
import { createFakeTransport } from "./fake";

describe("createFakeTransport", () => {
  test("captura los bytes enviados", async () => {
    const transport = createFakeTransport();
    const bytes = Uint8Array.from([0x1b, 0x40]);
    const result = await transport.send(bytes);
    expect(result.ok).toBe(true);
    expect(transport.sent).toEqual([bytes]);
  });

  test("falla las primeras N veces y luego acepta", async () => {
    const transport = createFakeTransport({ failTimes: 2 });
    const bytes = Uint8Array.from([0x01]);
    expect((await transport.send(bytes)).ok).toBe(false);
    expect((await transport.send(bytes)).ok).toBe(false);
    expect((await transport.send(bytes)).ok).toBe(true);
    expect(transport.sent).toEqual([bytes]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/infra/printer/fake.test.ts`
Expected: FAIL — "Cannot find module './fake'".

- [ ] **Step 3: Write minimal implementation**

```ts
// src/infra/printer/transport.ts
import type { Result } from "@/core/result";

export type PrintError =
  | { kind: "not_configured" }
  | { kind: "timeout" }
  | { kind: "connection"; message: string }
  | { kind: "io"; message: string };

export type PrintTransport = {
  send(bytes: Uint8Array): Promise<Result<void, PrintError>>;
};
```

```ts
// src/infra/printer/fake.ts
import { err, ok, type Result } from "@/core/result";
import type { PrintError, PrintTransport } from "./transport";

export type FakeTransport = PrintTransport & { sent: Uint8Array[] };

export function createFakeTransport(options?: { failTimes?: number }): FakeTransport {
  let remainingFailures = options?.failTimes ?? 0;
  const sent: Uint8Array[] = [];
  return {
    sent,
    async send(bytes: Uint8Array): Promise<Result<void, PrintError>> {
      if (remainingFailures > 0) {
        remainingFailures -= 1;
        return err({ kind: "connection", message: "fallo simulado" });
      }
      sent.push(bytes);
      return ok(undefined);
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/infra/printer/fake.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/infra/printer/transport.ts src/infra/printer/fake.ts src/infra/printer/fake.test.ts
git commit -m "feat(printer): puerto PrintTransport + fake in-memory"
```

---

## Task 6: Adapter TCP (impresora de red)

**Files:**
- Create: `src/infra/printer/tcp.ts`
- Test: `src/infra/printer/tcp.test.ts`

**Interfaces:**
- Consumes: `PrintTransport`, `PrintError` (Task 5), `Result` de `@/core/result`.
- Produces: `createTcpTransport(options: { host: string; port: number; timeoutMs?: number }): PrintTransport` (timeout default 3000 ms).

- [ ] **Step 1: Write the failing test**

```ts
// src/infra/printer/tcp.test.ts
// @vitest-environment node
import net from "node:net";
import { afterEach, describe, expect, test } from "vitest";
import { createTcpTransport } from "./tcp";

describe("createTcpTransport", () => {
  const servers: net.Server[] = [];
  const sockets: net.Socket[] = [];

  afterEach(async () => {
    for (const socket of sockets.splice(0)) socket.destroy();
    await Promise.all(
      servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))),
    );
  });

  function trackServer(server: net.Server): void {
    servers.push(server);
    server.on("connection", (socket) => sockets.push(socket));
  }

  async function startServer(onData: (chunk: Buffer) => void): Promise<number> {
    const server = net.createServer((socket) => socket.on("data", onData));
    trackServer(server);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("sin puerto asignado");
    return address.port;
  }

  // El transporte resuelve al terminar de enviar (no al cerrar el peer), así que
  // los bytes pueden llegar al servidor uno o dos ticks después. Esperamos la
  // recepción para que la aserción no dependa del scheduling del event loop.
  async function waitForBytes(received: Buffer[]): Promise<void> {
    const deadline = Date.now() + 1000;
    while (received.length === 0 && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
  }

  test("envía los bytes a la impresora de red", async () => {
    const received: Buffer[] = [];
    const port = await startServer((chunk) => received.push(chunk));
    const transport = createTcpTransport({ host: "127.0.0.1", port });

    const result = await transport.send(Uint8Array.from([0x1b, 0x40, 0x41]));

    await waitForBytes(received);
    expect(result.ok).toBe(true);
    expect(Buffer.concat(received)).toEqual(Buffer.from([0x1b, 0x40, 0x41]));
  });

  test("devuelve error de conexión cuando nadie escucha", async () => {
    const transport = createTcpTransport({ host: "127.0.0.1", port: 1, timeoutMs: 500 });
    const result = await transport.send(Uint8Array.from([0x00]));
    expect(result.ok).toBe(false);
  });

  test("resuelve ok aunque la impresora no cierre la conexión", async () => {
    const received: Buffer[] = [];
    const server = net.createServer({ allowHalfOpen: true }, (socket) => {
      socket.on("data", (chunk: Buffer) => received.push(chunk));
    });
    trackServer(server);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("sin puerto asignado");
    const transport = createTcpTransport({ host: "127.0.0.1", port: address.port, timeoutMs: 500 });

    const result = await transport.send(Uint8Array.from([0x1b, 0x40]));

    await waitForBytes(received);
    expect(result.ok).toBe(true);
    expect(Buffer.concat(received)).toEqual(Buffer.from([0x1b, 0x40]));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/infra/printer/tcp.test.ts`
Expected: FAIL — "Cannot find module './tcp'".

- [ ] **Step 3: Write minimal implementation**

```ts
// src/infra/printer/tcp.ts
import net from "node:net";
import { err, ok, type Result } from "@/core/result";
import type { PrintError, PrintTransport } from "./transport";

export function createTcpTransport(options: {
  host: string;
  port: number;
  timeoutMs?: number;
}): PrintTransport {
  const timeoutMs = options.timeoutMs ?? 3000;
  return {
    send(bytes: Uint8Array): Promise<Result<void, PrintError>> {
      return new Promise((resolve) => {
        const socket = net.createConnection({ host: options.host, port: options.port });
        let settled = false;
        let connected = false;
        const finish = (result: Result<void, PrintError>) => {
          if (settled) return;
          settled = true;
          socket.destroy();
          resolve(result);
        };
        socket.setTimeout(timeoutMs);
        socket.once("timeout", () => finish(err({ kind: "timeout" })));
        socket.once("error", (error: Error) =>
          finish(connected ? err({ kind: "io", message: error.message }) : err({ kind: "connection", message: error.message })),
        );
        socket.once("connect", () => {
          connected = true;
          // Resolver al terminar de enviar (no esperar el FIN del peer): si la
          // impresora deja la conexión abierta, esperar "close" daría timeout
          // espurio -> reintento -> ticket duplicado.
          socket.end(Buffer.from(bytes), () => finish(ok(undefined)));
        });
      });
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/infra/printer/tcp.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/infra/printer/tcp.ts src/infra/printer/tcp.test.ts
git commit -m "feat(printer): adapter TCP a impresora de red IP:9100"
```

---

## Task 7: Env `PRINTER_*` + `resolveTransport`

**Files:**
- Modify: `src/env.ts:5-7` (añadir dos vars)
- Create: `src/infra/printer/index.ts`
- Modify: `.env.example`
- Test: `src/infra/printer/resolve-transport.test.ts`

**Interfaces:**
- Consumes: `createTcpTransport` (Task 6), `PrintTransport` (Task 5), tipo `Env` de `@/env`.
- Produces: `resolveTransport(env: Pick<Env, "PRINTER_HOST" | "PRINTER_PORT">): PrintTransport | null` — `null` si `PRINTER_HOST` vacío; si no, transport TCP a `PRINTER_HOST:PRINTER_PORT`. Recibe el env por parámetro (no lee `getEnv()` adentro) para ser puro y testeable sin variables de entorno.

- [ ] **Step 1: Write the failing test**

```ts
// src/infra/printer/resolve-transport.test.ts
import { describe, expect, test } from "vitest";
import { resolveTransport } from "./index";

describe("resolveTransport", () => {
  test("devuelve null sin PRINTER_HOST (fallback al navegador)", () => {
    expect(resolveTransport({ PRINTER_HOST: "", PRINTER_PORT: 9100 })).toBeNull();
  });
});
```

> **Nota:** el env se inyecta, así que el test no depende de `getEnv()` ni de `.env.local` (CI corre unit sin variables de entorno). La rama TCP la cubre el adapter (Task 6) y el servicio (Task 8).

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/infra/printer/resolve-transport.test.ts`
Expected: FAIL — "Cannot find module './index'".

- [ ] **Step 3: Add env vars**

En `src/env.ts`, dentro del objeto, después de `MIGRATIONS_PATH`:

```ts
    PRINTER_HOST: z.string().default(""),
    PRINTER_PORT: z.coerce.number().int().min(1).max(65535).default(9100),
```

- [ ] **Step 4: Write minimal implementation**

```ts
// src/infra/printer/index.ts
import type { Env } from "@/env";
import { createTcpTransport } from "./tcp";
import type { PrintTransport } from "./transport";

export function resolveTransport(
  env: Pick<Env, "PRINTER_HOST" | "PRINTER_PORT">,
): PrintTransport | null {
  if (!env.PRINTER_HOST) return null;
  return createTcpTransport({ host: env.PRINTER_HOST, port: env.PRINTER_PORT });
}
```

- [ ] **Step 5: Document in `.env.example`**

Añadir al final de `.env.example`:

```bash
# Impresora térmica de red (desktop). Vacío = imprimir desde el navegador.
PRINTER_HOST=
PRINTER_PORT=9100
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm vitest run src/infra/printer/resolve-transport.test.ts`
Expected: PASS (1 test).

- [ ] **Step 7: Commit**

```bash
git add src/env.ts src/infra/printer/index.ts src/infra/printer/resolve-transport.test.ts .env.example
git commit -m "feat(printer): vars PRINTER_HOST/PORT + resolveTransport por env"
```

---

## Task 8: `print-service` (orquesta render + reintentos + eventos)

**Files:**
- Create: `src/infra/printer/print-service.ts`
- Test: `tests/integration/printer/print-service.test.ts`

**Interfaces:**
- Consumes: `renderKitchenTicket`/`renderBillTicket` (Task 3), `PrintTransport`/`PrintError` (Task 5), `createFakeTransport` (Task 5), `getEnv` (Task 7), `getDb`/`orderEvents`, `Order`/`OrderItem` del schema.
- Produces:
  - `PrintKind = "kitchen" | "bill"`.
  - `PrintOutcome = { printed: "server" } | { printed: "browser" } | { printed: "failed"; error: PrintError }`.
  - `PrintOptions { attempts: number; backoffMs: number[] }` y `DEFAULT_PRINT_OPTIONS` (3, `[250, 500, 1000]`).
  - `printOrder(data: { order: Order; items: OrderItem[] }, kind: PrintKind, transport: PrintTransport | null, options?: PrintOptions): Promise<PrintOutcome>`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/integration/printer/print-service.test.ts
// @vitest-environment node
import { beforeEach, describe, expect, test } from "vitest";
import { eq, sql } from "drizzle-orm";
import { getDb } from "@/infra/db/client";
import { categories, orderEvents, products } from "@/infra/db/schema";
import { createOrder, getOrder } from "@/infra/db/order-repository";
import { createFakeTransport } from "@/infra/printer/fake";
import { printOrder } from "@/infra/printer/print-service";

const db = getDb();
const FAST = { attempts: 3, backoffMs: [0, 0, 0] };

async function seedOrder(): Promise<string> {
  const [category] = await db
    .insert(categories)
    .values({ name: "Test", slug: `test-${Date.now()}` })
    .returning();
  const [product] = await db
    .insert(products)
    .values({ categoryId: category.id, name: "Hamburguesa", basePrice: "100" })
    .returning();
  const order = await createOrder({
    serviceType: "local",
    customerPhone: "555",
    customerName: "Cliente",
    deliveryCost: "0",
    subtotal: "200.00",
    total: "200.00",
    source: "staff",
    notes: "",
    items: [
      {
        productId: product.id,
        productNameSnapshot: "Hamburguesa",
        basePriceSnapshot: "100.00",
        unitPrice: "100.00",
        quantity: 2,
        removedIngredients: ["cebolla"],
        extraIngredients: [{ name: "queso", price: "10.00" }],
        itemTotal: "200.00",
      },
    ],
  });
  return order.id;
}

async function eventKinds(orderId: string): Promise<string[]> {
  const rows = await db.select().from(orderEvents).where(eq(orderEvents.orderId, orderId));
  return rows.map((row) => row.kind);
}

beforeEach(async () => {
  await db.execute(
    sql`TRUNCATE TABLE order_events, order_items, orders, products, categories RESTART IDENTITY CASCADE`,
  );
});

describe("printOrder", () => {
  test("sin transport registra evento y hace fallback al navegador", async () => {
    const id = await seedOrder();
    const data = await getOrder(id);
    if (!data) throw new Error("orden no encontrada");

    const outcome = await printOrder(data, "kitchen", null);

    expect(outcome).toEqual({ printed: "browser" });
    expect(await eventKinds(id)).toContain("printed_kitchen");
  });

  test("con transport OK imprime server-side y registra evento", async () => {
    const id = await seedOrder();
    const data = await getOrder(id);
    if (!data) throw new Error("orden no encontrada");
    const transport = createFakeTransport();

    const outcome = await printOrder(data, "bill", transport, FAST);

    expect(outcome).toEqual({ printed: "server" });
    expect(transport.sent).toHaveLength(1);
    expect(await eventKinds(id)).toContain("printed_bill");
  });

  test("reintenta ante fallo y termina OK", async () => {
    const id = await seedOrder();
    const data = await getOrder(id);
    if (!data) throw new Error("orden no encontrada");
    const transport = createFakeTransport({ failTimes: 2 });

    const outcome = await printOrder(data, "kitchen", transport, FAST);

    expect(outcome).toEqual({ printed: "server" });
    expect(transport.sent).toHaveLength(1);
  });

  test("si falla siempre registra print_failed y devuelve failed", async () => {
    const id = await seedOrder();
    const data = await getOrder(id);
    if (!data) throw new Error("orden no encontrada");
    const transport = createFakeTransport({ failTimes: 99 });

    const outcome = await printOrder(data, "kitchen", transport, FAST);

    expect(outcome.printed).toBe("failed");
    expect(await eventKinds(id)).toContain("print_failed");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `VITEST_INIT_DB=1 pnpm vitest run tests/integration/printer/print-service.test.ts`
Expected: FAIL — "Cannot find module '@/infra/printer/print-service'".

- [ ] **Step 3: Write minimal implementation**

```ts
// src/infra/printer/print-service.ts
import { getEnv } from "@/env";
import { renderBillTicket, renderKitchenTicket } from "@/core/printing/render-ticket";
import type { TicketItem } from "@/core/printing/types";
import { getDb } from "@/infra/db/client";
import { orderEvents, type Order, type OrderItem } from "@/infra/db/schema";
import type { PrintError, PrintTransport } from "./transport";

export type PrintKind = "kitchen" | "bill";

export type PrintOutcome =
  | { printed: "server" }
  | { printed: "browser" }
  | { printed: "failed"; error: PrintError };

export type PrintOptions = { attempts: number; backoffMs: number[] };

export const DEFAULT_PRINT_OPTIONS: PrintOptions = { attempts: 3, backoffMs: [250, 500, 1000] };

export type PrintOrderData = { order: Order; items: OrderItem[] };

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function toTicketItem(item: OrderItem): TicketItem {
  return {
    quantity: item.quantity,
    name: item.productNameSnapshot,
    removed: item.removedIngredients,
    extras: item.extraIngredients,
    itemTotal: item.itemTotal,
  };
}

async function logEvent(
  orderId: string,
  kind: "printed_kitchen" | "printed_bill" | "print_failed",
  payload: Record<string, unknown>,
): Promise<void> {
  await getDb().insert(orderEvents).values({ orderId, kind, payload });
}

export async function printOrder(
  data: PrintOrderData,
  kind: PrintKind,
  transport: PrintTransport | null,
  options: PrintOptions = DEFAULT_PRINT_OPTIONS,
): Promise<PrintOutcome> {
  const { order, items } = data;
  const eventKind = kind === "kitchen" ? "printed_kitchen" : "printed_bill";

  if (!transport) {
    await logEvent(order.id, eventKind, { printed: "browser" });
    return { printed: "browser" };
  }

  const env = getEnv();
  const bytes =
    kind === "kitchen"
      ? renderKitchenTicket({
          serviceType: order.serviceType,
          sequentialNumber: order.sequentialNumber,
          createdAt: order.createdAt,
          items: items.map(toTicketItem),
          notes: order.notes,
        })
      : renderBillTicket({
          businessName: env.BUSINESS_NAME,
          businessAddress: env.BUSINESS_ADDRESS,
          businessPhone: env.BUSINESS_PHONE,
          serviceType: order.serviceType,
          sequentialNumber: order.sequentialNumber,
          createdAt: order.createdAt,
          deliveryAddress: order.deliveryAddress ?? undefined,
          items: items.map(toTicketItem),
          subtotal: order.subtotal,
          deliveryCost: order.deliveryCost,
          total: order.total,
        });

  let lastError: PrintError = { kind: "connection", message: "sin intentos" };
  for (let attempt = 0; attempt < options.attempts; attempt += 1) {
    const result = await transport.send(bytes);
    if (result.ok) {
      await logEvent(order.id, eventKind, { printed: "server" });
      return { printed: "server" };
    }
    lastError = result.error;
    if (attempt < options.attempts - 1) await wait(options.backoffMs[attempt] ?? 0);
  }

  await logEvent(order.id, "print_failed", { kind, error: lastError });
  return { printed: "failed", error: lastError };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `VITEST_INIT_DB=1 pnpm vitest run tests/integration/printer/print-service.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/infra/printer/print-service.ts tests/integration/printer/print-service.test.ts
git commit -m "feat(printer): print-service con reintentos y eventos de impresión"
```

---

## Task 9: Wire de los endpoints de impresión

**Files:**
- Modify: `src/app/api/orders/[id]/print-kitchen/route.ts`
- Modify: `src/app/api/orders/[id]/print-bill/route.ts`
- Test: `tests/integration/printer/print-routes.test.ts`

**Interfaces:**
- Consumes: `getOrder` (repo), `resolveTransport` (Task 7), `printOrder`/`PrintOutcome` (Task 8).
- Produces: `POST` en ambos endpoints → `200 { ok: true, printed }` en éxito/fallback; `502 { ok: false, error }` en fallo; `404` si el pedido no existe.

- [ ] **Step 1: Write the failing test**

```ts
// tests/integration/printer/print-routes.test.ts
// @vitest-environment node
import { beforeEach, describe, expect, test } from "vitest";
import { eq, sql } from "drizzle-orm";
import { getDb } from "@/infra/db/client";
import { categories, orderEvents, products } from "@/infra/db/schema";
import { createOrder } from "@/infra/db/order-repository";
import { POST as printKitchen } from "@/app/api/orders/[id]/print-kitchen/route";
import { POST as printBill } from "@/app/api/orders/[id]/print-bill/route";

const db = getDb();

function callRoute(handler: typeof printKitchen, id: string): Promise<Response> {
  return handler(new Request(`http://test/api/orders/${id}/print-kitchen`, { method: "POST" }), {
    params: Promise.resolve({ id }),
  });
}

async function seedOrder(): Promise<string> {
  const [category] = await db
    .insert(categories)
    .values({ name: "Test", slug: `test-${Date.now()}` })
    .returning();
  const [product] = await db
    .insert(products)
    .values({ categoryId: category.id, name: "Taco", basePrice: "50" })
    .returning();
  const order = await createOrder({
    serviceType: "local",
    customerPhone: "555",
    customerName: "Cliente",
    deliveryCost: "0",
    subtotal: "50.00",
    total: "50.00",
    source: "staff",
    notes: "",
    items: [
      {
        productId: product.id,
        productNameSnapshot: "Taco",
        basePriceSnapshot: "50.00",
        unitPrice: "50.00",
        quantity: 1,
        removedIngredients: [],
        extraIngredients: [],
        itemTotal: "50.00",
      },
    ],
  });
  return order.id;
}

beforeEach(async () => {
  await db.execute(
    sql`TRUNCATE TABLE order_events, order_items, orders, products, categories RESTART IDENTITY CASCADE`,
  );
});

describe("endpoints de impresión", () => {
  test("404 cuando el pedido no existe", async () => {
    const res = await callRoute(printKitchen, "00000000-0000-0000-0000-000000000000");
    expect(res.status).toBe(404);
  });

  test("sin PRINTER_HOST responde fallback al navegador y registra evento", async () => {
    const id = await seedOrder();
    const res = await callRoute(printBill, id);
    const body = (await res.json()) as { ok: boolean; printed?: string };

    expect(res.status).toBe(200);
    expect(body.printed).toBe("browser");
    const events = await db.select().from(orderEvents).where(eq(orderEvents.orderId, id));
    expect(events.map((event) => event.kind)).toContain("printed_bill");
  });
});
```

> **Nota de cobertura:** la rama `server`/`failed` del endpoint depende de `PRINTER_HOST` + el cacheo de `getEnv`, difícil de alternar entre tests del mismo archivo. Esa lógica vive en `printOrder` (Task 8, cubierta con fake transport). Acá se cubre el contrato HTTP del fallback al navegador y el 404.

- [ ] **Step 2: Run test to verify it fails**

Run: `VITEST_INIT_DB=1 pnpm vitest run tests/integration/printer/print-routes.test.ts`
Expected: FAIL — el `POST` actual no lee el pedido; devuelve 200 para id inexistente → el assert 404 falla.

- [ ] **Step 3: Implement the routes**

```ts
// src/app/api/orders/[id]/print-kitchen/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getOrder } from "@/infra/db/order-repository";
import { getEnv } from "@/env";
import { resolveTransport } from "@/infra/printer/index";
import { printOrder } from "@/infra/printer/print-service";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const data = await getOrder(id);
  if (!data) {
    return NextResponse.json(
      { ok: false, error: { message: "Pedido no encontrado" } },
      { status: 404 },
    );
  }
  const outcome = await printOrder(data, "kitchen", resolveTransport(getEnv()));
  if (outcome.printed === "failed") {
    return NextResponse.json(
      { ok: false, error: { message: "No se pudo imprimir la comanda" } },
      { status: 502 },
    );
  }
  return NextResponse.json({ ok: true, printed: outcome.printed });
}
```

```ts
// src/app/api/orders/[id]/print-bill/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getOrder } from "@/infra/db/order-repository";
import { getEnv } from "@/env";
import { resolveTransport } from "@/infra/printer/index";
import { printOrder } from "@/infra/printer/print-service";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const data = await getOrder(id);
  if (!data) {
    return NextResponse.json(
      { ok: false, error: { message: "Pedido no encontrado" } },
      { status: 404 },
    );
  }
  const outcome = await printOrder(data, "bill", resolveTransport(getEnv()));
  if (outcome.printed === "failed") {
    return NextResponse.json(
      { ok: false, error: { message: "No se pudo imprimir la cuenta" } },
      { status: 502 },
    );
  }
  return NextResponse.json({ ok: true, printed: outcome.printed });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `VITEST_INIT_DB=1 pnpm vitest run tests/integration/printer/print-routes.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/orders/[id]/print-kitchen/route.ts" "src/app/api/orders/[id]/print-bill/route.ts" tests/integration/printer/print-routes.test.ts
git commit -m "feat(printer): endpoints print-kitchen/bill imprimen server-side o hacen fallback"
```

---

## Task 10: Evitar doble impresión en las páginas `/print/...`

**Files:**
- Modify: `src/app/print/[id]/kitchen/page.tsx:26-36`
- Modify: `src/app/print/[id]/bill/page.tsx:36-46`

**Interfaces:**
- Consumes: respuesta de los endpoints (Task 9): `{ ok: boolean; printed?: "server" | "browser" }`.

- [ ] **Step 1: Adjust the kitchen page**

Reemplazar el `useEffect` (líneas 26-36) por:

```tsx
  const [printed, setPrinted] = useState<string | null>(null);

  useEffect(() => {
    void params.then(({ id }) => {
      void fetch(`/api/orders/${id}`)
        .then((r) => r.json())
        .then((d: { data: Data }) => {
          setData(d.data);
          return fetch(`/api/orders/${id}/print-kitchen`, { method: "POST" });
        })
        .then((r) => r.json())
        .then((res: { printed?: string }) => {
          setPrinted(res.printed ?? null);
          if (res.printed === "browser") setTimeout(() => window.print(), 500);
        });
    });
  }, [params]);
```

Y añadir, antes del bloque de items (después de la línea del número de pedido), un aviso cuando ya imprimió el servidor:

```tsx
      {printed === "server" && (
        <div className="text-center text-xs">Impreso en cocina</div>
      )}
```

- [ ] **Step 2: Adjust the bill page**

Reemplazar el `useEffect` (líneas 36-46) por:

```tsx
  const [printed, setPrinted] = useState<string | null>(null);

  useEffect(() => {
    void params.then(({ id }) => {
      void fetch(`/api/orders/${id}`)
        .then((r) => r.json())
        .then((d: { data: Data }) => {
          setData(d.data);
          return fetch(`/api/orders/${id}/print-bill`, { method: "POST" });
        })
        .then((r) => r.json())
        .then((res: { printed?: string }) => {
          setPrinted(res.printed ?? null);
          if (res.printed === "browser") setTimeout(() => window.print(), 500);
        });
    });
  }, [params]);
```

Y añadir el aviso análogo:

```tsx
      {printed === "server" && (
        <div className="text-center text-xs">Impreso en caja</div>
      )}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: PASS (sin errores).

- [ ] **Step 4: Commit**

```bash
git add "src/app/print/[id]/kitchen/page.tsx" "src/app/print/[id]/bill/page.tsx"
git commit -m "fix(print): no imprimir por navegador si el servidor ya imprimió"
```

---

## Task 11: Sincronizar documentación

**Files:**
- Modify: `AGENTS.md` (Estado actual + variables de entorno)
- Modify: `docs/deuda-tecnica.md` (DT-015)

- [ ] **Step 1: Update AGENTS.md**

En `AGENTS.md`:
- En §"Estado actual" → §"Migración a versión de escritorio", marcar la Fase 2 como ✅ con una línea que resuma lo construido y anote el conteo real de tests verde y el número del PR de esta fase (no inventar; usar los valores reales al cerrar).
- En §"Variables de entorno requeridas" agregar:

```
PRINTER_HOST=                      # IP de la térmica de red (vacío = navegador)
PRINTER_PORT=9100                  # puerto raw ESC/POS
```

- [ ] **Step 2: Update deuda-técnica**

En `docs/deuda-tecnica.md`, fila **DT-015**: cambiar estado a `En progreso` y anotar que la Fase 2 ya tiene plan/spec; Fases 3–5 siguen sin plan.

- [ ] **Step 3: Commit**

```bash
git add AGENTS.md docs/deuda-tecnica.md
git commit -m "docs: marca Fase 2 desktop (impresión ESC/POS) como completada"
```

---

## Verificación final (antes del PR)

- [ ] `pnpm test:unit` → verde
- [ ] `pnpm test:integration` → verde (aplica migración en PGlite)
- [ ] `pnpm typecheck` → sin errores
- [ ] `pnpm build` → OK (recordar `find .next -name '._*' -delete` antes, gotcha H-002)
- [ ] PR contra `main` con el check `verify` verde
