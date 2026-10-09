# Diseño — Desktop Fase 3: backups

- **Fecha:** 2026-10-08
- **Estado:** Aprobado (diseño) — pendiente plan de implementación
- **Fase:** Desktop 3 de 5 ([plan maestro](../plans/2026-10-03-migracion-desktop.md))

## Contexto

La versión de escritorio corre el server Next contra **PGlite embebido** (Fase 1) y guarda todos los pedidos en `%APPDATA%` / `./.data/pglite`. No hay Postgres server ni backups gestionados por un proveedor: si el disco muere o el operador borra datos, no hay red de seguridad.

Esta fase implementa el **módulo de backup**: volcar la base a un dump SQL, escribirlo a una carpeta sincronizada (Drive/OneDrive/Dropbox) y a las memorias USB conectadas, rotar los viejos, y permitir **validar** que un dump es restaurable. El *swap* en vivo del `dataDir` (reemplazar la DB mientras el server corre) queda para Fase 4, cuando el shell Electron pueda reiniciar el server de forma controlada.

## Decisiones (aprobadas 2026-10-08)

| Tema | Decisión |
|---|---|
| Formato del backup | **Dump SQL portable** vía `pgDump` de `@electric-sql/pglite-tools`. Restaurable con `exec()`. |
| Restore | **Solo validación de restaurabilidad.** El dump se levanta en una PGlite temporal y se cuentan filas. El swap en vivo → Fase 4. |
| Destino USB | **Auto + opcional.** Se detectan todas las unidades removibles escribibles (`drivelist`); si no hay ninguna, el backup solo escribe la carpeta sincronizada, sin fallar. |
| Programación | **Solo manual.** Sin timer en Fase 3; el schedule/cron se decide en Fase 4 con el tray de Electron. |
| Rotación | **`BACKUP_KEEP` (default 7)** por destino. Se borran los más viejos. |
| Superficie | **API + página `/admin/backup` mínima** (listar, disparar, validar). |
| Cliente cloud (Postgres) | Sin fuente de backup (`backupSource = null`) → los endpoints devuelven **409**. La feature es exclusiva de la versión desktop. |

## Arquitectura

Separación *functional core, imperative shell*:

- **Core puro** en `src/core/backup/` (sin I/O): nombre de archivo, política de rotación, tipos/errores.
- **Puertos** en `src/infra/backup/`)
  - `BackupSource` — `dump(): Promise<Result<string, BackupError>>`. Adapter PGlite envuelve `pgDump`.
  - `BackupDestination` — `write` / `list` / `read` / `remove`, todos `Result`. Adapters: carpeta (fs) y USB (una carpeta por unidad removible).
- **`backup-service.ts`** (shell): orquesta dump → escritura multi-destino → rotación.
- **`restore-verify.ts`** (shell): valida un dump levantando una PGlite temporal in-memory.

> **Desvío del plan maestro (registrado):** el master plan ubicaba todo en `src/infra/backup/`. Los fragmentos puros (nombre + rotación) se mueven a `src/core/backup/` por la regla *functional core, imperative shell*. Los adapters y la orquestación quedan en `infra/`.

### Archivos

```
src/core/backup/
  types.ts              # BackupError, BackupFile, BackupReport, VerifyReport, Result
  filename.ts           # backupFileName(now), isBackupFileName(name)
  rotation.ts           # selectForDeletion(files, keep)
src/infra/backup/
  port.ts               # BackupSource, BackupDestination
  pglite-source.ts      # createPgliteBackupSource(client) -> pgDump
  folder-destination.ts # createFolderDestination({ id, label, dir })
  usb-destinations.ts   # resolveUsbDestinations(listDrives)
  resolve-destinations.ts # resolveDestinations({ backupDir, listDrives })
  backup-service.ts     # runBackup({ source, destinations, keep, now })
  restore-verify.ts     # verifyBackup(sql)
src/infra/db/
  types.ts              # DbHandle + backupSource?
  adapters/pglite.ts    # construye el backupSource desde el cliente crudo
  client.ts             # guarda y expone getBackupSource()
src/app/api/backup/
  route.ts              # GET (listar) + POST (disparar)
  restore/route.ts      # POST (validar)
src/app/admin/backup/
  page.tsx              # server component: lista + estado
  backup-actions.tsx    # client: botones "Crear backup" y "Validar"
```

### Puertos (contratos)

```ts
export type BackupSource = {
  dump(): Promise<Result<string, BackupError>>;
};

export type BackupDestination = {
  id: string;    // "folder" | "usb:/Volumes/UNTITLED"
  label: string; // "Carpeta sincronizada" | "USB (UNTITLED)"
  write(name: string, bytes: Uint8Array): Promise<Result<void, BackupError>>;
  list(): Promise<Result<BackupFile[], BackupError>>;
  read(name: string): Promise<Result<string, BackupError>>;
  remove(name: string): Promise<Result<void, BackupError>>;
};
```

