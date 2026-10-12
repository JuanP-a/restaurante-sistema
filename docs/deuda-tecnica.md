# Registro de deuda técnica

> Trabajo que **debemos** (código, tests, infra, docs) que no está hecho, o compromisos conscientes que tomamos por ahora. Distinto de [`hallazgos.md`](hallazgos.md): acá va lo que hay que *pagar*, no lo que *descubrimos*.
>
> **Regla de uso:** cuando un hallazgo implique trabajo pendiente, o cuando tomemos un atajo consciente, agregar una entrada. Al resolver, marcar `Resuelta` con fecha y el commit/PR — no borrar la fila (el historial importa).

**Convenciones:**

- ID `DT-NNN` incremental, nunca se reutiliza.
- Prioridad: **Alta** (bloquea o degrada calidad/seguridad), **Media**, **Baja**.
- Esfuerzo: **S** (<1h), **M** (1 día), **L** (varios días).
- Estado: `Abierta` · `En progreso` · `Aceptada` (decisión consciente, no se paga) · `Resuelta`.

---

## Índice

| ID | Área | Deuda | Prioridad | Esfuerzo | Estado | Origen |
|----|------|-------|-----------|----------|--------|--------|
| DT-047 | Desktop | `POST /api/setup` (one-shot) no es atómico: dos POST concurrentes en primer arranque pasan el guard (TOCTOU) | Baja | S | Abierta | Review seguridad |
| DT-048 | Desktop | El instalador NSIS del `.exe` no se genera en macOS (makensis x86 sin Rosetta; el standalone debe construirse en Windows) → empaquetar y verificar en CI/Windows | Media | M | Abierta | Fase 4 |
| DT-049 | Desktop | Verificar en Windows real que `SESSION_COOKIE_SECURE=false` llega al cookie (auto-login en LAN HTTP) | Media | S | Abierta | Review seguridad |
| DT-022 | Desktop | `/admin/backup` sin `force-dynamic`: se prerenderiza como cloud y no aparece en el `.exe` | Alta | S | Resuelta | [H-015](hallazgos.md) |
| DT-023 | Frontend | Dark-mode del SO vuelve ilegible la UI y los tickets (`bg-white` + `--foreground` claro) | Alta | S | Abierta | [H-016](hallazgos.md) |
| DT-024 | WhatsApp | El bot no hidrata el producto: placeholder `name:"x"`/`basePrice:"0"` | Alta | M | Abierta | [H-017](hallazgos.md) |
| DT-025 | Desktop | `runBackup` reporta éxito sin escribir en ningún destino (falso "Backup creado") | Alta | S | Abierta | [H-018](hallazgos.md) |
| DT-026 | Desktop | `verifyBackup`: 2ª instancia PGlite por llamada; sin single-flight ni timeout/tamaño | Media | S | Abierta | [H-019](hallazgos.md) |
| DT-027 | Seguridad | Dos modelos de sesión: `admin_sessions` no se consulta, el logout no invalida | Media | M | Abierta | [H-020](hallazgos.md) |
| DT-028 | API | Parsear requests con Zod en el borde (elimina los `as Tipo` de las rutas) | Alta | M | Abierta | [H-021](hallazgos.md), [DT-001] |
| DT-029 | Dominio | Pricing/armado de pedido duplicado en 2 handlers; extraer `priceOrder` puro al core | Alta | M | Abierta | Reviews backend/calidad |
| DT-030 | Arquitectura | Repos acoplados a `getDb()` singleton: falta puerto por propósito + composition root (SaaS/tenant) | Media | L | Abierta | Review arquitectura |
| DT-031 | Arquitectura | Estado in-process (event bus, session-store, rate-limit) sin ADR ni puertos | Media | M | Abierta | Review arquitectura |
| DT-032 | Arquitectura | `infra/db` depende de `infra/backup` (`DbHandle.backupSource`): seam mal ubicado | Media | S | Abierta | Review arquitectura |
| DT-033 | Arquitectura | `infra/backup/http-routes.ts` acopla Next.js y aloja el composition root en `infra` | Media | S | Abierta | Review arquitectura |
| DT-034 | Arquitectura | Identidad de negocio duplicada: `BUSINESS_*` (server) vs `NEXT_PUBLIC_BUSINESS_*` (client) | Media | S | Abierta | Review arquitectura |
| DT-035 | Desktop | `drivelist`/`pglite-tools` fuera del `outputFileTracingIncludes` del standalone | Media | S | Resuelta | [DT-008] / [DT-018] |
| DT-036 | Frontend | Sin manejo de errores de fetch: botones "pegados" y fallos silenciosos (login, nuevo pedido, categorías, zonas) | Media | M | Abierta | Review frontend |
| DT-037 | Frontend | Páginas de impresión: "Cargando…" infinito sin `.catch` y duplicación kitchen/bill | Media | M | Abierta | Review frontend |
| DT-038 | Frontend | Sin `error.tsx`/`not-found.tsx`/`loading.tsx` en la app | Media | S | Abierta | Review frontend |
| DT-039 | Frontend | SSE sin reconexión/errores y solo escucha `order_created` | Baja | S | Abierta | Review frontend |
| DT-040 | A11y | Inputs sin label (solo placeholder), sin `aria-pressed`; `Button` sin `focus-visible` | Media | S | Abierta | Review frontend |
| DT-041 | UX | Sin UI de logout ni `aria-current` en el nav | Baja | S | Abierta | Review frontend |
| DT-042 | Dominio | Dinero como `number`+`toFixed` (float); sumar en centavos enteros | Baja | M | Abierta | Review calidad |
| DT-043 | Bot | `BotPayload` bolsa de opcionales + flag `created`: estados ilegales representables | Media | M | Abierta | Review calidad |
| DT-044 | Bot | `buildBotReply` es un `switch` de ~160 líneas (9 estados) | Media | M | Abierta | Review calidad |
| DT-045 | Mantenibilidad | Menores de core/infra: `listZones(_activeOnly)`, contrato de `calculateOrderTotals`, `truncate`/`twoColumns`, `importMenu`/`parse-import`, `?? 1` en secuencia, event-bus stringly, `as any` en test, `raw_input` | Baja | S | Abierta | Reviews varios |
| DT-046 | Desktop | Impresora única por env global; sin seam N impresoras; `not_configured` es variante muerta | Baja | M | Abierta | Review arquitectura |
| DT-001 | Tooling | Sin linter; `pnpm lint` documentado pero inexistente | Alta | S | Abierta | [H-009](hallazgos.md) |
| DT-003 | CI | Integration tests no corren en CI (solo unit) | Alta | M | Abierta | [H-008](hallazgos.md) |
| DT-009 | Dominio | Nº de pedido global, no reinicia diario (spec pedía 4 AM) | Media | M | Abierta | Plan desktop Q1 |
| DT-004 | Feature | Modificadores de menú pausados (falta UI) | Media | L | En progreso | `feature/modifiers-completion` |
| DT-005 | Feature | Import de menú: `includes`/`extras`/`optionGroups` se parsean pero no persisten | Media | M | Abierta | Import menú |
| DT-006 | Deps | Override de `sharp` (módulo nativo) — riesgo de binario en deploy | Media | S | Abierta | [ADR 0004](../decisions/0004-pnpm-overrides-advisories.md) |
| DT-007 | Seguridad | 1 advisory **moderate** residual (bajo el umbral `high`) | Baja | S | Abierta | [H-007](hallazgos.md) |
| DT-008 | Desktop | Verificar que `drizzle/` + WASM PGlite viajan en el bundle standalone | Media | S | Resuelta | Fase 4; ver [DT-035] |
| DT-011 | Desktop | Cookie `secure` en HTTP intranet rompe login | Media | S | Resuelta | Plan desktop R6 |
| DT-015 | Desktop | Fases desktop sin plan escrito; Fases 3 y 4 ya tienen plan, falta 5 (túnel) | Media | M | En progreso | Plan maestro |
| DT-016 | Testing | Anti-doble-impresión en `/print/...` sin test automático (solo typecheck) | Media | S | Abierta | Fase 2 |
| DT-017 | API | `id` malformado (no-UUID) en rutas de pedido → 500 en vez de 404 | Baja | S | Abierta | Fase 2 |
| DT-018 | Deps | `drivelist` (addon nativo) sin bindings: pnpm ignora su build script | Media | S | Abierta | Fase 3 backup |
| DT-019 | Deps | `pglite-tools` fija el peer de PGlite en versión exacta: subir ambos en lockstep | Media | S | Abierta | [H-014](hallazgos.md) |
| DT-020 | Desktop | El swap en vivo de la DB (restaurar reemplazando el `dataDir`) no está implementado | Media | M | Abierta | Fase 3 backup |
| DT-021 | Desktop | El backup no está serializado contra las queries de la app (PGlite single-connection) | Media | S | Abierta | [H-001](hallazgos.md), [H-019](hallazgos.md) |
| DT-002 | Tooling | `pnpm db:seed` documentado pero inexistente | Baja | S | Abierta | [H-009](hallazgos.md) |
| DT-010 | Tooling | Grupos de Dependabot abren 2 PRs/semana; podrían unificarse | Baja | S | Aceptada | [H-005](hallazgos.md) |
| DT-012 | Entorno | Workarounds macOS (file mode / shadow files) en volumen externo | Baja | — | Aceptada | [H-002](hallazgos.md) / [H-003](hallazgos.md) |
| DT-013 | Desktop | Adapter de impresión USB previsto, no implementado | Baja | M | Aceptada | Plan desktop (fuera de alcance) |
| DT-014 | Desktop | Sin firma de código (SmartScreen) | Baja | M | Aceptada | Plan desktop |

