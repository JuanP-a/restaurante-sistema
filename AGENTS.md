# AGENTS.md — Sistema de pedidos del restaurante

## Qué es este proyecto

Sistema web (PWA) en la nube para gestionar pedidos de un restaurante de comida rápida. El operador del local toma pedidos desde laptop o celular; los clientes pueden pedirse solos por WhatsApp. Imprime comandas de cocina y cuentas con precios en una sola impresora térmica 80 mm.

> Para el diseño completo, leer [`docs/superpowers/specs/2026-09-13-sistema-pedidos-restaurante-design.md`](docs/superpowers/specs/2026-09-13-sistema-pedidos-restaurante-design.md). Este archivo es solo el contexto rápido.

## Stack (decidido, no cambiar sin discutir)

- **Next.js 16** (App Router, TypeScript estricto)
- **Drizzle ORM** + **Postgres** (Neon/Render/Railway en prod, Docker local en dev — ver [`docs/decisions/0001-local-postgres-docker.md`](docs/decisions/0001-local-postgres-docker.md))
- **Tailwind** + **shadcn/ui**
- **360dialog** como BSP de WhatsApp
- **Server-Sent Events** para el dashboard en tiempo real
- Deploy en **Render** o **Railway**
- Sin TypeScript `any`, sin non-null assertion (`!`), sin type assertions (`as Tipo`) — usar `satisfies` cuando se necesite shape checking

## Reglas no negociables

1. **No agregar features fuera del alcance del spec sin actualizar el spec primero.** El spec tiene una sección 13 "Fuera de alcance" explícita. Si crees que algo nuevo debe entrar, modifica el spec y pide aprobación del usuario antes de codear.
2. **Functional core, imperative shell.** Lógica de negocio (cálculo de precios, state machines, validaciones) en funciones puras, sin I/O. I/O solo en bordes (handlers, repos, adaptadores).
3. **Tests con TDD.** Target 80% coverage mínimo. Escribir el test antes que la implementación, ver fallar, hacer pasar, refactorizar.
4. **YAGNI.** Si una feature no está en el spec, no se implementa aunque sea "obvia".
5. **No mocks.** Para el core puro, tests con valores reales. Para adapters, fakes in-memory o infraestructura real. Si necesitas mockear, replantéate el diseño.
6. **Comentarios solo cuando el "por qué" no es obvio.** El "qué" y el "cómo" se deducen del código. El "por qué" se documenta.
7. **Commits chicos y verificables.** Cada commit es un cambio coherente que pasaría review aislado. Mensaje en formato conventional commits (`feat:`, `fix:`, `chore:`, etc.), con cuerpo cuando el "por qué" no sea obvio.

## Estructura esperada del proyecto (cuando se cree)

```
/
├── docs/
│   ├── decisions/                    # ADRs (NNNN-titulo.md)
│   ├── superpowers/
│   │   ├── specs/                    # diseños aprobados
│   │   └── plans/                    # planes de implementación
│   ├── hallazgos.md                  # registro de descubrimientos
│   └── deuda-tecnica.md              # registro de deuda técnica
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── (admin)/                  # Rutas admin (requieren login)
│   │   ├── (public)/                 # Rutas públicas (login, landing)
│   │   ├── api/                      # API routes
│   │   └── print/[id]/{kitchen,bill} # Plantillas de impresión
│   ├── core/                         # Pure business logic (sin I/O)
│   │   ├── pricing/                  # Cálculos de precios
│   │   ├── order/                    # State machine, validaciones
│   │   └── bot/                      # State machine del bot de WhatsApp
│   ├── infra/                        # Adapters (I/O)
│   │   ├── db/                       # Repositorios Drizzle
│   │   ├── whatsapp/                 # 360dialog adapter
│   │   ├── printer/                  # Adaptador de impresión
│   │   └── auth/                     # Sesiones, hash
│   └── ui/                           # Componentes compartidos
├── drizzle/                          # Migraciones SQL
└── tests/
    ├── unit/                         # Tests del core puro
    └── integration/                  # Tests de endpoints
```

## Documentación: web vs. desktop

La versión web/cloud y la de escritorio **comparten un solo repo, una sola `main` y un solo código** ([ADR 0003](docs/decisions/0003-estrategia-repositorio-git.md)). Por eso la documentación **no se separa por variante** mientras el código no se separe:

