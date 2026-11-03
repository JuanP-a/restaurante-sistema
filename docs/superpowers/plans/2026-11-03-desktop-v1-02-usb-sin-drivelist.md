# Desktop v1 — Detección de USB sin `drivelist`: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** que el `.exe` detecte memorias USB y discos USB como destinos de backup, sin módulo nativo: se quita `drivelist` y se listan las unidades de Windows con PowerShell (CIM).

**Spec:** [`2026-11-03-desktop-v1-02-usb-sin-drivelist-design.md`](../specs/2026-11-03-desktop-v1-02-usb-sin-drivelist-design.md) (debe estar **Aprobada** antes de empezar; está en el PR #56). Cierra DT-018.

**Architecture:** functional core, imperative shell. `DriveInfo`/`selectUsbMounts` y el parseo de la salida de PowerShell son puros (`src/core/backup/`); ejecutar `powershell.exe` es el borde (`src/infra/backup/`) detrás de un puerto `run(script)`. La costura ya existe: `resolveDestinations` recibe `listDrives: () => Promise<DriveInfo[]>`.

## Global Constraints

- TypeScript estricto: **sin** `any`, `!` ni `as Tipo`; `satisfies` si hace falta.
- Core sin I/O, y **el core no importa de `infra/`** (hoy `DriveInfo` vive en `infra`: la Task 1 lo sube).
- Errores del core con `Result` (`src/core/result.ts`).
- **TDD:** test primero, verlo fallar por la razón correcta, mínimo código para pasar, refactor.
- **Sin mocks:** el ejecutor falso de PowerShell es una implementación en memoria del puerto `run`.
- **Los tests de `src/` corren en CI sin `.env.local`** (lección de #55): no pueden depender de variables de entorno ni de `getEnv()`. Para comprobarlo: `SESSION_SECRET= DB_DRIVER= pnpm test:unit`.
- Un test de integración suelto: `VITEST_INIT_DB=1 pnpm exec vitest run --no-file-parallelism <archivo>`. Un test unit suelto: `pnpm exec vitest run <archivo>`.
- `pnpm typecheck` antes de cada commit (no existe `pnpm lint`, H-009). Un commit por tarea, conventional commits.
- Renombres/movimientos en un commit aparte del cambio de contenido, con sus imports para que compile.
- `pnpm`, nunca npm/npx. Nombres de dominio en español, tecnología en inglés.
- Fuera de alcance: lo listado en la spec (macOS/Linux, hot-plug, unidades de red, etiquetas).

---

### Task 1: Subir `DriveInfo` y `selectUsbMounts` al core (solo mover)

**Files:**
- Create: `src/core/backup/drives.ts` (`DriveInfo`, `selectUsbMounts`, movidos tal cual)
- Move: `src/infra/backup/usb-destinations.test.ts` → `src/core/backup/drives.test.ts`
- Modify: `src/infra/backup/usb-destinations.ts` (queda solo `listDrivesFromDrivelist`, importando el tipo del core)
- Modify: `src/infra/backup/resolve-destinations.ts`, `tests/integration/backup/resolve-destinations.test.ts` (imports)

**Por qué primero:** el parser de la Task 2 devuelve `DriveInfo` y vive en `core/`; no puede importar de `infra/`. "Make the change easy first".

- [ ] **Step 1:** `git mv` del test, crear `drives.ts` con el código movido sin cambios y actualizar los 3 imports.
- [ ] **Step 2:** correr `pnpm exec vitest run src/core/backup src/infra/backup` y `VITEST_INIT_DB=1 pnpm exec vitest run --no-file-parallelism tests/integration/backup`: **todo verde sin tocar los tests** (es un refactor puro). `pnpm typecheck`.
- [ ] **Step 3:** commit `refactor(backup): DriveInfo y selectUsbMounts pasan al core`.

---

### Task 2: `parseWindowsDrives` (core puro)

**Files:**
- Create: `src/core/backup/windows-drives.ts`
- Create: `src/core/backup/windows-drives.test.ts`

**Interfaces:**
- Produces: `type DriveListError = { kind: "invalid_output"; message: string }`, `parseWindowsDrives(raw: string): Result<DriveInfo[], DriveListError>`. Entrada: JSON `[{ id: "E:", type: 2, usb: true, access: 3 }]`. Mapeo: `isRemovable = type === 2`, `isUSB = usb`, `isReadOnly = access === 1`, `mountpoints = [{ path: "<id>\\" }]`.

- [ ] **Step 1 (rojo):** tests, cada uno con el "por qué" en el nombre, y todos pasando por `selectUsbMounts` para probar el comportamiento de punta a punta:
  - pendrive (`type 2`) → seleccionado, mount `E:\`;
  - disco duro USB (`type 3, usb true`) → seleccionado (Windows lo marca como fijo);
  - disco del sistema (`type 3, usb false`) y unidad de red (`type 4`) → no seleccionados;
  - `access 1` → solo lectura → excluido; `access 0` (desconocido) y `3` → se aceptan;
  - `[]` y salida vacía o en blanco → `ok([])`;
  - JSON inválido, no-array, o entradas sin `id`/con tipos incorrectos → `err` (o se descarta solo la entrada mala; decidir y fijar en el test: **se descarta la entrada inválida y se devuelve el resto**).
  Ver fallar por módulo inexistente.
- [ ] **Step 2 (verde):** implementar mínimo; sin `as`, narrowing con comprobaciones (`typeof`, `"id" in x`).
- [ ] **Step 3:** `pnpm exec vitest run src/core/backup`; `pnpm typecheck`; commit `feat(backup): parseo puro de la lista de unidades de Windows`.

---

### Task 3: `createDriveLister` y `listDrives` (shell)

**Files:**
- Create: `src/infra/backup/windows-drives.ts`
- Create: `src/infra/backup/windows-drives.test.ts` (unit, `run` falso)
- Create: `tests/integration/backup/windows-drives.test.ts` (script real, solo win32)

**Interfaces:**
- Consumes: `parseWindowsDrives`, `DriveInfo`.
- Produces: `type RunPowerShell = (script: string) => Promise<string>`, `createDriveLister(deps: { run: RunPowerShell; platform: string; warn: (m: string, cause: unknown) => void }): () => Promise<DriveInfo[]>`, `DRIVES_SCRIPT` (el script de la spec, constante), `listDrives` (real: `execFile("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", DRIVES_SCRIPT], { timeout: 5000, windowsHide: true })`).

- [ ] **Step 1 (rojo), unit:** `run` falso en memoria:
  - devuelve las unidades parseadas del JSON de ejemplo;
  - si `run` rechaza (timeout, `powershell.exe` bloqueado) → `[]` y `warn` llamado una vez;
  - salida ilegible → `[]` y `warn`;
  - `platform !== "win32"` → `[]` **sin llamar a `run`**.
  No importar `@/env` ni nada que lea el entorno.
- [ ] **Step 2 (verde):** implementar `createDriveLister` y `listDrives` real (`execFile`, no shell: no hay entradas del usuario que interpolar).
- [ ] **Step 3 (rojo→verde), integración real:** `describe.skipIf(process.platform !== "win32")`: ejecuta `listDrives()` con el script real; comprueba que **no lanza**, devuelve un array y tarda <5 s. No exige que haya un USB.
- [ ] **Step 4:** `SESSION_SECRET= DB_DRIVER= pnpm test:unit`, integración suelta, `pnpm typecheck`; commit `feat(backup): listar unidades de Windows con PowerShell (CIM)`.

---

### Task 4: Cablear y retirar el adapter de `drivelist`

**Files:**
- Modify: `src/infra/backup/deps.ts`, `src/app/admin/backup/page.tsx` (usan `listDrives`)
- Delete: `src/infra/backup/usb-destinations.ts` (queda vacío)

- [ ] **Step 1:** sustituir `listDrivesFromDrivelist` por `listDrives` en los dos sitios y borrar `usb-destinations.ts`. `grep` que no queda ninguna referencia a `listDrivesFromDrivelist` ni a `usb-destinations`.
- [ ] **Step 2:** `pnpm typecheck`; `VITEST_INIT_DB=1 pnpm exec vitest run --no-file-parallelism tests/integration/backup` (los tests de rutas y de `resolveDestinations` siguen verdes).
- [ ] **Step 3:** commit `refactor(backup): el listado de unidades usa listDrives en vez de drivelist`.

---

### Task 5: Quitar la dependencia `drivelist`

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml` (`pnpm remove drivelist`)
- Modify: `next.config.ts` (fuera de `outputFileTracingIncludes` y `serverExternalPackages`; ajustar el comentario)
- Modify: `electron-builder.yml` (quitar el comentario de `drivelist`; **probar** sin `npmRebuild: false`)

- [ ] **Step 1:** `pnpm remove drivelist` y editar los dos archivos de config.
- [ ] **Step 2:** `pnpm build` y `pnpm audit --audit-level=high` (CI los corre).
- [ ] **Step 3:** quitar `npmRebuild: false` y correr `pnpm electron:dist`. Si **pasa**, queda quitado (era solo por `drivelist`); si falla por otro addon, se restaura la línea con un comentario que nombre el paquete real. Comprobar que `dist-standalone/vendor/drivelist` ya no existe.
- [ ] **Step 4:** suite completa `pnpm test` y, por separado, `SESSION_SECRET= DB_DRIVER= pnpm test:unit`; commit `chore(deps): quita drivelist (DT-018)`.

---

### Task 6: Verificación en el `.exe` (sin hardware)

**Files:**
- Create: `docs/runbooks/2026-11-XX-desktop-v1-usb.md`

- [ ] **Step 1:** `dist\win-unpacked` con `--user-data-dir` nuevo y `--remote-debugging-port=9222` (mismo método que el runbook de la impresora; no tocar la instalación ni la DB real). Wizard por CDP.
- [ ] **Step 2:** `GET /api/backup` → 200, `destinations` solo con `folder`, y **responde en <3 s** (PowerShell no cuelga la página). `/admin/backup` carga y muestra solo "Carpeta sincronizada".
- [ ] **Step 3:** `POST /api/backup` crea el archivo en la carpeta; `POST /api/backup/restore` lo valida. Los backups a carpeta no se ven afectados.
- [ ] **Step 4:** buscar en el log del server que **no** aparece `drivelist no disponible` ni un warning de PowerShell.
- [ ] **Step 5:** mirar al menos una captura de `/admin/backup` (H-027: el DOM no basta).
- [ ] **Step 6:** escribir el runbook con resultados y la **lista de 7 pasos de hardware de la spec marcados como pendientes** para el usuario; matar los procesos de prueba; commit `docs: runbook de verificacion de USB en el .exe`.

---

### Task 7: Cierre documental

**Files:**
- Modify: `docs/deuda-tecnica.md` (DT-018), `docs/hallazgos.md` (H-013 + hallazgo nuevo), `AGENTS.md`, `docs/decisions/0005-alcance-v1-desktop.md`, la spec (Estado)

- [ ] **Step 1:** DT-018 → **`En progreso`**: implementado en código, **pendiente de la verificación con hardware del usuario**; documentar la desviación (el fix propuesto nunca pudo funcionar). Se pasa a `Resuelta` cuando el usuario confirme los 7 pasos.
- [ ] **Step 2:** hallazgo nuevo: `drivelist` 12.x no publica binarios (0 assets, comprobado 2026-11-03) y `pnpm approve-builds` no lo arregla; actualizar H-013 (la "ausencia no debe romper el backup" sigue valiendo para PowerShell).
- [ ] **Step 3:** AGENTS.md: quitar las menciones a `drivelist` (backup, Fase 4), añadir ✅ de esta tarea y actualizar el 🎯 de la v1 y las cifras de tests. ADR 0005: nota fechada de que el criterio de DT-018 cambió ("detección de USB sin módulo nativo") y por qué. Spec → "Implementada (pendiente de hardware)".
- [ ] **Step 4:** commit `docs: cierra DT-018 en codigo; pendiente verificacion con hardware`.

---

## Verificación final (antes del PR)

```bash
pnpm typecheck
pnpm test                                   # unit + integration
SESSION_SECRET= DB_DRIVER= pnpm test:unit   # condiciones de CI (sin .env.local)
pnpm build && pnpm audit --audit-level=high
pnpm electron:dist
```

Un PR contra `main` que referencie DT-018. Integration y e2e no corren en CI: pegar la salida local en la descripción, y decir explícitamente que la detección con un USB real **no está verificada** (la hace el usuario).

## Riesgos

- **USB real sin probar:** el recorrido `Win32_DiskDrive → Win32_DiskPartition → Win32_LogicalDisk` solo se ejercita con un dispositivo. Mitigación: la condición `DriveType=2` cubre los pendrives aunque falle la asociación; la lista de hardware de la spec cubre el resto.
- **`npmRebuild: false`:** si quitarlo rompe `electron:dist` por otro addon, se restaura y se documenta el motivo.
- **PowerShell bloqueado o con alerta de antivirus:** degrada a `[]`; ver riesgos de la spec.
