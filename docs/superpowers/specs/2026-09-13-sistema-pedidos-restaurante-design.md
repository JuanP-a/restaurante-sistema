# SPEC: Sistema de pedidos para restaurante

**Fecha**: 2026-09-13
**Estado**: Aprobado, pendiente de revisión final del usuario
**Stack**: Next.js 15 + Drizzle + Postgres (Neon) + 360dialog + shadcn/ui

## 1. Resumen ejecutivo

Sistema web (PWA) en la nube para gestionar pedidos de un restaurante de comida rápida (hamburguesas, hot dogs, papas, alitas, etc.). El staff del local toma pedidos desde una laptop o celular con un flujo optimizado para velocidad. Los clientes pueden hacer pedidos por sí mismos vía un bot conversacional de WhatsApp con mensajes interactivos (listas y botones). Cada pedido genera automáticamente un ticket de cocina (sin precios) y permite reimprimir un ticket con precios para control interno.

El sistema completo corre en la nube (sin servidor local). Una sola impresora térmica 80mm en el local, conectada a la laptop del operador, imprime tanto comandas de cocina como cuentas con precios bajo demanda.

## 2. Objetivos y no-objetivos

### Objetivos

- Reducir el tiempo de captura de pedidos por parte del único operador del local.
- Permitir al cliente final hacer pedidos por sí mismo vía WhatsApp sin descargar apps.
- Garantizar que el cliente reciba confirmación de que su pedido fue recibido.
- Generar comandas de cocina claras y reimprimibles.
- Permitir al dueño editar el menú, precios y disponibilidad de productos sin intervención del desarrollador.
- Imprimir tickets de 80 mm en una sola impresora térmica local.

### No-objetivos (explícitos para evitar scope creep)

- No es un POS completo con caja registradora, facturación CFDI ni manejo de propinas.
- No maneja pagos electrónicos (todo es contra entrega).
- No tiene gestión visual de mesas (solo número de mesa en texto libre).
- No tiene roles ni múltiples usuarios (un solo operador con contraseña única).
- No tiene reportes, analytics ni KDS (pantalla de cocina separada).
- No tiene gestión de inventario ni stock de ingredientes.
- No es multi-local.
- No incluye adiciones a pedidos ya existentes (se crea un pedido nuevo).

## 3. Usuarios y casos de uso

### Usuario primario: operador del local

- Abre la app, inicia sesión con contraseña del local.
- Toma pedidos de clientes que llegan al mostrador, llaman por teléfono o escriben por WhatsApp.
- Marca pedidos como "entregado" cuando salen.
- Gestiona el menú cuando hay cambios de precio, productos agotados, etc.

### Usuario secundario: cliente final (vía WhatsApp)

- Escribe al número de WhatsApp del negocio.
- Arma su pedido eligiendo de listas (categorías, productos, colonias).
- Recibe confirmación de que su pedido fue recibido.
- No necesita descargar ninguna app ni crear cuenta.

## 4. Arquitectura

### Stack

| Capa | Tecnología | Justificación |
|---|---|---|
| Front + Backend | Next.js 15 (App Router, TypeScript) | Full-stack, un solo deploy, ecosistema amplio. |
| ORM | Drizzle | TypeScript-first, queries claras, migraciones simples. |
| DB | Postgres (Neon serverless) | Tier free generoso, escalable, económico. |
| UI | React + Tailwind + shadcn/ui | Componentes copy-paste, accesibles. |
| Real-time | Server-Sent Events | Notificación live de pedidos nuevos al dashboard. |
| WhatsApp BSP | 360dialog | Conexión directa a Meta Cloud API, sin intermediario caro. |
| Impresión MVP | HTML/PDF + diálogo del navegador | Sin instalación local, funciona con cualquier impresora del SO. |
| Deploy | Render o Railway | Tier free para arrancar, $5–15/mes escalando. |
| Auth | Contraseña única en variable de entorno + sesión firmada | Un solo operador, no requiere tabla de usuarios. |

### Diagrama de contexto