- **Compartido en la raíz de `docs/`:** ADRs (`decisions/`), `hallazgos.md`, `deuda-tecnica.md`, master plan desktop y specs/planes cross-cutting.
- **Fases desktop:** prefijo `desktop-NN-*` en specs y planes (ej. `2026-10-07-desktop-02-print-escpos-design.md`). Las fases web conservan su nombre original.
- **Cuando el código se parta (Fase 4)** en `apps/web` + `apps/desktop`, espejar en `docs/apps/web/` y `docs/apps/desktop/`, dejando lo cross-cutting en la raíz de `docs/`. Hasta entonces, no adelantar la estructura (YAGNI).

> **Por qué no separar hoy:** separar la doc antes que el código crea divergencia y duplica lo compartido (un cambio de core toca web + desktop y su doc debería ir en un solo PR).

## Convenciones de código

- **Nombres en español para dominio, en inglés para tech.** El dominio es restaurante mexicano → `pedido`, `producto`, `cliente` en el código de negocio. La tecnología es en inglés: `OrderRepository`, `BotStateMachine`, etc., solo cuando el framework lo exige.
- **Errores explícitos con Result/Either en el core, excepciones en la shell.** El `core/` no lanza excepciones, devuelve `Result<T, DomainError>`. Los handlers de Next.js traducen a HTTP.
- **Tipos primero.** Definir las entidades y DTOs en archivos `types.ts` antes de implementar.
- **Migraciones con drizzle-kit.** Nunca editar la DB a mano, siempre via migración versionada.
- **Variables de entorno validadas con Zod al inicio.** Un solo `env.ts` parsea y exporta `env.DATABASE_URL`, etc., con tipos correctos. Si falta una, el server no arranca.

## Setup local

```bash
docker compose up -d              # arranca Postgres 16 en localhost:5432
pnpm install                      # dependencias
cp .env.example .env.local        # plantilla de variables de entorno
# editar .env.local con tus valores reales
pnpm drizzle:migrate              # aplica migraciones a la DB local
pnpm dev                          # arranca Next.js en :3000
```

> Requiere Docker Desktop corriendo. Sin Docker activo, `pnpm drizzle:migrate` y los tests de integración fallarán con error de conexión.

### Versión de escritorio (Fase 4)

```bash
pnpm build                       # standalone en .next/standalone
pnpm electron:start              # shell Electron apuntando al standalone
pnpm electron:dist               # instalador NSIS en dist/*.exe
```

El `.exe` no usa `.env.local`: al primer arranque muestra `/setup` para definir la contraseña (se guarda como hash en la tabla `settings`), levanta el server en `127.0.0.1:3210` (con fallback de puerto) y sirve la LAN en `0.0.0.0`. La config vive en `%APPDATA%/Sistema de Pedidos/config.json` (sessionSecret + último puerto) y la DB PGlite en `%APPDATA%/Sistema de Pedidos/pglite`. Los backups van a `Documentos/restaurante-backups`. La impresora se configura en `/admin/ajustes` (claves `printer_host`/`printer_port` en `settings`, la DB gana sobre `PRINTER_HOST`/`PRINTER_PORT`; solo con `DB_DRIVER=pglite`) y se lee por request, sin reiniciar.

### Mantenimiento: shadow files de macOS

> **Solo aplica si el repo vive en el volumen externo de macOS** (`/Volumes/M2 Mac/`). En Windows (`C:\Users\...\source\repos\restaurante-sistema`) no hay `._*`; saltar esta sección y la siguiente.

El proyecto vive en un volumen externo (`/Volumes/M2 Mac/`) que no soporta atributos extendidos de APFS de forma nativa. macOS compensa creando archivos `._*` (AppleDouble) junto a cada archivo real — ensucian el IDE y pueden romper herramientas que asumen UTF-8 limpio (vitest fallaba con `PARSE_ERROR` hasta que los excluimos del glob de tests).

**Dónde romper y por qué:**

- `node_modules/` — vitest los ve si el glob no los excluye. Cubierto por `**/._*` en `vitest.config.ts`.
- `.next/` — Turbopack persiste caché en `.next/cache/`. Si los `._*` se cuelan ahí, el binario de SWC falla con `Loading persistence directory failed: invalid digit found in string` y `pnpm build` aborta. **Después de cada build en este Mac, correr `find .next -name '._*' -delete` antes de rebuilder.**

Gítense a `._*` en `.gitignore` (ya está), pero conviene correr de vez en cuando:

```bash
dot_clean -m .                  # fusiona metadata al archivo padre y borra los ._*
find . -name '._*' -delete       # limpia remanentes en todo el repo
find .next -name '._*' -delete   # específicamente antes de pnpm build
```

