# Runbook — verificación de la config de impresora en el `.exe`

**Fecha:** 2026-11-03
**Rama:** `feat/desktop-config-impresora` (tareas 1-6 del [plan](../superpowers/plans/2026-11-03-desktop-v1-01-config-impresora.md))
**Artefacto:** `dist\win-unpacked\Sistema de Pedidos.exe` compilado con `pnpm electron:dist`
**Método:** copia aislada (`--user-data-dir` nuevo, DB virgen, sin tocar la instalación ni `%APPDATA%\restaurante-sistema`), ventana real manejada por CDP (`--remote-debugging-port=9222`). La "impresora" es un servidor TCP en `127.0.0.1:9100` que captura los bytes.

## Resultado: 21/21

| # | Paso | Resultado | Evidencia |
|---|---|---|---|
| 1 | Wizard → `/admin/orders` | ✅ | |
| 2 | `/admin/ajustes` carga; valores iniciales vacío / 9100 | ✅ | |
| 3 | Nav a 375 px: "Ajustes" alcanzable y ≥44 px | ✅ | `left 297, right 367, vw 375, h 44` |
| 4 | IP inválida (`http://192.168.1.50`) → error en español | ✅ | "La IP no es válida. Escríbela sin http:// ni puerto (ej. 192.168.1.50)" |
| 5 | **Imprimir prueba** con los valores del formulario | ✅ | "Prueba enviada: revisa el papel." |
| 6 | La impresora recibe el ticket (`ESC @`, título, corte `GS V`) | ✅ | |
| 7 | Probar **no** guarda (al recargar el host sigue vacío) | ✅ | |
| 8 | **Guardar** y persistir tras recargar | ✅ | |
| 9 | `print-kitchen` y `print-bill` → `printed: "server"` **sin reiniciar** el server | ✅ | |
| 10 | La impresora recibe 2 tickets; comanda con `PEDIDO #1` y sin `TOTAL`; cuenta con `TOTAL` | ✅ | |
| 11 | Impresora apagada: **Imprimir prueba** → "No se pudo conectar con la impresora 127.0.0.1:9100…" | ✅ | |
| 12 | Impresora apagada: `print-kitchen` → 502 | ✅ | |
| 13 | Host vacío guardado → `printed: "browser"` | ✅ | |
| 14 | Sin sesión: `GET /api/settings/printer` y `POST …/test` → 401 | ✅ | |

## Hallazgo: la página nueva es casi ilegible con Windows en modo oscuro

Capturas del run: título "Ajustes", etiquetas, texto de los campos y el botón **Imprimir prueba** salen en gris casi blanco sobre `gray-50`, y la mitad inferior de la ventana es negra. Es el bug de [DT-023](../deuda-tecnica.md): `globals.css` aplica `--foreground: #ededed` con `prefers-color-scheme: dark`, y los componentes llevan fondos fijos claros.

La verificación pasó porque se maneja el DOM por CDP, no la vista. **Un operador con Windows en modo oscuro no podría leer el formulario que debe usar para configurar la impresora.** Eso vuelve DT-023 un riesgo directo del criterio de cierre de la v1; ver el trade-off del [ADR 0005](../decisions/0005-alcance-v1-desktop.md).

## No cubierto

- **Térmica física:** solo un listener TCP; ver [DT-048](../deuda-tecnica.md). Falta confirmar 48 columnas, acentos CP850, corte y la IP fija.
- **Instalador NSIS:** se usó `win-unpacked`; no se ejecutó `Setup.exe`.
- **Tray / autostart / reinicio de Windows / QR desde celular:** siguen pendientes (v2).

## Cómo reproducir

```powershell
pnpm electron:dist
Start-Process "dist\win-unpacked\Sistema de Pedidos.exe" -ArgumentList "--user-data-dir=<dir nuevo>","--remote-debugging-port=9222"
# un servidor TCP en 127.0.0.1:9100 que acumule bytes + CDP contra http://127.0.0.1:9222/json
```