---

## Detalle

### DT-047 — `POST /api/setup` no es atómico (TOCTOU)

- **Qué:** el handler lee `getAdminPasswordHash()` y solo después escribe el hash; dos POST concurrentes en la ventana de primer arranque pueden pasar ambos el guard y setear la contraseña dos veces (gana el último).
- **Por qué importa:** es la puerta pública del wizard; en LAN HTTP, durante esa ventana, una carrera podría dejar el hash que eligió otro. Impacto real bajo (host local restringe el endpoint), pero el patrón es incorrecto.
- **Fix propuesto:** hacer el set atómico (`INSERT ... ON CONFLICT DO NOTHING` sobre `settings` y tratar `rowCount === 0` como `already_setup`), o serializar con un lock en el composition root.
- **Criterio de cierre:** dos POST concurrentes → exactamente uno responde 200 y el otro 409.

### DT-048 — El instalador NSIS no se genera en macOS

- **Qué:** `pnpm electron:dist` corre `electron-builder --win` desde macOS; `makensis` es un binario x86_64 y este Mac (Apple Silicon) no tiene Rosetta, así que el instalador NSIS no se produce. `electron-builder` tampoco puede empaquetar Windows nativo desde macOS de forma fiable.
- **Por qué importa:** el artefacto de entrega de la Fase 4 es el `.exe`; sin CI/Windows no hay build reproducible del instalador.
- **Fix propuesto:** job de CI en `windows-latest` que corra `pnpm build && pnpm electron:compile && electron-builder`. Ver el runbook manual de Task 17 como criterio de cierre.
- **Criterio de cierre:** `dist/*.exe` generado en CI/Windows y verificado con el runbook.