```
                    ┌─────────────────────────────┐
                    │   Clientes (WhatsApp)       │
                    └──────────────┬──────────────┘
                                   │ mensajes interactivos
                                   ▼
                    ┌─────────────────────────────┐
                    │  Meta Cloud API / 360dialog │
                    └──────────────┬──────────────┘
                                   │ webhook
                                   ▼
┌───────────────────┐      ┌──────────────────────────────┐
│ Operador (laptop  │ HTTP │   Backend (Next.js en nube)  │
│   + celulares)    │◄────►│   API REST + Webhooks        │
│                   │ SSE  │   ┌──────────────────┐       │
│ [Dashboard]       │◄─────┤   │ Postgres (Neon)  │       │
│ [Tomar pedido]    │      │   └──────────────────┘       │
│ [Marcar entregado]│      └──────────────┬───────────────┘
│ [Gestionar menú]  │                     │
└─────────┬─────────┘                     │
          │ clic "Imprimir"                │
          ▼                                │
┌───────────────────┐                      │
│ Navegador (laptop)│ ─── HTTP ────────────┘
│   diálogo de impresión del SO
│   ↓
│ IMPRESORA TÉRMICA 80mm
└───────────────────┘
```

## 5. Modelo de datos

```sql
-- Menú
Category              id (uuid), name, slug, sortOrder, active (bool), createdAt, updatedAt
Product               id, categoryId (FK), name, basePrice (decimal 10,2),
                      description, sortOrder, active (bool), createdAt, updatedAt
Ingredient            id, name, type ('removable' | 'extra'), price (decimal), active
ProductIngredient     productId (FK), ingredientId (FK), defaultIncluded (bool)

-- Operación
DeliveryZone          id, name, cost (decimal 10,2), active, sortOrder
Colonia               id, name, zoneId (FK DeliveryZone), active
Order                 id, sequentialNumber (int), status ('received' | 'delivered' | 'cancelled'),
                      serviceType ('local' | 'delivery'),
                      customerPhone, customerName,
                      deliveryAddress (text, nullable), deliveryColoniaId (FK, nullable),
                      deliveryCostOverride (decimal, nullable),
                      deliveryCost (decimal, computed),
                      subtotal (decimal), total (decimal),
                      source ('whatsapp' | 'staff'),
                      notes (text), createdAt, updatedAt, deliveredAt (nullable)
OrderItem             id, orderId (FK), productId (FK), productNameSnapshot, basePriceSnapshot,
                      unitPrice (decimal), quantity (int),
                      removedIngredients (jsonb),
                      extraIngredients (jsonb),
                      itemTotal (decimal)
OrderEvent            id, orderId (FK), kind ('created'|'status_change'|'printed_kitchen'|'printed_bill'|'notified'),
                      payload (jsonb), createdAt

-- Auth
AdminSession          token (PK), createdAt, expiresAt

-- Auditoría
AuditLog              id, entity, entityId, action, beforeData (jsonb), afterData (jsonb), createdAt
```

### Reglas de integridad

- `sequentialNumber` se genera con una **sequence de Postgres** (`nextval('order_number_seq')`) reiniciada diariamente por un cron job a las 4:00 AM.
- `deliveryCost` es `zone.cost` por default, o `deliveryCostOverride` si el staff lo cambió manualmente (validado entre 10 y 30 pesos).
- `basePriceSnapshot` y `productNameSnapshot` se copian al crear el OrderItem para que cambios futuros de precio o nombre no afecten pedidos históricos.
- `OrderEvent` es append-only: es el log de auditoría del pedido.
- `active=false` en Product, Category, Ingredient, DeliveryZone, Colonia = oculto del menú y de los selectores, pero sigue contando en pedidos históricos.

## 6. Funcionalidades

### 6.1 Captura de pedidos por el operador

**Pantalla: Login** (`/login`)

- Campo único de contraseña.
- Sesión firmada con cookie httpOnly, expira en 7 días.
- Redirige a `/admin/orders`.

**Pantalla: Pedidos activos** (`/admin/orders`, dashboard principal)

