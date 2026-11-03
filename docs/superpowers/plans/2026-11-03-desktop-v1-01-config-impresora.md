# Desktop v1 — Configurar la impresora desde el `.exe`: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** que el operador del `.exe` configure la IP de la térmica Ethernet desde `/admin/ajustes`, sin reiniciar, y que `print-kitchen`/`print-bill` impriman por ESC/POS (`printed: "server"`).

**Spec:** [`2026-11-03-desktop-v1-01-config-impresora-design.md`](../specs/2026-11-03-desktop-v1-01-config-impresora-design.md) (debe estar **Aprobada** antes de empezar). DT-018 (USB) tiene su propio plan.

**Architecture:** functional core, imperative shell. Validación pura en `src/core/settings/`, config en la tabla `settings` (DB gana sobre env), rutas con el patrón `createXRoutes(deps)` de `src/infra/backup/http-routes.ts`, página admin como server component + form cliente.

## Global Constraints

- TypeScript estricto: **sin** `any`, `!` ni `as Tipo`; `satisfies` si hace falta.
- Core sin I/O. Errores del core con `Result` (`src/core/result.ts`: `ok`/`err`).
- **TDD:** test primero, verlo fallar por la razón correcta, mínimo código para pasar, refactor. Cobertura ≥80 %.
- **Sin mocks:** fakes in-memory, PGlite real, y un servidor TCP local (`node:net`) en lugar de mockear el transporte.
- Tests de integración: `// @vitest-environment node` y `getDb()`.
- Un commit por tarea (conventional commits, cuerpo con el "por qué" si no es obvio). Verificar antes de commitear: `pnpm typecheck && pnpm lint && pnpm test:unit` (+ `pnpm test:integration` donde se indique).
- `pnpm`, nunca npm/npx. Nombres de dominio en español, tecnología en inglés.
- Fuera de alcance: lo listado en la spec (BUSINESS_*, WHATSAPP_*, USB, 2 impresoras, auto-print).

---

### Task 1: `parsePrinterSettings` (core puro)

**Files:**
- Create: `src/core/settings/printer.ts`
- Create: `src/core/settings/printer.test.ts`

**Interfaces:**
- Produces: `type PrinterSettings = { host: string; port: number }` (`host: ""` = desactivada), `type PrinterSettingsError = { kind: "invalid_host" | "invalid_port"; message: string }`, `parsePrinterSettings(input: { host: string; port: string | number }): Result<PrinterSettings, PrinterSettingsError>`.

- [ ] **Step 1 (rojo):** `printer.test.ts` con casos: IPv4 válida → ok; hostname (`impresora.local`) → ok; `host` vacío o solo espacios → ok con `host: ""`; puerto vacío → 9100; puerto `"9101"` y `9101` → 9101; rechaza `http://1.2.3.4`, `1.2.3.4:9100`, `"a b"`, puerto 0, 70000, `"abc"` y `1.5`. Correr `pnpm test:unit -- printer` y ver fallar por módulo inexistente.
- [ ] **Step 2 (verde):** implementar lo mínimo. Mensajes de error en español, claros para el operador (p. ej. "La IP no debe incluir http:// ni el puerto").
- [ ] **Step 3:** refactor si hay duplicación; test verde.
- [ ] **Step 4:** commit `feat(settings): validacion pura de la config de impresora`.

---

### Task 2: `renderTestTicket` (core puro)

**Files:**
- Modify: `src/core/printing/render-ticket.ts`
- Modify: `src/core/printing/render-ticket.test.ts`

**Interfaces:**
- Produces: `renderTestTicket(now: Date): Uint8Array` (init + CP850 + texto "PRUEBA DE IMPRESION" + fecha con `formatDateTime` + feed + corte).

- [ ] **Step 1 (rojo):** test: empieza con `init()`, contiene el texto (reusar `includesSequence`) y termina con `cut()`. Ver fallar por export inexistente.
- [ ] **Step 2 (verde):** implementar reutilizando `escpos-bytes.ts` y los helpers existentes.
- [ ] **Step 3:** commit `feat(printing): ticket de prueba`.

---

### Task 3: Repo de settings de impresora

**Files:**
- Modify: `src/infra/db/settings-repository.ts`
- Create: `tests/integration/db/printer-settings.test.ts`

**Interfaces:**
- Consumes: `getSetting`/`setSetting`, `PrinterSettings` (Task 1).
- Produces: `PRINTER_HOST_KEY = "printer_host"`, `PRINTER_PORT_KEY = "printer_port"`, `getPrinterSettings(): Promise<PrinterSettings | null>` (null si **no existe** `printer_host`; existente y vacío = desactivada), `setPrinterSettings(s: PrinterSettings): Promise<void>`.

