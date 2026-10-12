# Migración a Versión de Escritorio — Plan Maestro

> **Para workers agénticos:** REQUIRED SUB-SKILL: usar `superpowers:subagent-driven-development` (recomendado) o `superpowers:executing-plans` para implementar este plan task-by-task. Los steps usan checkbox (`- [ ]`) para tracking.

**Goal:** Convertir el sistema cloud de pedidos en una app de escritorio (Windows) para pequeños restaurantes de pago único: DB embebida (sin Postgres server), impresión térmica por LAN resuelta server-side, backups a USB/carpeta sincronizada, y bot de WhatsApp vía túnel — conservando el código para un futuro SaaS.

**Architecture:** Single-app Next.js con un **puerto de base de datos** en `src/infra/db/` y dos adapters (PGlite embebido para desktop, node-postgres para SaaS) elegidos por env. Lógica de negocio (`src/core/`) intacta y reutilizable. Shell Electron para Windows que arranca el server Next local + PGlite in-process y expone IPC de filesystem/USB. Impresión server-side a impresora térmica de red (ESC/POS a `IP:9100`). Bot WhatsApp recibe webhooks por Cloudflare Tunnel directo a la app local.

**Tech Stack:** Next.js 16, TypeScript estricto, Drizzle ORM, **PGlite** (`@electric-sql/pglite`) desktop / Postgres node-postgres SaaS, Electron + electron-builder, `@electric-sql/pglite-tools` (pg_dump), `drivelist` (USB), ESC/POS, Cloudflare Tunnel, Vitest.

---

## Decisiones bloqueadas (2026-10-03)

| Tema | Decisión |
|---|---|
| Estructura repo | Single-app + **puerto DB** ahora. Split a monorepo workspace solo cuando el SaaS sea real. |
| SO host | Windows (`.exe` vía electron-builder). |
| Impresoras | 1 térmica **de red** (Ethernet/WiFi, ESC/POS) para ambos tickets. Server imprime. Diseño soporta N. |
| Destinos backup | **USB** + **carpeta sincronizada** (Drive/OneDrive/Dropbox del usuario). Sin OAuth a Drive API en MVP. |
| WhatsApp | **Dominio + Cloudflare Tunnel** saliente → webhook directo a la app local. Sin servidor cloud. |
| Datos a migrar | Ninguno. Cliente nuevo, DB vacía + import JSON del menú. |
| Firma de código | **No** por ahora (1 cliente). Revisar al escalar. |
| Modelo comercial | Licencia única + soporte opcional. Solo costo recurrente: WhatsApp (Meta) + dominio. |

## Arquitectura destino

```
                        Internet
                            │
                  Cloudflare Tunnel (saliente)
                            │  HTTPS público → webhook WhatsApp
                            ▼
┌───────────────────────────────────────────────────────────┐
│ Máquina del restaurante (Windows)                          │
│                                                            │
│  electron.exe (main)                                       │
│   ├─ Next standalone server (child o mismo proceso)        │
│   │    ├─ PGlite in-process  (data en %APPDATA%)           │
│   │    ├─ /api/* (LAN, bind 0.0.0.0)                       │
│   │    ├─ /api/webhooks/whatsapp (túnel)                   │
│   │    └─ print service → ESC/POS TCP                    │
│   └─ BrowserWindow → localhost:PUERTO                      │
│                                                            │
│  LAN: celulares/laptops → http://192.168.x.x:PUERTO        │
└───────────────────────────────────────────────────────────┘
                            │ TCP 9100 (ESC/POS raw)
                            ▼
                 Térmica de red (IP fija)
                 ├─ ticket cocina (sin precios)
                 └─ cuenta cliente (con precios)
```

## Estrategia de repositorio

**Ahora:** un solo repo, una sola app. El seam real es el **puerto DB**, no los workspaces.

- `src/infra/db/client.ts` deja de acoplar `pg` directo; expone `getDb(): Db` tipado contra el tipo base `PgDatabase<..., typeof schema>` de `drizzle-orm/pg-core` (tanto `NodePgDatabase` como `PgliteDatabase` lo satisfacen).
- Selección por `env.DB_DRIVER` (`pglite` | `postgres`).
- Repos (`menu-repository.ts`, `order-repository.ts`, etc.) **no cambian**: siguen llamando `getDb()`.