- Lista de pedidos con `status='received'`, ordenados por hora.
- Server-Sent Events: aparece un pedido nuevo sin recargar.
- Cada pedido muestra: número, hora, tipo (local/domicilio), total, badge "NUEVO" si fue creado en los últimos 30 segundos.
- Acciones por pedido: "Marcar entregado", "Ver detalle", "Reimprimir cuenta".
- Botón flotante: "+ Nuevo pedido" → va a `/admin/orders/new`.

**Pantalla: Crear pedido** (`/admin/orders/new`)

Layout de dos columnas: izquierda menú, derecha carrito.

*Columna izquierda (menú)*:

- Tabs por categoría (la primera activa se ve por default).
- Grid de productos con imagen opcional, nombre, precio.
- Barra de búsqueda en la parte superior (filtra productos por nombre, atajo `Ctrl+K` o `/`).
- Click en producto abre modal de customización.

*Modal de customización*:

- Lista de ingredientes removibles con checkboxes.
- Lista de extras con checkboxes y precio.
- Stepper de cantidad.
- Botón "Agregar al carrito".

*Columna derecha (carrito)*:

- Lista de items agregados con customizaciones.
- Subtotal en tiempo real.
- Selector "Local" / "Domicilio" (radio buttons).
- Si domicilio: campo dirección (textarea) y campo colonia (autocomplete que filtra colonias activas y muestra zona + costo).
- Override de costo de envío (botón pequeño, abre input con validación 10–30).
- Campo notas.
- Botón grande "Finalizar pedido".

Al finalizar: `POST /api/orders` → crea pedido → redirige a `/print/[id]/kitchen` (auto-imprime comanda) → muestra confirmación con botones "Imprimir cuenta con precios" y "Volver al dashboard".

**Pantalla: Detalle de pedido** (`/admin/orders/[id]`)

- Vista de solo lectura con todos los datos.
- Botón "Reimprimir cuenta" (imprime con precios).
- Botón "Reimprimir comanda" (imprime sin precios).
- Si está `received`: botón "Marcar como entregado".
- Si está `delivered`: muestra timestamp de entregado, sin acciones.
- Si está `cancelled`: muestra razón de cancelación.

### 6.2 Impresión

**Plantilla A — Comanda de cocina** (auto al crear pedido, sin precios)

```
════════════════════════════════
 [LOCAL] / [DOMICILIO]
 PEDIDO #0042              13/09/26 14:35
════════════════════════════════
 2x Hamburguesa especial
    - sin jitomate
    - sin mostaza
    + extra queso
 1x Hamburguesa sencilla
    - sin jitomate
 3x Papas
 1x Alitas BBQ
────────────────────────────────
 NOTAS: cliente alérgico a cacahuate
════════════════════════════════
```

**Plantilla B — Cuenta con precios** (manual, reimprimible)

```
[NOMBRE DEL NEGOCIO]
Dirección · Tel
════════════════════════════════
 [LOCAL] / [DOMICILIO - Residencial del Valle]
 PEDIDO #0042          13/09/26 16:20
════════════════════════════════
 2  Hamburguesa especial       $180.00
    + extra queso             $ 20.00
 1  Hamburguesa sencilla      $ 80.00
 3  Papas                     $105.00
 1  Alitas BBQ                $120.00
────────────────────────────────
 SUBTOTAL:                   $505.00
 ENVÍO:                      $ 30.00
 TOTAL:                      $535.00
════════════════════════════════
```

**Implementación**:

- Cada plantilla es una página Next.js (`/print/[id]/kitchen`, `/print/[id]/bill`) con CSS optimizado para 80 mm (`@page { size: 80mm auto; margin: 0 }`).
- Auto-llama a `window.print()` al cargar.
- En la laptop del operador, el diálogo del SO permite seleccionar la impresora térmica.

### 6.3 Bot de WhatsApp

**Configuración**:

- BSP: 360dialog.
- Número dedicado del negocio.
- Webhook entrante: `POST /api/webhooks/whatsapp` (verifica firma del BSP).

**State machine de la conversación** (por `phone` del cliente):