- [ ] **Step 1 (rojo):** integración sobre PGlite: sin filas → `null`; guardar y leer devuelve lo guardado; guardar dos veces actualiza (upsert); guardar `host: ""` se lee como `{ host: "", port }` (no `null`). Aislar con `DELETE FROM settings WHERE key IN (...)` en `beforeEach`.
- [ ] **Step 2 (verde):** implementar. Puerto guardado como texto; al leer, parsear con el core (dato corrupto en DB → `null`, no excepción).
- [ ] **Step 3:** `pnpm test:integration -- printer-settings`; commit `feat(settings): persistir la config de impresora en la tabla settings`.

---

### Task 4: `loadPrinterConfig` y cableado en las rutas de impresión

**Files:**
- Modify: `src/infra/printer/index.ts`
- Modify: `src/app/api/orders/[id]/print-kitchen/route.ts`
- Modify: `src/app/api/orders/[id]/print-bill/route.ts`
- Create: `tests/integration/printer/load-printer-config.test.ts`
- Modify: `tests/integration/printer/print-routes.test.ts`

**Interfaces:**
- Consumes: `getPrinterSettings`, `resolveTransport` (sin cambios de firma).
- Produces: `loadPrinterConfig(env: Pick<Env, "PRINTER_HOST" | "PRINTER_PORT">): Promise<{ PRINTER_HOST: string; PRINTER_PORT: number }>`.

- [ ] **Step 1 (rojo):** `load-printer-config.test.ts`: sin DB → devuelve el env; con DB gana sobre el env; DB con host vacío desactiva aunque el env tenga host; DB corrupta → cae al env. En `print-routes.test.ts`, caso nuevo: levantar un `net.createServer` en puerto 0 que acumula bytes, guardar su host/puerto con `setPrinterSettings`, llamar `print-kitchen` y esperar `printed: "server"` + que el servidor recibió bytes que empiezan con `init()`.
- [ ] **Step 2 (verde):** implementar `loadPrinterConfig`; en ambas rutas sustituir `resolveTransport(getEnv())` por `resolveTransport(await loadPrinterConfig(getEnv()))`.
- [ ] **Step 3:** correr la suite de impresión completa (`pnpm test:integration -- printer`) para comprobar que los casos previos (fallback `browser`, `502`) siguen verdes; commit `feat(printer): la config de la DB gana sobre el env en las rutas de impresion`.

---

### Task 5: API `GET/PUT /api/settings/printer` y `POST …/test`

**Files:**
- Create: `src/infra/printer/http-routes.ts` (`createPrinterSettingsRoutes(deps)`, mismo patrón que `src/infra/backup/http-routes.ts`)
- Create: `src/app/api/settings/printer/route.ts` (GET, PUT)
- Create: `src/app/api/settings/printer/test/route.ts` (POST)
- Create: `tests/integration/api/settings-printer.test.ts`

**Interfaces:**
- Consumes: `parsePrinterSettings`, `get/setPrinterSettings`, `loadPrinterConfig`, `renderTestTicket`, `createTcpTransport` (con `timeoutMs` corto, **un solo intento**, sin pasar por `print-service`).
- Produces: `deps = { isDesktop(): boolean; now(): Date }`. Respuestas según la tabla de la spec.

- [ ] **Step 1 (rojo):** integración:
  - `409` en las tres rutas con `isDesktop: () => false`.
  - `GET` sin DB → valores del env; tras `PUT` → los guardados.
  - `PUT` válido → `200` y persistido; `PUT` con `http://x` → `400` con `message` en español y **nada** persistido.
  - `POST test` contra un servidor TCP local → `200` y el servidor recibió el ticket de prueba; contra un puerto cerrado (abrir y cerrar un servidor para obtenerlo) → `502`; con host inválido → `400`; el test **no** debe guardar nada en la DB.
- [ ] **Step 2 (verde):** implementar las rutas. `isDesktop` real = `getEnv().DB_DRIVER === "pglite"`. Verificar a mano que el middleware ya protege `/api/settings/*` (misma regla que el resto de `/api`); si no, añadir test en `setup-gate`/middleware existente.
- [ ] **Step 3:** commit `feat(api): ajustes de impresora con prueba de conexion (solo escritorio)`.

---

### Task 6: Página `/admin/ajustes`