**Después (al construir el SaaS):** promove a pnpm workspace:
```
packages/core   ← src/core trasladado, puro
packages/db     ← puerto + adapters (pglite, postgres)
apps/desktop    ← Electron + Next (esta app)
apps/web        ← Next cloud (deployment)
```
El `pnpm-workspace.yaml` ya existe, así que la migración es directa cuando toque. No se hace hoy para no romper CI/tests por adelantado (YAGNI).

## Fases

| Fase | Entregable | Archivo de plan | Verificación |
|---|---|---|---|
| **0 — Spike PGlite** | Go/No-Go documentado: schema real, migraciones y un repo corriendo en PGlite. | `2026-10-03-desktop-01-puerto-db-pglite.md` (Task 1) | Script corre, repo inserta/lee, secuencia `nextval` funciona. |
| **1 — Puerto DB + PGlite** | App corre local contra PGlite embebida, **todos los tests existentes verdes**. | `2026-10-03-desktop-01-puerto-db-pglite.md` | `pnpm test:unit` verde + suite de integración contra PGlite. |
| **2 — Print service ESC/POS** | `POST /api/orders/:id/print-{kitchen,bill}` manda ESC/POS real a `IP:9100`. Ambas plantillas. | `2026-10-03-desktop-02-print-escpos.md` | Test con TCP server fake recibe bytes correctos; cocina sin precios, cuenta con precios. |
| **3 — Backup** | ✅ Módulo de backup manual: `pgDump` → carpeta sincronizada + USB (auto-opcional), rotación por conteo, **validación** de restaurabilidad, endpoints + `/admin/backup`. (Schedule + restore en vivo → ver [DT-020](deuda-tecnica.md).) | `2026-10-08-desktop-03-backup.md` | Dump restaurable en PGlite temporal (escrito con `public.` por el `search_path` que vacía `pgDump`), rotación, escritura multi-destino con éxito parcial, endpoints (409 en cloud) y página admin. 244 tests verdes + 1 skipped. |
| **4 — Shell Electron** | `.exe` Windows que arranca server + PGlite, tray, autostart, bind LAN, firewall. | `2026-10-03-desktop-04-electron-shell.md` | Instalar en Windows real, pedido creado desde celular en LAN, app sobrevive cierre de ventana. |
| **5 — WhatsApp tunnel** | Cloudflare Tunnel + webhook registrado; pedido del bot aparece en cola local. | `2026-10-03-desktop-05-whatsapp-tunnel.md` | Mensaje real de WhatsApp crea pedido en el dashboard local. |

Cada plan produce software funcionando y testeable por sí mismo. **Orden estricto**: 0→1 desbloquean todo. 2 y 3 dependen de 1. 4 depende de 1. 5 depende de 4.

## Estructura de archivos objetivo (tras completar todas las fases)

```
/
├── electron/
│   ├── main.ts                  # proceso principal: arranca server, tray, IPC, autostart
│   ├── preload.ts               # bridge seguro a renderer (dialog, USB list)
│   ├── tray.ts
│   └── tsconfig.json
├── electron-builder.yml
├── src/
│   ├── env.ts                   # + DB_DRIVER, DB_PATH, HOST, PORT, PRINTER_*
│   ├── infra/
│   │   ├── db/
│   │   │   ├── client.ts        # getDb() + selección de adapter (puerto)
│   │   │   ├── adapters/
│   │   │   │   ├── pglite.ts    # desktop
│   │   │   │   └── postgres.ts  # saas
│   │   │   ├── migrate.ts       # aplica drizzle/ migraciones en boot
│   │   │   ├── schema.ts        # sin cambios (pg-core)
│   │   │   └── *-repository.ts  # sin cambios
│   │   ├── printer/
│   │   │   ├── escpos.ts        # renderer ticket (cocina|cuenta) → bytes ESC/POS
│   │   │   ├── transport.ts     # interfaz puerto; tcp.ts (IP:9100), fake.ts
│   │   │   └── print-service.ts # orquesta render + transport + reintentos + evento
│   │   └── backup/
│   │       ├── backup-service.ts# dump + destino + rotación + restore
│   │       ├── destinations.ts  # USB (drivelist), carpeta
│   │       └── schedule.ts      # timer programado
│   └── app/
│       ├── api/backup/route.ts  # disparar backup (LAN/host)
│       └── admin/backup/page.tsx
├── drizzle/                     # migraciones (se empaquetan en el build)
└── docs/superpowers/plans/...
```