```
idle
  ↓ (cliente escribe "hola" o cualquier cosa)
browsing_category
  ↓ (cliente toca una categoría)
browsing_product
  ↓ (cliente toca un producto)
customizing_product
  ↓ (cliente confirma customización)
in_cart
  ↓ (cliente elige "Agregar otro producto" → vuelve a browsing_category)
  ↓ (cliente elige "Finalizar pedido")
choosing_service_type
  ↓ (cliente toca "Domicilio" o "Local")
  ↓ (si Local)
confirming_order
  ↓ (si Domicilio)
awaiting_colonia
  ↓ (cliente toca una colonia)
awaiting_address
  ↓ (cliente escribe dirección)
confirming_order
  ↓ (cliente toca "Confirmar")
  ↓
[backend crea pedido, responde con número, manda confirmación]
idle
```

**Mensaje de confirmación al cliente** (al crear pedido):

> ✅ ¡Pedido #0042 recibido!
> ⏱️ Tiempo estimado: 25 minutos
> Te avisaremos cuando esté listo.

### 6.4 Gestión de menú (admin)

**CRUD de Categorías** (`/admin/menu/categories`):

- Listar, crear, editar, desactivar.
- Campos: nombre, slug (auto), orden.
- Soft delete (`active=false`).

**CRUD de Productos** (`/admin/menu/products`):

- Lista agrupada por categoría con badge [DISPONIBLE] / [AGOTADO].
- Switch rápido de "Disponible" en cada fila (sin entrar a editar).
- Click en producto abre detalle.
- Detalle: nombre, descripción, precio base, categoría, switch "Disponible", lista de ingredientes removibles, lista de extras con precio.
- Botón "Desactivar" en la parte inferior.

**CRUD de Zonas de Entrega** (`/admin/delivery-zones`):

- Lista de zonas con costo.
- Cada zona tiene: nombre, costo (validado 10–30), lista de colonias.
- CRUD de colonias dentro de cada zona.

**Carga masiva inicial** (`/admin/import`):

- Botón "Importar menú desde JSON" con file picker.
- Acepta un JSON con el formato:

```json
{
  "categories": [{"name": "Hamburguesas", "products": [...]}],
  "deliveryZones": [{"name": "Centro", "cost": 15, "colonias": [...]}]
}
```

- Si ya hay datos, pregunta si reemplazar o agregar.
- Imprime reporte de lo importado (N categorías, N productos, N colonias).

## 7. Endpoints API

| Método | Ruta | Propósito |
|---|---|---|
| POST | `/api/orders` | Crear pedido (staff o bot) |
| GET | `/api/orders` | Listar pedidos (con filtros `?status=received`) |
| GET | `/api/orders/:id` | Detalle de pedido |
| PATCH | `/api/orders/:id/status` | Cambiar estado (received → delivered, etc.) |
| POST | `/api/orders/:id/print-kitchen` | Registra impresión de comanda |
| POST | `/api/orders/:id/print-bill` | Registra impresión de cuenta |
| GET | `/api/menu/categories` | Listar categorías |
| POST/PATCH/DELETE | `/api/menu/categories[/:id]` | CRUD categorías |
| GET | `/api/menu/products` | Listar productos (con `?active=true` filtra) |
| POST/PATCH/DELETE | `/api/menu/products[/:id]` | CRUD productos |
| GET/POST/PATCH/DELETE | `/api/delivery-zones[/:id]` | CRUD zonas |
| GET/POST/PATCH/DELETE | `/api/colonias[/:id]` | CRUD colonias |
| POST | `/api/admin/import` | Importar JSON de menú/zonas |
| POST | `/api/admin/login` | Login con contraseña |
| POST | `/api/admin/logout` | Cerrar sesión |
| GET | `/api/events` | SSE stream de eventos del sistema |
| POST | `/api/webhooks/whatsapp` | Webhook del BSP |

## 8. Manejo de errores

- Todos los handlers de Next.js devuelven JSON con shape `{ ok: true, data }` o `{ ok: false, error: { code, message } }`.
- El cliente muestra toasts con el mensaje de error.
- El webhook de WhatsApp responde siempre 200 al BSP (para evitar retries), pero registra el error internamente.
- Si la creación de pedido falla a mitad de camino (después de mandar WhatsApp al cliente), se manda un segundo mensaje "Hubo un error, contáctanos por teléfono".
- Logs estructurados con `pino` incluyen: `orderId`, `phone`, `userAgent`, `error`.

