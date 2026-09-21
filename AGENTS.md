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
│   └── superpowers/
│       └── specs/
│           └── 2026-09-13-sistema-pedidos-restaurante-design.md
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

### Mantenimiento: shadow files de macOS

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

### Gotcha: variables en `.env*` con Next.js (dotenv-expand)

Next.js expande `$VAR` en valores de `.env*` vía dotenv-expand. Si un valor contiene `$`, Next.js lo trata como referencia a variable y trunca silenciosamente (las vars no definidas se reemplazan por string vacío). **Bug clásico con hashes bcrypt**: `$2b$10$...` se trunca a `b$...`.

**Fix**: escapar cada `$` como `\$` y envolver el valor en comillas dobles. Ejemplo en `.env.example`:

```bash
ADMIN_PASSWORD_HASH="\$2b\$10\$YoEEXhwQhn5gKntCyJDQZ.aNl60oRDzKiRtoLGM6JUkuPXKrUCSSG"
```

Si el dev login falla con "Contraseña incorrecta" pero tu password es la correcta, este es el primer lugar a revisar. Diagnóstico rápido: en `src/env.ts` agregar un `console.log` temporal de `source.ADMIN_PASSWORD_HASH` — si el largo no es 60 chars, dotenv-expand está mutilando el valor.

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
```

## Cómo se trabaja en este proyecto

1. **Antes de tocar código de un cambio grande**: leer el spec completo.
2. **Si un cambio contradice el spec**: actualizar el spec primero.
3. **Si un cambio es trivial** (bugfix, refactor sin cambio de comportamiento): proceder, pero explicar el "por qué" en el commit.
4. **Después de cambios significativos**: actualizar este AGENTS.md o el spec si la estructura o convenciones cambiaron.
5. **Toda decisión con trade-offs** → escribir un ADR en `docs/decisions/NNNN-titulo.md`.

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

### Convenciones de testing (post-Phase 4)

- **`pnpm test`** corre todo (local dev con Docker): unit + integration.
- **`pnpm test:unit`** corre solo unit (lo que usa CI). Excluye `tests/integration/**`.
- **`pnpm test:integration`** corre solo integration; requiere Postgres vía `docker compose up -d` y `.env.local` con `DATABASE_URL`/`ADMIN_PASSWORD_HASH`/`SESSION_SECRET`.
- Integration tests comparten DB; vitest corre con `--no-file-parallelism` para evitar carreras en unique-constraint columns.
- CI (`verify`) solo corre unit por ahora; integration en CI queda pendiente (service container + provisioning de env vars).

### Infraestructura (fuera del spec, parte del repo)

- ✅ CI en GitHub Actions: `pnpm build` (genera tipos de Next) + `pnpm test` + `pnpm audit --audit-level=high`.
- ✅ Branch protection en `main`: requiere check `verify`, linear history, no force-push.
- ✅ Dependabot security updates habilitado (PRs automáticos para CVEs).
- ✅ LICENSE (All rights reserved) y SECURITY.md (disclosure a `juan12fc@gmail.com`).
- ✅ Secret scanning + push protection activos en GitHub.

Branch de trabajo: `feature/phase-N-{name}`. Repo: https://github.com/JuanP-a/restaurante-sistema. PRs contra `main` deben pasar el check `verify` antes de mergear. Squash por fase.

Cuando se avance, mantener este archivo sincronizado con la realidad.