### DT-049 — Verificar `SESSION_COOKIE_SECURE=false` en Windows HTTP

- **Qué:** el shell setea `SESSION_COOKIE_SECURE=false` para LAN HTTP, pero no se verificó en Windows real que el cookie llegue sin `Secure` y que el auto-login funcione.
- **Por qué importa:** es el fix de [DT-011]; si el shell no pasa la variable o Next la ignora, el login falla en silencio sobre HTTP (mismo síntoma original).
- **Fix propuesto:** en el runbook de Windows, inspeccionar el `Set-Cookie` del wizard/login y confirmar que el cookie se guarda y autoriza.
- **Criterio de cierre:** tras el wizard, `/admin/orders` carga sin volver a `/login` sobre `http://<ip-LAN>`.

### DT-008 — WASM de PGlite y migraciones en el bundle standalone

- **Qué:** verificar que `drizzle/` y el WASM de `@electric-sql/pglite` viajan en `.next/standalone`.
- **Por qué importa:** sin ellos el `.exe` no arranca (no encuentra migraciones o el módulo WASM).
- **Fix propuesto:** `outputFileTracingIncludes` explícito (las rutas de PGlite son dinámicas y el tracer no las ve).
- **Resolución (2026-10-11, `feat/desktop-fase-4-electron-shell`):** `next.config.ts` incluye `drizzle/`, `@electric-sql/pglite`, `@electric-sql/pglite-tools` y `drivelist` (Task 10); verificado en el payload empaquetado (Task 16).

### DT-011 — Cookie `secure` rompe el login en HTTP intranet

- **Qué:** el login derivaba `secure` de `NODE_ENV === "production"`; en la LAN HTTP de escritorio, un cookie `Secure` no se guarda y el login falla en silencio.
- **Por qué importa:** bloqueaba el uso del panel por el celular en la red del local.
- **Fix propuesto:** una var explícita `SESSION_COOKIE_SECURE` (default `true` para cloud; el shell setea `false`).
- **Resolución (2026-10-11, `feat/desktop-fase-4-electron-shell`):** renombrada a `SESSION_COOKIE_SECURE`; login y `/api/setup` la consumen y el shell la setea en `false` (Tasks 1-2). Verificación en Windows pendiente → [DT-049].

### DT-022 — `/admin/backup` sin `force-dynamic`

- **Qué:** `src/app/admin/backup/page.tsx` no declara `export const dynamic = "force-dynamic"`. En `next build` sin DB, `getBackupSource()` devuelve `null` y Next hornea el branch "solo escritorio" como estático (ver [H-015](hallazgos.md)).
- **Por qué importa:** en el `.exe` (Fase 4) la UI de backup nunca se muestra, pese a que el endpoint existe.
- **Fix propuesto:** añadir `export const dynamic = "force-dynamic";` (o `await connection()`), igual que `orders/page.tsx:12` y `menu/page.tsx:9`.
- **Criterio de cierre:** en un build standalone con `backupSource` presente, `/admin/backup` renderiza la UI.
- **Resolución (2026-10-11, `feat/desktop-fase-4-electron-shell`):** aplicado en Task 3 con test de contrato (`src/env.test.ts`).

