# Desktop Fase 3 — Backups: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Módulo de backup para la versión desktop: volcar PGlite a un dump SQL portable, escribirlo a una carpeta sincronizada + a las memorias USB conectadas, rotar los viejos, y validar que un dump es restaurable — con API y página admin mínima.

**Architecture:** Separación *functional core, imperative shell*. `src/core/backup/` (puro): nombre de archivo y política de rotación. `src/infra/backup/`: puertos `BackupSource` / `BackupDestination` + adapters (PGlite `pgDump`, carpeta fs, USB vía `drivelist`) + orquestación (`runBackup`, `verifyBackup`). Los endpoints usan una fábrica con dependencias inyectadas para ser testeables sin tocar `drivelist` ni el filesystem real.

**Tech Stack:** Next.js 16 (App Router), TypeScript estricto, Drizzle ORM, `@electric-sql/pglite` 0.5.8, `@electric-sql/pglite-tools` ^0.4.8, `drivelist` ^12.0.2, Vitest, Tailwind + `src/ui`.

## Global Constraints

- TypeScript estricto. **Prohibido** `any`, non-null assertion (`!`), type assertions (`as Tipo`). Usar `satisfies` cuando haga falta shape checking.
- **Functional core, imperative shell**: lógica pura sin I/O en `src/core/`; I/O solo en `src/infra/` y handlers.
- **TDD**: test antes que implementación (red → green → refactor). Target ≥80% coverage.
- **Sin mocks**: los fakes son implementaciones in-memory de los puertos; el resto usa infraestructura real (PGlite, fs, tmpdir).
- **YAGNI**: nada fuera de la spec `docs/superpowers/specs/2026-10-08-desktop-03-backup-design.md`.
- Comentarios solo para el "por qué" no obvio.
- **pnpm**, nunca npm/npx.
- Commits chicos, convencionales. Un commit = cambio coherente que pasaría review aislado.
- Nombres de dominio en español, tecnología en inglés.
- Errores explícitos con `Result` (`src/core/result.ts`) en el core y los adapters.
- `Result<T, E> = { ok: true; value: T } | { ok: false; error: E }`; helpers `ok(v)` / `err(e)`.
- Tests de integración: `// @vitest-environment node` al inicio y `getDb()` (la DB se inicializa en `vitest.setup.ts` cuando `VITEST_INIT_DB=1`).
- Alias de import: `@/*` → `./src/*`.

---

### Task 1: Dependencias + variables de entorno

**Files:**
- Modify: `package.json` (deps)
- Modify: `src/env.ts`
- Modify: `src/env.test.ts`
- Modify: `.env.example`

**Interfaces:**
- Produces: `Env.BACKUP_DIR: string` (default `./.data/backups`), `Env.BACKUP_KEEP: number` (default `7`, mínimo 1).
- Produces: dependencias `@electric-sql/pglite-tools`, `drivelist` instaladas.

- [ ] **Step 1: Escribir el test que falla (env)**

Agregar al final de `src/env.test.ts` (dentro del `describe` existente, o un `describe` nuevo):

```ts
describe("env de backup", () => {
  const base = {
    DATABASE_URL: "postgres://x",
    ADMIN_PASSWORD_HASH: "$2a$10$abcdefghijklmnopqrstuv",
    SESSION_SECRET: "a".repeat(32),
  };

  it("usa defaults de backup", () => {
    const env = parseEnv(base);
    expect(env.BACKUP_DIR).toBe("./.data/backups");
    expect(env.BACKUP_KEEP).toBe(7);
  });

  it("rechaza BACKUP_KEEP menor a 1", () => {
    expect(() => parseEnv({ ...base, BACKUP_KEEP: "0" })).toThrow();
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm test:unit src/env.test.ts`
Expected: FAIL — `env.BACKUP_DIR` is `undefined` / parse no valida `BACKUP_KEEP`.

- [ ] **Step 3: Agregar las vars al esquema**

En `src/env.ts`, dentro de `envSchema` (junto a `MIGRATIONS_PATH`), agregar:

```ts
    BACKUP_DIR: z.string().default("./.data/backups"),
    BACKUP_KEEP: z.coerce.number().int().min(1).default(7),
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `pnpm test:unit src/env.test.ts`
Expected: PASS.

- [ ] **Step 5: Instalar dependencias**

Run:
```bash
pnpm add @electric-sql/pglite-tools drivelist
```
Expected: se agregan a `dependencies`; `@electric-sql/pglite-tools` queda en `^0.4.8` y `drivelist` en `^12.0.2`. `drivelist` es un addon nativo (prebuild-install); si el postinstall falla, anotar en `docs/deuda-tecnica.md` y continuar (el import es lazy y tolera su ausencia en runtime).

- [ ] **Step 6: Documentar en `.env.example`**

Agregar al final de `.env.example`:

```bash
# Backups (versión desktop)
BACKUP_DIR=./.data/backups          # carpeta sincronizada (Drive/OneDrive/Dropbox)
BACKUP_KEEP=7                       # backups a retener por destino
```

- [ ] **Step 7: Verificar build + tests y commitear**

Run: `pnpm typecheck && pnpm test:unit`
Expected: typecheck limpio; unit tests verdes.

```bash
git add package.json pnpm-lock.yaml src/env.ts src/env.test.ts .env.example
git commit -m "feat(backup): deps de dump/USB y vars BACKUP_DIR/BACKUP_KEEP"
```

---

### Task 2: Core — tipos, `Result` y nombre de archivo

**Files:**
- Create: `src/core/backup/types.ts`
- Create: `src/core/backup/filename.ts`
- Test: `src/core/backup/filename.test.ts`

**Interfaces:**
- Produces:
  - `BackupError = { kind: "no_source" } | { kind: "dump_failed"; message: string } | { kind: "write_failed"; message: string } | { kind: "read_failed"; message: string } | { kind: "delete_failed"; message: string } | { kind: "verify_failed"; message: string }`
  - `BackupFile = { name: string; bytes: number; modifiedAt: Date }`
  - `backupFileName(now: Date): string` → `restaurante-YYYY-MM-DD-HHmm.sql` (hora local).
  - `isBackupFileName(name: string): boolean`
- Consumes: `Result` de `@/core/result`.

- [ ] **Step 1: Escribir el test que falla**

Crear `src/core/backup/filename.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { backupFileName, isBackupFileName } from "./filename";

describe("backupFileName", () => {
  test("formatea la fecha local con campos zero-padded", () => {
    const name = backupFileName(new Date(2026, 9, 8, 3, 7)); // 8 oct 2026, 03:07
    expect(name).toBe("restaurante-2026-10-08-0307.sql");
  });

  test("nombres distintos ordenan lexicográficamente por tiempo", () => {
    const older = backupFileName(new Date(2026, 9, 8, 3, 7));
    const newer = backupFileName(new Date(2026, 9, 8, 3, 8));
    expect(older < newer).toBe(true);
  });
});