## Global Constraints

Copiadas de `AGENTS.md` — aplican a **cada** task:

- TypeScript estricto. **Prohibido** `any`, non-null assertion (`!`), type assertions (`as Tipo`). Usar `satisfies` cuando haga falta shape checking.
- **Functional core, imperative shell**: lógica pura sin I/O en `src/core/`; I/O solo en `src/infra/` y handlers.
- **TDD**: test antes que implementación (red → green → refactor). Target ≥80% coverage. Sin mocks del core; adapters con fakes in-memory o infra real.
- **YAGNI**: nada fuera del plan.
- Comentarios solo para el "por qué" no obvio.
- **pnpm**, nunca npm/npx.
- Commits chicos, convencionales (`feat:`, `fix:`, `chore:`), cuerpo cuando el porqué no sea obvio. Un commit = cambio coherente que pasaría review aislado.
- Nombres de dominio en español, tecnologia en inglés.
- Errores explícitos con `Result`/`Either` en el core; excepciones en la shell.

## Riesgos

| # | Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|---|
| R1 | **PGlite no soporta algún patrón del schema/repos** (single connection, prepared statements, secuencia) | Media | Alto | **Fase 0 spike** antes de todo. Plan B: adapter SQLite (drizzle sqlite dialect) — +1–2 sem. |
| R2 | **PGlite crash V8 con instancias concurrentes** (issue #1053) | Baja en prod | Medio | Producción = 1 instancia long-lived. Tests: reusar una instancia, no crear/cerrar en churn. Nunca 2 procesos abriendo el mismo dataDir. |
| R3 | **Migraciones no se empaquetan** en el `.exe` | Media | Medio | Task de Fase 1 verifica que `drizzle/` viaja en el bundle y `migrate()` corre en boot. |
| R4 | **Firewall/SmartScreen** bloquea instalación | Alta | Medio | Fase 4 documenta e incluye regla de firewall; instrucciones anti-SmartScreen. |
| R5 | **Single connection serializa** todas las queries HTTP | Media | Bajo | Volumen de restaurante chico; aceptable. Medir en spike. |
| R6 | **Cookie `secure` en HTTP intranet** rompe login | Media | Medio | Task en Fase 4: quitar `secure` cuando no haya TLS, o TLS self-signed. |
| R7 | **Térmica no es de red** (cliente compra USB) | Media | Bajo | Adapter de transporte abstrae: `tcp` (IP:9100) y `usb`. Fase 2 solo implementa tcp; usb queda como adapter futuro. |
| R8 | **Cloudflare Tunnel URL inestable** sin dominio | Media | Medio | Requiere dominio propio (~$10/año). Documentar compra. Si no, relay (Fase 5 alternativa). |

## Fuera de alcance (explícito)

- Multi-tenant, roles, múltiples usuarios (sigue siendo contraseña única).
- Migración fork a monorepo (se hace cuando nazca el SaaS).
- Firma de código.
- Google Drive API con OAuth (MVP usa carpeta sincronizada).
- Impresión USB directa (adapter previsto, no implementado).
- Auto-update (se puede añadir después con electron-updater + Releases).
- Cambios al bot de WhatsApp (solo se le cambia el transporte de entrada).
- Reportes, analytics, KDS, inventario (siguen fuera, como en el spec original).

## Preguntas abiertas (resolver antes o durante la fase indicada)

1. **Número de pedido diario**: hoy `nextval('orders_sequential_number_seq')` es global, no reinicia por día. El spec pedía reset diario 4:00 AM. En desktop no hay cron del cloud. ¿Mantener global, o computar contador por día (recomendado: `MAX(sequential_number)+1 WHERE date=HOY`)? — decidir en Fase 1 Task de secuencia.
2. **Puerto HTTP**: ¿fijo (ej. 3210) o aleatorio? Fijo con QR es más simple. — Fase 4.
3. **Sembrado inicial / contraseña**: ¿cómo setea el cliente su contraseña en el primer arranque? Propuesta: primera pantalla wizard. — Fase 4.
4. **¿El server Next corre como child process o in-process con Electron?** Recomendado child process (aislado, reiniciable). — Fase 4.
5. **¿Dos impresoras algún día?** El diseño mapea tipo de ticket → impresora; MVP 1. — Fase 2.