**Files:**
- Create: `src/app/admin/ajustes/page.tsx` (server component, `force-dynamic`, lee con `loadPrinterConfig`)
- Create: `src/app/admin/ajustes/printer-form.tsx` (client: host, puerto, **Guardar**, **Imprimir prueba**, mensajes de resultado)
- Modify: `src/app/admin/layout.tsx` (link "Ajustes")

**Interfaces:**
- Consumes: la API de la Task 5; primitivas de `src/ui` (`PageContainer`, `PageHeading`, `Card`, `Button`, `Input`).

- [ ] **Step 1:** construir la página siguiendo `/admin/conectar` y `/admin/backup`. En cloud (`DB_DRIVER !== "pglite"`) mostrar "Disponible solo en la versión de escritorio", igual que `conectar`.
- [ ] **Step 2:** a11y: `label` por campo, mensajes de resultado con `role="status"`, botones ≥44 px (los primitivos ya lo cumplen).
- [ ] **Step 3:** `pnpm typecheck && pnpm lint && pnpm build`; commit `feat(admin): pagina de ajustes con la impresora`.
- Sin test de componente: la lógica está en el core y la API; la UI se verifica en la Task 7. (Un e2e con Playwright queda fuera por YAGNI; el flujo se recorre en el `.exe`.)

---

### Task 7: Verificación en el `.exe` (sin hardware)

**Files:**
- Create: `docs/runbooks/2026-11-XX-desktop-v1-impresora.md` (resultados)

- [ ] **Step 1:** `pnpm electron:dist` y lanzar `dist\win-unpacked` con `--user-data-dir` aislado y `--remote-debugging-port=9222` (mismo método que la verificación del 2026-11-03; no tocar la instalación ni la DB real).
- [ ] **Step 2:** listener TCP en `127.0.0.1:9100` que vuelca los bytes a un archivo.
- [ ] **Step 3 (CDP):** wizard → `/admin/ajustes` → `127.0.0.1` / `9100` → **Imprimir prueba** (esperar OK y ESC/POS en el archivo) → **Guardar** → crear pedido → `POST print-kitchen` y `print-bill` con `printed: "server"` y bytes recibidos, **sin reiniciar** el server.
- [ ] **Step 4 (negativos):** apagar el listener → **Imprimir prueba** da `502` con mensaje claro y `print-kitchen` da `502`; host `http://x` da `400`; vaciar el host y guardar → vuelve a `printed: "browser"`.
- [ ] **Step 5:** documentar resultados y evidencias en el runbook; matar los procesos de prueba; commit `docs: runbook de verificacion de la impresora en el .exe`.

---

### Task 8: Cierre documental

**Files:**
- Modify: `docs/deuda-tecnica.md` (DT-047)
- Modify: `AGENTS.md`
- Modify: `docs/hallazgos.md` (solo si hubo sorpresas)
- Modify: la spec (Estado → Implementada)

- [ ] **Step 1:** DT-047: anotar la **porción impresora resuelta** (fecha y PR) y dejar la deuda `Abierta` por `BUSINESS_*`/`WHATSAPP_*` (v2). Corregir el criterio `printed: "escpos"` → `"server"`.
- [ ] **Step 2:** AGENTS.md: línea ✅ en "Estado actual", `/admin/ajustes` y las claves `printer_host`/`printer_port` en la sección de la versión de escritorio; actualizar cifras de tests.
- [ ] **Step 3:** registrar en `hallazgos.md` cualquier cosa que haya contradicho la spec (regla "surprise = write it down").
- [ ] **Step 4:** commit `docs: cierra la porcion impresora de DT-047`.

---

## Verificación final (antes del PR)

```bash
pnpm typecheck && pnpm lint
pnpm test:unit
pnpm test:integration
pnpm build && pnpm audit --audit-level=high
```

Un PR contra `main`, squash, que cierre la porción impresora de DT-047. Integration y e2e **no** corren en CI: pegar la salida local en la descripción.

## Riesgos

- **Impresora real sin probar (aplazado, [DT-048](../../deuda-tecnica.md)):** no hay impresora conectada (2026-11-03). La verificación usa un listener TCP. Probar la térmica física (IP fija, CP850) antes de entregar la v1; anotarlo en el runbook.
- **Auto-print:** la pregunta abierta de la spec sigue sin resolver; este plan **no** lo incluye.
- **Dato corrupto en `settings`:** `getPrinterSettings` devuelve `null` y la config cae al env en vez de romper la impresión; cubierto en Tasks 3 y 4.