### DT-023 — Dark-mode rompe contraste de UI y tickets

- **Qué:** `globals.css:15-20` pisa `--foreground` a `#ededed` en modo oscuro; `Card`/`CardList` y varias páginas usan `bg-white` sin color de texto explícito; las páginas de impresión heredan el mismo color (ver [H-016](hallazgos.md)).
- **Por qué importa:** con el SO en modo oscuro el texto de tarjetas/encabezados queda casi blanco sobre blanco (invisible) y el ticket puede salir ilegible.
- **Fix propuesto:** quitar el bloque `@media (prefers-color-scheme: dark)` (app light-only) **o** fijar un `color` real; y en `@media print` forzar `color:#000; background:#fff`.
- **Criterio de cierre:** con el SO en oscuro, UI y tickets legibles.

### DT-024 — El bot no hidrata el producto

- **Qué:** `toBotEvent` (`webhooks/whatsapp/route.ts:165-171`) fabrica `product_picked` con `name:"x"`, `basePrice:"0"`; el precio se re-hidrata al crear el pedido, pero el **nombre** falso queda en el carrito (ver [H-017](hallazgos.md)).
- **Por qué importa:** la confirmación al cliente sale `• 1 x`; bug visible en el camino principal del bot.
- **Fix propuesto:** que `product_picked` lleve solo `productId` y se hidrate nombre/precio desde `getProduct` en un único punto (idealmente `addItemToCart` puro) antes de `in_cart`.
- **Criterio de cierre:** test que la confirmación incluye el nombre real del producto.

### DT-025 — `runBackup` reporta éxito sin destino escrito

- **Qué:** `runBackup` (`backup-service.ts:52`) devuelve `ok` con `written: []`; el endpoint responde 200 `ok:true` y la UI muestra "Backup creado." (ver [H-018](hallazgos.md)).
- **Por qué importa:** falso sentido de seguridad — creer que hay respaldo cuando no lo hay.
- **Fix propuesto:** tratar `written.length === 0` como fallo (502) en `http-routes.ts`, o devolver `err` desde `runBackup`; la UI debe leer `written`/`failures`, no solo `ok`.
- **Criterio de cierre:** sin destino escribible → error visible, nunca 200 "creado".

### DT-026 — `verifyBackup` y la segunda instancia PGlite

- **Qué:** `restore-verify.ts:10` crea y cierra un `PGlite` por llamada; sin single-flight ni límite de tamaño/tiempo de `exec` (ver [H-019](hallazgos.md)).
- **Por qué importa:** churn de WASM coexistiendo con la instancia long-lived; contradice la mitigación de [H-001](hallazgos.md)/R2.
- **Fix propuesto:** serializar (cola de tamaño 1) y/o reutilizar una instancia efímera; cota de tamaño del dump y `statement_timeout`. Resolver junto con [DT-021].
- **Criterio de cierre:** validaciones repetidas/concurrentes no crean múltiples instancias ni cuelgan el server.

### DT-027 — Modelo de sesión único

- **Qué:** `admin_sessions` se escribe en login y se borra en logout, pero **nadie la lee**; el middleware autoriza por HMAC (`verifyToken`) (ver [H-020](hallazgos.md)).
- **Por qué importa:** el logout no invalida; un token robado sigue válido hasta 7 días. Dos fuentes de verdad para la sesión.
- **Fix propuesto:** o el middleware valida contra `admin_sessions` (logout efectivo), o se elimina la tabla y se adoptan tokens cortos con revocación. Registrar en ADR.
- **Criterio de cierre:** tras el logout, el token deja de autorizar.

### DT-028 — Parsear requests con Zod en el borde

- **Qué:** los cuerpos se castean (`as IncomingOrder`, `as { status: string }`, `as Record<string, unknown>`, webhook con varios `as`) en lugar de parsearse; los schemas Zod existentes solo se usan para respuestas (ver [H-021](hallazgos.md)).
- **Por qué importa:** viola la regla "sin `as Tipo`", borra el tipo justo en el borde no confiable y produce 500 donde debería haber 400.
- **Fix propuesto:** un schema Zod por endpoint (`orders` POST/status, `menu` PATCH, `webhooks/whatsapp`, `delivery-zones`); `.safeParse` → 400 tipado. Encadenar con [DT-001].
- **Criterio de cierre:** sin `as Tipo` sobre input externo; input malformado → 400.

### DT-029 — Extraer pricing/armado de pedido al core

