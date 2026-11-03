# Diseño — Desktop v1: configurar la impresora desde el `.exe`

- **Fecha:** 2026-11-03
- **Estado:** Borrador — pendiente de aprobación del usuario
- **Fase:** v1 de escritorio ([ADR 0005](../../decisions/0005-alcance-v1-desktop.md)), porción impresora de [DT-047](../../deuda-tecnica.md)

## Contexto

La impresión ESC/POS server-side (Fase 2) se activa solo si `PRINTER_HOST` está en el entorno del server. El `.exe` no pasa esa variable al server hijo y tampoco lee `.env.local` (`electron/main.ts`), así que `print-kitchen`/`print-bill` siempre responden `printed: "browser"`. Verificado el 2026-11-03 sobre `main` a97ea51.

Sin impresión silenciosa a la térmica, el operador abre el diálogo del navegador en cada comanda. Es el pendiente principal de la v1.

## Requisito de hardware (decidido 2026-11-03)

La impresora es **de red por Ethernet (cable al router) con IP fija**. Todo el transporte es TCP raw al puerto 9100; las impresoras **USB** quedan fuera (v2).

- **Ethernet y no WiFi:** el WiFi de las térmicas baratas es 2.4 GHz, se cae y cambia de IP. La impresora es el eslabón que no se puede reiniciar en hora pico.
- **IP fija obligatoria:** reserva DHCP en el router o IP estática en la impresora. Si la IP cambia, la config guardada deja de apuntar a ella y toda comanda falla con 502.
- **Modelo:** 80 mm, ESC/POS, con puerto LAN y 9100 raw (p. ej. Epson TM-T20III Ethernet, TM-m30, clones Xprinter/Rongta con LAN). Codepage CP850 si la impresora permite elegirlo.
- **Celulares:** hablan con la app en la PC (`:3210`); solo la PC habla con la impresora. Con impresión server-side la comanda sale en la térmica aunque el pedido se haga desde un celular. La PC debe estar encendida, sin suspensión y en la misma red que la impresora.

## Pregunta abierta

**¿Imprime solo al crear un pedido?** Hoy la impresión se dispara al abrir `/print/[id]/kitchen` (botón en el detalle del pedido, `order-actions.tsx`); crear un pedido, desde la PC o el celular, no imprime nada. Los pedidos del bot de WhatsApp tampoco. Un auto-print en `POST /api/orders` sería un cambio pequeño, pero **no está en el alcance de la v1** ([ADR 0005](../../decisions/0005-alcance-v1-desktop.md)). Decidir con el cliente antes de implementar; si entra, se actualiza el ADR primero.

## Decisiones propuestas

| Tema | Decisión | Por qué |
|---|---|---|
| Dónde se guarda | Tabla `settings` de la DB (claves `printer_host`, `printer_port`) | Ya existe y la usan el wizard y el login. Los endpoints de impresión leen la config **por request**, así que cambiar la IP **no exige reiniciar** el server. |
| Prioridad | DB gana sobre env | Cloud (Render) sigue con `PRINTER_HOST` por env sin cambios; el `.exe` usa la DB. |
| Edición | Página `/admin/ajustes`, sección "Impresora" | DT-047 ya propone `/admin/ajustes`; v2 añadirá negocio y WhatsApp sin mover nada. |
| Disponibilidad | Solo con `DB_DRIVER=pglite` | Mismo criterio que backup (409 en cloud). En cloud, un endpoint que abre TCP a un host arbitrario sería un vector SSRF para quien tenga sesión. |
| Verificación | Botón **Imprimir prueba** que usa los valores del formulario **sin guardarlos** | Un error de tecleo en la IP, si se guarda, hace fallar todas las comandas con 502; mejor descubrirlo antes. |

> **Desvío de DT-047 (registrado):** la deuda proponía guardar en `config.json` e inyectar por env desde `electron/main.ts`. Eso obliga a que el server hijo escriba un archivo de Electron y a reiniciar tras cada cambio. Con `settings` no se toca `electron/` y todo se prueba sobre PGlite en memoria.
>
> **Corrección del criterio de cierre:** DT-047 dice que `print-kitchen` responde `printed: "escpos"`. El valor real del código es `printed: "server"` (`PrintOutcome` en `print-service.ts`).

## Arquitectura

Functional core, imperative shell:

