# Diseño — Desktop Fase 2: impresión ESC/POS server-side

- **Fecha:** 2026-10-07
- **Estado:** Aprobado (diseño) — pendiente plan de implementación
- **Fase:** Desktop 2 de 5 ([plan maestro](../plans/2026-10-03-migracion-desktop.md))

## Contexto

La Fase 6 (web) imprime **desde el navegador**: las páginas `/print/[id]/kitchen` y `/print/[id]/bill` cargan el pedido, llaman a `POST /api/orders/[id]/print-{kitchen,bill}` (que solo registra el evento `printed_kitchen`/`printed_bill`) y luego invocan `window.print()`. Eso requiere que la impresora térmica esté instalada como impresora del sistema y que el operador confirme el diálogo de impresión.

La versión de escritorio necesita imprimir **server-side**, directo a una impresora térmica **de red** por TCP (`IP:9100`), sin diálogo del navegador. Esta fase implementa el renderer ESC/POS y el transporte TCP, manteniendo el mismo código para la versión cloud (fallback al navegador).

## Decisiones (aprobadas 2026-10-07)

| Tema | Decisión |
|---|---|
| Integración con el flujo del browser | **Mismo endpoint con auto-detect.** Si `PRINTER_HOST` está configurado → ESC/POS server-side; si no → comportamiento actual (registra evento, imprime el navegador). |
| Acentos | **Codepage CP850** con mapa puro UTF-8 → bytes. Se selecciona el codepage en la impresora. |
| Fallo de impresión | **Reintentos con backoff + error al operador.** Si falla, `502` y evento `print_failed`. |
| Impresoras | **1 impresora** para ambos tickets. Seam por si luego son 2. |
| Corte / cajón | **Corte completo** (`GS V`) al final. **Sin** kick de cajón (no se gestiona efectivo). |
| Ancho | **48 columnas** (80 mm, Font A). |

## Arquitectura

- **Renderer puro** en `src/core/printing/` (sin I/O): pedido → `Uint8Array` ESC/POS.
- **Puerto `PrintTransport`** en `src/infra/printer/`: `send(bytes) → Promise<Result<void, PrintError>>`.
- **Adapters**: `tcp.ts` (a `HOST:PORT`), `fake.ts` (captura bytes para tests).
- **`print-service.ts`** (shell imperativo): orquesta render → transport → reintentos → eventos.
- **Selección por env**: `PRINTER_HOST` set → server-side; ausente → browser fallback.

> **Desvío del plan maestro (registrado):** el master plan ubicaba el renderer en `src/infra/printer/escpos.ts`. Se mueve a `src/core/printing/` por la regla *functional core, imperative shell* (el renderer es puro). El transport sí queda en `infra/`.

### Archivos

```
src/core/printing/
  cp850.ts            # mapa UTF-8 → CP850 (é, ñ, ¿, ¡, á, ú, ü…)
  escpos-bytes.ts     # comandos: init, align, bold, size, feed, cut
  render-ticket.ts    # renderKitchenTicket / renderBillTicket → Uint8Array
src/infra/printer/
  transport.ts        # puerto PrintTransport + PrintError
  tcp.ts              # createTcpTransport({ host, port })
  fake.ts             # createFakeTransport()
  print-service.ts    # printOrder(id, kind) → Result<PrintOutcome, PrintError>
```

### Config (env)

| Var | Default | Uso |
|---|---|---|
| `PRINTER_HOST` | *(vacío)* | IP/hostname de la térmica. Ausente = browser fallback. |
| `PRINTER_PORT` | `9100` | Puerto raw ESC/POS. |

Reintentos y timeout son **constantes de código** (no env), por YAGNI: 3 intentos, backoff 250/500/1000 ms, timeout 3 s por intento.

## Flujo (data flow)

1. `POST /api/orders/[id]/print-{kitchen,bill}` carga el pedido (`getOrder`).
2. `printOrder(id, kind)` → render → `transport.send(bytes)` con reintentos.
3. **Éxito** → inserta evento `printed_kitchen`/`printed_bill` + responde `{ ok: true, printed: "server" }`.
4. **Fallo** → inserta evento `print_failed` + responde **502** `{ ok: false, error }`.
5. **Sin `PRINTER_HOST`** → inserta evento + responde `{ ok: true, printed: "browser" }`.

**Detalle clave:** las páginas `/print/[id]/…` hoy ejecutan `window.print()` siempre. Se ajustan para imprimir por navegador **solo si `printed === "browser"`**, evitando doble impresión en desktop.

## Contenido de los tickets

- **Comanda (cocina):** `LOCAL`/`DOMICILIO`, `PEDIDO #N`, fecha-hora, por ítem `Nx nombre` con `- sin X` / `+ extra Y`, notas. **Sin precios.**
- **Cuenta (cliente):** nombre/dirección/teléfono del negocio, `LOCAL`/`DOMICILIO`, `PEDIDO #N`, fecha-hora, dirección de entrega si aplica, por ítem `Nx nombre  $itemTotal` con extras, `SUBTOTAL`/`ENVIO`/`TOTAL`.

Alineación a 48 columnas: totales alineados a la derecha; nombres largos truncados con `…`.

## Error handling

- `PrintError` = unión discriminada: `not_configured` · `timeout` · `connection` · `io`.
- El core devuelve `Result`; el servicio decide reintentos; el handler traduce a HTTP (502 en fallo de impresión).
- `not_configured` no es error de operación: dispara el fallback al navegador.

## Testing

- **Unit (core puro):** mapa CP850 (acentos), bytes ESC/POS exactos, render comanda (sin precios, con `removed`/`extra`), render cuenta (con precios, subtotal/envío/total), alineación a 48 cols, truncado.
- **Adapter contract:** fake captura bytes; `tcp` contra un `net.createServer` real → assert de bytes recibidos.
- **Servicio:** reintenta ante fallo, respeta timeout, hace fallback si no configurado, emite evento en éxito y en fallo.
- **Integration:** endpoint con fake → 200 + evento; impresora caída → 502 + `print_failed`.
- **Sin mocks:** el fake es una implementación in-memory del puerto; el adapter TCP usa infraestructura real.

## Fuera de alcance (Fase 2)

- Transporte **USB** (adapter previsto, no implementado).
- **2 impresoras** (diseño deja el seam).
- Logo/imagen, kick de cajón, auto-update.
- Cambios al contenido de los tickets más allá del renderer ESC/POS.
