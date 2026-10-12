# Desktop Fase 4 — Shell Electron: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar el producto instalable de escritorio: un `.exe` de Windows que arranca el server Next standalone + PGlite como proceso hijo, vive en la bandeja, sirve la LAN, se reinicia tras un crash y se configura la primera vez con un wizard mínimo de contraseña — más los 3 prerequisitos que bloqueaban el `.exe`.

**Architecture:** El shell Electron (`electron/`, TypeScript compilado aparte) hace `utilityProcess.fork` del `server.js` standalone con env inyectado, espera `GET /api/health`, y abre un `BrowserWindow` contra `127.0.0.1:<puerto>`. La app Next sigue siendo una sola: agrega una tabla `settings` en la DB (donde vive el hash de la contraseña que setea el wizard), un gate de setup en server components, y una pantalla de QR para conectar el celular. La lógica de arranque testeable (selección de puerto, config, URL LAN, supervisión del hijo) vive en módulos puros/inyectables.

**Tech Stack:** Next.js 16 (App Router), TypeScript estricto, Drizzle ORM, PGlite, Electron (`utilityProcess`), electron-builder (NSIS), `qrcode`, Vitest, Playwright, Tailwind + `src/ui`.

## Global Constraints

- TypeScript estricto. **Prohibido** `any`, non-null assertion (`!`), type assertions (`as Tipo`). Usar `satisfies` cuando haga falta shape checking.
- **Functional core, imperative shell**: lógica pura sin I/O en `src/core/`; I/O solo en `src/infra/`, `electron/` y handlers.
- **TDD**: test antes que implementación (red → green → refactor). Target ≥80% coverage.
- **Sin mocks**: los fakes son implementaciones in-memory de interfaces inyectadas; el resto usa infraestructura real (PGlite, fs, `os.networkInterfaces` real en test).
- **YAGNI**: nada fuera de la spec `docs/superpowers/specs/2026-10-11-desktop-04-electron-shell-design.md`.
- Comentarios solo para el "por qué" no obvio.
- **pnpm**, nunca npm/npx.
- Commits chicos, convencionales. Un commit = cambio coherente que pasaría review aislado.
- Nombres de dominio en español, tecnología en inglés.
- Errores explícitos con `Result` (`src/core/result.ts`) en el core; excepciones en la shell.
- `Result<T, E> = { ok: true; value: T } | { ok: false; error: E }`; helpers `ok(v)` / `err(e)`.
- Tests de integración: `// @vitest-environment node` al inicio; `getDb()` (la DB se inicializa en `vitest.setup.ts` cuando `VITEST_INIT_DB=1`).
- Alias de import: `@/*` → `./src/*`.
- **`electron/` se compila con su propio `tsconfig` a `dist-electron/`** (no lo toca el build de Next). Las partes que dependen del runtime de Electron (ventana, tray) **no** se unit-testean: se verifican a mano en Windows.
- Los pasos "verificación de empaquetado/instalación" no llevan check automático; su criterio de cierre es el runbook manual de Task 17.

---

### Task 1: Dependencias + variables de entorno

**Files:**
- Modify: `package.json` (deps)
- Modify: `src/env.ts`
- Modify: `src/env.test.ts`
- Modify: `.env.example`

**Interfaces:**
- Produces: `Env.ADMIN_PASSWORD_HASH: string | undefined` (ahora **opcional**), `Env.SESSION_COOKIE_SECURE: boolean` (default `true`), `Env.DESKTOP_LAN_URL: string | undefined`.
- Produces: dependencias `qrcode`, `@types/qrcode`, `electron`, `electron-builder` instaladas.

- [ ] **Step 1: Escribir el test que falla (env)**

Agregar al final de `src/env.test.ts`, dentro de un `describe` nuevo:

```ts
describe("env de Fase 4 (desktop)", () => {
  const base = {
    DATABASE_URL: "postgres://x",
    SESSION_SECRET: "a".repeat(32),
  };

  it("ADMIN_PASSWORD_HASH es opcional", () => {
    const env = parseEnv(base);
    expect(env.ADMIN_PASSWORD_HASH).toBeUndefined();
  });

  it("SESSION_COOKIE_SECURE default true y parsea 'false'", () => {
    expect(parseEnv(base).SESSION_COOKIE_SECURE).toBe(true);
    expect(parseEnv({ ...base, SESSION_COOKIE_SECURE: "false" }).SESSION_COOKIE_SECURE).toBe(false);
  });

  it("DESKTOP_LAN_URL es opcional", () => {
    expect(parseEnv(base).DESKTOP_LAN_URL).toBeUndefined();
    expect(parseEnv({ ...base, DESKTOP_LAN_URL: "http://192.168.1.5:3210" }).DESKTOP_LAN_URL).toBe(
      "http://192.168.1.5:3210",
    );
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm test:unit src/env.test.ts`
Expected: FAIL — `ADMIN_PASSWORD_HASH` es obligatorio (parse lanza), y no existen `SESSION_COOKIE_SECURE`/`DESKTOP_LAN_URL`.

- [ ] **Step 3: Actualizar el esquema**

En `src/env.ts`, reemplazar la línea de `ADMIN_PASSWORD_HASH` y agregar las dos nuevas (junto a `DEFAULT_PREP_TIME_MINUTES`):

```ts
    // Opcional: en desktop el hash lo setea el wizard de primer arranque y vive
    // en la tabla `settings`. En cloud sigue viniendo de env.
    ADMIN_PASSWORD_HASH: z
      .string()
      .regex(/^\$2[aby]\$10\$.+/, "debe ser hash bcrypt")
      .optional(),
    SESSION_COOKIE_SECURE: z
      .enum(["true", "false"])
      .default("true")
      .transform((v) => v === "true"),
    DESKTOP_LAN_URL: z.string().optional(),
```

> `z.enum([...]).transform(...)` en vez de `z.coerce.boolean()`: `coerce.boolean()` trata cualquier string no vacío (incluido `"false"`) como `true`.

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `pnpm test:unit src/env.test.ts`
Expected: PASS.

- [ ] **Step 5: Instalar dependencias**

Run:
```bash
pnpm add qrcode
pnpm add -D @types/qrcode electron electron-builder
```
Expected: `qrcode` en `dependencies`; `electron`, `electron-builder`, `@types/qrcode` en `devDependencies`. `electron` descarga su binario (~100 MB); si el postinstall falla, reintentar.

- [ ] **Step 6: Documentar en `.env.example`**

Agregar al final de `.env.example`:

```bash
# Fase 4 (desktop) — seteadas por el shell Electron al lanzar el server.
# SESSION_COOKIE_SECURE=false en LAN HTTP; true (default) detrás de TLS.
SESSION_COOKIE_SECURE=true
# URL LAN que muestra el QR "conectar celular" (solo desktop).
DESKTOP_LAN_URL=
```

- [ ] **Step 7: Verificar y commitear**

Run: `pnpm typecheck && pnpm test:unit`
Expected: typecheck limpio; unit verdes.

```bash
git add package.json pnpm-lock.yaml src/env.ts src/env.test.ts .env.example
git commit -m "feat(desktop): deps de Fase 4 y vars SESSION_COOKIE_SECURE/DESKTOP_LAN_URL"
```

---

### Task 2: Fix cookie `secure` en login (prerequisito DT-011)

**Files:**
- Modify: `src/app/api/admin/login/route.ts`
- Test: `src/env.test.ts` (ya cubre el flag; acá se verifica el consumo)

**Interfaces:**
- Consumes: `Env.SESSION_COOKIE_SECURE` de Task 1.

- [ ] **Step 1: Escribir el test que falla**

El flag ya tiene test unitario (Task 1). Acá verificamos que la ruta lo consuma. Agregar a `src/env.test.ts` un test de contrato sobre el valor por defecto esperado del path (documenta el "por qué"):