describe("isBackupFileName", () => {
  test("acepta nombres válidos", () => {
    expect(isBackupFileName("restaurante-2026-10-08-0307.sql")).toBe(true);
  });

  test("rechaza nombres que no son backup", () => {
    expect(isBackupFileName("README.md")).toBe(false);
    expect(isBackupFileName("restaurante-2026-10-08.sql")).toBe(false);
    expect(isBackupFileName("restaurante-2026-10-08-0307.sql.bak")).toBe(false);
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm test:unit src/core/backup/filename.test.ts`
Expected: FAIL — no existe `./filename`.

- [ ] **Step 3: Escribir los tipos**

Crear `src/core/backup/types.ts`:

```ts
export type BackupError =
  | { kind: "no_source" }
  | { kind: "dump_failed"; message: string }
  | { kind: "write_failed"; message: string }
  | { kind: "read_failed"; message: string }
  | { kind: "delete_failed"; message: string }
  | { kind: "verify_failed"; message: string };

export type BackupFile = {
  name: string;
  bytes: number;
  modifiedAt: Date;
};
```

- [ ] **Step 4: Implementar `filename.ts`**

Crear `src/core/backup/filename.ts`:

```ts
const BACKUP_NAME = /^restaurante-\d{4}-\d{2}-\d{2}-\d{4}\.sql$/;

const pad = (n: number): string => String(n).padStart(2, "0");

export function backupFileName(now: Date): string {
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}${pad(now.getMinutes())}`;
  return `restaurante-${date}-${time}.sql`;
}

export function isBackupFileName(name: string): boolean {
  return BACKUP_NAME.test(name);
}
```

- [ ] **Step 5: Correr el test y verificar que pasa**

Run: `pnpm test:unit src/core/backup/filename.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/core/backup/types.ts src/core/backup/filename.ts src/core/backup/filename.test.ts
git commit -m "feat(backup): tipos y nombre de archivo de backup (core puro)"
```

---

### Task 3: Core — política de rotación

**Files:**
- Create: `src/core/backup/rotation.ts`
- Test: `src/core/backup/rotation.test.ts`

**Interfaces:**
- Consumes: `BackupFile` de `./types`.
- Produces: `selectForDeletion(files: BackupFile[], keep: number): BackupFile[]` — ordena por nombre ascendente (más viejo primero) y devuelve los que sobran por encima de `keep`.

- [ ] **Step 1: Escribir el test que falla**

Crear `src/core/backup/rotation.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import type { BackupFile } from "./types";
import { selectForDeletion } from "./rotation";

function file(name: string): BackupFile {
  return { name, bytes: 10, modifiedAt: new Date() };
}

describe("selectForDeletion", () => {
  test("no borra nada si no se excede el límite", () => {
    const files = [file("restaurante-2026-10-08-0300.sql")];
    expect(selectForDeletion(files, 7)).toEqual([]);
  });

  test("borra los más viejos cuando se excede el límite", () => {
    const files = [
      file("restaurante-2026-10-08-0302.sql"),
      file("restaurante-2026-10-08-0300.sql"),
      file("restaurante-2026-10-08-0301.sql"),
    ];
    const removed = selectForDeletion(files, 2).map((f) => f.name);
    expect(removed).toEqual(["restaurante-2026-10-08-0300.sql"]);
  });

  test("no muta la lista de entrada", () => {
    const files = [file("b.sql"), file("a.sql")];
    const snapshot = [...files];
    selectForDeletion(files, 1);
    expect(files).toEqual(snapshot);
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm test:unit src/core/backup/rotation.test.ts`
Expected: FAIL — no existe `./rotation`.

- [ ] **Step 3: Implementar**

Crear `src/core/backup/rotation.ts`:

```ts
import type { BackupFile } from "./types";

export function selectForDeletion(files: BackupFile[], keep: number): BackupFile[] {
  const sorted = [...files].sort((a, b) => a.name.localeCompare(b.name));
  return sorted.slice(0, Math.max(0, sorted.length - keep));
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `pnpm test:unit src/core/backup/rotation.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/backup/rotation.ts src/core/backup/rotation.test.ts
git commit -m "feat(backup): política de rotación por conteo (core puro)"
```

---

### Task 4: Puerto `BackupDestination` + adapter de carpeta (fs)

**Files:**
- Create: `src/infra/backup/port.ts`
- Create: `src/infra/backup/folder-destination.ts`
- Test: `tests/integration/backup/folder-destination.test.ts`

**Interfaces:**
- Consumes: `Result` (`@/core/result`), `BackupError`/`BackupFile` (`@/core/backup/types`), `isBackupFileName` (`@/core/backup/filename`).
- Produces:
  - `BackupSource = { dump(): Promise<Result<string, BackupError>> }`
  - `BackupDestination = { id: string; label: string; write(name, bytes: Uint8Array): Promise<Result<void, BackupError>>; list(): Promise<Result<BackupFile[], BackupError>>; read(name): Promise<Result<string, BackupError>>; remove(name): Promise<Result<void, BackupError>> }`
  - `createFolderDestination(input: { id: string; label: string; dir: string }): BackupDestination`

- [ ] **Step 1: Escribir el test que falla**

Crear `tests/integration/backup/folder-destination.test.ts`:

```ts
// @vitest-environment node
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { createFolderDestination } from "@/infra/backup/folder-destination";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "backup-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("createFolderDestination", () => {
  test("write crea el directorio y el archivo", async () => {
    const dest = createFolderDestination({ id: "folder", label: "Carpeta", dir: join(dir, "sub") });
    const result = await dest.write("restaurante-2026-10-08-0300.sql", new TextEncoder().encode("SELECT 1;"));

    expect(result.ok).toBe(true);
    const read = await dest.read("restaurante-2026-10-08-0300.sql");
    expect(read.ok && read.value).toBe("SELECT 1;");
  });

  test("list devuelve vacío si el directorio no existe", async () => {
    const dest = createFolderDestination({ id: "folder", label: "Carpeta", dir: join(dir, "nope") });
    const result = await dest.list();
    expect(result).toEqual({ ok: true, value: [] });
  });

  test("list solo incluye nombres de backup, con tamaño y fecha", async () => {
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, "restaurante-2026-10-08-0300.sql"), "x");
    await writeFile(join(dir, "notas.txt"), "y");
    const dest = createFolderDestination({ id: "folder", label: "Carpeta", dir });

    const result = await dest.list();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.map((f) => f.name)).toEqual(["restaurante-2026-10-08-0300.sql"]);
    expect(result.value[0]?.bytes).toBe(1);
    expect(result.value[0]?.modifiedAt).toBeInstanceOf(Date);
  });

  test("remove borra el archivo", async () => {
    const dest = createFolderDestination({ id: "folder", label: "Carpeta", dir });
    await dest.write("restaurante-2026-10-08-0300.sql", new TextEncoder().encode("x"));
    const removed = await dest.remove("restaurante-2026-10-08-0300.sql");
    expect(removed.ok).toBe(true);
    const listed = await dest.list();
    expect(listed.ok && listed.value).toEqual([]);
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm test:integration tests/integration/backup/folder-destination.test.ts`
Expected: FAIL — no existe `@/infra/backup/folder-destination`.

- [ ] **Step 3: Definir el puerto**

Crear `src/infra/backup/port.ts`:

```ts
import type { Result } from "@/core/result";
import type { BackupError, BackupFile } from "@/core/backup/types";

export type BackupSource = {
  dump(): Promise<Result<string, BackupError>>;
};

export type BackupDestination = {
  id: string;
  label: string;
  write(name: string, bytes: Uint8Array): Promise<Result<void, BackupError>>;
  list(): Promise<Result<BackupFile[], BackupError>>;
  read(name: string): Promise<Result<string, BackupError>>;
  remove(name: string): Promise<Result<void, BackupError>>;
};
```

- [ ] **Step 4: Implementar el adapter de carpeta**

Crear `src/infra/backup/folder-destination.ts`:

```ts
import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { err, ok, type Result } from "@/core/result";
import { isBackupFileName } from "@/core/backup/filename";
import type { BackupError, BackupFile } from "@/core/backup/types";
import type { BackupDestination } from "./port";

const message = (cause: unknown): string =>
  cause instanceof Error ? cause.message : "error desconocido";

const isNotFound = (cause: unknown): boolean =>
  typeof cause === "object" && cause !== null && "code" in cause && cause.code === "ENOENT";

export function createFolderDestination(input: {
  id: string;
  label: string;
  dir: string;
}): BackupDestination {
  return {
    id: input.id,
    label: input.label,

    async write(name, bytes): Promise<Result<void, BackupError>> {
      try {
        await mkdir(input.dir, { recursive: true });
        await writeFile(join(input.dir, name), bytes);
        return ok(undefined);
      } catch (cause) {
        return err({ kind: "write_failed", message: message(cause) });
      }
    },

    async list(): Promise<Result<BackupFile[], BackupError>> {
      try {
        const names = (await readdir(input.dir)).filter(isBackupFileName);
        const files: BackupFile[] = [];
        for (const name of names) {
          const info = await stat(join(input.dir, name));
          files.push({ name, bytes: info.size, modifiedAt: info.mtime });
        }
        return ok(files);
      } catch (cause) {
        if (isNotFound(cause)) return ok([]);
        return err({ kind: "read_failed", message: message(cause) });
      }
    },

    async read(name): Promise<Result<string, BackupError>> {
      try {
        return ok(await readFile(join(input.dir, name), "utf8"));
      } catch (cause) {
        return err({ kind: "read_failed", message: message(cause) });
      }
    },

    async remove(name): Promise<Result<void, BackupError>> {
      try {
        await rm(join(input.dir, name));
        return ok(undefined);
      } catch (cause) {
        return err({ kind: "delete_failed", message: message(cause) });
      }
    },
  };
}
```

- [ ] **Step 5: Correr el test y verificar que pasa**

Run: `pnpm test:integration tests/integration/backup/folder-destination.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/infra/backup/port.ts src/infra/backup/folder-destination.ts tests/integration/backup/folder-destination.test.ts
git commit -m "feat(backup): puerto BackupDestination + adapter de carpeta"
```

---

### Task 5: Adapter `BackupSource` para PGlite (`pgDump`)

**Files:**
- Create: `src/infra/backup/pglite-source.ts`
- Test: `tests/integration/backup/pglite-source.test.ts`

**Interfaces:**
- Consumes: `pgDump` de `@electric-sql/pglite-tools/pg_dump`; `PGlite` de `@electric-sql/pglite`; `BackupSource` de `./port`.
- Produces: `createPgliteBackupSource(client: PGlite): BackupSource`.

- [ ] **Step 1: Escribir el test que falla**

Crear `tests/integration/backup/pglite-source.test.ts`:

```ts
// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { afterEach, describe, expect, test } from "vitest";
import { createPgliteBackupSource } from "@/infra/backup/pglite-source";

let client: PGlite | null = null;

afterEach(async () => {
  if (client) await client.close();
  client = null;
});

describe("createPgliteBackupSource", () => {
  test("dump devuelve SQL con CREATE TABLE e INSERT", async () => {
    client = new PGlite();
    await client.exec("CREATE TABLE demo (id int primary key, nombre text);");
    await client.exec("INSERT INTO demo (id, nombre) VALUES (1, 'taco');");

    const source = createPgliteBackupSource(client);
    const result = await source.dump();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toContain("CREATE TABLE");
    expect(result.value).toContain("INSERT INTO");
    expect(result.value).toContain("taco");
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm test:integration tests/integration/backup/pglite-source.test.ts`
Expected: FAIL — no existe `@/infra/backup/pglite-source`.

- [ ] **Step 3: Implementar**

Crear `src/infra/backup/pglite-source.ts`:

```ts
import type { PGlite } from "@electric-sql/pglite";
import { pgDump } from "@electric-sql/pglite-tools/pg_dump";
import { err, ok, type Result } from "@/core/result";
import type { BackupError } from "@/core/backup/types";
import type { BackupSource } from "./port";

export function createPgliteBackupSource(client: PGlite): BackupSource {
  return {
    async dump(): Promise<Result<string, BackupError>> {
      try {
        const file = await pgDump({ pg: client });
        return ok(await file.text());
      } catch (cause) {
        return err({
          kind: "dump_failed",
          message: cause instanceof Error ? cause.message : "dump falló",
        });
      }
    },
  };
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `pnpm test:integration tests/integration/backup/pglite-source.test.ts`
Expected: PASS. (Si `pgDump` falla por incompatibilidad de versión del peer, revisar que `@electric-sql/pglite` esté en `0.5.8`.)

- [ ] **Step 5: Commit**

```bash
git add src/infra/backup/pglite-source.ts tests/integration/backup/pglite-source.test.ts
git commit -m "feat(backup): adapter de dump PGlite vía pgDump"
```

---

### Task 6: Resolución de destinos (carpeta + USB)

**Files:**
- Create: `src/infra/backup/usb-destinations.ts`
- Create: `src/infra/backup/resolve-destinations.ts`
- Test: `src/infra/backup/usb-destinations.test.ts`
- Test: `tests/integration/backup/resolve-destinations.test.ts`

**Interfaces:**
- Consumes: `createFolderDestination` (`./folder-destination`), `BackupDestination` (`./port`).
- Produces:
  - `DriveInfo = { isRemovable: boolean; isUSB: boolean | null; isReadOnly: boolean; mountpoints: { path: string }[] }`
  - `selectUsbMounts(drives: DriveInfo[]): string[]` — solo removibles/USB, no read-only, con mountpoint.
  - `listDrivesFromDrivelist(): Promise<DriveInfo[]>` — import lazy de `drivelist`; **degrada a `[]`** si el addon no está disponible (loguea un warning).
  - `resolveDestinations(input: { backupDir: string; listDrives: () => Promise<DriveInfo[]> }): Promise<BackupDestination[]>` — `[folder, ...usb]`.

- [ ] **Step 1: Escribir el test unitario de filtrado**

Crear `src/infra/backup/usb-destinations.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { selectUsbMounts, type DriveInfo } from "./usb-destinations";

function drive(overrides: Partial<DriveInfo>): DriveInfo {
  return {
    isRemovable: false,
    isUSB: null,
    isReadOnly: false,
    mountpoints: [{ path: "/mnt/x" }],
    ...overrides,
  };
}

describe("selectUsbMounts", () => {
  test("incluye unidades removibles y USB", () => {
    const drives = [
      drive({ isRemovable: true, mountpoints: [{ path: "/media/usb" }] }),
      drive({ isUSB: true, mountpoints: [{ path: "E:" }] }),
    ];
    expect(selectUsbMounts(drives)).toEqual(["/media/usb", "E:"]);
  });

  test("ignora discos de sistema, read-only y sin mountpoint", () => {
    const drives = [
      drive({ isSystem: true } as Partial<DriveInfo>),
      drive({ isRemovable: true, isReadOnly: true }),
      drive({ isRemovable: true, mountpoints: [] }),
    ];
    expect(selectUsbMounts(drives)).toEqual([]);
  });
});
```

> Nota: la primera fila usa un objeto con `isSystem` extra; el filtro solo mira `isRemovable`/`isUSB`/`isReadOnly`/`mountpoints`, así que una unidad de sistema no removible queda fuera por `isRemovable: false`.

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm test:unit src/infra/backup/usb-destinations.test.ts`
Expected: FAIL — no existe `./usb-destinations`.

- [ ] **Step 3: Implementar `usb-destinations.ts`**

Crear `src/infra/backup/usb-destinations.ts`:

```ts
export type DriveInfo = {
  isRemovable: boolean;
  isUSB: boolean | null;
  isReadOnly: boolean;
  mountpoints: { path: string }[];
};

export function selectUsbMounts(drives: DriveInfo[]): string[] {
  return drives
    .filter((d) => (d.isRemovable || d.isUSB === true) && !d.isReadOnly)
    .flatMap((d) => d.mountpoints.map((m) => m.path));
}

// drivelist es un addon nativo; si no está disponible (CI, build sin toolchain)
// degradamos a "sin USB" en vez de romper el backup — la carpeta sincronizada
// sigue siendo un destino válido.
export async function listDrivesFromDrivelist(): Promise<DriveInfo[]> {
  try {
    const { list } = await import("drivelist");
    return await list();
  } catch (cause) {
    console.warn("drivelist no disponible, se omite el destino USB:", cause);
    return [];
  }
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `pnpm test:unit src/infra/backup/usb-destinations.test.ts`
Expected: PASS.

- [ ] **Step 5: Escribir el test de `resolveDestinations`**

Crear `tests/integration/backup/resolve-destinations.test.ts`:

```ts
// @vitest-environment node
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { resolveDestinations } from "@/infra/backup/resolve-destinations";
import type { DriveInfo } from "@/infra/backup/usb-destinations";

describe("resolveDestinations", () => {
  test("siempre incluye la carpeta sincronizada", async () => {
    const dests = await resolveDestinations({
      backupDir: "/tmp/backups",
      listDrives: async () => [],
    });
    expect(dests.map((d) => d.id)).toEqual(["folder"]);
    expect(dests[0]?.label).toBe("Carpeta sincronizada");
  });

  test("agrega una carpeta por unidad USB removible", async () => {
    const drives: DriveInfo[] = [
      { isRemovable: true, isUSB: true, isReadOnly: false, mountpoints: [{ path: join("/tmp", "usb1") }] },
      { isRemovable: false, isUSB: null, isReadOnly: false, mountpoints: [{ path: "/" }] },
    ];
    const dests = await resolveDestinations({ backupDir: "/tmp/backups", listDrives: async () => drives });

    expect(dests.map((d) => d.id)).toEqual(["folder", `usb:${join("/tmp", "usb1")}`]);
  });
});
```

- [ ] **Step 6: Correr y verificar que falla**

Run: `pnpm test:integration tests/integration/backup/resolve-destinations.test.ts`
Expected: FAIL — no existe `./resolve-destinations`.

- [ ] **Step 7: Implementar `resolve-destinations.ts`**

Crear `src/infra/backup/resolve-destinations.ts`:

```ts
import { join } from "node:path";
import { createFolderDestination } from "./folder-destination";
import { selectUsbMounts, type DriveInfo } from "./usb-destinations";
import type { BackupDestination } from "./port";

export async function resolveDestinations(input: {
  backupDir: string;
  listDrives: () => Promise<DriveInfo[]>;
}): Promise<BackupDestination[]> {
  const folder = createFolderDestination({
    id: "folder",
    label: "Carpeta sincronizada",
    dir: input.backupDir,
  });

  const mounts = selectUsbMounts(await input.listDrives());
  const usb = mounts.map((mount) =>
    createFolderDestination({
      id: `usb:${mount}`,
      label: `USB (${mount})`,
      dir: join(mount, "restaurante-backups"),
    }),
  );

  return [folder, ...usb];
}
```

- [ ] **Step 8: Correr y verificar que pasa**

Run: `pnpm test:integration tests/integration/backup/resolve-destinations.test.ts`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/infra/backup/usb-destinations.ts src/infra/backup/resolve-destinations.ts src/infra/backup/usb-destinations.test.ts tests/integration/backup/resolve-destinations.test.ts
git commit -m "feat(backup): resolución de destinos carpeta + USB (drivelist opcional)"
```

---

### Task 7: Fakes in-memory + `runBackup`

**Files:**
- Create: `src/infra/backup/fake.ts`
- Create: `src/infra/backup/backup-service.ts`
- Test: `tests/integration/backup/backup-service.test.ts`

**Interfaces:**
- Consumes: `selectForDeletion` (`@/core/backup/rotation`), `backupFileName` (`@/core/backup/filename`), `BackupSource`/`BackupDestination` (`./port`).
- Produces:
  - `createFakeSource(sql: string): BackupSource` (o `createFailingSource(error): BackupSource`).
  - `createFakeDestination(input: { id: string; label: string; initial?: BackupFile[]; failWrite?: boolean }): FakeDestination` con `files: Map<string, string>` visible.
  - `BackupReport = { name: string; bytes: number; written: {destinationId;label}[]; failures: {destinationId;label;error}[]; rotated: {destinationId; removed: string[]}[] }`
  - `runBackup(input: { source: BackupSource; destinations: BackupDestination[]; keep: number; now: Date }): Promise<Result<BackupReport, BackupError>>`

- [ ] **Step 1: Escribir el test que falla**

Crear `tests/integration/backup/backup-service.test.ts`:

```ts
// @vitest-environment node
import { describe, expect, test } from "vitest";
import { runBackup } from "@/infra/backup/backup-service";
import {
  createFakeDestination,
  createFakeSource,
  createFailingSource,
} from "@/infra/backup/fake";

const NOW = new Date(2026, 9, 8, 3, 0);
const NAME = "restaurante-2026-10-08-0300.sql";

describe("runBackup", () => {
  test("escribe el dump en cada destino y reporta", async () => {
    const a = createFakeDestination({ id: "folder", label: "Carpeta" });
    const b = createFakeDestination({ id: "usb:E:", label: "USB (E:)" });

    const result = await runBackup({
      source: createFakeSource("CREATE TABLE t (id int);"),
      destinations: [a, b],
      keep: 7,
      now: NOW,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.written.map((w) => w.destinationId)).toEqual(["folder", "usb:E:"]);
    expect(a.files.get(NAME)).toBe("CREATE TABLE t (id int);");
    expect(b.files.get(NAME)).toBe("CREATE TABLE t (id int);");
  });

  test("rota los backups viejos por encima de keep", async () => {
    const dest = createFakeDestination({
      id: "folder",
      label: "Carpeta",
      initial: [
        { name: "restaurante-2026-10-08-0258.sql", bytes: 1, modifiedAt: NOW },
        { name: "restaurante-2026-10-08-0259.sql", bytes: 1, modifiedAt: NOW },
      ],
    });

    const result = await runBackup({
      source: createFakeSource("x"),
      destinations: [dest],
      keep: 2,
      now: NOW,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.rotated[0]?.removed).toEqual(["restaurante-2026-10-08-0258.sql"]);
    expect(dest.files.has("restaurante-2026-10-08-0258.sql")).toBe(false);
  });

  test("si el dump falla no escribe y devuelve el error", async () => {
    const dest = createFakeDestination({ id: "folder", label: "Carpeta" });
    const result = await runBackup({
      source: createFailingSource({ kind: "dump_failed", message: "boom" }),
      destinations: [dest],
      keep: 7,
      now: NOW,
    });

    expect(result.ok).toBe(false);
    expect(dest.files.size).toBe(0);
  });

  test("éxito parcial: un destino falla y el otro escribe", async () => {
    const okDest = createFakeDestination({ id: "folder", label: "Carpeta" });
    const badDest = createFakeDestination({ id: "usb:E:", label: "USB (E:)", failWrite: true });

    const result = await runBackup({
      source: createFakeSource("x"),
      destinations: [okDest, badDest],
      keep: 7,
      now: NOW,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.written).toHaveLength(1);
    expect(result.value.failures).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm test:integration tests/integration/backup/backup-service.test.ts`
Expected: FAIL — no existen `./fake` ni `./backup-service`.

- [ ] **Step 3: Implementar los fakes**

Crear `src/infra/backup/fake.ts`:

```ts
import { err, ok, type Result } from "@/core/result";
import type { BackupError, BackupFile } from "@/core/backup/types";
import type { BackupDestination, BackupSource } from "./port";

export function createFakeSource(sql: string): BackupSource {
  return { async dump() { return ok(sql); } };
}

export function createFailingSource(error: BackupError): BackupSource {
  return { async dump() { return err(error); } };
}

export type FakeDestination = BackupDestination & { files: Map<string, string> };

export function createFakeDestination(input: {
  id: string;
  label: string;
  initial?: BackupFile[];
  failWrite?: boolean;
}): FakeDestination {
  const files = new Map(input.initial?.map((f) => [f.name, ""]) ?? []);
  return {
    id: input.id,
    label: input.label,
    files,

    async write(name, bytes) {
      if (input.failWrite) return err({ kind: "write_failed", message: "simulado" });
      files.set(name, new TextDecoder().decode(bytes));
      return ok(undefined);
    },
    async list(): Promise<Result<BackupFile[], BackupError>> {
      return ok(
        [...files].map(([name, content]) => ({
          name,
          bytes: content.length,
          modifiedAt: new Date(0),
        })),
      );
    },
    async read(name) {
      const value = files.get(name);
      return value === undefined
        ? err({ kind: "read_failed", message: "no existe" })
        : ok(value);
    },
    async remove(name) {
      files.delete(name);
      return ok(undefined);
    },
  };
}
```

- [ ] **Step 4: Implementar `runBackup`**

Crear `src/infra/backup/backup-service.ts`:

```ts
import { backupFileName } from "@/core/backup/filename";
import { selectForDeletion } from "@/core/backup/rotation";
import { err, ok, type Result } from "@/core/result";
import type { BackupError } from "@/core/backup/types";
import type { BackupDestination, BackupSource } from "./port";

export type BackupReport = {
  name: string;
  bytes: number;
  written: { destinationId: string; label: string }[];
  failures: { destinationId: string; label: string; error: BackupError }[];
  rotated: { destinationId: string; removed: string[] }[];
};

export async function runBackup(input: {
  source: BackupSource;
  destinations: BackupDestination[];
  keep: number;
  now: Date;
}): Promise<Result<BackupReport, BackupError>> {
  const dump = await input.source.dump();
  if (!dump.ok) return err(dump.error);

  const name = backupFileName(input.now);
  const bytes = new TextEncoder().encode(dump.value);
  const written: BackupReport["written"] = [];
  const failures: BackupReport["failures"] = [];
  const rotated: BackupReport["rotated"] = [];

  for (const destination of input.destinations) {
    const stored = await destination.write(name, bytes);
    if (!stored.ok) {
      failures.push({ destinationId: destination.id, label: destination.label, error: stored.error });
      continue;
    }
    written.push({ destinationId: destination.id, label: destination.label });

    const listed = await destination.list();
    if (!listed.ok) continue;
    const removed: string[] = [];
    for (const file of selectForDeletion(listed.value, input.keep)) {
      const result = await destination.remove(file.name);
      if (result.ok) removed.push(file.name);
    }
    rotated.push({ destinationId: destination.id, removed });
  }

  return ok({ name, bytes: bytes.length, written, failures, rotated });
}
```

- [ ] **Step 5: Correr el test y verificar que pasa**

Run: `pnpm test:integration tests/integration/backup/backup-service.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/infra/backup/fake.ts src/infra/backup/backup-service.ts tests/integration/backup/backup-service.test.ts
git commit -m "feat(backup): runBackup con escritura multi-destino, rotación y éxito parcial"
```

---

### Task 8: Validación de restaurabilidad (`verifyBackup`)

**Files:**
- Create: `src/infra/backup/restore-verify.ts`
- Test: `tests/integration/backup/restore-verify.test.ts`

**Interfaces:**
- Consumes: `PGlite` de `@electric-sql/pglite`; `createPgliteBackupSource` (opcional, para producir un dump real en el test).
- Produces:
  - `VerifyReport = { tables: { name: string; rows: number }[] }`
  - `verifyBackup(sql: string): Promise<Result<VerifyReport, BackupError>>` — levanta una PGlite in-memory, ejecuta el dump y cuenta filas de `orders`, `products`, `categories`.

- [ ] **Step 1: Escribir el test que falla**

Crear `tests/integration/backup/restore-verify.test.ts`:

```ts
// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { afterEach, describe, expect, test } from "vitest";
import { createPgliteBackupSource } from "@/infra/backup/pglite-source";
import { verifyBackup } from "@/infra/backup/restore-verify";

let client: PGlite | null = null;

afterEach(async () => {
  if (client) await client.close();
  client = null;
});

describe("verifyBackup", () => {
  test("un dump con datos se restaura y reporta conteos", async () => {
    client = new PGlite();
    await client.exec(`
      CREATE TABLE categories (id serial primary key, name text);
      CREATE TABLE products (id serial primary key, name text);
      CREATE TABLE orders (id serial primary key, total text);
      INSERT INTO categories (name) VALUES ('Bebidas'), ('Tacos');
      INSERT INTO orders (total) VALUES ('100');
    `);
    const dump = await createPgliteBackupSource(client).dump();
    if (!dump.ok) throw new Error("dump falló");

    const result = await verifyBackup(dump.value);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const byName = Object.fromEntries(result.value.tables.map((t) => [t.name, t.rows]));
    expect(byName).toEqual({ orders: 1, products: 0, categories: 2 });
  });

  test("un SQL inválido devuelve verify_failed", async () => {
    const result = await verifyBackup("esto no es sql;");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("verify_failed");
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm test:integration tests/integration/backup/restore-verify.test.ts`
Expected: FAIL — no existe `./restore-verify`.

- [ ] **Step 3: Implementar**

Crear `src/infra/backup/restore-verify.ts`:

```ts
import { PGlite } from "@electric-sql/pglite";
import { err, ok, type Result } from "@/core/result";
import type { BackupError } from "@/core/backup/types";

export type VerifyReport = { tables: { name: string; rows: number }[] };

const CHECKED_TABLES = ["orders", "products", "categories"] as const;

export async function verifyBackup(sql: string): Promise<Result<VerifyReport, BackupError>> {
  const client = new PGlite();
  try {
    await client.exec(sql);
    const tables: VerifyReport["tables"] = [];
    for (const name of CHECKED_TABLES) {
      const result = await client.query<{ count: number }>(
        `SELECT count(*)::int AS count FROM ${name}`,
      );
      tables.push({ name, rows: result.rows[0]?.count ?? 0 });
    }
    return ok({ tables });
  } catch (cause) {
    return err({
      kind: "verify_failed",
      message: cause instanceof Error ? cause.message : "no restaurable",
    });
  } finally {
    await client.close();
  }
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `pnpm test:integration tests/integration/backup/restore-verify.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/infra/backup/restore-verify.ts tests/integration/backup/restore-verify.test.ts
git commit -m "feat(backup): validación de restaurabilidad en PGlite temporal"
```

---

### Task 9: Cableado del puerto DB (`getBackupSource`)

**Files:**
- Modify: `src/infra/db/types.ts`
- Modify: `src/infra/db/adapters/pglite.ts`
- Modify: `src/infra/db/client.ts`
- Test: `tests/integration/db/backup-source.test.ts`

**Interfaces:**
- Consumes: `BackupSource` (`@/infra/backup/port`), `createPgliteBackupSource` (`@/infra/backup/pglite-source`).
- Produces:
  - `DbHandle = { db: Db; close: () => Promise<void>; backupSource?: BackupSource }`
  - `getBackupSource(): BackupSource | null` desde `@/infra/db/client` — `null` cuando el driver es Postgres o aún no se inicializó.

- [ ] **Step 1: Escribir el test que falla**

Crear `tests/integration/db/backup-source.test.ts`:

```ts
// @vitest-environment node
import { describe, expect, test } from "vitest";
import { getBackupSource } from "@/infra/db/client";

describe("getBackupSource", () => {
  test("en modo pglite hay una fuente de backup", () => {
    const source = getBackupSource();
    expect(source).not.toBeNull();
  });

  test("la fuente produce un dump restaurable", async () => {
    const source = getBackupSource();
    if (!source) throw new Error("sin fuente");
    const dump = await source.dump();
    expect(dump.ok).toBe(true);
    if (!dump.ok) return;
    expect(dump.value).toContain("CREATE TABLE");
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm test:integration tests/integration/db/backup-source.test.ts`
Expected: FAIL — `getBackupSource` no está exportado.

- [ ] **Step 3: Extender `DbHandle`**

En `src/infra/db/types.ts`, agregar el import y el campo:

```ts
import type { PgDatabase } from "drizzle-orm/pg-core";
import type { NodePgQueryResultHKT } from "drizzle-orm/node-postgres";
import type { PgliteQueryResultHKT } from "drizzle-orm/pglite";
import type * as schema from "@/infra/db/schema";
import type { BackupSource } from "@/infra/backup/port";

export type Db = PgDatabase<NodePgQueryResultHKT | PgliteQueryResultHKT, typeof schema>;

export type DbHandle = {
  db: Db;
  close: () => Promise<void>;
  backupSource?: BackupSource;
};
```

- [ ] **Step 4: Construir la fuente en el adapter PGlite**

En `src/infra/db/adapters/pglite.ts`, agregar el import y devolver `backupSource`:

```ts
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "@/infra/db/schema";
import type { DbHandle } from "@/infra/db/types";
import { createPgliteBackupSource } from "@/infra/backup/pglite-source";

export async function createPgliteDb(input: {
  dataDir: string;
  migrationsFolder: string;
}): Promise<DbHandle> {
  // "memory://" runs ephemeral (tests). Any other value persists to disk.
  const client = input.dataDir === "memory://" ? new PGlite() : new PGlite(input.dataDir);
  try {
    const db = drizzle(client, { schema });
    await migrate(db, { migrationsFolder: input.migrationsFolder });
    return { db, close: () => client.close(), backupSource: createPgliteBackupSource(client) };
  } catch (error) {
    await client.close();
    throw error;
  }
}
```

- [ ] **Step 5: Exponer `getBackupSource` en el client**

En `src/infra/db/client.ts`, agregar el global, asignarlo y exportar el getter:

```ts
import { getEnv } from "@/env";
import { createPostgresDb } from "@/infra/db/adapters/postgres";
import type { Db } from "@/infra/db/types";
import type { BackupSource } from "@/infra/backup/port";

export type { Db } from "@/infra/db/types";

declare global {
  // eslint-disable-next-line no-var
  var __db: Db | undefined;
  // eslint-disable-next-line no-var
  var __dbInit: Promise<Db> | undefined;
  // eslint-disable-next-line no-var
  var __backupSource: BackupSource | null | undefined;
}

async function createDb(): Promise<Db> {
  const env = getEnv();
  if (env.DB_DRIVER === "pglite") {
    const { createPgliteDb } = await import("@/infra/db/adapters/pglite");
    const { db, backupSource } = await createPgliteDb({
      dataDir: env.DB_PATH,
      migrationsFolder: env.MIGRATIONS_PATH,
    });
    globalThis.__backupSource = backupSource ?? null;
    return db;
  }
  if (!env.DATABASE_URL) throw new Error("DATABASE_URL requerida para DB_DRIVER=postgres");
  globalThis.__backupSource = null;
  return createPostgresDb(env.DATABASE_URL).db;
}
```

Y al final del archivo, después de `getDb`:

```ts
export function getBackupSource(): BackupSource | null {
  return globalThis.__backupSource ?? null;
}
```

> El resto de `initDb` / `getDb` no cambia.

- [ ] **Step 6: Correr el test y verificar que pasa**

Run: `pnpm test:integration tests/integration/db/backup-source.test.ts`
Expected: PASS.

- [ ] **Step 7: Verificar que no rompió nada**

Run: `pnpm typecheck && pnpm test:unit`
Expected: limpio y verde.

- [ ] **Step 8: Commit**

```bash
git add src/infra/db/types.ts src/infra/db/adapters/pglite.ts src/infra/db/client.ts tests/integration/db/backup-source.test.ts
git commit -m "feat(backup): expone getBackupSource desde el puerto DB (null en cloud)"
```

---

### Task 10: Endpoints HTTP + middleware

**Files:**
- Create: `src/infra/backup/http-routes.ts`
- Create: `src/infra/backup/deps.ts`
- Create: `src/app/api/backup/route.ts`
- Create: `src/app/api/backup/restore/route.ts`
- Modify: `src/middleware.ts`
- Test: `tests/integration/backup/backup-routes.test.ts`

**Interfaces:**
- Consumes: `runBackup` (`./backup-service`), `verifyBackup` (`./restore-verify`), `resolveDestinations` (`./resolve-destinations`), `listDrivesFromDrivelist` (`./usb-destinations`), `getBackupSource` (`@/infra/db/client`).
- Produces:
  - `BackupDeps = { getSource: () => BackupSource | null; resolveDestinations: () => Promise<BackupDestination[]>; keep: () => number; now: () => Date }`
  - `createBackupRoutes(deps: BackupDeps): { GET: () => Promise<Response>; POST: () => Promise<Response> }`
  - `createRestoreRoute(deps: Pick<BackupDeps, "getSource" | "resolveDestinations">): (req: Request) => Promise<Response>`
  - `realBackupDeps(): BackupDeps`

- [ ] **Step 1: Escribir el test que falla**

Crear `tests/integration/backup/backup-routes.test.ts`:

```ts
// @vitest-environment node
import { describe, expect, test } from "vitest";
import { createBackupRoutes, createRestoreRoute } from "@/infra/backup/http-routes";
import { createFakeDestination, createFakeSource } from "@/infra/backup/fake";
import type { BackupDeps } from "@/infra/backup/http-routes";

const NOW = new Date(2026, 9, 8, 3, 0);

function deps(overrides: Partial<BackupDeps> = {}): BackupDeps {
  return {
    getSource: () => createFakeSource("CREATE TABLE orders (id int);"),
    resolveDestinations: async () => [createFakeDestination({ id: "folder", label: "Carpeta" })],
    keep: () => 7,
    now: () => NOW,
    ...overrides,
  };
}

describe("POST /api/backup", () => {
  test("crea el backup y responde ok", async () => {
    const { POST } = createBackupRoutes(deps());
    const res = await POST();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; data?: { name: string } };
    expect(body.ok).toBe(true);
    expect(body.data?.name).toBe("restaurante-2026-10-08-0300.sql");
  });

  test("409 sin fuente (modo cloud)", async () => {
    const { POST } = createBackupRoutes(deps({ getSource: () => null }));
    expect((await POST()).status).toBe(409);
  });
});

describe("GET /api/backup", () => {
  test("lista los backups por destino", async () => {
    const { GET } = createBackupRoutes(deps());
    const res = await GET();
    const body = (await res.json()) as { data?: { destinations: { id: string }[] } };
    expect(res.status).toBe(200);
    expect(body.data?.destinations[0]?.id).toBe("folder");
  });
});

describe("POST /api/backup/restore", () => {
  test("valida un backup y reporta los conteos", async () => {
    const dest = createFakeDestination({ id: "folder", label: "Carpeta" });
    await dest.write("restaurante-2026-10-08-0300.sql", new TextEncoder().encode(
      "CREATE TABLE orders (id int); CREATE TABLE products (id int); CREATE TABLE categories (id int); INSERT INTO orders VALUES (1);",
    ));
    const handler = createRestoreRoute({ getSource: () => createFakeSource("x"), resolveDestinations: async () => [dest] });

    const res = await handler(
      new Request("http://test/api/backup/restore", {
        method: "POST",
        body: JSON.stringify({ destinationId: "folder", name: "restaurante-2026-10-08-0300.sql" }),
      }),
    );
    const body = (await res.json()) as { ok: boolean; data?: { tables: { rows: number }[] } };
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
  });

  test("400 si el backup no existe", async () => {
    const dest = createFakeDestination({ id: "folder", label: "Carpeta" });
    const handler = createRestoreRoute({ getSource: () => createFakeSource("x"), resolveDestinations: async () => [dest] });
    const res = await handler(
      new Request("http://test/api/backup/restore", {
        method: "POST",
        body: JSON.stringify({ destinationId: "folder", name: "nope.sql" }),
      }),
    );
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm test:integration tests/integration/backup/backup-routes.test.ts`
Expected: FAIL — no existe `@/infra/backup/http-routes`.

- [ ] **Step 3: Implementar la fábrica de handlers**

Crear `src/infra/backup/http-routes.ts`:

```ts
import { NextResponse } from "next/server";
import type { BackupFile } from "@/core/backup/types";
import { runBackup } from "./backup-service";
import { verifyBackup } from "./restore-verify";
import type { BackupDestination, BackupSource } from "./port";

export type BackupDeps = {
  getSource: () => BackupSource | null;
  resolveDestinations: () => Promise<BackupDestination[]>;
  keep: () => number;
  now: () => Date;
};

type DestinationListing = { id: string; label: string; backups: BackupFile[] };

async function listDestinations(
  destinations: BackupDestination[],
): Promise<DestinationListing[]> {
  const listings: DestinationListing[] = [];
  for (const destination of destinations) {
    const listed = await destination.list();
    listings.push({
      id: destination.id,
      label: destination.label,
      backups: listed.ok ? listed.value : [],
    });
  }
  return listings;
}

export function createBackupRoutes(deps: BackupDeps): {
  GET: () => Promise<Response>;
  POST: () => Promise<Response>;
} {
  async function GET(): Promise<Response> {
    if (!deps.getSource()) {
      return NextResponse.json(
        { ok: false, error: { message: "Backup no soportado en modo cloud" } },
        { status: 409 },
      );
    }
    const destinations = await listDestinations(await deps.resolveDestinations());
    return NextResponse.json({ ok: true, data: { destinations } });
  }

  async function POST(): Promise<Response> {
    const source = deps.getSource();
    if (!source) {
      return NextResponse.json(
        { ok: false, error: { message: "Backup no soportado en modo cloud" } },
        { status: 409 },
      );
    }
    const destinations = await deps.resolveDestinations();
    const result = await runBackup({ source, destinations, keep: deps.keep(), now: deps.now() });
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: { message: `No se pudo crear el backup: ${result.error.kind}` } },
        { status: 502 },
      );
    }
    return NextResponse.json({ ok: true, data: result.value });
  }

  return { GET, POST };
}

export function createRestoreRoute(
  deps: Pick<BackupDeps, "getSource" | "resolveDestinations">,
): (req: Request) => Promise<Response> {
  return async (req: Request): Promise<Response> => {
    if (!deps.getSource()) {
      return NextResponse.json(
        { ok: false, error: { message: "Backup no soportado en modo cloud" } },
        { status: 409 },
      );
    }
    const body = (await req.json()) as { destinationId?: string; name?: string };
    if (!body.destinationId || !body.name) {
      return NextResponse.json(
        { ok: false, error: { message: "destinationId y name son requeridos" } },
        { status: 400 },
      );
    }
    const destinations = await deps.resolveDestinations();
    const destination = destinations.find((d) => d.id === body.destinationId);
    if (!destination) {
      return NextResponse.json(
        { ok: false, error: { message: "Destino no encontrado" } },
        { status: 400 },
      );
    }
    const sql = await destination.read(body.name);
    if (!sql.ok) {
      return NextResponse.json(
        { ok: false, error: { message: "Backup no encontrado" } },
        { status: 400 },
      );
    }
    const verified = await verifyBackup(sql.value);
    if (!verified.ok) {
      return NextResponse.json(
        { ok: false, error: { message: `Backup no restaurable: ${verified.error.message}` } },
        { status: 502 },
      );
    }
    return NextResponse.json({ ok: true, data: verified.value });
  };
}
```

- [ ] **Step 4: Implementar las dependencias reales**

Crear `src/infra/backup/deps.ts`:

```ts
import { getEnv } from "@/env";
import { getBackupSource } from "@/infra/db/client";
import { resolveDestinations } from "./resolve-destinations";
import { listDrivesFromDrivelist } from "./usb-destinations";
import type { BackupDeps } from "./http-routes";

export function realBackupDeps(): BackupDeps {
  return {
    getSource: () => getBackupSource(),
    resolveDestinations: () =>
      resolveDestinations({
        backupDir: getEnv().BACKUP_DIR,
        listDrives: listDrivesFromDrivelist,
      }),
    keep: () => getEnv().BACKUP_KEEP,
    now: () => new Date(),
  };
}
```

- [ ] **Step 5: Crear las rutas Next**

Crear `src/app/api/backup/route.ts`:

```ts
import { createBackupRoutes } from "@/infra/backup/http-routes";
import { realBackupDeps } from "@/infra/backup/deps";

const routes = createBackupRoutes(realBackupDeps());

export const GET = routes.GET;
export const POST = routes.POST;
```

Crear `src/app/api/backup/restore/route.ts`:

```ts
import { createRestoreRoute } from "@/infra/backup/http-routes";
import { realBackupDeps } from "@/infra/backup/deps";

const deps = realBackupDeps();

export const POST = createRestoreRoute({ getSource: deps.getSource, resolveDestinations: deps.resolveDestinations });
```

- [ ] **Step 6: Proteger las rutas en el middleware**

En `src/middleware.ts`, agregar `/api/backup` a `PROTECTED_PREFIXES`:

```ts
const PROTECTED_PREFIXES = [
  "/admin",
  "/api/admin",
  "/api/orders",
  "/api/menu",
  "/api/delivery-zones",
  "/api/backup",
  "/api/events",
];
```

Y en `config.matcher`, agregar `"/api/backup/:path*"`:

```ts
  matcher: [
    "/admin/:path*",
    "/api/admin/:path*",
    "/api/orders/:path*",
    "/api/menu/:path*",
    "/api/delivery-zones/:path*",
    "/api/backup/:path*",
    "/api/events",
  ],
```

- [ ] **Step 7: Correr los tests y verificar que pasan**

Run: `pnpm test:integration tests/integration/backup/backup-routes.test.ts`
Expected: PASS.

- [ ] **Step 8: Verificar build**

Run: `pnpm typecheck && pnpm build`
Expected: build OK (los handlers `GET`/`POST` exportados desde `route.ts` se detectan; no hay exports inválidos).
> Recordar el gotcha del volumen externo: si `pnpm build` falla por `._*` en `.next/cache`, correr `find .next -name '._*' -delete` y reintentar.

- [ ] **Step 9: Commit**

```bash
git add src/infra/backup/http-routes.ts src/infra/backup/deps.ts src/app/api/backup/route.ts src/app/api/backup/restore/route.ts src/middleware.ts tests/integration/backup/backup-routes.test.ts
git commit -m "feat(backup): endpoints GET/POST /api/backup + restore, protegidos"
```

---

### Task 11: UI `/admin/backup` + nav

**Files:**
- Create: `src/app/admin/backup/page.tsx`
- Create: `src/app/admin/backup/backup-actions.tsx`
- Modify: `src/app/admin/layout.tsx`

**Interfaces:**
- Consumes: `@/ui/{PageContainer,PageHeading,Card,CardList,CardListItem,Button,ErrorMessage}`, `getBackupSource`, `resolveDestinations`, `listDrivesFromDrivelist`, `getEnv`.
- Produces: ruta `/admin/backup`.

> Skills aplicados: **next-best-practices** (page server component; el seam client es solo el subcomponente de acciones) y **accessibility** (`role="status" aria-live="polite"` para el estado, `ErrorMessage` con `role="alert"`, `<button>` nativos con nombre accesible, foco visible provisto por `Button`).

- [ ] **Step 1: Crear el subcomponente client de acciones**

Crear `src/app/admin/backup/backup-actions.tsx` (recibe la lista de la page y renderiza cada fila con su acción "Validar"):

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/ui/Button";
import { ErrorMessage } from "@/ui/ErrorMessage";

export type BackupListing = {
  id: string;
  label: string;
  backups: { name: string; bytes: number }[];
};

export function BackupActions({ destinations }: { destinations: BackupListing[] }) {
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function createBackup() {
    setBusy(true);
    setError("");
    setStatus("Creando backup…");
    try {
      const res = await fetch("/api/backup", { method: "POST" });
      const json = (await res.json()) as { ok: boolean; error?: { message: string } };
      if (!json.ok) {
        setError(json.error?.message ?? "No se pudo crear el backup");
        setStatus("");
        return;
      }
      setStatus("Backup creado.");
      router.refresh();
    } catch {
      setError("No se pudo conectar con el servidor.");
      setStatus("");
    } finally {
      setBusy(false);
    }
  }

  async function validate(destinationId: string, name: string) {
    setBusy(true);
    setError("");
    setStatus(`Validando ${name}…`);
    try {
      const res = await fetch("/api/backup/restore", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ destinationId, name }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        data?: { tables: { name: string; rows: number }[] };
        error?: { message: string };
      };
      if (!json.ok) {
        setError(json.error?.message ?? "Backup no restaurable");
        setStatus("");
        return;
      }
      const total = json.data?.tables.reduce((sum, t) => sum + t.rows, 0) ?? 0;
      setStatus(`Backup válido (${total} filas).`);
    } catch {
      setError("No se pudo conectar con el servidor.");
      setStatus("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Button onClick={createBackup} disabled={busy}>
        {busy ? "Procesando…" : "Crear backup"}
      </Button>
      <p role="status" aria-live="polite" className="text-sm text-gray-600">
        {status}
      </p>
      {error ? <ErrorMessage>{error}</ErrorMessage> : null}

      {destinations.map((destination) => (
        <section key={destination.id} className="space-y-2">
          <h2 className="text-sm font-semibold">{destination.label}</h2>
          {destination.backups.length === 0 ? (
            <p className="text-sm text-gray-500">Sin backups.</p>
          ) : (
            <ul className="divide-y rounded border bg-white">
              {destination.backups.map((backup) => (
                <li key={backup.name} className="flex items-center justify-between p-3">
                  <span className="text-sm">{backup.name}</span>
                  <Button
                    variant="ghost"
                    onClick={() => validate(destination.id, backup.name)}
                    disabled={busy}
                    aria-label={`Validar ${backup.name}`}
                  >
                    Validar
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Crear la page server component**

Crear `src/app/admin/backup/page.tsx`:

```tsx
import { getEnv } from "@/env";
import { getBackupSource } from "@/infra/db/client";
import { resolveDestinations } from "@/infra/backup/resolve-destinations";
import { listDrivesFromDrivelist } from "@/infra/backup/usb-destinations";
import { PageContainer } from "@/ui/PageContainer";
import { PageHeading } from "@/ui/PageHeading";
import { BackupActions, type BackupListing } from "./backup-actions";

export default async function BackupPage() {
  if (!getBackupSource()) {
    return (
      <PageContainer>
        <PageHeading>Backups</PageHeading>
        <p className="mt-2 text-sm text-gray-500">
          Los backups solo están disponibles en la versión de escritorio.
        </p>
      </PageContainer>
    );
  }

  const destinations = await resolveDestinations({
    backupDir: getEnv().BACKUP_DIR,
    listDrives: listDrivesFromDrivelist,
  });

  const listings: BackupListing[] = [];
  for (const destination of destinations) {
    const listed = await destination.list();
    listings.push({
      id: destination.id,
      label: destination.label,
      backups: listed.ok ? listed.value.map((f) => ({ name: f.name, bytes: f.bytes })) : [],
    });
  }

  return (
    <PageContainer>
      <PageHeading>Backups</PageHeading>
      <p className="mb-6 mt-2 text-sm text-gray-500">
        Se guardan en la carpeta sincronizada y en las memorias USB conectadas.
      </p>
      <BackupActions destinations={listings} />
    </PageContainer>
  );
}
```

- [ ] **Step 3: Agregar el link al nav**

En `src/app/admin/layout.tsx`, después del link de "Zonas":

```tsx
          <Link href="/admin/backup" className="text-gray-700">
            Backups
          </Link>
```

- [ ] **Step 4: Verificar typecheck + build**

Run: `pnpm typecheck && pnpm build`
Expected: limpio y build OK.

- [ ] **Step 5: Verificación manual (smoke)**

Run: `DB_DRIVER=pglite pnpm dev` y abrir `http://localhost:3000/admin/backup` (logueado).
Expected: la página lista la "Carpeta sincronizada"; "Crear backup" genera `restaurante-*.sql` en `./.data/backups` y refresca; "Validar" responde "Backup válido (N filas)".

- [ ] **Step 6: Commit**

```bash
git add src/app/admin/backup/page.tsx src/app/admin/backup/backup-actions.tsx src/app/admin/layout.tsx
git commit -m "feat(backup): página /admin/backup (listar, crear, validar) + nav"
```

---

### Task 12: Sincronización de docs + verificación final

**Files:**
- Modify: `AGENTS.md`
- Modify: `docs/superpowers/plans/2026-10-03-migracion-desktop.md`
- Modify: `docs/hallazgos.md`
- Modify: `docs/deuda-tecnica.md`

**Interfaces:** sin código nuevo.

- [ ] **Step 1: Marcar la fase como completada en el plan maestro**

En `docs/superpowers/plans/2026-10-03-migracion-desktop.md`, en la tabla de Fases, cambiar la fila de la Fase 3 para reflejar el archivo de plan real (`2026-10-08-desktop-03-backup.md` si difiere) y su verificación.

- [ ] **Step 2: Registrar hallazgos**

Agregar a `docs/hallazgos.md` (respetando el formato existente, siguiente `H-0NN`):

```markdown
| H-012 | `pgDump` de `@electric-sql/pglite-tools` ejecuta `DEALLOCATE ALL` sobre la única conexión de PGlite al terminar el dump | Si la app tiene prepared statements vivos, un backup concurrente puede invalidarlos; serializar el backup contra las queries de la app. Fase 3 lo dispara manual, sin concurrencia real. |
| H-013 | `drivelist` es un addon nativo (prebuild-install) | Su ausencia no debe romper el backup: el import es lazy y `listDrivesFromDrivelist` degrada a `[]`. |
| H-014 | `@electric-sql/pglite-tools@0.4.8` fija el peer `@electric-sql/pglite@0.5.8` exacto | Subir PGlite obliga a subir pglite-tools en lockstep. |
```

- [ ] **Step 3: Registrar deuda técnica**

Agregar a `docs/deuda-tecnica.md` (respetando el formato, siguiente `DT-0NN`):

```markdown
| DT-018 | El swap en vivo de la DB (restaurar reemplazando el `dataDir`) no está implementado | Fase 4 (Electron puede reiniciar el server). Fase 3 solo valida restaurabilidad. |
| DT-019 | El backup no está serializado contra las queries de la app (PGlite single-connection) | Riesgo bajo con disparo manual; revisar si se agrega schedule en Fase 4. |
```

- [ ] **Step 4: Actualizar `AGENTS.md`**

En la sección "Estado actual → Migración a versión de escritorio", marcar Desktop Fase 3 como completada con un resumen (dump SQL → carpeta + USB, rotación, validación, endpoints + `/admin/backup`) y la deuda registrada.

- [ ] **Step 5: Verificación final completa**

Run:
```bash
find .next -name '._*' -delete 2>/dev/null
pnpm typecheck && pnpm test && pnpm audit --audit-level=high
```
Expected: typecheck limpio; **todos** los tests verdes (unit + integración, incluyendo los nuevos de backup); audit sin high.

- [ ] **Step 6: Commit**

```bash
git add AGENTS.md docs/superpowers/plans/2026-10-03-migracion-desktop.md docs/hallazgos.md docs/deuda-tecnica.md
git commit -m "docs(desktop): registra Fase 3 (backups) completada + hallazgos y deuda"
```

---

## Self-Review

**Spec coverage:**
- Dump SQL portable vía `pgDump` → Task 5. ✅
- Carpeta sincronizada + USB auto-opcional → Tasks 4 y 6. ✅
- Rotación por `BACKUP_KEEP` → Tasks 3 y 7. ✅
- Validación de restaurabilidad (no swap) → Task 8. ✅
- Solo manual (sin timer) → no hay task de schedule (correcto). ✅
- API + `/admin/backup` → Tasks 10 y 11. ✅
- Cloud → 409 → Task 10. ✅
- Env `BACKUP_DIR`/`BACKUP_KEEP` → Task 1. ✅
- `getBackupSource` en el puerto DB → Task 9. ✅
- UI con skills `next-best-practices` + `accessibility` → Task 11. ✅
- Docs vivas → Task 12. ✅

**Placeholder scan:** sin `TBD`/`TODO`/placeholders; cada step de código contiene el contenido final.

**Type consistency:** `BackupSource`/`BackupDestination` (port.ts) usados consistentemente; `BackupError`/`BackupFile` (core/backup/types.ts) en todos los adapters; `runBackup` recibe `{source, destinations, keep, now}` en servicio y en `http-routes`; `getBackupSource` retorna `BackupSource | null` en client, deps y page; `BackupListing` (UI) es un shape propio del client, no confundir con `BackupFile` del core.