- **Core puro** `src/core/settings/printer.ts`: `parsePrinterSettings({ host, port })` → `Result<PrinterSettings, DomainError>`.
  - `host` vacío = impresora desactivada (fallback al navegador).
  - `host` válido: IPv4 o hostname sin esquema (`http://`), sin puerto embebido, sin espacios.
  - `port`: entero 1–65535; vacío = 9100.
- **Core puro** `renderTestTicket()` en `src/core/printing/render-ticket.ts`: init + CP850 + texto "Prueba de impresión" + corte. Reutiliza `escpos-bytes.ts`.
- **Repo** `src/infra/db/settings-repository.ts`: `getPrinterSettings()` / `setPrinterSettings()` sobre `getSetting`/`setSetting`.
- **Resolución** `src/infra/printer/index.ts`: `resolveTransport` queda puro (recibe `{ PRINTER_HOST, PRINTER_PORT }`). Se añade `loadPrinterConfig(env)` que mezcla DB y env y devuelve ese mismo shape. Si la clave `printer_host` existe en DB (aunque sea vacía) gana sobre el env: así el operador puede desactivarla.
- **Shell**: las dos rutas de impresión cambian `resolveTransport(getEnv())` por `resolveTransport(await loadPrinterConfig(getEnv()))`.

### Archivos

```
src/core/settings/printer.ts            # parsePrinterSettings
src/core/printing/render-ticket.ts      # + renderTestTicket
src/infra/db/settings-repository.ts     # + get/setPrinterSettings
src/infra/printer/index.ts              # + loadPrinterConfig
src/app/api/settings/printer/route.ts   # GET, PUT
src/app/api/settings/printer/test/route.ts  # POST (imprime ticket de prueba)
src/app/admin/ajustes/page.tsx          # server component
src/app/admin/ajustes/printer-form.tsx  # client: host, port, Guardar, Imprimir prueba
src/app/admin/layout.tsx                # + link "Ajustes"
src/app/api/orders/[id]/print-{kitchen,bill}/route.ts  # usan loadPrinterConfig
```

## API

| Método y ruta | Cuerpo | Respuesta |
|---|---|---|
| `GET /api/settings/printer` | — | `200 { ok, data: { host, port } }` (los guardados, o los del env si no hay en DB) |
| `PUT /api/settings/printer` | `{ host, port }` | `200` guardado · `400` validación (`message` en español) |
| `POST /api/settings/printer/test` | `{ host, port }` | `200 { ok }` imprimió · `400` validación · `502` no se pudo conectar |

Las tres exigen sesión (middleware) y responden `409` si `DB_DRIVER` no es `pglite`.

El test usa **un intento y timeout corto** (no los 3 reintentos del print-service): el operador espera frente a la pantalla y tres reintentos con backoff retrasan el error.

## Pruebas (TDD)

| Capa | Qué |
|---|---|
| Unit core | `parsePrinterSettings`: IPv4 válida, hostname, vacío = desactivada, puerto por defecto, rechaza `http://x`, `1.2.3.4:9100`, espacios, puerto 0 y 70000. `renderTestTicket` empieza con init y termina con corte. |
| Integration (PGlite) | Repo: guardar y leer; `loadPrinterConfig`: DB gana sobre env, clave vacía desactiva, sin DB cae al env. Rutas: 400, 409 en postgres, 502 contra un puerto cerrado y 200 contra un servidor TCP local que captura los bytes. |
| Manual en el `.exe` | Mismo método de la verificación del 2026-11-03 (CDP): levantar un listener TCP en `127.0.0.1:9100` que captura bytes, configurar `127.0.0.1` desde `/admin/ajustes`, crear un pedido y comprobar `printed: "server"` y que el listener recibió ESC/POS. Repetir con el listener apagado → `502`. |

Sin mocks: el transporte real contra un servidor TCP local, y `createFakeTransport` donde ya se usa.

## Criterio de cierre de DT-047 (porción impresora)

En el `.exe` se configura la IP desde `/admin/ajustes` sin reiniciar, **Imprimir prueba** funciona, y `POST /api/orders/:id/print-kitchen` responde `printed: "server"` con los bytes llegando a la impresora (o al listener de prueba).

## Fuera de alcance (v2, [ADR 0005](../../decisions/0005-alcance-v1-desktop.md))

`BUSINESS_*`, `WHATSAPP_*`, dos impresoras (cocina y cuenta separadas), impresoras USB o por spooler de Windows, descubrimiento automático en la red, elegir codepage, cajón de dinero.