- **Qué:** `api/orders/route.ts:46-112` y `webhooks/whatsapp/route.ts:187-258` reimplementan el mismo cálculo (`unitPrice = (base + extras).toFixed(2)`, snapshots, `calculateOrderTotals`) y duplican el join de costo por colonia.
- **Por qué importa:** aritmética de dinero divergente en la shell; un cambio de regla hay que recordarlo en dos sitios y solo uno tiene tests de core.
- **Fix propuesto:** `priceOrder(...)`/`buildOrderDraft(...)` puro en `src/core/order/`; los handlers solo buscan datos (impuro) y persisten. El bot usa `getColoniaDeliveryCost`.
- **Criterio de cierre:** una sola implementación, cubierta por tests de core.

### DT-030 — Puertos por propósito + composition root

- **Qué:** el "puerto" `Db` es el tipo de Drizzle (interface por tecnología) y los repos resuelven `getDb()`/`globalThis.__db` (~20 call sites); no hay contexto de request/tenant.
- **Por qué importa:** es la decisión desktop que más bloquea un SaaS multi-tenant (una DB por proceso, sin dónde inyectar `tenantId`).
- **Fix propuesto:** interfaces por propósito (`OrderRepository`, …) inyectadas desde un composition root; mínimo un `withTenant(ctx, fn)`. `getDb()` queda como detalle del composition root desktop.
- **Criterio de cierre:** los repos dependen de una interface, no de un singleton global.

### DT-031 — Estado in-process: ADR + puertos

- **Qué:** event bus, `session-store` y `rate-limit` viven en memoria del proceso.
- **Por qué importa:** correcto para desktop/single-instance, bloqueante a escala horizontal; decisión con trade-offs y sin ADR.
- **Fix propuesto:** ADR que lo declare intencional + esconderlo tras puertos (`EventPublisher`, `BotSessionStore`, `RateLimiter`) para permitir swap a Redis/Postgres.
- **Criterio de cierre:** ADR escrito y consumo vía puertos.

### DT-032 — `infra/db` depende de `infra/backup`

- **Qué:** `DbHandle.backupSource?` y el adapter PGlite construyen la `BackupSource`.
- **Por qué importa:** al splitear a `packages/db`, ese paquete arrastraría el contexto de backup.
- **Fix propuesto:** quitar `backupSource` de `DbHandle`; exponer el cliente crudo y que el módulo de backup arme su `BackupSource` en un composition root desktop-only.
- **Criterio de cierre:** `infra/db` no importa `infra/backup`.

### DT-033 — `infra/backup/http-routes.ts` acopla Next.js

- **Qué:** `http-routes.ts` importa `NextResponse` y `deps.ts` es el composition root dentro de `infra`.
- **Por qué importa:** core/infra deben quedar framework-free para el split a `packages/*`/apps.
- **Fix propuesto:** mover las fábricas de rutas y `realBackupDeps()` a la capa app (`src/app/api/backup/_lib`).
- **Criterio de cierre:** `infra/backup` no importa `next`.

### DT-034 — Identidad de negocio duplicada

- **Qué:** `env.BUSINESS_*` (server, ESC/POS) vs `NEXT_PUBLIC_BUSINESS_*` (client, fallback navegador), con defaults independientes.
- **Por qué importa:** la misma cuenta puede imprimir distinto según el transporte; un SaaS multi-tenant no lo sostiene.
- **Fix propuesto:** fuente única resuelta en el server y pasada al page o incluida en la respuesta de `/api/orders/[id]`.
- **Criterio de cierre:** una sola fuente de identidad de negocio.

### DT-035 — `drivelist`/`pglite-tools` fuera del trace standalone

- **Qué:** `next.config.ts` incluye `./drizzle/**` y PGlite, pero no `drivelist` (import dinámico) ni `@electric-sql/pglite-tools`.
- **Por qué importa:** R3 se creyó mitigado; el `.exe` perdería detección USB y, potencialmente, el `pgDump`.
- **Fix propuesto:** añadir ambos a `outputFileTracingIncludes`/`serverExternalPackages`; verificar en el `.exe`. Encadenar con [DT-008] y [DT-018].
- **Criterio de cierre:** el build de escritorio incluye ambos módulos.
- **Resolución (2026-10-11, `feat/desktop-fase-4-electron-shell`):** `next.config.ts` agrega `@electric-sql/pglite-tools` y `drivelist` a `outputFileTracingIncludes` y `serverExternalPackages` (Task 10). Verificado en el payload empaquetado.

### DT-036 — Manejo de errores de fetch en el frontend