## 9. Seguridad

- Una sola contraseña del local, guardada en variable de entorno (`ADMIN_PASSWORD`), hasheada con bcrypt al comparar.
- Sesiones con cookies httpOnly, secure en producción, signed.
- Webhooks de WhatsApp verifican firma del BSP antes de procesar.
- Rate limiting en endpoints públicos (10 req/min por IP) usando middleware de Next.js.
- Variables sensibles (DB URL, WhatsApp token, admin password) en `.env`, nunca en código.
- CORS restrictivo (solo el dominio del deploy).
- HTTPS obligatorio en producción.

## 10. Testing (objetivo: 80%+ coverage)

- **Unit tests** (Vitest) para:
  - Cálculo de precios (subtotal, extras, envío, total).
  - State machine de pedidos (transiciones válidas).
  - State machine del bot de WhatsApp.
  - Validaciones (precio entre 10–30, colonia existe, etc.).
- **Integration tests** para endpoints principales (`/api/orders`, `/api/menu/products`).
- **Smoke test manual** del bot de WhatsApp antes de cada deploy.
- **E2E mínimo** (Playwright) para el flujo crítico: login → crear pedido → imprimir.

## 11. Despliegue

- Repo: GitHub.
- CI: GitHub Actions que corre lint, typecheck y tests en cada PR.
- Deploy: conectado a `main`, push a main → deploy automático en Render.
- DB: provisionada en Neon, connection string en env vars.
- Variables de entorno requeridas:
  - `DATABASE_URL`
  - `ADMIN_PASSWORD` (hash bcrypt)
  - `SESSION_SECRET`
  - `WHATSAPP_BSP_API_KEY`
  - `WHATSAPP_BSP_URL`
  - `WHATSAPP_VERIFY_TOKEN`
  - `BUSINESS_NAME`, `BUSINESS_ADDRESS`, `BUSINESS_PHONE`
- Dominio custom (opcional, recomendado).
- Backups de Neon automáticos, retención 7 días.
- Cron job diario: reinicia la sequence de `sequentialNumber` a 1.

## 12. Estimación de costos mensuales (MXN)

| Servicio | Costo |
|---|---|
| Render o Railway | $100–300 |
| Neon Postgres | $0–200 (free tier arranca) |
| 360dialog (WhatsApp) | $50–150 según volumen |
| Dominio (opcional) | $200/año ≈ $17/mes |
| Impresora térmica 80 mm | $1,500–3,500 (compra única) |
| **Total mensual recurrente** | **~$170–670** |

## 13. Fuera de alcance (explícito)

Para no caer en scope creep, lo siguiente NO se incluye en el MVP:

- Manejo de pagos (efectivo, tarjeta, transferencia).
- Captura de propina.
- Ticket de cierre / factura CFDI.
- Roles multi-usuario, autenticación avanzada.
- Reportes de ventas, dashboards analíticos.
- Inventario de ingredientes, stock.
- KDS (Kitchen Display System).
- Multi-local.
- Programa de lealtad / clientes recurrentes.
- Adiciones a pedidos ya creados (se debe crear uno nuevo).
- Notificación al cliente cuando se marca como entregado.
- Modificación de pedidos después de creados.
- Integración con Maps / geolocalización.

Si alguno de estos se necesita en el futuro, será una nueva fase con su propio spec.

## 14. Plan de implementación (alto nivel)

Para discusión en la siguiente fase (cuando invoquemos la skill `writing-plans`):

1. Setup del proyecto (Next.js + Drizzle + DB + auth básico).
2. CRUD de menú y zonas.
3. UI de captura de pedido del staff.
4. Sistema de impresión (2 plantillas).
5. Bot de WhatsApp (state machine + BSP).
6. Notificación de pedido recibido.
7. Polish, tests, deploy a producción.
8. Onboarding con datos reales (importar menú del cliente, configurar colonias).