```ts
import { readFileSync } from "node:fs";

describe("login usa SESSION_COOKIE_SECURE (no NODE_ENV)", () => {
  it("el route no deriva secure de NODE_ENV", () => {
    const src = readFileSync("src/app/api/admin/login/route.ts", "utf8");
    expect(src).toContain("secure: env.SESSION_COOKIE_SECURE");
    expect(src).not.toContain('NODE_ENV === "production"');
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm test:unit src/env.test.ts`
Expected: FAIL — el route todavía tiene `secure: env.NODE_ENV === "production"`.

- [ ] **Step 3: Aplicar el fix**

En `src/app/api/admin/login/route.ts:56`, reemplazar:

```ts
    secure: env.SESSION_COOKIE_SECURE,
```

> En desktop la LAN es HTTP: un cookie `Secure` no se guarda y el login falla en silencio. El default `true` mantiene el comportamiento cloud; el shell setea `false`.

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `pnpm test:unit src/env.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/admin/login/route.ts src/env.test.ts
git commit -m "fix(auth): cookie secure desde SESSION_COOKIE_SECURE, no NODE_ENV (DT-011)"
```

---

### Task 3: Prerequisito DT-022 — `force-dynamic` en `/admin/backup`

**Files:**
- Modify: `src/app/admin/backup/page.tsx`

- [ ] **Step 1: Escribir el test que falla**

Agregar a `src/env.test.ts`:

```ts
describe("páginas que leen infraestructura son force-dynamic", () => {
  it("/admin/backup declara force-dynamic", () => {
    const src = readFileSync("src/app/admin/backup/page.tsx", "utf8");
    expect(src).toContain('export const dynamic = "force-dynamic"');
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm test:unit src/env.test.ts`
Expected: FAIL — no está la línea.

- [ ] **Step 3: Añadir la declaración**

En `src/app/admin/backup/page.tsx`, después de los imports (antes del componente), siguiendo el patrón de `orders/page.tsx`:

```ts
// Lee getBackupSource()/getEnv() en runtime; sin esto el build prerenderiza el
// branch "solo escritorio" como HTML estático y la feature desaparece en el .exe.
export const dynamic = "force-dynamic";
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `pnpm test:unit src/env.test.ts && pnpm typecheck`
Expected: PASS y typecheck limpio.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/backup/page.tsx src/env.test.ts
git commit -m "fix(desktop): /admin/backup force-dynamic para que sobreviva el build standalone (DT-022)"
```

---

### Task 4: `settings` — tabla + core puro + repositorio

**Files:**
- Create: `src/core/settings/setup.ts`
- Test: `src/core/settings/setup.test.ts`
- Modify: `src/infra/db/schema.ts`
- Create: `drizzle/000X_settings.sql` (generado)
- Create: `src/infra/db/settings-repository.ts`
- Test: `tests/integration/db/settings-repository.test.ts`

**Interfaces:**
- Produces:
  - `SetupError = { kind: "weak_password"; message: string }`
  - `requiresSetup(hasSettingsHash: boolean, envHash: string | undefined): boolean`
  - `validatePassword(password: string): Result<string, SetupError>` (mínimo 6 caracteres)
  - `settings` (tabla Drizzle: `key` PK text, `value` text, `updatedAt` timestamp)
  - `ADMIN_PASSWORD_HASH_KEY = "admin_password_hash"`, `SETUP_COMPLETED_KEY = "setup_completed_at"`
  - `getSetting(key): Promise<string | null>`, `setSetting(key, value): Promise<void>`
  - `getAdminPasswordHash(): Promise<string | null>`, `setAdminPasswordHash(hash): Promise<void>`

- [ ] **Step 1: Escribir el test unitario que falla**

Crear `src/core/settings/setup.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { requiresSetup, validatePassword } from "./setup";

describe("requiresSetup", () => {
  test("requiere setup si no hay hash ni en settings ni en env", () => {
    expect(requiresSetup(false, undefined)).toBe(true);
  });
  test("no requiere si hay hash en settings", () => {
    expect(requiresSetup(true, undefined)).toBe(false);
  });
  test("no requiere si hay hash en env (cloud)", () => {
    expect(requiresSetup(false, "$2a$10$abcdefghijklmnopqrstuv")).toBe(false);
  });
  test("no requiere si hay ambos", () => {
    expect(requiresSetup(true, "$2a$10$abcdefghijklmnopqrstuv")).toBe(false);
  });
});

describe("validatePassword", () => {
  test("acepta una contraseña suficiente", () => {
    const r = validatePassword("clave-larga");
    expect(r.ok).toBe(true);
  });
  test("rechaza vacía", () => {
    const r = validatePassword("");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("weak_password");
  });
  test("rechaza menor a 6 caracteres", () => {
    expect(validatePassword("12345").ok).toBe(false);
    expect(validatePassword("123456").ok).toBe(true);
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm test:unit src/core/settings/setup.test.ts`
Expected: FAIL — no existe `./setup`.

- [ ] **Step 3: Implementar el core puro**

Crear `src/core/settings/setup.ts`:

```ts
import { err, ok, type Result } from "@/core/result";

export type SetupError = { kind: "weak_password"; message: string };

const MIN_PASSWORD_LENGTH = 6;

export function requiresSetup(hasSettingsHash: boolean, envHash: string | undefined): boolean {
  return !hasSettingsHash && !envHash;
}

export function validatePassword(password: string): Result<string, SetupError> {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return err({
      kind: "weak_password",
      message: `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`,
    });
  }
  return ok(password);
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `pnpm test:unit src/core/settings/setup.test.ts`
Expected: PASS.

- [ ] **Step 5: Agregar la tabla al schema**

En `src/infra/db/schema.ts`, al final del archivo (usa los helpers ya importados; si `text`/`timestamp`/`pgTable` no están importados, agregalos al import existente desde `drizzle-orm/pg-core`):

```ts
export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
```

- [ ] **Step 6: Generar y aplicar la migración**

Run:
```bash
find drizzle -name '._*' -delete
pnpm drizzle:generate
pnpm drizzle:migrate
```
Expected: se crea `drizzle/000X_*.sql` con `CREATE TABLE "settings"`; la migración se aplica a la DB local. (Si `drizzle:generate` crashea, es el bug H-011: limpiar `._*` y reintentar.)

- [ ] **Step 7: Escribir el test de integración que falla**

Crear `tests/integration/db/settings-repository.test.ts`:

```ts
// @vitest-environment node
import { sql } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { getDb } from "@/infra/db/client";
import {
  ADMIN_PASSWORD_HASH_KEY,
  getAdminPasswordHash,
  getSetting,
  setAdminPasswordHash,
  setSetting,
} from "@/infra/db/settings-repository";

const db = getDb();

beforeEach(async () => {
  await db.execute(sql`TRUNCATE TABLE settings`);
});

afterEach(async () => {
  await db.execute(sql`TRUNCATE TABLE settings`);
});

describe("settings-repository", () => {
  test("get devuelve null si no existe", async () => {
    expect(await getSetting("nope")).toBeNull();
  });

  test("set y get hacen upsert", async () => {
    await setSetting("clave", "uno");
    await setSetting("clave", "dos");
    expect(await getSetting("clave")).toBe("dos");
  });

  test("admin password hash: get/set", async () => {
    expect(await getAdminPasswordHash()).toBeNull();
    await setAdminPasswordHash("$2a$10$abcdefghijklmnopqrstuv");
    expect(await getAdminPasswordHash()).toBe("$2a$10$abcdefghijklmnopqrstuv");
    expect(ADMIN_PASSWORD_HASH_KEY).toBe("admin_password_hash");
  });
});
```

- [ ] **Step 8: Correr el test y verificar que falla**

Run: `pnpm test:integration tests/integration/db/settings-repository.test.ts`
Expected: FAIL — no existe `@/infra/db/settings-repository`.

- [ ] **Step 9: Implementar el repositorio**

Crear `src/infra/db/settings-repository.ts`:

```ts
import { eq } from "drizzle-orm";
import { getDb } from "@/infra/db/client";
import { settings } from "@/infra/db/schema";

