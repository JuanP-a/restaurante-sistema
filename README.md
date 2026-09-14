# Sistema de pedidos del restaurante

App web (PWA) para gestionar pedidos de un restaurante de comida rápida. Los clientes piden por WhatsApp; el operador toma pedidos y cocina imprime comandas en térmica 80 mm.

Para el diseño completo, ver [`docs/superpowers/specs/`](docs/superpowers/specs/). Las convenciones de trabajo viven en [`AGENTS.md`](AGENTS.md).

## Requisitos

- Node.js 20+
- [pnpm](https://pnpm.io) 10+
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) corriendo

## Setup local

```bash
docker compose up -d              # Postgres 16 en localhost:5432
pnpm install                      # dependencias
cp .env.example .env.local        # plantilla lista para dev
# editar .env.local: ADMIN_PASSWORD_HASH, SESSION_SECRET, etc.
pnpm drizzle:migrate              # aplica migraciones a la DB local
pnpm dev                          # Next.js en http://localhost:3000
```

Para generar los valores de `ADMIN_PASSWORD_HASH` y `SESSION_SECRET` revisa `src/infra/auth/` (Phase 3 del plan).

## Comandos

| Comando | Para qué |
|---------|----------|
| `pnpm dev` | Servidor de desarrollo con HMR |
| `pnpm build` | Build de producción |
| `pnpm test` | Corre todos los tests (unit + integration; requiere Docker con Postgres) |
| `pnpm test:unit` | Solo unit tests (lo que corre CI) |
| `pnpm test:integration` | Solo integration tests contra Postgres local |
| `pnpm test:watch` | Tests en watch mode |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm drizzle:generate` | Genera migración SQL desde `src/infra/db/schema.ts` |
| `pnpm drizzle:migrate` | Aplica migraciones pendientes a la DB |

## Rutas actuales

- `/login` — acceso admin (sesión por cookie HMAC)
- `/admin/menu` — productos agrupados por categoría con toggle DISPONIBLE/AGOTADO
- `/admin/menu/categories` — CRUD de categorías
- `/admin/menu/products/[id]` — editor de producto

API (protegidas por middleware excepto login y webhook de WhatsApp):

- `POST /api/admin/login` — login con contraseña
- `GET/POST /api/menu/categories`, `PATCH/DELETE /api/menu/categories/[id]`
- `GET /api/menu/products[?active=true]`, `POST`, `GET/PATCH/DELETE /api/menu/products/[id]`

## Estructura

- `docs/superpowers/specs/` — diseño y alcance aprobado
- `docs/superpowers/plans/` — plan de implementación por fases
- `docs/decisions/` — ADRs (decisiones con trade-offs)
- `src/app/` — Next.js App Router (rutas, API, impresión)
- `src/core/` — lógica de negocio pura (pricing, state machines, validaciones)
- `src/infra/` — adaptadores de I/O (DB, WhatsApp, printer, auth)
- `drizzle/` — migraciones SQL generadas