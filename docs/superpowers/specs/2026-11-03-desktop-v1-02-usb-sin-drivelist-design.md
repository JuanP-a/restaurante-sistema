# Diseño — Desktop v1: detección de USB en el `.exe` sin `drivelist`

- **Fecha:** 2026-11-03
- **Estado:** Borrador — pendiente de aprobación del usuario
- **Fase:** v1 de escritorio ([ADR 0005](../../decisions/0005-alcance-v1-desktop.md)), cierra [DT-018](../../deuda-tecnica.md)

## Contexto

El backup (Fase 3) escribe a la carpeta sincronizada y a las memorias USB conectadas. La detección de USB depende de `drivelist`, un addon nativo. En el `.exe` el binding no existe y el adapter degrada a `[]`: los backups van a carpeta pero **nunca a USB**.

DT-018 proponía permitir el build script de `drivelist` (`pnpm.onlyBuiltDependencies`). **Ese fix no funciona**, como se comprobó al investigarlo (2026-11-03):

- `drivelist` 12.x usa N-API y su `install` es `prebuild-install --runtime napi || node-gyp rebuild`.
- **Ningún release 12.x publica binarios:** v12.0.0, v12.0.1 y v12.0.2 tienen 0 assets en GitHub (`gh api repos/balena-io-modules/drivelist/releases`). `prebuild-install` pide `…/v12.0.2/drivelist-v12.0.2-napi-v8-win32-x64.tar.gz` y recibe 404.
- Solo queda `node-gyp rebuild`, que exige Visual Studio Build Tools + Python. No hay `cl.exe` en esta PC, `python` es el atajo de Microsoft Store, y el runner de CI tampoco los tiene para el empaquetado.

## Decisión

**Quitar `drivelist` y listar las unidades de Windows con PowerShell (CIM)**, ejecutado desde el server con un script fijo. Sin módulo nativo, sin toolchain, sin binarios que mantener.

| Tema | Decisión | Por qué |
|---|---|---|
| Plataforma | Solo Windows; en otros SO devuelve `[]` | La v1 es un `.exe` de Windows. En cloud el backup responde 409 y no lista nada. |
| Fuente | CIM (`Win32_LogicalDisk`, `Win32_DiskDrive`) | Medido en esta PC: ≈0,4 s. `Get-Disk`/`Get-Partition` tardó **8,5 s**; inviable para abrir `/admin/backup`. `wmic` está retirado en Windows 11 24H2. |
| Qué cuenta como USB | `DriveType=2` (extraíble) **o** unidad cuyo disco físico tiene `InterfaceType='USB'` | Los pendrives son `DriveType=2`, pero los discos duros USB aparecen como `DriveType=3` (fijo): sin la segunda condición se pierden. |
| Solo lectura | `Access=1` ⇒ solo lectura ⇒ se excluye | Mismo criterio que `selectUsbMounts` hoy (`!isReadOnly`). |
| Fallo | Timeout 5 s; cualquier error ⇒ `[]` + `console.warn` | El backup a carpeta no debe romperse por esto (comportamiento actual). |
| Modelo | Se conserva `DriveInfo` y `selectUsbMounts` | La costura ya existe: `resolveDestinations` recibe `listDrives: () => Promise<DriveInfo[]>`. Solo cambia el adapter. |

## Arquitectura

Functional core, imperative shell. El parseo es puro; ejecutar PowerShell es el borde.

- **Core puro** `src/core/backup/windows-drives.ts`: `parseWindowsDrives(raw: string): Result<DriveInfo[], DriveListError>`. Mapea `{ id, type, usb, access }` → `DriveInfo` (`isRemovable = type===2`, `isUSB = usb`, `isReadOnly = access===1`, `mountpoints = [{ path: "E:\\" }]`). Salida vacía o vacía-de-datos ⇒ `[]`; JSON inválido o con forma inesperada ⇒ `err`.
- **Shell** `src/infra/backup/windows-drives.ts`: `createDriveLister(run)` + `listDrives` real. `run` es el puerto `(script: string) => Promise<string>`; el real usa `execFile("powershell.exe", ["-NoProfile","-NonInteractive","-Command", SCRIPT], { timeout: 5000, windowsHide: true })`. En `process.platform !== "win32"` devuelve `[]` sin ejecutar nada.
- **Cableado:** `deps.ts` y `app/admin/backup/page.tsx` pasan `listDrives` en lugar de `listDrivesFromDrivelist`.

### Script (constante, sin entradas del usuario)

```powershell
$usb = @(Get-CimInstance Win32_DiskDrive -Filter "InterfaceType='USB'" | ForEach-Object { Get-CimAssociatedInstance -InputObject $_ -ResultClassName Win32_DiskPartition | ForEach-Object { Get-CimAssociatedInstance -InputObject $_ -ResultClassName Win32_LogicalDisk } } | ForEach-Object { $_.DeviceID })
$rows = @(Get-CimInstance Win32_LogicalDisk | Where-Object { $_.DriveType -eq 2 -or $usb -contains $_.DeviceID } | ForEach-Object { [pscustomobject]@{ id = $_.DeviceID; type = [int]$_.DriveType; usb = ($usb -contains $_.DeviceID); access = [int]$_.Access } })
ConvertTo-Json -InputObject $rows -Compress
```

