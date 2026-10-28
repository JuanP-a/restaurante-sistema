# Runbook — verificación de Fase 4 en Windows

**Fecha:** 2026-10-28
**Artefacto:** `Sistema de Pedidos Setup 0.1.0.exe` (NSIS, x64)
**Máquina:** Windows, `192.168.1.91`, `Documentos` redirigido a OneDrive
**Método:** instalación silenciosa (`/S`), arranque de la copia instalada y verificación por API + CDP (DevTools remoto) contra la ventana real.

## Resultado

| # | Paso | Resultado | Evidencia |
|---|---|---|---|
| 1 | Instalar `.exe` + firewall | ✅ | Instalador exit 0; 4 reglas inbound `Allow` para `sistema de pedidos.exe` |
| 2 | Primer arranque → `/setup` → contraseña → panel | ✅ | `/` responde `307 /setup`; wizard hidratado; tras guardar, URL `/admin/orders` |
| 3 | `/admin/conectar` con QR de LAN | ⚠️ parcial | Página renderiza `http://192.168.1.91:3210`; falta escanear desde un celular real |
| 4 | Imprimir comanda por ESC/POS | ⛔ bloqueado | `POST /api/orders/:id/print-kitchen` → `{"printed":"browser"}`: `PRINTER_HOST` no es configurable en el `.exe` ([DT-047](../deuda-tecnica.md)) |
| 5 | Crear backup → archivo en Documentos | ✅ | `restaurante-2026-10-28-1733.sql` (37,6 KB) en `OneDrive\Documents\restaurante-backups`; `POST /api/backup/restore` verifica `orders:1, products:75, categories:8` |
| 6 | "Reiniciar servidor" desde el tray | ⏳ pendiente | Requiere clic humano en el menú del tray |
| 7 | Cerrar ventana → sigue sirviendo la LAN | ✅ | Ventana cerrada por CDP; 4 procesos vivos; `/api/health` 200 en `127.0.0.1` y en `192.168.1.91` |
| 8 | Reiniciar Windows → autostart + login | ⏳ pendiente | Requiere marcar "Iniciar con Windows" en el tray y reiniciar |

## Extras verificados

- **Import del menú real:** `POST /api/admin/import` → 8 categorías, 75 productos (`extras: 4`, `optionGroups: 1` diferidos, [DT-005](../deuda-tecnica.md)).
- **Captura de pedidos:** dos pedidos creados en el `.exe` (seq 1 y 2), con totales calculados.
- **Persistencia:** `config.json` en `%APPDATA%\restaurante-sistema` con `sessionSecret` + `lastPort: 3210`; la DB sobrevive reinicios de la app.
- **Rotación de backups:** `BACKUP_KEEP=7` deja los archivos anteriores.

## Bugs encontrados y corregidos durante el runbook

| Bug | Síntoma | Fix |
|---|---|---|
| [H-024](../hallazgos.md) — standalone sin `.next/static` | Chunks 404 → sin hidratación; el form hacía `GET /setup?password=...` y la app "no hacía nada" | `pack-standalone.mjs` copia `.next/static` + `public` y falla si quedan vacíos |
| [H-025](../hallazgos.md) — `pg_dump` deja transacción read-only | Después del primer backup, login **500** (`cannot execute INSERT in a read-only transaction`) hasta reiniciar | `pglite-source.ts` cierra con `COMMIT` + restaura `default_transaction_read_only` en `finally` |

> El smoke test previo (health + setup + login por API) **no** detectaba H-024 porque nunca ejercitaba el JS de la ventana. Lección: verificar el `.exe` con CDP (DOM real), no solo con HTTP.

## Cómo reproducir la verificación automática

```powershell
pnpm electron:dist
Start-Process "dist\Sistema de Pedidos Setup 0.1.0.exe" -ArgumentList "/S" -Wait
Start-Process "$env:LOCALAPPDATA\Programs\Sistema de Pedidos\Sistema de Pedidos.exe" -ArgumentList "--remote-debugging-port=9222"
# luego, contra http://127.0.0.1:9222/json, manejar la ventana por CDP
```