Si los IDE siguen mostrando `._*` después de esto, reiniciarlo suele forzar el re-escaneo del filesystem.

### Mantenimiento: file mode 700 en volumen externo (rebase / merge)

> **Solo aplica en el volumen externo de macOS.** En Windows no hay mismatch de modos; rebase/merge/checkout funcionan normal.

El mismo volumen externo que rompe con `._*` también escribe **cada archivo con mode `700` (rwx------)**, mientras que git index tiene `644`. Resultado: `chmod 644` es no-op en este filesystem (APFS protection), `git status` mienta diciendo "clean" cuando hay mode mismatch, y `git rebase`/`merge`/`checkout` que toquen muchos archivos fallan con errores crípticos:

```
error: Your local changes to the following files would be overwritten by merge:
	package.json
	pnpm-lock.yaml
```

**Síntomas típicos:**
- `git diff --stat HEAD` muestra `127 files changed, 0 insertions(+), 0 deletions(-)` con solo `old mode 100644 / new mode 100755` por archivo.
- `git rebase origin/main` aborta con "unstaged changes" pero `git status` está clean.
- `git checkout <otra-branch>` se queja de "would be overwritten" para archivos que no tocaste.
- `core.fileMode = false` en `.git/config` silencia `git status` pero **no** soluciona rebase/merge (el sequencer usa `git checkout` que sí chequea el executable bit).

**Fix de raíz:** clonar el repo a filesystem local (`/tmp`) y trabajar ahí para operaciones de rebase/merge entre branches divergentes.

```bash
# Workaround cuando rebase/merge falla por file mode en /Volumes/M2 Mac/
mkdir -p /tmp/rest-repo && cd /tmp/rest-repo
git clone --no-local --no-hardlinks "/Volumes/M2 Mac/proyectos/Restaurante-sistema" repo
cd repo && git remote set-url origin https://github.com/JuanP-a/restaurante-sistema.git
git fetch origin '+refs/heads/*:refs/remotes/origin/*' '+refs/pull/*/head:refs/remotes/origin/pr/*'
# ahora rebase/merge/checkout funcionan normalmente (mode 644 se preserva)
```

**Fix local (silencia status, NO soluciona rebase):**

```bash
git config core.fileMode false   # ya aplicado en este repo, pero solo para status
```

**Diagnóstico rápido:**

```bash
ls -lOn package.json              # si muestra -rwx------ = bug presente
git ls-files --debug package.json | grep ctime   # comparar con filesystem
git diff --stat HEAD              # si hay cambios 0/0, son mode fantasma
```

Descubierto tras 5+ intentos fallidos de rebasear PRs Dependabot que habían quedado out-of-date. El workaround `/tmp` es feo pero efectivo y tarda 30 segundos. Si te toca, no insistas con chmod ni con `core.fileMode = false` para rebase — saltá directo al clone.

### Gotcha: variables en `.env*` con Next.js (dotenv-expand)

Next.js expande `$VAR` en valores de `.env*` vía dotenv-expand. Si un valor contiene `$`, Next.js lo trata como referencia a variable y trunca silenciosamente (las vars no definidas se reemplazan por string vacío). **Bug clásico con hashes bcrypt**: `$2b$10$...` se trunca a `b$...`.

**Fix**: escapar cada `$` como `\$` y envolver el valor en comillas dobles. Ejemplo en `.env.example`:

```bash
ADMIN_PASSWORD_HASH="\$2b\$10\$YoEEXhwQhn5gKntCyJDQZ.aNl60oRDzKiRtoLGM6JUkuPXKrUCSSG"
```

Si el dev login falla con "Contraseña incorrecta" pero tu password es la correcta, este es el primer lugar a revisar. Diagnóstico rápido: en `src/env.ts` agregar un `console.log` temporal de `source.ADMIN_PASSWORD_HASH` — si el largo no es 60 chars, dotenv-expand está mutilando el valor.

### Mantenimiento: Dependabot y el audit en CI

**Los 2 PRs de Dependabot NO son un bug.** `.github/dependabot.yml` define `groups: { production, development }` → Dependabot abre **un PR por grupo** por diseño. Si se quiere uno solo, unificar los grupos.

**CI corre `pnpm audit --audit-level=high` como parte de `verify`.** Un advisory nuevo sobre una **dep transitiva** (no directa) rompe el audit **en `main`** y bloquea *todo* PR, no solo los de Dependabot. Fix: `pnpm.overrides` pinneando la versión parcheada (ver [ADR 0004](docs/decisions/0004-pnpm-overrides-advisories.md)). Dependabot no cubre transitivas ni overrides — se ataca a mano.