### Config (env)

| Var | Default | Uso |
|---|---|---|
| `BACKUP_DIR` | `./.data/backups` | Ruta de la carpeta sincronizada. |
| `BACKUP_KEEP` | `7` | Backups a retener por destino (mínimo 1). |

USB y `drivelist` se resuelven en runtime, sin variable de entorno. El import de `drivelist` es **lazy** (`await import("drivelist")`) para no cargar el addon nativo en tests ni en el bundle web.

## Flujo (data flow)

**Backup (`POST /api/backup`):**
1. `getBackupSource()` → si `null`, responder **409** (`backup no soportado en modo cloud`).
2. `source.dump()` → SQL. Si falla → **502** + no se escribe nada.
3. Calcular nombre con `backupFileName(new Date())`.
4. `resolveDestinations({ backupDir, listDrives })` → carpeta sincronizada + una por USB.
5. `runBackup(...)`: escribe el dump en cada destino; por cada destino que escribió bien, `list()` → `selectForDeletion(files, keep)` → `remove()` de los viejos.
6. Responder `{ ok: true, report }` con: `written[]`, `failures[]` (éxito parcial), `rotated[]`.

**Listar (`GET /api/backup`):** por cada destino, `list()` → `{ destinations: [{ id, label, backups }] }`.

**Validar (`POST /api/backup/restore`, body `{ destinationId, name }`):**
1. Localizar destino → `read(name)` → SQL.
2. `verifyBackup(sql)`: `PGlite.create()` in-memory + `exec(sql)`, contar filas de `orders`, `products`, `categories`.
3. Responder `{ ok: true, report: { tables: [{ name, rows }] } }`.

## Contenido del dump

`pgDump` emite SQL con `--inserts` (portable). No se cifra (fuera de alcance). El nombre es `restaurante-YYYY-MM-DD-HHmm.sql` en **hora local**, ordenable lexicográficamente por construcción (campos zero-padded).

## Error handling

- `BackupError` = unión discriminada con `kind` ∈ `no_source` · `dump_failed` · `write_failed` · `read_failed` · `delete_failed` · `verify_failed`, cada variante con `message`.
- El core devuelve `Result`; los adapters traducen `try/catch` de fs y socket a `Result`.
- **Éxito parcial:** si un destino falla pero otro escribe, el backup es `Ok` con el fallo en `failures[]` (el operador lo ve; el respaldo existe en al menos un lugar).
- Si el *dump* falla, no se escribe nada → error total.
- Los handlers traducen a HTTP: 409 (sin fuente), 400 (destino/archivo inexistente), 502 (fallo de dump/verify).

## Testing

- **Unit (core puro):** `backupFileName` (fecha fija → string exacto), `isBackupFileName` (positivo/negativo), `selectForDeletion` (0/1/exactos/más-que-keep).
- **Adapter / integración:**
  - `pglite-source`: dump de una PGlite real con datos → SQL no vacío, contiene `INSERT INTO` y `CREATE TABLE`.
  - `folder-destination`: `write`/`list`/`read`/`remove` contra un `tmpdir` real (sin mocks).
  - `usb-destinations`: `resolveUsbDestinations` con lista de drives inyectada (fake) → filtra removibles escribibles, ignora sistémicas/read-only.
  - `runBackup`: fake destination in-memory + source fake → escribe a los 2 destinos, rota los viejos, reporta fallos parciales.
  - `verifyBackup`: dump de PGlite real → restaura en temporal → los conteos de tabla coinciden.
  - API: endpoints contra PGlite + carpeta temporal real; caso `no_source` → 409.
- **Sin mocks:** los fakes son implementaciones in-memory de los puertos; el resto usa infraestructura real (PGlite, fs).

## UI (`/admin/backup`)

Página **server component** que lista los backups por destino y monta un subcomponente client (`backup-actions.tsx`) para las acciones. Sigue los patrones existentes:

- Primitivas de `src/ui/` (`PageContainer`, `PageHeading`, `Card`, `Button`, `ErrorMessage`).
- **Skills aplicados:** `next-best-practices` (page server component por defecto, seam client mínimo, sin `useEffect` para datos, `Promise.all` sobre fetch de la API) y `accessibility` (elementos nativos `<button>`, labels asociadas, `aria-live="polite"` para el estado de "creando backup…", foco visible, anuncio de errores con `role="alert"`).
- Link "Backups" agregado al nav de `src/app/admin/layout.tsx`.

## Fuera de alcance (Fase 3)

- **Swap en vivo** de la base (restaurar reemplazando el `dataDir` en caliente) → Fase 4.
- **Schedule / timer / cron** → Fase 4 (tray de Electron).
- Cifrado del dump, backups incrementales, retención por fecha (no por conteo).
- Backups del modo cloud (Postgres) — el proveedor gestiona.
- Sincronización con la API de Google Drive/OneDrive (MVP usa la carpeta sincronizada del SO).