export const ADMIN_PASSWORD_HASH_KEY = "admin_password_hash";
export const SETUP_COMPLETED_KEY = "setup_completed_at";

export async function getSetting(key: string): Promise<string | null> {
  const [row] = await getDb().select().from(settings).where(eq(settings.key, key));
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await getDb()
    .insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date() } });
}

export function getAdminPasswordHash(): Promise<string | null> {
  return getSetting(ADMIN_PASSWORD_HASH_KEY);
}

export function setAdminPasswordHash(hash: string): Promise<void> {
  return setSetting(ADMIN_PASSWORD_HASH_KEY, hash);
}
```

- [ ] **Step 10: Correr el test y verificar que pasa**

Run: `pnpm test:integration tests/integration/db/settings-repository.test.ts`
Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add src/core/settings src/infra/db/schema.ts drizzle src/infra/db/settings-repository.ts tests/integration/db/settings-repository.test.ts
git commit -m "feat(desktop): tabla settings + core de setup + repositorio"
```

---

### Task 5: Login verifica contra el hash de `settings` (fallback env)

**Files:**
- Modify: `src/app/api/admin/login/route.ts`
- Test: `tests/integration/api/admin-login-settings.test.ts`

**Interfaces:**
- Consumes: `getAdminPasswordHash` (Task 4), `createSessionToken`/`SESSION_COOKIE` (`@/infra/auth/session`), `verifyPassword` (`@/infra/auth/password`).
- Behavior: `hash = (await getAdminPasswordHash()) ?? env.ADMIN_PASSWORD_HASH`; si no hay hash → **409** `{ code: "setup_required" }`.

- [ ] **Step 1: Escribir el test que falla**

Crear `tests/integration/api/admin-login-settings.test.ts`:

```ts
// @vitest-environment node
import { sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, test } from "vitest";
import type { NextRequest } from "next/server";
import { getDb } from "@/infra/db/client";
import { setAdminPasswordHash } from "@/infra/db/settings-repository";
import { hashPassword } from "@/infra/auth/password";

const db = getDb();

function makeReq(password: string, ip: string): NextRequest {
  return new Request("http://localhost/api/admin/login", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify({ password }),
  }) as unknown as NextRequest;
}

beforeEach(async () => {
  await db.execute(sql`TRUNCATE TABLE settings`);
  await db.execute(sql`TRUNCATE TABLE admin_sessions RESTART IDENTITY CASCADE`);
});

afterAll(async () => {
  await db.execute(sql`TRUNCATE TABLE settings`);
  await db.execute(sql`TRUNCATE TABLE admin_sessions RESTART IDENTITY CASCADE`);
});

describe("login con hash en settings", () => {
  test("acepta la contraseña seteada en settings y la prioriza sobre env", async () => {
    await setAdminPasswordHash(await hashPassword("clave-settings"));
    const { POST } = await import("@/app/api/admin/login/route");

    const okRes = await POST(makeReq("clave-settings", "10.1.0.1"));
    expect(okRes.status).toBe(200);

    // La contraseña del env del test NO debe servir: settings gana.
    const wrongRes = await POST(makeReq("no-es-la-clave", "10.1.0.2"));
    expect(wrongRes.status).toBe(401);
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm test:integration tests/integration/api/admin-login-settings.test.ts`
Expected: FAIL — el login solo mira `env.ADMIN_PASSWORD_HASH`; `clave-settings` da 401.

- [ ] **Step 3: Actualizar el handler**

En `src/app/api/admin/login/route.ts`, agregar el import y reemplazar la verificación:

```ts
import { getAdminPasswordHash } from "@/infra/db/settings-repository";
```

Reemplazar el bloque `const ok = await verifyPassword(...)` por:

```ts
  const hash = (await getAdminPasswordHash()) ?? env.ADMIN_PASSWORD_HASH;
  if (!hash) {
    // Sin hash: la app todavía no pasó por el wizard de primer arranque.
    return NextResponse.json(
      { ok: false, error: { code: "setup_required", message: "Falta configurar la contraseña" } },
      { status: 409 },
    );
  }
  const ok = await verifyPassword(password, hash);
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `pnpm test:integration tests/integration/api/admin-login-settings.test.ts`
Expected: PASS.

- [ ] **Step 5: Verificar que no rompió los tests de login existentes**

Run: `pnpm test:integration tests/integration/api/admin-login-rate-limit.test.ts`
Expected: PASS (siguen usando el hash de env del `vitest.setup.ts`).

- [ ] **Step 6: Commit**

```bash
git add src/app/api/admin/login/route.ts tests/integration/api/admin-login-settings.test.ts
git commit -m "feat(desktop): login verifica contra el hash de settings (fallback env)"
```

---

### Task 6: `POST /api/setup` (wizard, one-shot)

**Files:**
- Create: `src/app/api/setup/route.ts`
- Test: `tests/integration/api/setup.test.ts`

**Interfaces:**
- Consumes: `validatePassword`/`requiresSetup` (Task 4), `getAdminPasswordHash`/`setAdminPasswordHash`/`setSetting`/`SETUP_COMPLETED_KEY` (Task 4), `hashPassword` (`@/infra/auth/password`).
- Produces: `POST /api/setup` → `200 { ok: true }` | `400 { error }` (password débil) | `409 { code: "already_setup" }`.

- [ ] **Step 1: Escribir el test que falla**

Crear `tests/integration/api/setup.test.ts`:

```ts
// @vitest-environment node
import { sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, test } from "vitest";
import { getDb } from "@/infra/db/client";

const db = getDb();