**No usar `gh pr update-branch` sobre una branch de Dependabot.** El merge server-side del `pnpm-lock.yaml` produce `ERR_PNPM_BROKEN_LOCKFILE` (duplicated mapping key) porque Dependabot y `main` ya tienen entradas para el mismo paquete. Pasó el 2026-10-07 con #23/#24.

Orden de reparación:

1. `@dependabot rebase` en el PR (regenera el lock proper). Si no dispara, `@dependabot recreate`.
2. Si Dependabot cierra el PR ("dependencies are no longer updatable") o no responde, **reemplazar a mano**: aplicar los bumps del PR sobre `main` actual con `pnpm update <pkg>...`, commit, PR propio, y cerrar el de Dependabot referenciando el reemplazo.

**Diagnóstico del audit local:**

```bash
pnpm audit --audit-level=high        # lo mismo que corre CI
pnpm why <paquete>                   # de quién cuelga la dep vulnerable
```

## Comandos esperados

- `pnpm dev` — dev server
- `pnpm build` — build de producción
- `pnpm test` — correr tests
- `pnpm test:watch` — tests en watch mode
- `pnpm typecheck` — tsc --noEmit
- `pnpm lint` — ESLint
- `pnpm drizzle:generate` — generar migración desde schema
- `pnpm drizzle:migrate` — aplicar migraciones
- `pnpm db:seed` — sembrar datos de ejemplo
- `pnpm test:e2e` — Playwright (wizard de setup + superficie pública + admin a 375px). Requiere `pnpm exec playwright install chromium` la primera vez
- `pnpm electron:compile` — compila `electron/` a `dist-electron/`
- `pnpm electron:start` — shell Electron en dev (requiere `pnpm build` previo)
- `pnpm electron:dist` — build + `pack-standalone` + instalador NSIS en `dist/`

> Usar **pnpm**, no npm. (Configurado en AGENTS.md global del usuario.)

## Variables de entorno requeridas (referencia)

```
DATABASE_URL=                      # Postgres connection string. Dev: postgresql://postgres:postgres@localhost:5432/restaurante
ADMIN_PASSWORD_HASH=               # bcrypt hash de la contraseña del local
SESSION_SECRET=                    # random 32+ bytes
WHATSAPP_BSP_API_KEY=              # 360dialog API key
WHATSAPP_BSP_URL=                  # https://waba.360dialog.io/v1
WHATSAPP_VERIFY_TOKEN=             # token de verificación del webhook
BUSINESS_NAME=                     # para encabezados de tickets
BUSINESS_ADDRESS=                  # idem
BUSINESS_PHONE=                    # idem
DEFAULT_PREP_TIME_MINUTES=25       # tiempo estimado que se muestra al cliente
PRINTER_HOST=                      # IP de la térmica de red (vacío = imprime el navegador)
PRINTER_PORT=9100                  # puerto raw ESC/POS
```

## Cómo se trabaja en este proyecto

1. **Antes de tocar código de un cambio grande**: leer el spec completo.
2. **Si un cambio contradice el spec**: actualizar el spec primero.
3. **Si un cambio es trivial** (bugfix, refactor sin cambio de comportamiento): proceder, pero explicar el "por qué" en el commit.
4. **Después de cambios significativos**: actualizar este AGENTS.md o el spec si la estructura o convenciones cambiaron.
5. **Toda decisión con trade-offs** → escribir un ADR en `docs/decisions/NNNN-titulo.md`.
6. **Todo hallazgo o atajo consciente** → registrar en [`docs/hallazgos.md`](docs/hallazgos.md) (descubrimientos) y/o [`docs/deuda-tecnica.md`](docs/deuda-tecnica.md) (trabajo pendiente). Son registros vivos: no borrar filas resueltas, marcarlas.

## Estado actual