Verificado (PowerShell 5.1.26100): devuelve siempre un array (`[]`, `[{…}]`, `[{…},{…}]`); sin USB conectado devuelve `[]` en ≈1 s de pared.

### Archivos

```
src/core/backup/windows-drives.ts        # parseWindowsDrives (puro)
src/core/backup/windows-drives.test.ts
src/infra/backup/windows-drives.ts       # createDriveLister + listDrives (real)
src/infra/backup/usb-destinations.ts     # - listDrivesFromDrivelist (queda DriveInfo + selectUsbMounts)
src/infra/backup/deps.ts                 # usa listDrives
src/app/admin/backup/page.tsx            # usa listDrives
package.json, pnpm-lock.yaml             # - drivelist
next.config.ts                           # - drivelist de tracing y serverExternalPackages
electron-builder.yml                     # comentario de drivelist; probar quitar npmRebuild:false
tests/integration/backup/windows-drives.test.ts   # script real (solo win32)
```

## Pruebas (TDD)

| Capa | Qué |
|---|---|
| Unit core | Pendrive (`type 2`) → extraíble; disco USB (`type 3, usb true`) → `isUSB`; disco del sistema (`type 3, usb false`) y unidad de red (`type 4`) no se seleccionan; `access 1` ⇒ solo lectura ⇒ excluido; `[]`; salida vacía; JSON inválido ⇒ `err`; un objeto suelto en vez de array no revienta. Todo con `selectUsbMounts` de punta a punta. |
| Unit shell | Con un `run` falso en memoria: devuelve las unidades parseadas; si `run` rechaza o agota el tiempo ⇒ `[]` y warning; fuera de win32 ⇒ `[]` sin llamar a `run`. |
| Integración (solo win32, `skipIf`) | Ejecuta el script **real**: no lanza, devuelve un array y tarda <5 s. No exige que haya un USB conectado. |
| Hardware | Lo hace el usuario; ver abajo. |

Sin mocks: el `run` falso es una implementación en memoria del puerto, igual que `createFakeTransport` en impresión.

## Verificación de hardware (la hace el usuario)

Con el `.exe` instalado y **una memoria USB**:

1. Sin la memoria: `/admin/backup` solo lista "Carpeta sincronizada".
2. Conectarla (recargar): aparece `USB (E:\)` (la letra que toque).
3. **Crear backup**: el archivo `restaurante-….sql` está en la carpeta **y** en `E:\restaurante-backups\`.
4. **Validar** el backup del USB: responde "Backup válido (N filas)".
5. Con el interruptor de solo lectura de la memoria (si lo tiene) o un disco USB de solo lectura: **no** aparece como destino.
6. Un disco duro externo USB: aparece (es el caso `DriveType=3` que cubre la segunda condición).
7. Retirarla y recargar: desaparece, y crear backup sigue funcionando solo a carpeta.

Estos pasos son lo único que no se puede comprobar sin hardware: el recorrido `Win32_DiskDrive → partición → unidad` solo se ejercita con un USB real.

## Riesgos

- **PowerShell restringido:** en equipos con Constrained Language Mode o AppLocker los cmdlets CIM siguen funcionando, pero un bloqueo de `powershell.exe` dejaría la lista vacía (degrada, no rompe).
- **Antivirus:** un `powershell.exe` lanzado por una app sin firmar puede levantar una alerta heurística. La app no está firmada (DT-014). Si ocurre con el cliente, se reevalúa.
- **Asociación USB no probada con hardware:** ver verificación de hardware.

## Fuera de alcance

USB en macOS/Linux, eventos de conexión en caliente (el listado es bajo demanda), unidades de red (`DriveType=4`) y ópticas (`5`), mostrar la etiqueta del volumen, cifrado de los backups.

## Alternativas rechazadas

- **Compilar `drivelist` (MSVC + Python):** sin binarios upstream (0 assets), exige toolchain en el equipo del desarrollador y en CI, y hay que recompilar en cada subida de versión.
- **Versionar un `.node` precompilado en el repo:** no se puede construir ni verificar en esta máquina, mete un binario en git y depende de que el ABI de N-API siga coincidiendo.
- **`Get-Disk` + `Get-Partition` + `Get-Volume`:** 8,5 s medidos frente a ≈0,4 s con CIM.
- **Mantener `drivelist` como dependencia opcional junto a PowerShell:** código muerto que nunca carga en el `.exe`.

## Cierre de DT-018

El criterio original ("`require("drivelist")` carga y el binario viaja en el build") deja de aplicar. Nuevo criterio: **en el `.exe`, una memoria USB conectada aparece como destino de backup y recibe el archivo** (verificado por el usuario con hardware). DT-018 se marca `Resuelta` con la desviación del fix propuesto, y [H-013](../../hallazgos.md) se actualiza.
