# Runbook — detección de USB en el `.exe` sin `drivelist`

**Fecha:** 2026-11-03
**Rama:** `feat/desktop-usb-sin-drivelist` (tareas 1-5 del [plan](../superpowers/plans/2026-11-03-desktop-v1-02-usb-sin-drivelist.md))
**Resultado:** el código y la capa de servidor están verificados. **Falta la verificación con hardware (la hace el usuario) y no se pudo ejecutar el `.exe` empaquetado en esta PC** (ver "Bloqueo").

## Qué se verificó (sin hardware)

| # | Paso | Resultado | Evidencia |
|---|---|---|---|
| 1 | `pnpm electron:dist` **sin** `npmRebuild: false` | ✅ | exit 0; `@electron/rebuild` corre limpio; `dist-standalone/vendor` ya no contiene `drivelist` |
| 2 | `pnpm test` (unit + integration) | ✅ | 355 verdes + 1 skipped |
| 3 | `SESSION_SECRET= DB_DRIVER= pnpm test:unit` (condiciones de CI) | ✅ | 197 verdes + 1 skipped |
| 4 | `pnpm build` y `pnpm audit --audit-level=high` | ✅ | 5 avisos moderate, ninguno high (iguales a antes) |
| 5 | Script CIM real ejecutado por `execFile` desde Node | ✅ | test de integración: JSON parseable y el disco del sistema no se ofrece |
| 6 | Bundle standalone recién construido, con `node` y el entorno del `.exe` (`DB_DRIVER=pglite`, `NODE_PATH=vendor`…): setup → `GET /api/backup` | ✅ | 200, solo `folder`; **1137 ms** en frío y **892 ms** la segunda (>300 ms: PowerShell se ejecutó) |
| 7 | `POST /api/backup` y `POST /api/backup/restore` | ✅ | escribe en la carpeta sin fallos; valida el dump |
| 8 | `/admin/backup` renderiza | ✅ | 200, "Carpeta sincronizada", ningún `USB (` |
| 9 | Log del server | ✅ | sin `drivelist`, sin "PowerShell no disponible", sin "No se pudo leer la lista de unidades" |

Coste: cada listado de destinos lanza un PowerShell (≈0,9-1,1 s medidos dentro del server). Abrir `/admin/backup` o crear/validar un backup tarda ~1 s más que antes.

## Bloqueo: Smart App Control impide ejecutar el `.exe` sin firmar

Al lanzar `dist\win-unpacked\Sistema de Pedidos.exe` Windows lo bloqueó: desde bash (código 126) y con `Start-Process` ("Una directiva de Control de aplicaciones bloqueó este archivo"). Evento 3077 de Code Integrity: el binario "no cumple los requisitos de nivel de firma Enterprise o viola la política"; `Get-AuthenticodeSignature` → `NotSigned`; `VerifiedAndReputablePolicyState = 1` (**Smart App Control activo**).

Los `.exe` anteriores de esta misma carpeta sí arrancaron hoy (verificaciones de la impresora), así que el bloqueo no es nuevo en el código sino de reputación/política del binario recién generado. **No se desactivó ni se esquivó la protección.** Por eso el paso 6 usa el servidor standalone con `node`: cubre la capa que cambió (PowerShell desde el server, rutas de backup) pero **no** el shell de Electron ni el empaquetado final.

Implicación para la entrega: sin firma de código ([DT-014](../deuda-tecnica.md)), cualquier PC con Smart App Control o una política de Control de aplicaciones puede negarse a ejecutar el instalador y la app. Ver DT-050.

## Verificación de hardware (pendiente — usuario)

Con el `.exe` instalado y **una memoria USB**:

- [ ] Sin la memoria: `/admin/backup` solo lista "Carpeta sincronizada".
- [ ] Conectarla y recargar: aparece `USB (E:\)` (la letra que toque).
- [ ] **Crear backup**: el `.sql` está en la carpeta **y** en `E:\restaurante-backups\`.
- [ ] **Validar** el backup del USB: "Backup válido (N filas)".
- [ ] Memoria o disco con protección de escritura: **no** aparece como destino.
- [ ] Disco duro externo USB: aparece (caso `DriveType=3`).
- [ ] Retirarla y recargar: desaparece; crear backup sigue funcionando solo a carpeta.

Si el `.exe` no arranca en la PC de verificación por el bloqueo de arriba, el mismo flujo se puede comprobar con `pnpm build` + `pnpm start` (requiere `.env.local` con `DB_DRIVER=pglite`).

## Cómo reproducir los pasos 6-9

```powershell
pnpm electron:dist   # genera dist-standalone/
# desde dist-standalone: PORT=3211 HOSTNAME=127.0.0.1 NODE_ENV=production DB_DRIVER=pglite
#   DB_PATH=<dir> MIGRATIONS_PATH=<dist-standalone>\drizzle SESSION_SECRET=<32+ caracteres>
#   SESSION_COOKIE_SECURE=false BACKUP_DIR=<dir> NODE_PATH=<dist-standalone>\vendor  node server.js
```
