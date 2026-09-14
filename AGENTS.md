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

- ✅ Spec aprobado y versionado en `docs/superpowers/specs/`.
- ✅ Plan de implementación en `docs/superpowers/plans/` (9 fases).
- ✅ Phase 0 (Foundation): Next.js 16 + TS strict + Vitest + Zod env.
- ✅ Phase 1 (DB schema): Drizzle ORM + schema completo (categorías, productos, pedidos, items, zonas, sesiones) + migración inicial generada.
- ⏳ Pendiente: `docker-compose.yml` + aplicar migración contra Postgres local (Task 1.3).
- ⏳ Pendiente: Phase 2 (core puro con TDD): pricing, state machine de pedido, validaciones, state machine del bot.
- ⏳ Pendiente: Phases 3–9 (auth, menu CRUD, captura de pedido, impresión, zonas, bot WhatsApp, polish, deploy).

Branch de trabajo: `feature/implementacion-mvp`. Repo público: https://github.com/JuanP-a/restaurante-sistema

Cuando se avance, mantener este archivo sincronizado con la realidad.