- **Qué:** `login`, `admin/orders/new`, `menu/categories`, `delivery-zones` y `products-list` no usan `try/catch/finally` ni chequean `r.ok`; ante fallo el botón queda "pegado" y los errores se tragan.
- **Por qué importa:** el operador no recibe feedback ante caída de red o 5xx.
- **Fix propuesto:** `try/catch/finally` que resetee el busy, chequeo de `r.ok` + `parseErrorMessage`, error visible (`ErrorMessage`). Modelo a seguir: `backup-actions.tsx`.
- **Criterio de cierre:** ningún botón queda bloqueado tras un fallo.

### DT-037 — Páginas de impresión: errores + duplicación

- **Qué:** `print/[id]/{kitchen,bill}` no chequean `r.ok` ni usan `.catch` → "Cargando…" infinito ante 404/fallo; ambas duplican la lógica de auto-impresión.
- **Por qué importa:** spinner eterno sin feedback; cada fix hay que hacerlo dos veces.
- **Fix propuesto:** extraer `useAutoPrint(id, kind)` + componente `<Receipt>`; validar `OrderDetailResponse` y mostrar error. Unificar con `use(params)` y limpiar el `setTimeout`.
- **Criterio de cierre:** 404/fallo muestra mensaje (no spinner); una sola implementación.

### DT-038 — Sin error boundaries

- **Qué:** no existen `error.tsx`/`not-found.tsx`/`loading.tsx`/`global-error.tsx`.
- **Por qué importa:** si un repositorio lanza (DB caída, migración faltante), el operador ve el error genérico de Next sin navegación.
- **Fix propuesto:** `src/app/admin/error.tsx` (client, con `reset()`), `loading.tsx` con `Loading`; opcional `not-found.tsx`.
- **Criterio de cierre:** un throw en una página muestra UI de recuperación dentro del layout admin.

### DT-039 — SSE sin reconexión/errores

- **Qué:** `orders-list.tsx` usa `EventSource` sin `onerror` y solo escucha `order_created`.
- **Por qué importa:** sesión expirada reintenta sin feedback; cambios de estado de otros operadores no se reflejan.
- **Fix propuesto:** manejar `onerror` (aviso + backoff), incluir el nº en el `aria-live`, considerar `status_change`/revalidar.
- **Criterio de cierre:** caída de SSE produce aviso y reconexión controlada.

### DT-040 — A11y: labels y foco

- **Qué:** inputs solo con placeholder (`orders/new`, `delivery-zones`, `menu/categories`); botones de categoría sin `aria-pressed`; `Button` sin `focus-visible`.
- **Por qué importa:** WCAG 3.3.2/4.1.2; targets chicos en celular (uso principal según AGENTS.md).
- **Fix propuesto:** pasar `label` (`sr-only`)/`aria-label`, `aria-pressed` en botones de categoría, `focus-visible:*` en `Button`.
- **Criterio de cierre:** audit a11y básico sin hallazgos de label/foco.

### DT-041 — Sin UI de logout

- **Qué:** el nav admin no tiene "Salir" (el endpoint existe) ni `aria-current`.
- **Por qué importa:** el operador no puede cerrar sesión desde la UI; sin wayfinding de sección activa.
- **Fix propuesto:** botón "Salir" → `POST /api/admin/logout` + `router.push("/login")`; `aria-current="page"` en el link activo.
- **Criterio de cierre:** logout disponible en la UI.

### DT-042 — Dinero como float

- **Qué:** `calculate-order.ts` opera con `Number()` + `toFixed(2)`.
- **Por qué importa:** derivas de redondeo en montos persistidos como `decimal(10,2)`.
- **Fix propuesto:** sumar en centavos enteros (`Math.round(x*100)`) y formatear al final; test con items fraccionarios.
- **Criterio de cierre:** totales exactos con entradas fraccionarias.

### DT-043 — `BotPayload` con opcionales + `created`

- **Qué:** `payload` es una bolsa plana de opcionales más un flag `created` (`state-machine.ts:21-31,109`).
- **Por qué importa:** permite estados imposibles (`idle` con `cart`), y `created` obliga al consumidor a recordar resetearlo.
- **Fix propuesto:** estrechar el payload por variante de `BotState` (unión discriminada).
- **Criterio de cierre:** `tsc` impide combinaciones estado/payload inválidas.

### DT-044 — `buildBotReply` switch de ~160 líneas

- **Qué:** una función con 9 `case` y anidación hasta 5-6.
- **Por qué importa:** supera los límites de función (<50) y anidación (≤4) del proyecto; difícil de testear por partes.
- **Fix propuesto:** `Record<BotStateName, (ctx) => ReplyAction[]>` de renderers chicos.
- **Criterio de cierre:** cada estado se testea aislado.

### DT-045 — Menores de core/infra

