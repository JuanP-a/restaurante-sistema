# Diseño — Desktop Fase 4: shell Electron

- **Fecha:** 2026-10-11
- **Estado:** Aprobado (diseño) — pendiente plan de implementación
- **Fase:** Desktop 4 de 5 ([plan maestro](../plans/2026-10-03-migracion-desktop.md))

## Contexto

Las fases 1–3 dejaron la app corriendo contra **PGlite embebido**, con impresión ESC/POS server-side y backups. Todo eso asume que alguien arranca el server Next a mano (`pnpm dev` / `pnpm start`) y le pasa las variables de entorno.

Esta fase entrega el **producto instalable**: un `.exe` de Windows que arranca el server + PGlite solo, vive en la bandeja del sistema, se reconecta tras un crash, acepta conexiones desde los celulares/laptops del local por LAN, y se configura la primera vez con un asistente mínimo.

La auditoría de la versión de escritorio (PR #37) dejó tres hallazgos que **bloquean** el `.exe`; se incluyen en el alcance (ver §Prerequisitos).

## Decisiones (aprobadas 2026-10-11)

| Tema | Decisión |
|---|---|
| Modelo de proceso | **Child process.** Electron main lanza el server Next como hijo y lo supervisa. |
| Mecanismo de launch | **Fork del `server.js` standalone** con el Node embebido de Electron (`utilityProcess.fork`, fallback `child_process.fork` + `ELECTRON_RUN_AS_NODE=1`). |
| Puerto HTTP | **Fijo 3210 con fallback**: si está ocupado, se prueba 3211… y se muestra el puerto real. |
| Primer arranque | **Wizard mínimo: contraseña.** El negocio/impresora/backup siguen por `.env` al instalar. |
| Almacenamiento de config | `admin_password_hash` y `setup_completed_at` en una tabla **`settings` de la DB** (se respalda con el backup). `SESSION_SECRET` y el puerto elegido en un `config.json` en `userData`. |
| Carpeta de backup por defecto | **`Documentos/restaurante-backups`** (`app.getPath("documents")`). |
| Conectar celular | **QR + URL LAN** en una pantalla de la app (`/admin/conectar`). |
| Alcance | Shell (tray, autostart, bind LAN, firewall) **+ los 3 prerequisitos** de la auditoría. |
| Split de repo | **No** se hace `apps/desktop` (ADR [0003](../../decisions/0003-estrategia-repositorio-git.md): el split se hace cuando nazca el SaaS). |

## Arquitectura

```
                        LAN (celulares / laptops)
                                  │  http://192.168.x.x:3210
                                  ▼
┌───────────────────────────────────────────────────────────┐
│ Máquina del restaurante (Windows)                          │
│                                                            │
│  electron.exe (main)                                       │
│   ├─ requestSingleInstanceLock · port-pick · config.json   │
│   ├─ spawn ─▶ server.js (Next standalone, utilityProcess)  │
│   │              ├─ PGlite in-process (%APPDATA%/…/pglite) │
│   │              ├─ /api/* bind 0.0.0.0:3210               │
│   │              └─ print ESC/POS TCP · backup             │
│   ├─ health-poll /api/health → BrowserWindow → :3210       │
│   └─ tray: abrir · URL LAN · reiniciar · autostart · salir │
└───────────────────────────────────────────────────────────┘
```

El mismo binario Next sirve tanto al operador (ventana de Electron) como a los clientes de la LAN (navegador del celular). No hay segundo código.

## Componentes y archivos

```
electron/
  main.ts               # bootstrap: single-instance, config, port, spawn, tray, ventana, shutdown
  server-process.ts     # ServerProcess: start/stop/restart, health-poll, manejo de `exit`
  port.ts               # pickPort(start=3210): bind-test y avanza si está ocupado
  config.ts             # load/save config.json (sessionSecret, lastPort, autostart)
  tray.ts               # buildTray({ onOpen, onLan, onRestart, onToggleAutostart, onQuit })
  lan.ts                # lanUrl(port): IP LAN desde os.networkInterfaces
  tsconfig.json
electron-builder.yml    # NSIS + extraResources (.next/standalone, drizzle/, nativos)
src/core/settings/
  setup.ts              # requiresSetup(hasHash, envHash) · validatePassword(pw) -> Result
src/infra/db/
  settings-repository.ts# getSetting/setSetting · getAdminPasswordHash/setAdminPasswordHash
  schema.ts             # + tabla `settings` (key/value) + migración
src/app/setup/
  page.tsx              # wizard (server) — público, redirigido por middleware
  setup-form.tsx        # client: input + submit
src/app/api/setup/route.ts   # POST: set hash (one-shot)
src/app/admin/conectar/page.tsx  # QR + URL LAN (client para el QR)
```

**Cambios a archivos existentes:**

- `src/env.ts`: `ADMIN_PASSWORD_HASH` pasa a **opcional**; nueva `SESSION_COOKIE_SECURE` (bool, **default `true`**; el shell la setea `false`) y `DESKTOP_LAN_URL` (opcional, solo desktop).
- `src/app/api/admin/login/route.ts`: verifica contra `hashDeSettings ?? env.ADMIN_PASSWORD_HASH`; cookie `secure` desde `SESSION_COOKIE_SECURE`.
- `src/middleware.ts`: gate de setup (si falta hash y no hay env → redirige a `/setup`).
- `src/app/admin/backup/page.tsx`: `export const dynamic = "force-dynamic"` (DT-022).
- `next.config.ts`: `outputFileTracingIncludes`/`serverExternalPackages` con `@electric-sql/pglite-tools` y `drivelist` (DT-008/DT-035).

## Arranque y ciclo de vida

1. `app.requestSingleInstanceLock()` → si ya corre, la segunda instancia enfoca la ventana y sale.
2. Cargar `config.json`; si no hay `sessionSecret`, generarlo y persistirlo.
3. **Elegir puerto:** `pickPort(3210)` — bind-test de 3210, 3211… hasta encontrar libre. Guardar el elegido.
4. **Spawn del hijo** con env:
   `PORT`, `HOSTNAME=0.0.0.0`, `NODE_ENV=production`, `DB_DRIVER=pglite`, `DB_PATH=<userData>/pglite`,
   `SESSION_COOKIE_SECURE=false`, `SESSION_SECRET`, `BACKUP_DIR=<Documentos>/restaurante-backups`,
   `DESKTOP_LAN_URL=http://<ipLan>:<port>`, `BUSINESS_*`, `PRINTER_HOST`/`PRINTER_PORT`.
   `ADMIN_PASSWORD_HASH` **no se setea** en desktop (modo wizard).
5. **Health-poll** `http://127.0.0.1:<port>/api/health` hasta 200 (timeout ~30 s; cubre el boot de PGlite y `migrate()`). Mientras, splash "Iniciando…".
6. `BrowserWindow.loadURL("http://127.0.0.1:<port>")`. El middleware redirige a `/setup` si falta configurar.
7. **Tray:** Abrir panel · Dirección LAN · Reiniciar servidor · Iniciar con Windows (toggle) · Salir.
8. **Crash del hijo:** el `exit` dispara reintento con backoff (3×); si no levanta, diálogo de error con la ruta de logs.
9. **Shutdown:** cerrar la ventana **oculta a la bandeja** (el server sigue sirviendo la LAN); se sale de verdad con "Salir" del tray (o `Ctrl+Q`). `before-quit` mata el hijo (SIGTERM → timeout → SIGKILL) para no dejar el puerto tomado.

## Primer arranque (wizard mínimo)

- **Estado "setup requerido" = no hay `admin_password_hash` en `settings` ni `env.ADMIN_PASSWORD_HASH`.**
  El fallback por env mantiene el comportamiento cloud (donde el hash viene de `.env`): si la env está presente, el setup se considera completo.
- `POST /api/setup` (público): valida la contraseña (core puro), la hashea (bcrypt, reusa `infra/auth/password`) y guarda en `settings`. **One-shot**: si ya existe hash → `409`.
- `src/core/settings/setup.ts` (puro): `requiresSetup(hasHash, envHash)` y `validatePassword(pw)` (longitud mínima, etc.) devolviendo `Result`.
- El middleware, mientras el setup esté incompleto, permite solo `/setup` y `/api/setup`; cualquier otra ruta redirige a `/setup`.

## Conectar celular (QR)

- El main calcula la IP LAN y pasa `DESKTOP_LAN_URL` al hijo.
- `/admin/conectar` muestra esa URL y un **QR** para que el celular abra el panel. El QR se renderiza en el cliente (dep nueva `qrcode`, `toDataURL`). La URL también aparece en el menú del tray.

## Prerequisitos de la auditoría (en scope)

| ID | Fix |
|---|---|
| [DT-011](../../deuda-tecnica.md) | Cookie `secure` deja de derivar de `NODE_ENV`; pasa a `SESSION_COOKIE_SECURE` (desktop `false`, cloud `true`). Hoy rompe el login en LAN HTTP. |
| [DT-022](../../deuda-tecnica.md) | `export const dynamic = "force-dynamic"` en `/admin/backup/page.tsx`; sin esto la página se prerenderiza como variante cloud y desaparece en el `.exe`. |
| [DT-008](../../deuda-tecnica.md) / [DT-035](../../deuda-tecnica.md) | Empaquetado: incluir `@electric-sql/pglite-tools` y `drivelist` en el trace `standalone`; verificar en Windows que `drivelist` carga ([DT-018](../../deuda-tecnica.md)) y que `pgDump` corre. |

## LAN, firewall y SmartScreen

- Bind a `0.0.0.0` sin TLS (LAN de confianza). La cookie no-secure es intencional (DT-011).
- El primer bind dispara el prompt del Firewall de Windows; se documenta y se ofrece una regla `netsh advfirewall` opcional (requiere admin) desde el instalador NSIS (riesgo R4 del plan maestro).
- Sin firma de código → instrucciones anti-aviso de SmartScreen (DT-014, aceptada).

## Error handling

- El server (hijo) ya traduce errores de core/infra a HTTP; el shell no los reinterpreta.
- El main maneja **fallos de infraestructura**: hijo que no arranca (timeout de health), crash con reintento, error de spawn (diálogo + logs). Los logs del hijo se capturan por IPC/stdio a `userData/logs`.
- `config.json` corrupto → se regenera con defaults (nunca impide arrancar).

## Testing

- **Unit (core puro):** `requiresSetup` (4 combinaciones hasHash/envHash) y `validatePassword` (válida/larga/corta/vacía).
- **Integración (PGlite):** `settings-repository` (get/set, upsert); flujo `POST /api/setup` → hash guardado → login OK; segundo `POST` → 409; login usando el hash de `settings` (sin env); gate del middleware (ruta protegida sin setup → redirige).
- **E2E (Playwright):** wizard de primer arranque (es web; corre en CI linux).
- **Manual Windows (criterio de cierre):** instalar el `.exe`; crear un pedido desde el celular en LAN; la app sobrevive al cierre de ventana; reiniciar el server desde el tray; verificar autostart; cargar `drivelist` y disparar un backup real.

## Fuera de alcance (Fase 4)

- **Split a `apps/desktop` + `packages/*`** → cuando nazca el SaaS (ADR 0003).
- **Firma de código** (DT-014) y **auto-update** (`electron-updater`).
- **TLS / HTTPS** en la LAN.
- **Túnel de WhatsApp** → Fase 5.
- **Wizard completo** (negocio/impresora/backup) — solo contraseña; el resto por `.env`.
- **Schedule de backups / swap en vivo de la DB** (DT-020) — siguen pendientes.