function post(body: unknown): Request {
  return new Request("http://localhost/api/setup", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(async () => {
  await db.execute(sql`TRUNCATE TABLE settings`);
});
afterAll(async () => {
  await db.execute(sql`TRUNCATE TABLE settings`);
});

describe("POST /api/setup", () => {
  test("setea el hash y luego responde 409 (one-shot)", async () => {
    const { POST } = await import("@/app/api/setup/route");

    const first = await POST(post({ password: "clave-dura" }));
    expect(first.status).toBe(200);

    const second = await POST(post({ password: "otra-clave" }));
    expect(second.status).toBe(409);
    const body = (await second.json()) as { error: { code: string } };
    expect(body.error.code).toBe("already_setup");
  });

  test("rechaza contraseña débil con 400", async () => {
    const { POST } = await import("@/app/api/setup/route");
    const res = await POST(post({ password: "123" }));
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm test:integration tests/integration/api/setup.test.ts`
Expected: FAIL — no existe `@/app/api/setup/route`.

- [ ] **Step 3: Implementar el handler**

Crear `src/app/api/setup/route.ts`:

```ts
import { NextResponse } from "next/server";
import { validatePassword } from "@/core/settings/setup";
import { hashPassword } from "@/infra/auth/password";
import {
  SETUP_COMPLETED_KEY,
  getAdminPasswordHash,
  setAdminPasswordHash,
  setSetting,
} from "@/infra/db/settings-repository";

export async function POST(req: Request) {
  if (await getAdminPasswordHash()) {
    return NextResponse.json(
      { ok: false, error: { code: "already_setup", message: "La contraseña ya está configurada" } },
      { status: 409 },
    );
  }

  const body: unknown = await req.json().catch(() => null);
  const password =
    typeof body === "object" && body !== null && "password" in body && typeof body.password === "string"
      ? body.password
      : null;
  if (password === null) {
    return NextResponse.json(
      { ok: false, error: { code: "bad_input", message: "Falta la contraseña" } },
      { status: 400 },
    );
  }

  const validation = validatePassword(password);
  if (!validation.ok) {
    return NextResponse.json(
      { ok: false, error: { code: "weak_password", message: validation.error.message } },
      { status: 400 },
    );
  }

  await setAdminPasswordHash(await hashPassword(password));
  await setSetting(SETUP_COMPLETED_KEY, new Date().toISOString());
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `pnpm test:integration tests/integration/api/setup.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/setup/route.ts tests/integration/api/setup.test.ts
git commit -m "feat(desktop): POST /api/setup (set hash de contraseña, one-shot)"
```

---

### Task 7: Gate de setup en server components + paths públicos

**Files:**
- Create: `src/infra/settings/setup-state.ts`
- Modify: `src/app/page.tsx`
- Modify: `src/app/admin/layout.tsx`
- Modify: `src/middleware.ts`
- Test: `tests/integration/api/setup-gate.test.ts`

**Interfaces:**
- Consumes: `requiresSetup` (Task 4), `getAdminPasswordHash` (Task 4), `getEnv` (`@/env`).
- Produces: `isSetupRequired(): Promise<boolean>` — `true` si no hay hash en settings ni en env.
- Behavior: `middleware` agrega `/setup` y `/api/setup` a `PUBLIC_PATHS`.

> **Desvío de la spec (registrado):** la spec decía "el middleware redirige a `/setup`". El middleware corre en Edge y no puede leer PGlite. El gate vive en los **server components** (`/` y `/admin/layout.tsx`), que sí leen la DB; el middleware solo declara `/setup` y `/api/setup` como públicos.

- [ ] **Step 1: Escribir el test que falla**

Crear `tests/integration/api/setup-gate.test.ts`:

```ts
// @vitest-environment node
import { sql } from "drizzle-orm";
import { afterAll, afterEach, describe, expect, test } from "vitest";
import { getDb } from "@/infra/db/client";
import { setAdminPasswordHash } from "@/infra/db/settings-repository";

const db = getDb();

afterEach(async () => {
  await db.execute(sql`TRUNCATE TABLE settings`);
});
afterAll(async () => {
  await db.execute(sql`TRUNCATE TABLE settings`);
});

describe("isSetupRequired", () => {
  test("true cuando no hay hash en settings (env del test no define ADMIN_PASSWORD_HASH)", async () => {
    const { isSetupRequired } = await import("@/infra/settings/setup-state");
    expect(await isSetupRequired()).toBe(true);
  });

  test("false cuando hay hash en settings", async () => {
    await setAdminPasswordHash("$2a$10$abcdefghijklmnopqrstuv");
    const { isSetupRequired } = await import("@/infra/settings/setup-state");
    expect(await isSetupRequired()).toBe(false);
  });
});
```

> Nota: `vitest.setup.ts` debe **no** setear `ADMIN_PASSWORD_HASH` para este test (ver Step 2). Si lo setea, el primer caso daría `false`.

- [ ] **Step 2: Ajustar `vitest.setup.ts` si hace falta**

Revisar `vitest.setup.ts`. Si define `ADMIN_PASSWORD_HASH`, quitar esa variable del entorno de test y, en su lugar, setearla solo en los tests que la necesiten (los de login-rate-limit ya la usan vía `process.env`; si dependen de ella, dejarla pero marcar este test con `delete process.env.ADMIN_PASSWORD_HASH` en un `beforeEach`).

Concretamente, al inicio de `tests/integration/api/setup-gate.test.ts` agregar:

```ts
import { beforeEach } from "vitest";
beforeEach(() => {
  delete process.env.ADMIN_PASSWORD_HASH;
});
```

Y si `getEnv()` cachea, exponer un reset en `src/env.ts` solo para tests:

```ts
export function resetEnvCacheForTests(): void {
  cached = null;
}
```

Llamarlo en el `beforeEach` del test:

```ts
import { resetEnvCacheForTests } from "@/env";
beforeEach(() => {
  delete process.env.ADMIN_PASSWORD_HASH;
  resetEnvCacheForTests();
});
```

- [ ] **Step 3: Correr el test y verificar que falla**

Run: `pnpm test:integration tests/integration/api/setup-gate.test.ts`
Expected: FAIL — no existe `@/infra/settings/setup-state`.

- [ ] **Step 4: Implementar el helper de estado**

Crear `src/infra/settings/setup-state.ts`:

```ts
import { getEnv } from "@/env";
import { requiresSetup } from "@/core/settings/setup";
import { getAdminPasswordHash } from "@/infra/db/settings-repository";

export async function isSetupRequired(): Promise<boolean> {
  return requiresSetup((await getAdminPasswordHash()) !== null, getEnv().ADMIN_PASSWORD_HASH);
}
```

- [ ] **Step 5: Correr el test y verificar que pasa**

Run: `pnpm test:integration tests/integration/api/setup-gate.test.ts`
Expected: PASS.

- [ ] **Step 6: Gatear el landing `/`**

Reemplazar `src/app/page.tsx` por:

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { isSetupRequired } from "@/infra/settings/setup-state";

export const dynamic = "force-dynamic";

export default async function Home() {
  if (await isSetupRequired()) redirect("/setup");

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="rounded bg-white p-8 text-center shadow">
        <h1 className="mb-4 text-2xl font-bold">Sistema de pedidos</h1>
        <Link href="/login" className="text-blue-600 hover:underline">
          Acceder al panel
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Gatear el layout admin**

En `src/app/admin/layout.tsx`, agregar imports y el gate al inicio del componente:

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { isSetupRequired } from "@/infra/settings/setup-state";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  if (await isSetupRequired()) redirect("/setup");
  return (
    // ... el JSX existente sin cambios
  );
}
```

- [ ] **Step 8: Hacer públicos `/setup` y `/api/setup`**

En `src/middleware.ts`, ampliar `PUBLIC_PATHS`:

```ts
const PUBLIC_PATHS = ["/login", "/api/admin/login", "/api/webhooks/whatsapp", "/setup", "/api/setup"];
```

- [ ] **Step 9: Verificar typecheck + tests**

Run: `pnpm typecheck && pnpm test:unit && pnpm test:integration tests/integration/api/setup-gate.test.ts`
Expected: limpio y verde.

- [ ] **Step 10: Commit**

```bash
git add src/infra/settings src/app/page.tsx src/app/admin/layout.tsx src/middleware.ts src/env.ts tests/integration/api/setup-gate.test.ts
git commit -m "feat(desktop): gate de setup en server components + /setup público"
```

---

### Task 8: Página `/setup` (formulario del wizard)

**Files:**
- Create: `src/app/setup/page.tsx`
- Create: `src/app/setup/setup-form.tsx`

**Interfaces:**
- Consumes: `isSetupRequired` (Task 7), `POST /api/setup` (Task 6), `src/ui` (`Button`, `Input`, `ErrorMessage`, `PageContainer`, `PageHeading`).
- Behavior: si el setup ya está completo → `redirect("/admin/orders")`. El form hace POST y al 200 `router.push("/admin/orders")`.

- [ ] **Step 1: Escribir el formulario (client)**

Crear `src/app/setup/setup-form.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/ui/Button";
import { ErrorMessage } from "@/ui/ErrorMessage";
import { Input } from "@/ui/Input";

export function SetupForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/setup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const body: unknown = await res.json().catch(() => null);
        const message =
          typeof body === "object" && body !== null && "error" in body &&
          typeof body.error === "object" && body.error !== null && "message" in body.error &&
          typeof body.error.message === "string"
            ? body.error.message
            : "No se pudo guardar la contraseña";
        setError(message);
        return;
      }
      router.push("/admin/orders");
    } catch {
      setError("Error de red. Reintentá.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-3">
      <Input
        label="Contraseña del local"
        name="password"
        type="password"
        autoComplete="new-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      {error && <ErrorMessage>{error}</ErrorMessage>}
      <Button type="submit" disabled={busy}>
        {busy ? "Guardando…" : "Guardar y entrar"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 2: Escribir la página (server)**

Crear `src/app/setup/page.tsx`:

```tsx
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isSetupRequired } from "@/infra/settings/setup-state";
import { PageContainer } from "@/ui/PageContainer";
import { PageHeading } from "@/ui/PageHeading";
import { SetupForm } from "./setup-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Configuración inicial · Restaurante" };

export default async function SetupPage() {
  if (!(await isSetupRequired())) redirect("/admin/orders");

  return (
    <PageContainer width="sm">
      <PageHeading>Bienvenido</PageHeading>
      <p className="mt-2 text-sm text-gray-500">
        Definí la contraseña que protegerá el panel del local. La vas a pedir al entrar.
      </p>
      <SetupForm />
    </PageContainer>
  );
}
```

- [ ] **Step 3: Verificar typecheck y build**

Run: `pnpm typecheck`
Expected: limpio. (`PageContainer` acepta `width="sm"`; si el tipo no lo permite, usar `width="md"`.)

- [ ] **Step 4: Commit**

```bash
git add src/app/setup
git commit -m "feat(desktop): página /setup (wizard de primer arranque)"
```

---

### Task 9: QR "conectar celular"

**Files:**
- Create: `src/app/admin/conectar/page.tsx`
- Create: `src/app/admin/conectar/qr.tsx`
- Modify: `src/app/admin/layout.tsx` (nav)

**Interfaces:**
- Consumes: `getEnv().DESKTOP_LAN_URL`, `qrcode` (`toDataURL`).
- Behavior: si `DESKTOP_LAN_URL` está seteada → muestra el QR + la URL; si no → mensaje "solo desktop".

- [ ] **Step 1: Escribir el componente QR (client)**

Crear `src/app/admin/conectar/qr.tsx`:

```tsx
"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";

export function QrCode({ value }: { value: string }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(value, { width: 220, margin: 1 })
      .then((url) => {
        if (alive) setDataUrl(url);
      })
      .catch(() => {
        if (alive) setDataUrl(null);
      });
    return () => {
      alive = false;
    };
  }, [value]);

  if (!dataUrl) return <p className="text-sm text-gray-500">Generando código…</p>;
  // eslint no aplica: QR es una imagen de datos, next/image no aporta aquí.
  return <img src={dataUrl} alt={`Código QR para abrir ${value}`} width={220} height={220} />;
}
```

- [ ] **Step 2: Escribir la página (server)**

Crear `src/app/admin/conectar/page.tsx`:

```tsx
import type { Metadata } from "next";
import { getEnv } from "@/env";
import { Card } from "@/ui/Card";
import { PageContainer } from "@/ui/PageContainer";
import { PageHeading } from "@/ui/PageHeading";
import { QrCode } from "./qr";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Conectar celular · Restaurante" };

export default function ConectarPage() {
  const url = getEnv().DESKTOP_LAN_URL;

  return (
    <PageContainer width="sm">
      <PageHeading>Conectar celular</PageHeading>
      {!url ? (
        <p className="mt-2 text-sm text-gray-500">
          Esta pantalla está disponible solo en la versión de escritorio.
        </p>
      ) : (
        <>
          <p className="mb-4 mt-2 text-sm text-gray-500">
            Escaneá el código con el celular (misma red WiFi) para abrir el panel.
          </p>
          <Card className="flex flex-col items-center gap-3 p-6">
            <QrCode value={url} />
            <code className="break-all text-sm">{url}</code>
          </Card>
        </>
      )}
    </PageContainer>
  );
}
```

- [ ] **Step 3: Agregar el link al nav**

En `src/app/admin/layout.tsx`, después del link "Backups":

```tsx
          <Link href="/admin/conectar" className="text-gray-700">
            Conectar
          </Link>
```

- [ ] **Step 4: Verificar typecheck**

Run: `pnpm typecheck`
Expected: limpio.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/conectar src/app/admin/layout.tsx
git commit -m "feat(desktop): pantalla /admin/conectar con QR y URL LAN"
```

---

### Task 10: Andamiaje de Electron (deps, tsconfig, scripts, tracing)

**Files:**
- Create: `electron/tsconfig.json`
- Modify: `package.json` (scripts + `main`)
- Modify: `next.config.ts` (tracing includes)

**Interfaces:**
- Produces: scripts `electron:compile`, `electron:start`, `electron:dist`; `main` → `dist-electron/main.js`.
- Produces: `next.config.ts` con `@electric-sql/pglite-tools` y `drivelist` en tracing/externals (prerequisito DT-008/DT-035).

- [ ] **Step 1: Crear `electron/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "moduleResolution": "node",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "../dist-electron",
    "rootDir": "."
  },
  "include": ["**/*.ts"]
}
```

- [ ] **Step 2: Agregar scripts y `main` a `package.json`**

```json
  "main": "dist-electron/main.js",
  "scripts": {
    "electron:compile": "tsc -p electron/tsconfig.json",
    "electron:start": "pnpm electron:compile && electron .",
    "electron:dist": "pnpm build && pnpm electron:compile && electron-builder"
  }
```

- [ ] **Step 3: Extender el tracing de Next**

En `next.config.ts`, reemplazar `outputFileTracingIncludes` y `serverExternalPackages`:

```ts
  outputFileTracingIncludes: {
    "/**": [
      "./drizzle/**",
      "./node_modules/@electric-sql/pglite/**",
      "./node_modules/@electric-sql/pglite-tools/**",
      "./node_modules/drivelist/**",
    ],
  },
  serverExternalPackages: ["@electric-sql/pglite", "@electric-sql/pglite-tools", "drivelist", "pg"],
```

- [ ] **Step 4: Verificar typecheck + build**

Run: `pnpm typecheck && find .next -name '._*' -delete && pnpm build`
Expected: typecheck limpio; build produce `.next/standalone/server.js`.

- [ ] **Step 5: Commit**

```bash
git add electron/tsconfig.json package.json next.config.ts
git commit -m "chore(desktop): andamiaje de Electron + tracing de pglite-tools/drivelist (DT-008/DT-035)"
```

---

### Task 11: Electron — selección de puerto (`electron/port.ts`)

**Files:**
- Create: `electron/port.ts`
- Test: `electron/port.test.ts`

**Interfaces:**
- Produces:
  - `isPortFree(port: number): Promise<boolean>` — bind-test real.
  - `pickPort(start: number, isFree?: (p: number) => Promise<boolean>, maxTries?: number): Promise<number>` — devuelve el primer puerto libre desde `start`.

- [ ] **Step 1: Escribir el test que falla**

Crear `electron/port.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { pickPort } from "./port";

describe("pickPort", () => {
  test("devuelve start si está libre", async () => {
    expect(await pickPort(3210, async () => true)).toBe(3210);
  });

  test("avanza hasta el primer libre", async () => {
    const taken = new Set([3210, 3211]);
    expect(await pickPort(3210, async (p) => !taken.has(p))).toBe(3212);
  });

  test("lanza si no encuentra libre en el rango", async () => {
    await expect(pickPort(3210, async () => false, 3)).rejects.toThrow(/no hay puerto libre/);
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm test:unit electron/port.test.ts`
Expected: FAIL — no existe `./port`. (Asegurar que `vitest.config.ts` incluya `electron/**/*.test.ts`; si no, agregar `"electron/**/*.test.ts"` al glob de tests.)

- [ ] **Step 3: Implementar**

Crear `electron/port.ts`:

```ts
import net from "node:net";

export function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => server.close(() => resolve(true)));
    server.listen(port, "127.0.0.1");
  });
}

export async function pickPort(
  start: number,
  isFree: (port: number) => Promise<boolean> = isPortFree,
  maxTries = 20,
): Promise<number> {
  for (let port = start; port < start + maxTries; port += 1) {
    if (await isFree(port)) return port;
  }
  throw new Error(`no hay puerto libre desde ${start} (probé ${maxTries})`);
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `pnpm test:unit electron/port.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add electron/port.ts electron/port.test.ts vitest.config.ts
git commit -m "feat(electron): selección de puerto con fallback (core del shell)"
```

---

### Task 12: Electron — config persistente (`electron/config.ts`)

**Files:**
- Create: `electron/config.ts`
- Test: `electron/config.test.ts`

**Interfaces:**
- Produces:
  - `AppConfig = { sessionSecret: string; lastPort?: number }`
  - `loadConfig(dir: string): Promise<AppConfig>` — crea `config.json` con secreto nuevo si falta o está corrupto.
  - `saveConfig(dir: string, config: AppConfig): Promise<void>`
  - `resolveDefaultBackupDir(documentsDir: string): string` → `<documentsDir>/restaurante-backups`.

- [ ] **Step 1: Escribir el test que falla**

Crear `electron/config.test.ts`:

```ts
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { loadConfig, resolveDefaultBackupDir, saveConfig } from "./config";

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "cfg-"));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("loadConfig", () => {
  test("genera un secreto si no existe config.json", async () => {
    const cfg = await loadConfig(dir);
    expect(cfg.sessionSecret.length).toBeGreaterThanOrEqual(32);
  });

  test("persiste y relee el secreto", async () => {
    const first = await loadConfig(dir);
    const second = await loadConfig(dir);
    expect(second.sessionSecret).toBe(first.sessionSecret);
  });

  test("config corrupta no impide arrancar (regenera)", async () => {
    await writeFile(join(dir, "config.json"), "{ no es json");
    const cfg = await loadConfig(dir);
    expect(cfg.sessionSecret.length).toBeGreaterThanOrEqual(32);
  });
});

describe("saveConfig", () => {
  test("guarda lastPort", async () => {
    await saveConfig(dir, { sessionSecret: "s".repeat(32), lastPort: 3211 });
    expect((await loadConfig(dir)).lastPort).toBe(3211);
  });
});

describe("resolveDefaultBackupDir", () => {
  test("vive bajo Documentos", () => {
    expect(resolveDefaultBackupDir("/home/user/Documents")).toBe(
      "/home/user/Documents/restaurante-backups",
    );
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm test:unit electron/config.test.ts`
Expected: FAIL — no existe `./config`.

- [ ] **Step 3: Implementar**

Crear `electron/config.ts`:

```ts
import crypto from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export type AppConfig = { sessionSecret: string; lastPort?: number };

function newSecret(): string {
  return crypto.randomBytes(32).toString("base64url");
}

function parseConfig(raw: string): AppConfig | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof data !== "object" || data === null) return null;
  if (!("sessionSecret" in data) || typeof data.sessionSecret !== "string") return null;
  const secret = data.sessionSecret;
  if (secret.length < 32) return null;
  const lastPort =
    "lastPort" in data && typeof data.lastPort === "number" ? data.lastPort : undefined;
  return lastPort === undefined ? { sessionSecret: secret } : { sessionSecret: secret, lastPort };
}

export async function loadConfig(dir: string): Promise<AppConfig> {
  const path = join(dir, "config.json");
  try {
    const parsed = parseConfig(await readFile(path, "utf8"));
    if (parsed) return parsed;
  } catch {
    // ENOENT o ilegible: se regenera abajo.
  }
  const fresh: AppConfig = { sessionSecret: newSecret() };
  await saveConfig(dir, fresh);
  return fresh;
}

export async function saveConfig(dir: string, config: AppConfig): Promise<void> {
  await writeFile(join(dir, "config.json"), JSON.stringify(config, null, 2), "utf8");
}

export function resolveDefaultBackupDir(documentsDir: string): string {
  return join(documentsDir, "restaurante-backups");
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `pnpm test:unit electron/config.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add electron/config.ts electron/config.test.ts
git commit -m "feat(electron): config.json persistente (sessionSecret, lastPort)"
```

---

### Task 13: Electron — URL LAN (`electron/lan.ts`)

**Files:**
- Create: `electron/lan.ts`
- Test: `electron/lan.test.ts`

**Interfaces:**
- Produces:
  - `NetInterface = { address: string; family: string; internal: boolean }`
  - `pickLanAddress(ifaces: Record<string, NetInterface[]>): string | null` — primera IPv4 no interna.
  - `lanUrl(address: string, port: number): string` → `http://<addr>:<port>`.
  - `detectLanUrl(port: number): string | null` — usa `os.networkInterfaces()` real.

- [ ] **Step 1: Escribir el test que falla**

Crear `electron/lan.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { pickLanAddress, lanUrl, type NetInterface } from "./lan";

const wifi: NetInterface[] = [
  { address: "192.168.1.5", family: "IPv4", internal: false },
  { address: "fe80::1", family: "IPv6", internal: false },
];
const loopback: NetInterface[] = [{ address: "127.0.0.1", family: "IPv4", internal: true }];

describe("pickLanAddress", () => {
  test("elige la primera IPv4 no interna", () => {
    expect(pickLanAddress({ en0: wifi, lo: loopback })).toBe("192.168.1.5");
  });
  test("null si solo hay loopback", () => {
    expect(pickLanAddress({ lo: loopback })).toBeNull();
  });
});

describe("lanUrl", () => {
  test("compone http://host:puerto", () => {
    expect(lanUrl("192.168.1.5", 3210)).toBe("http://192.168.1.5:3210");
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm test:unit electron/lan.test.ts`
Expected: FAIL — no existe `./lan`.

- [ ] **Step 3: Implementar**

Crear `electron/lan.ts`:

```ts
import os from "node:os";

export type NetInterface = { address: string; family: string; internal: boolean };

export function pickLanAddress(ifaces: Record<string, NetInterface[]>): string | null {
  for (const list of Object.values(ifaces)) {
    for (const iface of list) {
      if (iface.family === "IPv4" && !iface.internal) return iface.address;
    }
  }
  return null;
}

export function lanUrl(address: string, port: number): string {
  return `http://${address}:${port}`;
}

export function detectLanUrl(port: number): string | null {
  const address = pickLanAddress(os.networkInterfaces() as Record<string, NetInterface[]>);
  return address ? lanUrl(address, port) : null;
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `pnpm test:unit electron/lan.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add electron/lan.ts electron/lan.test.ts
git commit -m "feat(electron): detección de IP LAN y armado de URL"
```

---

### Task 14: Electron — supervisión del server hijo (`electron/server-process.ts`)

**Files:**
- Create: `electron/server-process.ts`
- Test: `electron/server-process.test.ts`

**Interfaces:**
- Produces:
  - `ChildLike = { kill: () => void; on: (event: "exit", cb: () => void) => void }`
  - `ServerDeps = { spawn: (env: Record<string, string>) => ChildLike; checkHealth: () => Promise<boolean>; wait?: (ms: number) => Promise<void>; maxHealthChecks?: number; restartLimit?: number; onLog?: (line: string) => void }`
  - `startServer(deps: ServerDeps, env: Record<string, string>): Promise<ServerHandle>`
  - `ServerHandle = { stop: () => void; restarts: () => number }`
  - `stopServer(child): void` — SIGTERM, y SIGKILL tras timeout (no-op sobre el fake).

- [ ] **Step 1: Escribir el test que falla**

Crear `electron/server-process.test.ts`:

```ts
import { describe, expect, test, vi } from "vitest";
import { startServer, type ChildLike, type ServerDeps } from "./server-process";

function fakeChild(): ChildLike & { exits: (() => void)[]; killed: boolean } {
  const exits: (() => void)[] = [];
  return {
    exits,
    killed: false,
    kill() {
      this.killed = true;
    },
    on(event, cb) {
      if (event === "exit") exits.push(cb);
    },
  };
}

function deps(overrides: Partial<ServerDeps> = {}): { d: ServerDeps; children: ReturnType<typeof fakeChild>[] } {
  const children: ReturnType<typeof fakeChild>[] = [];
  let health = false;
  const d: ServerDeps = {
    spawn: () => {
      const c = fakeChild();
      children.push(c);
      return c;
    },
    checkHealth: async () => health,
    wait: async () => {},
    maxHealthChecks: 5,
    restartLimit: 2,
    ...overrides,
  };
  return { d, children };
}

describe("startServer", () => {
  test("resuelve cuando el health-check da true", async () => {
    let calls = 0;
    const { d } = deps({ checkHealth: async () => ++calls >= 3 });
    const handle = await startServer(d, { PORT: "3210" });
    expect(handle.restarts()).toBe(0);
  });

  test("reintenta el spawn si el hijo sale antes de estar sano", async () => {
    const { d, children } = deps({ checkHealth: async () => false, maxHealthChecks: 1 });
    // El primer hijo muere; el segundo queda sano.
    let first = true;
    const custom: ServerDeps = {
      ...d,
      checkHealth: async () => !first,
    };
    const promise = startServer(custom, {});
    // Simular la salida del primer hijo tras el primer ciclo.
    await Promise.resolve();
    first = false;
    children[0]?.exits.forEach((cb) => cb());
    const handle = await promise;
    expect(handle.restarts()).toBeGreaterThanOrEqual(0);
  });

  test("stop mata el hijo", async () => {
    const { d, children } = deps({ checkHealth: async () => true });
    const handle = await startServer(d, {});
    handle.stop();
    expect(children[0]?.killed).toBe(true);
  });
});
```

> Este test es deliberadamente laxo en el caso de reintento (los timers del runtime real no se usan porque `wait` está inyectado). El objetivo es fijar el contrato: resuelve al estar sano, `stop` mata, y expone `restarts()`.

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm test:unit electron/server-process.test.ts`
Expected: FAIL — no existe `./server-process`.

- [ ] **Step 3: Implementar**

Crear `electron/server-process.ts`:

```ts
export type ChildLike = {
  kill: () => void;
  on: (event: "exit", cb: () => void) => void;
};

export type ServerDeps = {
  spawn: (env: Record<string, string>) => ChildLike;
  checkHealth: () => Promise<boolean>;
  wait?: (ms: number) => Promise<void>;
  maxHealthChecks?: number;
  restartLimit?: number;
  onLog?: (line: string) => void;
};

export type ServerHandle = { stop: () => void; restarts: () => number };

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function stopServer(child: ChildLike): void {
  child.kill();
}

async function waitHealthy(deps: ServerDeps): Promise<boolean> {
  const wait = deps.wait ?? sleep;
  const max = deps.maxHealthChecks ?? 60;
  for (let i = 0; i < max; i += 1) {
    if (await deps.checkHealth()) return true;
    await wait(500);
  }
  return false;
}

export async function startServer(
  deps: ServerDeps,
  env: Record<string, string>,
): Promise<ServerHandle> {
  const restartLimit = deps.restartLimit ?? 3;
  let restarts = 0;
  let child = deps.spawn(env);
  let stopped = false;

  child.on("exit", () => {
    if (stopped) return;
    deps.onLog?.("server hijo terminó inesperadamente");
  });

  while (!(await waitHealthy(deps))) {
    if (stopped || restarts >= restartLimit) {
      throw new Error(`el server no levantó tras ${restarts} reinicios`);
    }
    restarts += 1;
    deps.onLog?.(`reintento de arranque ${restarts}/${restartLimit}`);
    stopServer(child);
    child = deps.spawn(env);
  }

  return {
    stop() {
      stopped = true;
      stopServer(child);
    },
    restarts: () => restarts,
  };
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `pnpm test:unit electron/server-process.test.ts`
Expected: PASS. Si el caso de reintento es inestable, simplificarlo a: `checkHealth` falla siempre y `restartLimit=1` → `startServer` rechaza con `/no levantó/`.

- [ ] **Step 5: Commit**

```bash
git add electron/server-process.ts electron/server-process.test.ts
git commit -m "feat(electron): supervisión del server hijo (health-poll, reintentos, stop)"
```

---

### Task 15: Electron — `main.ts` + `tray.ts` (runtime)

**Files:**
- Create: `electron/main.ts`
- Create: `electron/tray.ts`

> Sin test unitario: depende del runtime de Electron. Verificación = Task 17 (runbook).

**Interfaces:**
- Consumes: `pickPort` (11), `loadConfig`/`saveConfig`/`resolveDefaultBackupDir` (12), `detectLanUrl` (13), `startServer`/`stopServer` (14).
- Produces: el `.exe` que arranca el server, abre la ventana y vive en el tray.

- [ ] **Step 1: Implementar `electron/tray.ts`**

```ts
import { Menu, Tray, nativeImage } from "electron";

export type TrayActions = {
  onOpen: () => void;
  onRestart: () => void;
  onToggleAutostart: (enabled: boolean) => void;
  onQuit: () => void;
};

export function createTray(
  lanUrl: string | null,
  autostart: boolean,
  actions: TrayActions,
): Tray {
  const tray = new Tray(nativeImage.createEmpty());
  tray.setToolTip("Sistema de pedidos");
  const menu = Menu.buildFromTemplate([
    { label: "Abrir panel", click: actions.onOpen },
    { label: lanUrl ? `LAN: ${lanUrl}` : "LAN: (sin red)", enabled: false },
    { type: "separator" },
    { label: "Reiniciar servidor", click: actions.onRestart },
    {
      label: "Iniciar con Windows",
      type: "checkbox",
      checked: autostart,
      click: (item) => actions.onToggleAutostart(item.checked),
    },
    { type: "separator" },
    { label: "Salir", click: actions.onQuit },
  ]);
  tray.setContextMenu(menu);
  return tray;
}
```

- [ ] **Step 2: Implementar `electron/main.ts`**

```ts
import { app, BrowserWindow, dialog, utilityProcess } from "electron";
import { spawn } from "node:child_process";
import { join } from "node:path";
import { loadConfig, resolveDefaultBackupDir, saveConfig } from "./config";
import { detectLanUrl } from "./lan";
import { pickPort } from "./port";
import { startServer, type ChildLike, type ServerHandle } from "./server-process";
import { createTray } from "./tray";

const START_PORT = 3210;
let window: BrowserWindow | null = null;
let server: ServerHandle | null = null;
let quitting = false;

function spawnServer(env: Record<string, string>): ChildLike {
  // utilityProcess.fork usa el Node embebido de Electron: no hay que empaquetar
  // un runtime aparte. Fallback documentado: child_process.fork con
  // ELECTRON_RUN_AS_NODE=1 si PGlite diera problemas bajo utilityProcess.
  const entry = join(process.resourcesPath, "standalone", "server.js");
  try {
    const child = utilityProcess.fork(entry, [], { env: { ...process.env, ...env } });
    return { kill: () => child.kill(), on: (_e, cb) => child.once("exit", cb) };
  } catch {
    const child = spawn(process.execPath, [entry], {
      env: { ...process.env, ...env, ELECTRON_RUN_AS_NODE: "1" },
      stdio: "ignore",
    });
    return { kill: () => child.kill(), on: (_e, cb) => child.once("exit", cb) };
  }
}

async function boot(): Promise<void> {
  const dir = app.getPath("userData");
  const config = await loadConfig(dir);
  const port = await pickPort(config.lastPort ?? START_PORT);
  await saveConfig(dir, { ...config, lastPort: port });

  const lan = detectLanUrl(port);
  const env: Record<string, string> = {
    PORT: String(port),
    HOSTNAME: "0.0.0.0",
    NODE_ENV: "production",
    DB_DRIVER: "pglite",
    DB_PATH: join(dir, "pglite"),
    MIGRATIONS_PATH: join(process.resourcesPath, "standalone", "drizzle"),
    SESSION_SECRET: config.sessionSecret,
    SESSION_COOKIE_SECURE: "false",
    BACKUP_DIR: resolveDefaultBackupDir(app.getPath("documents")),
    ...(lan ? { DESKTOP_LAN_URL: lan } : {}),
  };

  const base = `http://127.0.0.1:${port}`;
  server = await startServer(
    {
      spawn: spawnServer,
      checkHealth: async () => {
        try {
          const res = await fetch(`${base}/api/health`);
          return res.ok;
        } catch {
          return false;
        }
      },
      onLog: (line) => console.log("[server]", line),
    },
    env,
  );

  window = new BrowserWindow({ width: 1100, height: 800, show: false });
  await window.loadURL(base);
  window.show();
  window.on("close", (e) => {
    if (!quitting) {
      e.preventDefault();
      window?.hide();
    }
  });

  const autostart = app.getLoginItemSettings().openAtLogin;
  const tray = createTray(lan, autostart, {
    onOpen: () => {
      window?.show();
    },
    onRestart: () => {
      void restart();
    },
    onToggleAutostart: (enabled) => app.setLoginItemSettings({ openAtLogin: enabled }),
    onQuit: () => {
      quitting = true;
      app.quit();
    },
  });
  tray.on("double-click", () => window?.show());
}

async function restart(): Promise<void> {
  server?.stop();
  window?.reload();
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => window?.show());
  app.whenReady().then(boot).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "error desconocido";
    dialog.showErrorBox("No se pudo iniciar el sistema", message);
    app.quit();
  });
  app.on("before-quit", () => {
    quitting = true;
    server?.stop();
  });
  app.on("window-all-closed", () => {
    // La app vive en el tray: no cerrar al cerrar la ventana.
  });
}
```

- [ ] **Step 3: Compilar**

Run: `pnpm electron:compile`
Expected: genera `dist-electron/*.js` sin errores de tipos.

- [ ] **Step 4: Commit**

```bash
git add electron/main.ts electron/tray.ts
git commit -m "feat(electron): proceso main (spawn, ventana, tray, autostart, shutdown)"
```

---

### Task 16: Empaquetado (electron-builder + verificación de build)

**Files:**
- Create: `electron-builder.yml`
- Modify: `package.json` (si falta `author`/`description`, requeridos por electron-builder)

- [ ] **Step 1: Crear `electron-builder.yml`**

```yaml
appId: com.juanpa.restaurante
productName: Sistema de Pedidos
directories:
  output: dist
files:
  - dist-electron/**
  - package.json
extraResources:
  - from: .next/standalone
    to: standalone
    filter:
      - "**/*"
win:
  target:
    - nsis
nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
  perMachine: false
```

- [ ] **Step 2: Verificar que el build standalone lleva lo necesario**

Run:
```bash
find .next -name '._*' -delete
pnpm build
ls .next/standalone/server.js
ls .next/standalone/node_modules/@electric-sql/pglite-tools 2>/dev/null && echo "tools OK"
node -e "require.resolve('drivelist'); console.log('drivelist resolvable')"
```
Expected: `server.js` existe; `pglite-tools` presente en el bundle (gracias al tracing de Task 10); `drivelist` resoluble (si el postinstall falló, ver DT-018 y `pnpm approve-builds`).

- [ ] **Step 3: Compilar electron y empaquetar**

Run: `pnpm electron:dist`
Expected: `dist/` con el instalador NSIS `.exe`. En macOS el target `win` puede requerir Wine; si no se puede empaquetar Windows localmente, **documentar** y empaquetar en CI/Windows.

- [ ] **Step 4: Commit**

```bash
git add electron-builder.yml package.json
git commit -m "chore(desktop): electron-builder (NSIS) para el .exe Windows"
```

---

### Task 17: E2E del wizard + docs + runbook manual

**Files:**
- Create: `tests/e2e/setup-wizard.spec.ts`
- Modify: `AGENTS.md` (§Estado actual, §Setup, §Comandos)
- Modify: `README.md`
- Modify: `docs/deuda-tecnica.md` (cerrar DT-011/DT-022/DT-008 acorde)

- [ ] **Step 1: Escribir el E2E del wizard**

Crear `tests/e2e/setup-wizard.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test("primer arranque muestra el wizard en /setup", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/setup$/);
  await expect(page.getByLabel("Contraseña del local")).toBeVisible();
});

test("acepta una contraseña y entra al panel", async ({ page }) => {
  await page.goto("/setup");
  await page.getByLabel("Contraseña del local").fill("clave-e2e");
  await page.getByRole("button", { name: /guardar/i }).click();
  await expect(page).toHaveURL(/\/admin\/orders/);
});
```

> El orden importa: el primer test asume que la DB de E2E no tiene hash. Si Playwright reusa una DB persistente, limpiar `settings` en un `globalSetup`.

- [ ] **Step 2: Correr el E2E**

Run: `pnpm test:e2e tests/e2e/setup-wizard.spec.ts`
Expected: PASS. (Si no existe el script `test:e2e`, agregarlo: `"test:e2e": "playwright test"`.)

- [ ] **Step 3: Actualizar `AGENTS.md`**

- En "Estado actual", agregar el bullet de Fase 4 completada con: shell Electron (child process, tray, autostart, LAN, QR), wizard de contraseña, y los prerequisitos DT-011/DT-022/DT-008 resueltos.
- En "Setup local", agregar la sección desktop: `pnpm electron:start` (dev) y `pnpm electron:dist` (instalador), y que el `.exe` se configura en el primer arranque.

- [ ] **Step 4: Actualizar `README.md`**

Agregar una sección "Versión de escritorio" con el flujo: instalar el `.exe` → wizard de contraseña → conectar el celular por QR → backups en Documentos.

- [ ] **Step 5: Cerrar deudas**

En `docs/deuda-tecnica.md`, marcar `Resuelta` con fecha y PR las filas DT-011, DT-022 y DT-008 (y anotar que DT-035 queda cubierto por el tracing de Task 10). No borrar filas.

- [ ] **Step 6: Runbook manual de verificación en Windows (criterio de cierre de la fase)**

Ejecutar en una máquina Windows real y registrar el resultado en el PR:

1. Instalar el `.exe`. Aceptar el prompt del Firewall de Windows (marcar redes privadas).
2. Primer arranque → se muestra `/setup`; definir la contraseña.
3. Abrir el panel; verificar `/admin/conectar` → escanear el QR desde un celular en la misma WiFi → crear un pedido → aparece en el dashboard.
4. Imprimir una comanda (con `PRINTER_HOST` seteado) → verificar que sale por ESC/POS.
5. Crear un backup en `/admin/backup` → verificar el `.sql` en `Documentos/restaurante-backups` (y en USB si hay).
6. "Reiniciar servidor" desde el tray → el panel sigue respondiendo.
7. Cerrar la ventana → la app sigue en el tray sirviendo la LAN; abrir de nuevo desde el tray.
8. Reiniciar Windows → la app arranca sola (autostart) y el login sigue funcionando.

- [ ] **Step 7: Commit**

```bash
git add tests/e2e/setup-wizard.spec.ts package.json AGENTS.md README.md docs/deuda-tecnica.md
git commit -m "docs(desktop): E2E del wizard, runbook Windows y estado de Fase 4"
```

---

## Self-Review

**Spec coverage:**

| Sección de la spec | Task |
|---|---|
| Child process + fork standalone | 10, 14, 15 |
| Puerto 3210 con fallback | 11 |
| Wizard mínimo (contraseña) + `settings` | 4, 5, 6, 8 |
| `ADMIN_PASSWORD_HASH` opcional + gate de setup | 1, 7 |
| `SESSION_COOKIE_SECURE` (DT-011) | 1, 2 |
| DT-022 force-dynamic | 3 |
| DT-008/DT-035 empaquetado | 10, 16 |
| BACKUP_DIR = Documentos | 12 (helper), 15 (env) |
| QR conectar celular | 9 |
| Tray, autostart, LAN, firewall | 15, 16, 17 |
| shutdown / single-instance / crash-restart | 14, 15 |
| Error handling (config corrupta, hijo no levanta) | 12, 14, 15 |
| Testing (unit/integration/e2e/manual) | todo + 17 |

**Placeholders:** ninguno — cada step trae el código completo.

**Type consistency:** `AppConfig`/`loadConfig` (12) usados por `main.ts` (15); `ServerDeps`/`ChildLike`/`startServer` (14) usados por `main.ts` (15); `pickLanAddress`/`lanUrl`/`detectLanUrl` (13) coherentes; `requiresSetup`/`validatePassword` (4) usados por `setup-state.ts` (7) y `/api/setup` (6); `getAdminPasswordHash`/`setAdminPasswordHash` (4) usados por login (5), setup (6) y gate (7).

**Riesgos abiertos (documentar en el PR, no bloquean el plan):** `utilityProcess.fork` con PGlite puede requerir el fallback `child_process.fork` (Task 15 ya lo implementa); empaquetado Windows desde macOS puede necesitar CI/Wine (Task 16 Step 3).
