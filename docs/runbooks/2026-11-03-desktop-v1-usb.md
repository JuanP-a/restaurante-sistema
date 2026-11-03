# Runbook — detección de USB en el `.exe` sin `drivelist`

**Fecha:** 2026-11-03
**Rama:** `feat/desktop-usb-sin-drivelist` (tareas 1-5 del [plan](../superpowers/plans/2026-11-03-desktop-v1-02-usb-sin-drivelist.md))
**Resultado:** código, capa de servidor y `.exe` empaquetado verificados sin hardware (el `.exe` en una segunda pasada, tras desactivar el usuario Smart App Control en su PC; ver "Bloqueo" y "Verificación sobre el `.exe` real"). **Falta la verificación con hardware (la hace el usuario).**

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

## Verificación sobre el `.exe` real (2026-11-03, con Smart App Control desactivado)

Mismo `dist\win-unpacked\Sistema de Pedidos.exe`, datos aislados (`--user-data-dir`), ventana real por CDP y salida del proceso capturada. **8/8**:

| Paso | Resultado | Evidencia |
|---|---|---|
| Wizard → `/admin/orders` | ✅ | |
| `GET /api/backup` → 200 solo con `folder` | ✅ | **763 ms** en frío, **605 ms** la segunda (PowerShell se ejecutó) |
| `/admin/backup` muestra "Carpeta sincronizada" y ningún `USB (` | ✅ | captura vista |
| `POST /api/backup` escribe en la carpeta sin fallos y `restore` lo valida | ✅ | |
| Log del proceso | ✅ | solo líneas de arranque de Next; sin `drivelist` ni avisos de PowerShell |

La verificación de la impresora (21 comprobaciones del [runbook de la impresora](2026-11-03-desktop-v1-impresora.md)) se repitió sobre este mismo build, con ambas funciones juntas: **21/21**.

Nota: `BACKUP_DIR` del `.exe` es `Documentos\restaurante-backups` de la cuenta real aunque se use un `--user-data-dir` aislado, así que la prueba escribió en esa carpeta (el archivo de prueba se borró). La captura confirma además el problema de [DT-023](../deuda-tecnica.md): con Windows en modo oscuro, títulos, nombres de archivo y botones de `/admin/backup` salen casi ilegibles.

## Bloqueo: Smart App Control impide ejecutar el `.exe` sin firmar

> **Actualización:** el usuario desactivó Smart App Control en su PC y el `.exe` arrancó. El bloqueo sigue vigente para cualquier equipo con el ajuste activo ([DT-050](../deuda-tecnica.md)).

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

Si el `.exe` no arranca en la PC de verificación por el bloqueo de arriba, el mismo flujo se puede comprobar ejecutando el servidor standalone sin Electron (la vía que sí se verificó): ver la sección 0 del [runbook de verificación de hardware](2026-11-03-desktop-v1-verificacion-hardware.md). `pnpm start` no se ha probado con `output: standalone`.

## Cómo reproducir los pasos 6-9

```powershell
pnpm electron:dist   # genera dist-standalone/
# desde dist-standalone: PORT=3211 HOSTNAME=127.0.0.1 NODE_ENV=production DB_DRIVER=pglite
#   DB_PATH=<dir> MIGRATIONS_PATH=<dist-standalone>\drizzle SESSION_SECRET=<32+ caracteres>
#   SESSION_COOKIE_SECURE=false BACKUP_DIR=<dir> NODE_PATH=<dist-standalone>\vendor  node server.js
```