- **Qué:** `listZones(_activeOnly)` ignora el parámetro; contrato mentiroso de `calculateOrderTotals` (`extras` muerto / `unitPrice` pasado como `basePrice`); `importMenu` con doble loop anidado; helpers duplicados en `parse-import`; `truncate` usa `"..."` (`render-ticket.ts:16-19`) y `twoColumns` puede exceder 48 cols; `?? 1` silencioso en la secuencia; event-bus `kind: string/data: unknown`; `as any` en `order-repository.test.ts:98,171`; `ParsedResponse` sin uso; `raw_input` (snake_case).
- **Por qué importa:** ruido acumulado y errores silenciosos de layout/secuencia.
- **Fix propuesto:** tratar cada punto (parámetro real o removerlo, contrato único de item, helpers extraídos, `…`, clamp de columnas, error en vez de `?? 1`, `DomainEvent` tipado, `db.execute<T>()` en tests).
- **Criterio de cierre:** sin parámetros muertos, sin `as any`, layout de 48 cols garantizado.

### DT-046 — Impresora única por env; sin seam N impresoras

- **Qué:** `resolveTransport(env)` devuelve un solo `PrintTransport` por `PRINTER_HOST`/`PRINTER_PORT`; el tipo de ticket no selecciona impresora; `PrintError.kind: "not_configured"` nunca se produce.
- **Por qué importa:** el "seam para 2 impresoras" del spec no existe en código; multi-tenant requerirá tocarlo.
- **Fix propuesto:** `Record<PrintKind, PrintTransport>` (o `PrinterRegistry`) e inyectar la identidad de negocio en `printOrder` en vez de leer `getEnv()` adentro.
- **Criterio de cierre:** mapear kind→impresora sin romper el caso de 1.

### DT-001 — Sin linter

- **Qué:** no hay ESLint/Biome instalado ni script `lint`. `AGENTS.md` lo documenta como si existiera.
- **Por qué importa:** las reglas del proyecto (sin `any`, sin `!`, sin `as Tipo`, sin `console.log`, boundaries de capas) dependen de que un humano las recuerde. Deberían ser mecánicas.
- **Fix propuesto:** ESLint flat config (o Biome) + reglas de `mechanical-enforcement`; wire en `hk`/pre-commit y en CI `verify`.
- **Criterio de cierre:** `pnpm lint` existe, corre en CI, y `AGENTS.md` deja de mentir.

### DT-003 — Integration tests fuera de CI

- **Qué:** `verify` corre solo `pnpm test:unit`.
- **Por qué importa:** repos, adapters y API routes pueden regresar sin que CI lo detecte.
- **Fix propuesto:** job con PGlite in-memory (no requiere Docker) o service container Postgres + provisioning de env vars de test.
- **Criterio de cierre:** `pnpm test:integration` verde dentro de `verify`.

### DT-009 — Nº de pedido no reinicia diario

- **Qué:** `nextval('orders_sequential_number_seq')` es global y monótono; el spec pedía reset diario a las 4:00 AM.
- **Por qué importa:** en operación diaria los números crecen indefinidamente; el cliente espera "pedido #1" cada mañana.
- **Fix propuesto:** `MAX(sequential_number)+1 WHERE date = HOY` (recomendado en el plan) o reset programado. Decidir en Fase 1 de secuencia desktop.
- **Criterio de cierre:** número reinicia por día; test que cubre el borde de medianoche.

### DT-004 — Modificadores de menú pausados

- **Qué:** core + repo + API de ingredientes hechos en `feature/modifiers-completion`; falta UI y el resto.
- **Por qué importa:** es una feature de spec sin terminar; el import de menú ya parsea `optionGroups` que dependen de esto (ver DT-005).
- **Criterio de cierre:** feature completa y mergeada, o spec actualizado para sacarla de alcance.

### DT-005 — Import no persiste `includes`/`extras`/`optionGroups`

- **Qué:** `parseMenuImport` los valida/parsea pero `importMenu` no los guarda.
- **Por qué importa:** el menú importado queda incompleto hasta que existan los modificadores (DT-004).
- **Criterio de cierre:** persistencia de grupos/opciones o nota explícita en el spec de que quedan fuera.

### DT-006 — Override de `sharp`

- **Qué:** `pnpm.overrides` fuerza `sharp@0.35.5` por encima de lo que declara `next`.
- **Por qué importa:** `sharp` es nativo (binarios por plataforma); el empaquetado real podría romper.
- **Fix propuesto:** revisar en cada deploy; borrar el override cuando upstream suba la versión parcheada.
- **Criterio de cierre:** override eliminado sin que vuelva el advisory.

### DT-015 — Fases desktop sin plan escrito

- **Qué:** el proyecto exige spec/plan antes de implementar. Fases 1–3 (PGlite, impresión ESC/POS, backups) ya tienen spec + plan y están mergeadas; **Fases 4 (Electron) y 5 (túnel WhatsApp) siguen sin plan**.
- **Criterio de cierre:** plan por fase en `docs/superpowers/plans/` antes de tocar código.