- ✅ Spec aprobado y versionado en [`docs/superpowers/specs/`](docs/superpowers/specs/).
- ✅ Plan de implementación en [`docs/superpowers/plans/`](docs/superpowers/plans/) — 9 fases, 43 tasks.
- ✅ **Phase 0** (Foundation): Next.js 16 + TS strict + Vitest + Zod env.
- ✅ **Phase 1** (DB schema + Task 1.3): Drizzle ORM, schema completo, `docker-compose.yml` para Postgres local, migración inicial aplicada.
- ✅ **Phase 2** (core puro con TDD): 41 tests verde, sin I/O. Cubre cálculo de precios, state machine de pedido (received/delivered/cancelled), validación de pedido nuevo, validación de rango de costo de envío (10–30 MXN), y state machine del bot de WhatsApp (9 estados).
- ✅ **Phase 3** (Auth): bcrypt verifyPassword, HMAC session tokens, login API, middleware protegiendo `/admin` y rutas API, página `/login` funcional. 14 tests verde (3 password + 9 session + 2 env nuevos).
- ✅ **Phase 4** (Menu CRUD): repo Drizzle para categorías/productos + `/api/menu/{categories,products}` CRUD + páginas admin (`/admin/menu`, `/admin/menu/categories`, `/admin/menu/products/[id]`) protegidas por middleware. 27 tests nuevos (11 DB + 16 API). PR #2 squash-merged.
- ✅ **Phase 5** (Order capture): `orders_sequential_number_seq` (Postgres sequence) + `order-repository` (createOrder, listOrders, getOrder, updateOrderStatus) + in-process `EventEmitter` + SSE `/api/events` + `/api/orders` (GET list, POST create con cálculo de totales + costo envío desde colonia/override, GET detail, PATCH status con state machine guard) + páginas admin (`/admin/orders` dashboard con flash SSE, `/admin/orders/new` captura de pedido en 2 paneles, `/admin/orders/[id]` detalle con reprint + transición delivered). Nav admin actualizada (Pedidos/Nuevo/Menú/Categorías/Zonas). 15 tests nuevos (8 order-repository, 4 event-bus, 3 SSE, 8 orders API). **Total: 108 tests verde**. PR #5 squash-merged.
- ✅ **Phase 6** (Printing): `POST /api/orders/[id]/print-kitchen` y `/print-bill` registran eventos `printed_kitchen` / `printed_bill` en `order_events` (audit trail). Templates `/print/[id]/kitchen` (comanda sin precios) y `/print/[id]/bill` (cuenta con precios + header de negocio desde `NEXT_PUBLIC_BUSINESS_*`) — ambos monospace 80mm, auto-imprimen 500ms después de cargar. `.env.example` documenta las nuevas vars `NEXT_PUBLIC_BUSINESS_*`. 3 tests nuevos (kitchen, bill, independientes). **Total: 111 tests verde**.
- ✅ **Phase 7** (Delivery zones): `delivery-repository.ts` (zones + colonias CRUD + `getColoniaDeliveryCost` movido aquí desde `order-repository.ts`) + 4 API routes (`GET/POST /api/delivery-zones`, `PATCH/DELETE /api/delivery-zones/[id]`, `GET/POST /api/delivery-zones/colonias`, `DELETE /api/delivery-zones/colonias/[id]`) con validación `validateDeliveryCost` (10–30 MXN) + `/admin/delivery-zones` UI con inline CRUD + cleanup del `.catch(() => ({ data: [] }))` en new-order page. **18 tests nuevos** (7 repo + 11 API). **Total: 129 tests verde**.
- ✅ **Phase 8** (WhatsApp bot): `infra/whatsapp/client.ts` (360dialog text/list/buttons con mock fallback) + `webhook-verify.ts` (HMAC SHA-256 timing-safe) + `core/bot/build-reply.ts` (builder puro por estado) + `infra/whatsapp/session-store.ts` (Map por phone) + `/api/webhooks/whatsapp` (GET hub challenge, POST messages, SIG verify solo en prod). Flujo cubre idle→browse→cart→service→address→confirm, crea order real via `createOrder` + emite `order_created`. **16 tests nuevos** (4 verify + 8 build-reply + 4 webhook). **Total: 145 tests verde**.
- ✅ **Phase 9** (Polish + deploy): landing `/` con link a `/login` + `/api/health` (GET `{ok, ts}`) + Playwright E2E config + spec (5 tests: health/landing/middleware/admin-redirect/api-redirect, excluyen login por bcrypt unidireccional) + README completo (setup, comandos, rutas, deploy, vars) + `render.yaml` para deploy one-click vía Blueprint (web service + Postgres, health check `/api/health`). **6 commits, +0 unit/integration tests (5 E2E nuevos en `tests/e2e/`)**, total sigue en **145 tests verde** + 5 E2E.
- ✅ **Backend review fixes** (post-MVP hardening): aplicadas las 9 correcciones del backend review en una sola branch (C1-C4 críticas + H1/H2/H6/M2/M4). **9 commits, +20 tests** (145 → **165 verde**). Detalle en PR description.
- ✅ **Frontend review fixes** (post-MVP hardening): aplicadas las prioridades (server components + src/ui primitives + form a11y) + 4 quick wins del frontend review. **10 commits, 0 tests nuevos** (refactor sin cambio funcional). Detalle en PR description.
- ✅ **Hardening de deps + import de menú** (2026-10-07): import de menú merged (#22) + `pnpm.overrides` para parchear advisories high de transitivas `source-map-js`/`sharp` que rompían el audit en `main` (PR #25, [ADR 0004](docs/decisions/0004-pnpm-overrides-advisories.md)) + bumps de Dependabot (`next` #26, `pg` #27, dev group #28) aplicados a mano porque `gh pr update-branch` rompía el lock de las branches Dependabot. **0 PRs abiertas, audit verde**.

### Migración a versión de escritorio (en curso)

Producto con **dos formas de distribuir, un solo código**: versión web/cloud (SaaS futuro) y versión de escritorio para pequeños restaurantes (LAN, Electron, PGlite, pago único + soporte). Estrategia de repo: **monorepo, una sola `main`, GitHub Flow, variantes por carpeta** — ver ADR [`0003`](docs/decisions/0003-estrategia-repositorio-git.md). Diseño y decisiones completas en el [plan maestro](docs/superpowers/plans/2026-10-03-migracion-desktop.md).

- ✅ **Desktop Fase 1** (puerto DB + PGlite embebido): puerto `Db` con adapters `postgres`/`pglite` (`DB_DRIVER`), `initDb`/`getDb` + boot en `src/instrumentation.ts`, migración en boot, suite de integración sobre **PGlite in-memory sin Docker**, secuencia desacoplada del driver, y build que empaqueta `drizzle/` + `@electric-sql/pglite` (`output: "standalone"`). **PR [#19](https://github.com/JuanP-a/restaurante-sistema/pull/19) squash-merged.** Ver ADR [`0002`](docs/decisions/0002-puerto-db-pglite.md). **169 tests verde + 1 skipped** (contrato Postgres opt-in). Retro-compatible: default `DB_DRIVER=postgres`, `render.yaml` intacto.
- ✅ **Desktop Fase 2** (impresión ESC/POS server-side): renderer puro en `src/core/printing/` (CP850 + comandos ESC/POS + tickets 48 cols) + puerto `PrintTransport` con adapters `tcp`/`fake` + `print-service` (reintentos 3× con backoff + eventos `printed_kitchen`/`printed_bill`/`print_failed`) + endpoints `print-kitchen`/`print-bill` con auto-detect por `PRINTER_HOST` (server-side vs fallback al navegador) + anti-doble-impresión en `/print/...`. Migración `event_kind += print_failed`. **210 tests verde + 1 skipped**. Spec [`2026-10-07-desktop-02-print-escpos-design.md`](docs/superpowers/specs/2026-10-07-desktop-02-print-escpos-design.md), plan [`2026-10-03-desktop-02-print-escpos.md`](docs/superpowers/plans/2026-10-03-desktop-02-print-escpos.md).
- ✅ **Desktop Fase 3** (backups, manual): core puro (`backupFileName`, `selectForDeletion`) + puerto `BackupSource`/`BackupDestination` con adapters PGlite (`pgDump`), carpeta fs (valida nombre → sin path traversal) y USB vía PowerShell/CIM (`windows-drives.ts`; degrada a `[]`; antes `drivelist`, DT-018) + `runBackup` (escritura multi-destino con éxito parcial + rotación) + `verifyBackup` (restaura el dump en PGlite temporal y cuenta filas) + `getBackupSource` en el puerto DB (null en cloud → 409) + endpoints `GET/POST /api/backup` y `POST /api/backup/restore` (protegidos) + página `/admin/backup` (listar/crear/validar). Cloud intacto. **244 tests verde + 1 skipped**. Spec [`2026-10-08-desktop-03-backup-design.md`](docs/superpowers/specs/2026-10-08-desktop-03-backup-design.md), plan [`2026-10-08-desktop-03-backup.md`](docs/superpowers/plans/2026-10-08-desktop-03-backup.md). Deuda: [DT-019/020/021](docs/deuda-tecnica.md) y hallazgos [H-012/013/014](docs/hallazgos.md).
- ✅ **Portabilidad en Windows** (PR [#43](https://github.com/JuanP-a/restaurante-sistema/pull/43)): dir de datos de PGlite, `cross-env` en scripts y timeouts. El desarrollo del proyecto pasó a Windows; las notas de macOS de arriba son históricas.
- ✅ **Fixes del runbook de Fase 4** (PR [#47](https://github.com/JuanP-a/restaurante-sistema/pull/47)): el `.exe` no hidrataba (`.next/static` y `public` no iban en el standalone) y `pg_dump` dejaba la transacción read-only en la DB tras un backup. Runbook en `docs/runbooks/2026-10-28-desktop-04-verificacion-windows.md`; hallazgos H-024/H-025 y DT-047.
- ✅ **UI móvil del admin** (PR [#50](https://github.com/JuanP-a/restaurante-sistema/pull/50)): nuevo pedido a una columna bajo `lg` con barra fija de carrito, nav de una fila con scroll horizontal, 44px de área táctil con `pointer:coarse` en `Button`/`Input`, `text-base` en inputs. Spec e2e `tests/e2e/ui-movil.spec.ts`. Pendiente de la auditoría de UI: steppers de cantidad, teléfono opcional en local, contraste del verde, tema oscuro (DT-023), fuente Arial (`globals.css` pisa a Geist).
- ✅ **Bumps de Dependabot** (#48, #49): aplicados por `@dependabot recreate`/`rebase`, no con `gh pr update-branch`. Etiqueta `dependencies` creada en el repo (Dependabot no procesaba comandos sin ella).
- ⬜ **Desktop Fase 5** (túnel WhatsApp): Cloudflare Tunnel → webhook a la app local. Sin plan escrito aún.
- ✅ **Desktop Fase 4** (shell Electron, `.exe` Windows): `electron/` con `main` (arranque del server standalone vía `ELECTRON_RUN_AS_NODE`, ventana, tray, autostart, single-instance) + módulos puros testeados (`port`, `config`, `lan`, `server-process`) + wizard de contraseña (`settings` en DB, `POST /api/setup` one-shot que deja sesión abierta, gate de setup en `/` y `/admin/layout`) + `/admin/conectar` con QR de la URL LAN + `electron-builder` NSIS (`pnpm electron:dist` → `dist/Sistema de Pedidos Setup 0.1.0.exe`). Prerequisitos cerrados: DT-011 (cookie `secure` desde env), DT-022 (`force-dynamic` en `/admin/backup`), DT-008/DT-035 (tracing de `pglite-tools` + `vendor/` hoisted). Spec [`2026-10-11-desktop-04-electron-shell-design.md`](docs/superpowers/specs/2026-10-11-desktop-04-electron-shell-design.md), plan [`2026-10-11-desktop-04-electron-shell.md`](docs/superpowers/plans/2026-10-11-desktop-04-electron-shell.md). Sin USB en esta fase por `drivelist` (resuelto después con PowerShell, DT-018).
- ✅ **Import de menú** (spec §6.4): core puro `parseMenuImport` (valida el JSON y reporta el `path` del error) + `importMenu` transaccional en `menu-repository` (modos `replace` y `append`, este último idempotente por slug) + `POST /api/admin/import` + página `/admin/import`. Menú real del primer cliente en [`docs/import/lilians-menu.json`](docs/import/lilians-menu.json) (8 categorías, 75 productos). `includes`/`extras`/`optionGroups` se **parsean pero no persisten** (dependen de los modificadores). Plan en [`docs/superpowers/plans/2026-10-04-import-menu.md`](docs/superpowers/plans/2026-10-04-import-menu.md). **183 tests verde + 1 skipped**.
- ⬜ **Modificadores de menú** (rama `feature/modifiers-completion` pausada): core + repo + API de ingredientes hechos; UI y resto pendientes.
- ✅ **Impresora configurable en el `.exe`** (DT-047, porción impresora; [spec](docs/superpowers/specs/2026-11-03-desktop-v1-01-config-impresora-design.md), [plan](docs/superpowers/plans/2026-11-03-desktop-v1-01-config-impresora.md), [runbook](docs/runbooks/2026-11-03-desktop-v1-impresora.md)): `parsePrinterSettings` (core puro) + `get/setPrinterSettings` en `settings` + `loadPrinterConfig` en las rutas de impresión + `GET/PUT /api/settings/printer` y `POST …/test` + página `/admin/ajustes` (Guardar e Imprimir prueba). Añadió `/api/settings` al middleware, que lo dejaba abierto ([H-026](docs/hallazgos.md), [DT-049](docs/deuda-tecnica.md)). Verificado 21/21 en el `.exe` contra un listener TCP; **sin probar en térmica física** ([DT-048](docs/deuda-tecnica.md)). Con Windows en modo oscuro la página sale casi ilegible ([DT-023](docs/deuda-tecnica.md); se mantiene por decisión del usuario).
- ✅ **USB sin `drivelist`** (DT-018, código; [spec](docs/superpowers/specs/2026-11-03-desktop-v1-02-usb-sin-drivelist-design.md), [plan](docs/superpowers/plans/2026-11-03-desktop-v1-02-usb-sin-drivelist.md), [runbook](docs/runbooks/2026-11-03-desktop-v1-usb.md)): `drivelist` 12.x no publica binarios ([H-029](docs/hallazgos.md)), así que se quitó y las unidades se listan con PowerShell/CIM (`parseWindowsDrives` puro + `createDriveLister` con puerto `run`; ≈1 s por listado). Sin addons nativos también se quitó `npmRebuild: false`. Capa de servidor verificada 9/9; **pendiente la verificación con una memoria USB real (usuario)**. El `.exe` sin firmar lo bloquea Smart App Control en esta PC ([DT-050](docs/deuda-tecnica.md), [H-030](docs/hallazgos.md)).
- 🎯 **Alcance de la v1 de escritorio** ([ADR 0005](docs/decisions/0005-alcance-v1-desktop.md), 2026-11-03): solo bloquean la entrega **DT-047** (porción impresora: ✅ hecha; falta probarla en térmica física, DT-048) y **DT-018** (detección de USB: ✅ en código; falta probarla con una memoria real). Fase 5, modificadores, DT-023, auditoría de UI, resto de DT-047 y la verificación manual del tray/autostart son **v2**. No implementar nada de v2 sin cambiar el ADR primero.

> Las fases desktop siguen el flujo: **spec/plan escrito antes de implementar** (regla del proyecto). Cada una entra por su rama corta `feat/*` off `main`.

### Convenciones de testing (post-Phase 4)

- **`pnpm test`** corre todo (unit + integration) contra **PGlite in-memory por default** (sin Docker, desde Fase 1 desktop).
- **`pnpm test:unit`** corre solo unit (lo que usa CI). Excluye `tests/integration/**`; no inicializa DB.
- **`pnpm test:integration`** corre solo integration; por default contra PGlite in-memory. Para parity con Postgres real: `DB_DRIVER=postgres DATABASE_URL=... pnpm test:integration` (requiere `docker compose up -d`).
- `vitest.setup.ts` inicializa la DB solo cuando el script setea `VITEST_INIT_DB=1` (lo hacen `test` y `test:integration`, no `test:unit`).
- Integration tests comparten DB; vitest corre con `--no-file-parallelism` para evitar carreras en unique-constraint columns.
- **E2E** (`playwright.config.ts`): `workers: 1`. Los specs comparten un server con PGlite en memoria y el wizard (`setup-wizard.spec.ts`) asume la DB virgen; `fullyParallel: false` solo serializa dentro de un archivo, así que sin `workers: 1` los archivos corrían en paralelo y se pisaban (un spec que hace `/api/setup` antes que el wizard le deja la DB configurada). Los specs que necesitan sesión entran por API (`/api/setup` o `/api/admin/login`), no por el formulario: el login por UI se quedaba en `/login` en la primera carga en frío del dev server.
- Cifras actuales (2026-11-03): unit + integration 355 verdes + 1 skipped (`pnpm test`); e2e 10 verdes (sin re-ejecutar). Un test de integración suelto necesita `VITEST_INIT_DB=1` (`VITEST_INIT_DB=1 pnpm exec vitest run --no-file-parallelism <archivo>`); `pnpm test:unit -- <filtro>` ignora el filtro.
- CI (`verify`) corre `pnpm build` + unit + `pnpm audit --audit-level=high`. **Integration y e2e no corren en CI** (pendiente: service container/provisioning de env vars para integration; navegador de Playwright para e2e). Correrlos en local antes de abrir PR.

### Infraestructura (fuera del spec, parte del repo)

- ✅ CI en GitHub Actions: `pnpm build` (genera tipos de Next) + `pnpm test` + `pnpm audit --audit-level=high`.
- ✅ Branch protection en `main`: requiere check `verify`, linear history, no force-push.
- ✅ Dependabot security updates habilitado (PRs automáticos para CVEs).
- ✅ LICENSE (All rights reserved) y SECURITY.md (disclosure a `juan12fc@gmail.com`).
- ✅ Secret scanning + push protection activos en GitHub.

Branch de trabajo: `feature/phase-N-{name}`. Repo: https://github.com/JuanP-a/restaurante-sistema. PRs contra `main` deben pasar el check `verify` antes de mergear. Squash por fase.

Cuando se avance, mantener este archivo sincronizado con la realidad.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
