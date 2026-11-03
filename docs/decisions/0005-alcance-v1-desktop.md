# 0005. Alcance de la v1 de escritorio

- **Status:** Accepted
- **Date:** 2026-11-03
- **Deciders:** Usuario + agente

## Contexto

Tras verificar el `.exe` en Windows (Fase 4, runbook [`2026-10-28-desktop-04-verificacion-windows.md`](../runbooks/2026-10-28-desktop-04-verificacion-windows.md) y re-verificación del 2026-11-03 sobre `main` a97ea51) el producto funciona de punta a punta: wizard, pedidos, import de menú, backup/restore, LAN y QR. Queda una lista larga de deuda y features pendientes y hay que decidir qué bloquea la primera entrega.

## Decisión

La **v1** se cierra con solo dos pendientes:

| ID | Qué | Criterio de cierre |
|----|-----|--------------------|
| [DT-047](../deuda-tecnica.md) (porción impresora) | Configurar `PRINTER_HOST`/`PRINTER_PORT` desde la UI del `.exe`, persistidos en `config.json` e inyectados por `electron/main.ts` al server hijo | `print-kitchen` responde `printed: "escpos"` en el `.exe` |
| [DT-018](../deuda-tecnica.md) | `drivelist` con bindings nativos en el `.exe` | La detección de USB lista unidades en el `.exe` y el backup escribe a USB |

Todo lo demás pasa a **v2**. No se borra: sigue registrado donde ya estaba.

| Pendiente | Dónde está registrado |
|-----------|-----------------------|
| Resto de DT-047: `BUSINESS_*` (encabezado de tickets) y `WHATSAPP_*` | [DT-047](../deuda-tecnica.md) |
| Fase 5: túnel de WhatsApp (Cloudflare Tunnel). Sin plan escrito | AGENTS.md → Estado actual |
| Modificadores de menú (rama `feature/modifiers-completion` pausada) y persistencia de `includes`/`extras`/`optionGroups` | AGENTS.md, [DT-005](../deuda-tecnica.md) |
| Tema oscuro / contraste del SO | [DT-023](../deuda-tecnica.md), [H-016](../hallazgos.md) |
| Auditoría de UI: steppers de cantidad, teléfono opcional en local, contraste del verde, fuente Arial | AGENTS.md → UI móvil del admin |
| Verificación manual en el `.exe`: tray "Reiniciar servidor", autostart tras reinicio, QR desde celular, impresora térmica física | Runbook Fase 4, pasos 3, 4, 6 y 8 |
| CI sin integration ni e2e | AGENTS.md → Convenciones de testing |

## Consecuencias

**A favor:**

- La v1 queda acotada a lo que el restaurante necesita para operar: imprimir comandas en la térmica y respaldar en USB.
- Cada pendiente aplazado tiene su registro; la decisión de aplazarlo queda fechada aquí.

**Trade-offs:**

- **DT-023 se aplaza con prioridad `Alta`.** Con Windows en modo oscuro, la UI y los tickets por navegador salen con texto casi ilegible (`bg-white`/`bg-gray-50` con `--foreground` claro). Se acepta para la v1 con la premisa de que el equipo del cliente no usa modo oscuro. Si esa premisa falla, el arreglo mínimo es forzar `color-scheme: light` en `globals.css` (una línea, sin tocar los 18 archivos con colores fijos).
- Sin Fase 5, el bot de WhatsApp no funciona en la versión de escritorio.
- Los tickets salen con el nombre de negocio por defecto hasta resolver `BUSINESS_*`. Confirmar con el cliente que es aceptable antes de entregar.

## Alternativas consideradas

- **Incluir DT-023 en la v1:** rechazada por el usuario. Se considera un asunto del sistema operativo del cliente y no una funcionalidad. El trade-off de arriba deja constancia del riesgo.
- **Resolver todo DT-047 de una vez** (impresora, negocio y WhatsApp): rechazada. WhatsApp depende de la Fase 5, que no tiene plan, y no bloquea imprimir ni respaldar.

## Actualización (2026-11-03): DT-023 se mantiene

La verificación de la config de impresora ([runbook](../runbooks/2026-11-03-desktop-v1-impresora.md)) mostró que con Windows en modo oscuro `/admin/ajustes` sale casi ilegible (título, etiquetas, campos y el botón "Imprimir prueba" en gris casi blanco sobre gris claro). El usuario decidió **mantener el comportamiento actual: la app sigue el tema del sistema operativo**. DT-023 queda abierta. El riesgo es el descrito arriba y ahora está comprobado: si el equipo del cliente usa modo oscuro, el operador no podrá leer el formulario de la impresora. Arreglo mínimo si hace falta: `color-scheme: light` en `globals.css`.
