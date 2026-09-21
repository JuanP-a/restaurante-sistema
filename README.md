# Sistema de pedidos del restaurante

App web (PWA) para gestionar pedidos de un restaurante de comida rápida. El operador toma pedidos desde laptop o celular; los clientes pueden pedirse solos por WhatsApp. Imprime comandas de cocina y cuentas con precios en una sola impresora térmica 80 mm.

Para el diseño completo, ver [`docs/superpowers/specs/`](docs/superpowers/specs/). Convenciones y arquitectura en [`AGENTS.md`](AGENTS.md).

## Requisitos

- Node.js 20+
- [pnpm](https://pnpm.io) 10+
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) corriendo
- (opcional) cuenta [360dialog](https://www.360dialog.com) para el bot de WhatsApp en producción

## Setup local

```bash
docker compose up -d              # Postgres 16 en localhost:5432
pnpm install                      # dependencias
cp .env.example .env.local        # plantilla lista para dev
# editar .env.local:
#   ADMIN_PASSWORD_HASH, SESSION_SECRET (ambos requeridos)
pnpm drizzle:migrate              # aplica migraciones a la DB local
pnpm dev                          # Next.js en http://localhost:3000
```

Generar `ADMIN_PASSWORD_HASH` (bcrypt):

```bash
node -e 'console.log(require("bcryptjs").hashSync("TU-PASSWORD", 10))'
```

> **Gotcha bcrypt:** `dotenv-expand` de Next trunca `$` en `.env*`. Escapar cada `$` como `\$` y envolver en comillas dobles:
> ```bash
> ADMIN_PASSWORD_HASH="\$2b\$10\$TuHash..."
> ```

`SESSION_SECRET` debe ser ≥32 chars random: `openssl rand -hex 32`.

## Comandos

| Comando | Para qué |
|---------|----------|
| `pnpm dev` | Servidor de desarrollo con HMR |
| `pnpm build` | Build de producción |
| `pnpm start` | Servidor de producción (después de build) |
| `pnpm test` | Unit + integration (requiere Docker con Postgres) |
| `pnpm test:unit` | Solo unit (lo que corre CI) |
| `pnpm test:integration` | Solo integration contra Postgres local |
| `pnpm test:e2e` | E2E con Playwright (requiere dev server + DB) |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | ESLint |
| `pnpm drizzle:generate` | Genera migración SQL desde `schema.ts` |
| `pnpm drizzle:migrate` | Aplica migraciones pendientes |

## Rutas

**Públicas:**
- `/` — landing con link a `/login`
- `/login` — acceso admin (sesión por cookie HMAC)
- `/api/admin/login` — POST con password
- `/api/health` — GET, probe para Render/monitoring
- `/api/webhooks/whatsapp` — GET hub challenge, POST mensajes
- `/print/[id]/kitchen` y `/print/[id]/bill` — templates de impresión

**Admin (requieren sesión):**
- `/admin/orders` — dashboard con SSE live updates
- `/admin/orders/new` — captura de pedido en 2 paneles
- `/admin/orders/[id]` — detalle con reprint y transición a delivered
- `/admin/menu` — productos con toggle DISPONIBLE/AGOTADO
- `/admin/menu/categories` — CRUD de categorías
- `/admin/menu/products/[id]` — editor de producto
- `/admin/delivery-zones` — CRUD de zonas (10-30 MXN) y colonias

**API protegidas:**
- `/api/orders` (GET, POST)
- `/api/orders/[id]` (GET)
- `/api/orders/[id]/status` (PATCH)
- `/api/orders/[id]/print-kitchen`, `/print-bill` (POST)
- `/api/menu/{categories,products}` CRUD
- `/api/delivery-zones/{zones,colonias}` CRUD
- `/api/events` (GET, SSE)

## Estructura del proyecto

```
src/
├── app/                          # Next.js App Router
│   ├── (public)/                 # /login
│   ├── admin/                    # rutas admin (requieren sesión)
│   ├── api/                      # route handlers
│   └── print/[id]/{kitchen,bill} # templates 80mm
├── core/                         # Pure business logic (sin I/O)
│   ├── pricing/                  # cálculo de totales
│   ├── order/                    # state machine + validaciones
│   └── bot/                      # state machine WhatsApp
├── infra/                        # Adapters (I/O)
│   ├── db/                       # repos Drizzle
│   ├── auth/                     # bcrypt + HMAC sessions
│   ├── events/                   # EventEmitter in-process + SSE
│   └── whatsapp/                 # 360dialog client + webhook
└── ui/                           # componentes compartidos

tests/
├── unit/                         # vitest, sin infra
├── integration/                  # vitest + Postgres real
└── e2e/                          # Playwright contra dev server

drizzle/                          # migraciones SQL generadas
docs/
├── superpowers/specs/            # diseño aprobado
├── superpowers/plans/            # plan de implementación
└── decisions/                    # ADRs
```

## Deploy

1. Crear Web Service en [Render](https://render.com) conectando este repo
2. **Build command:** `pnpm install && pnpm build`
3. **Start command:** `pnpm start`
4. **Health check path:** `/api/health`
5. Crear Postgres (Render managed o Neon) y setear `DATABASE_URL`
6. Setear las env vars de `.env.example` (especialmente `ADMIN_PASSWORD_HASH` y `SESSION_SECRET`)
7. Aplicar migraciones desde local: `DATABASE_URL=<prod> pnpm drizzle:migrate`
8. Configurar webhook en [360dialog](https://www.360dialog.com) apuntando a `https://<tu-app>.onrender.com/api/webhooks/whatsapp` con el `WHATSAPP_VERIFY_TOKEN`

## Variables de entorno

| Var | Requerida | Default | Para qué |
|-----|-----------|---------|----------|
| `DATABASE_URL` | sí | — | Postgres connection string |
| `ADMIN_PASSWORD_HASH` | sí | — | bcrypt hash de la contraseña del local |
| `SESSION_SECRET` | sí | — | random ≥32 bytes para firmar cookies |
| `WHATSAPP_BSP_API_KEY` | prod | — | API key de 360dialog (sin esto, mock) |
| `WHATSAPP_BSP_URL` | no | `https://waba-v2.360dialog.io` | BSP endpoint |
| `WHATSAPP_VERIFY_TOKEN` | prod | — | token de verificación del webhook |
| `BUSINESS_NAME` | no | `Mi Restaurante` | header de tickets |
| `BUSINESS_ADDRESS` | no | `""` | header de tickets |
| `BUSINESS_PHONE` | no | `""` | header de tickets |
| `DEFAULT_PREP_TIME_MINUTES` | no | `25` | ETA al cliente |
| `NEXT_PUBLIC_BUSINESS_*` | no | `""` | header cuenta (cliente-side) |

## Seguridad

- Reportar vulnerabilidades a `juan12fc@gmail.com` (ver `SECURITY.md`)
- Sesiones son cookies HMAC firmadas, no JWT
- Webhook WhatsApp verifica HMAC SHA-256 timing-safe (solo en `NODE_ENV=production`)
- `ADMIN_PASSWORD_HASH` es bcrypt con cost 10

## Convenciones

- **Nombres en español para dominio** (`pedido`, `producto`), en inglés para tech (`OrderRepository`)
- **Functional core, imperative shell**: lógica pura en `src/core/`, I/O solo en bordes
- **TDD con 80% coverage mínimo**: tests antes que impl, ver fallar, hacer pasar, refactorizar
- **No mocks**: core con valores reales; adapters con fakes in-memory o infra real
- **Conventional commits**: `feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`