### DT-016 — Anti-doble-impresión sin test automático

- **Qué:** el gate de las páginas `/print/[id]/{kitchen,bill}` (`window.print()` solo si `printed === "browser"`) se verifica únicamente con `pnpm typecheck`. Una regresión que quite la condición pasaría desapercibida.
- **Por qué importa:** es exactamente la regresión que la Fase 2 evita (doble impresión en desktop).
- **Fix propuesto:** E2E Playwright que afirme que NO se llama `window.print()` cuando la respuesta es `printed:"server"`, o extraer el predicado a una función pura testeable.
- **Criterio de cierre:** test que falle si el gate desaparece.

### DT-017 — `id` malformado en rutas de pedido → 500

- **Qué:** `getOrder(id)` con un id no-UUID llega a Postgres y explota con `invalid input syntax for type uuid` → 500 en vez de 404. Pre-existente, aplica a todas las rutas de pedido (no solo impresión).
- **Fix propuesto:** validar/parsear el id en el borde (`src/infra/db/order-repository.ts` o el handler) antes de tocar la DB.
- **Criterio de cierre:** id no-UUID → 404.

### DT-018 — `drivelist` sin bindings nativos

- **Qué:** al instalar `drivelist` con `pnpm add`, pnpm 10 **ignora su build script** (`prebuild-install`) por defecto. Resultado: `require("drivelist")` falla con `Could not locate the bindings file`.
- **Por qué importa:** la detección de USB de la Fase 3 (backups) depende de `drivelist` en runtime. El código lo importa de forma **lazy** y tolera su ausencia, pero sin bindings no habrá detección de unidades extraíbles.
- **Fix propuesto:** `pnpm approve-builds` (o añadir `drivelist` a `pnpm.onlyBuiltDependencies` en `package.json`) para permitir el postinstall; verificar el `.exe`/binario por plataforma al empaquetar Electron (Fase 4).
- **Criterio de cierre:** `require("drivelist")` carga en la plataforma de desarrollo y el binario viaja en el build de escritorio.

### DT-019 — `pglite-tools` fija el peer de PGlite en versión exacta

- **Qué:** `@electric-sql/pglite-tools@0.4.8` declara `peerDependencies: { "@electric-sql/pglite": "0.5.8" }` (pin exacto, no rango).
- **Por qué importa:** el `pgDump` del backup vive en tools; subir PGlite sin tools (o al revés) rompe la instalación.
- **Fix propuesto:** subir `@electric-sql/pglite` y `@electric-sql/pglite-tools` en lockstep; añadir nota en el plan de Fase 3.
- **Criterio de cierre:** ningún bump de PGlite sin el de tools (ideal: Dependabot agrupado o un test que detecte el mismatch).

### DT-020 — El swap en vivo de la DB no está implementado

- **Qué:** Fase 3 solo **valida** que un dump es restaurable (`verifyBackup` sobre una PGlite temporal). Restaurar de verdad — reemplazar el `dataDir` con el dump — no existe.
- **Por qué importa:** el operador puede validar un backup pero no restaurarlo desde la app.
- **Fix propuesto:** Fase 4 (Electron puede reiniciar el server y reapuntar `DB_PATH`).
- **Criterio de cierre:** endpoint/flujo de restore que reemplaza el `dataDir` de forma segura.

### DT-021 — El backup no está serializado contra las queries de la app

- **Qué:** PGlite es single-connection; `pgDump` corre sobre esa misma conexión mientras la app puede estar consultando, y el dump termina con `DEALLOCATE ALL` (ver [H-012](hallazgos.md) y [H-019](hallazgos.md)).
- **Por qué importa:** en un restaurante en servicio el operador dispara el backup **con** pedidos fluyendo: el dump bloquea la única conexión y el `DEALLOCATE ALL` puede invalidar prepared statements en vuelo. Subestimado como "sin concurrencia real".
- **Fix propuesto:** mutex que serialice backup vs. queries (o pausar escritura durante el dump); resolver junto con [DT-026](deuda-tecnica.md).
- **Criterio de cierre:** backup disparado en servicio no produce errores ni bloqueos anómalos.

### DT-010 / DT-012 / DT-013 / DT-014 — Aceptadas

Compromisos conscientes que no se pagan ahora:

- **DT-010:** dos PRs de Dependabot/semana es tolerable; se unifica si molesta.
- **DT-012:** los workarounds de macOS son del entorno del dev, no del producto; se documentan en `AGENTS.md` y se vive con ellos.
- **DT-013:** impresión USB fuera de alcance (MVP usa térmica de red ESC/POS).
- **DT-014:** sin firma de código (1 cliente); se revisa al escalar.
