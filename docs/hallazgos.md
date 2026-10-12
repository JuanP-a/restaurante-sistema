# Registro de hallazgos

> Descubrimientos sobre **cómo se comporta** el proyecto, el entorno o las herramientas. La sorpresa (lo que esperábamos vs. lo que pasó) es el dato más valioso y perecedero: se anota acá antes de que se pierda.
>
> **Regla de uso:** cada vez que algo nos sorprenda (cambiamos de hipótesis, un enfoque falla, el fix no es obvio, el usuario corrige nuestra comprensión), agregar una entrada. Si el hallazgo implica trabajo pendiente, crear también una deuda en [`deuda-tecnica.md`](deuda-tecnica.md) y cruzarla.

**Convenciones:**

- ID `H-NNN` incremental, nunca se reutiliza.
- Una entrada por hallazgo, la más reciente arriba.
- Si el hallazgo ya está documentado en un ADR o en `AGENTS.md`, enlazarlo — este registro es el índice, no la fuente única.

---

## Índice

| ID | Fecha | Hallazgo | Impacto | Documentado en |
|----|-------|----------|---------|----------------|
| H-025 | 2026-10-11 | Ventana de primer arranque: `POST /api/setup` es público mientras no hay hash; en LAN cualquiera podría reclamar el admin. Mitigado restringiendo el endpoint a host local (`localhost`/`127.0.0.1`) | Medio | [DT-047](deuda-tecnica.md) |
| H-024 | 2026-10-11 | Empaquetar con output en el volumen externo rompe el `app.asar` (offset out of range); y `makensis` es x86_64 sin Rosetta en este Mac → usar filesystem local / CI | Medio | [DT-048](deuda-tecnica.md) |
| H-023 | 2026-10-11 | `output: "standalone"` no incluye `.next/static` ni `public`; hay que empaquetarlos en `standalone/.next/static` y `standalone/public` o los assets dan 404 | Alto | Fase 4 packaging |
| H-022 | 2026-10-11 | `electron-builder` descarta el `node_modules` raíz de toda carpeta copiada (`fileMatcher`) → hay que copiar `standalone/node_modules` como `extraResources` aparte o el server crashea con `Cannot find module 'next'` | Alto | Fase 4 packaging |
| H-021 | 2026-10-11 | `validateNewOrder` no valida la *forma* de `items`/`serviceType` → 500 en vez de 400 | Medio | [DT-028](deuda-tecnica.md) |
| H-020 | 2026-10-11 | `admin_sessions` nunca se consulta: el logout no invalida tokens (HMAC stateless) | Medio | [DT-027](deuda-tecnica.md) |
| H-019 | 2026-10-11 | `verifyBackup` crea una 2ª instancia PGlite (churn) coexistiendo con la long-lived | Medio | [DT-026](deuda-tecnica.md), [H-001](#h-001--pglite-single-connection-y-concurrencia) |
| H-018 | 2026-10-11 | `runBackup` devuelve `ok` aunque no escriba en ningún destino | Alto | [DT-025](deuda-tecnica.md) |
| H-017 | 2026-10-11 | El bot fabrica `name:"x"`/`basePrice:"0"`; la confirmación sale `• 1 x` | Alto | [DT-024](deuda-tecnica.md) |
| H-016 | 2026-10-11 | Dark-mode del SO vuelve ilegible la UI (`bg-white` + `--foreground` heredado) y los tickets | Alto | [DT-023](deuda-tecnica.md) |
| H-015 | 2026-10-11 | `/admin/backup` se prerenderiza como variante cloud (falta `force-dynamic`) | Alto | [DT-022](deuda-tecnica.md) |
| H-014 | 2026-10-08 | `pglite-tools@0.4.8` fija el peer `@electric-sql/pglite@0.5.8` **exacto** | Medio | [DT-019](deuda-tecnica.md) |
| H-013 | 2026-10-08 | `drivelist` es addon nativo: su ausencia no debe romper el backup | Medio | [DT-018](deuda-tecnica.md) |
| H-012 | 2026-10-08 | `pgDump` vacía el `search_path` y cualifica las tablas como `public.*` | Bajo | `restore-verify.ts` |
| H-011 | 2026-10-07 | `drizzle-kit generate` lee los `._*` de `drizzle/meta` y crashea (JSON inválido) | Alto | [H-002](#h-002--volumen-externo-macos-shadow-files-) |
| H-010 | 2026-10-07 | `drizzle/meta/0001_snapshot.json` duplicado (mismo id/prevId) rompía `drizzle-kit generate` | Alto | commit `0888535` |
| H-009 | 2026-10-07 | `AGENTS.md` documenta `pnpm lint` y `pnpm db:seed` que no existen | Medio | [DT-001](deuda-tecnica.md), [DT-002](deuda-tecnica.md) |
| H-008 | 2026-10-07 | CI solo corre tests **unit**; integration queda fuera | Medio | [DT-003](deuda-tecnica.md) |
| H-007 | 2026-10-07 | Advisories de deps **transitivas** rompen el audit en `main` y bloquean todo PR | Alto | [ADR 0004](../decisions/0004-pnpm-overrides-advisories.md), `AGENTS.md` |
| H-006 | 2026-10-07 | `gh pr update-branch` en branch de Dependabot rompe `pnpm-lock.yaml` | Alto | `AGENTS.md` §Mantenimiento |
| H-005 | 2026-10-07 | Los 2 PRs de Dependabot son **por diseño** (`groups`), no un bug | Bajo | `AGENTS.md` §Mantenimiento |
| H-004 | 2026-09-13 | Next.js expande `$VAR` en `.env*` (dotenv-expand) y mutila hashes bcrypt | Alto | `AGENTS.md` §Gotcha dotenv-expand |
| H-003 | 2026-09-13 | Volumen externo macOS: cada archivo queda mode `700`; rebase/merge fallan | Alto | `AGENTS.md` §Mantenimiento file mode |
| H-002 | 2026-09-13 | Volumen externo macOS: crea shadow files `._*`; rompen vitest y `next build` | Alto | `AGENTS.md` §Mantenimiento shadow files |
| H-001 | 2026-10-03 | PGlite: 1 conexión, riesgo de crash V8 con instancias concurrentes | Medio | [Plan maestro desktop](../superpowers/plans/2026-10-03-migracion-desktop.md) R2 |

---

## Detalle

### H-025 — La ventana de primer arranque deja el setup abierto en la LAN

- **Qué esperábamos:** el wizard `POST /api/setup` solo sería alcanzable desde la ventana local del shell.
- **Qué pasó:** mientras no hay hash, el endpoint es público (está en `PUBLIC_PATHS`) y con bind a la LAN (0.0.0.0) cualquiera en la red podía reclamar el admin en esa ventana. La carrera TOCTOU ([DT-047](deuda-tecnica.md)) es un problema aparte.
- **Por qué importa:** reclamo de admin remoto en una red compartida (WiFi de un local).
- **Fix:** guard de host en el handler que rechaza (`403 forbidden_host`) todo `Host` que no sea `localhost`/`127.0.0.1`/`::1`, ya que la ventana de Electron carga `http://127.0.0.1:<puerto>`. Endurecer con `INSERT ... ON CONFLICT` (DT-047).

### H-024 — Empaquetar desde el volumen externo rompe el `app.asar`

- **Qué esperábamos:** `electron-builder` produciría el `app.asar` sin importar dónde vive el repo.
- **Qué pasó:** con el output en `/Volumes/M2 Mac/...` (APFS externo con shadow files y file mode raro) el armado del `app.asar` falla con `offset out of range`. Aparte, `makensis` es un binario x86_64 y este Mac (Apple Silicon) no tiene Rosetta → el target NSIS no se genera localmente.
- **Por qué importa:** no hay build local reproducible del `.exe`; hay que empaquetar en filesystem local (`/tmp`) o, mejor, en CI/Windows.
- **Fix:** mover el empaquetado a CI `windows-latest`; en local, trabajar desde `/tmp`. Ver [DT-048](deuda-tecnica.md).

### H-023 — El standalone no incluye `.next/static` ni `public`

- **Qué esperábamos:** `output: "standalone"` produciría un bundle autocontenido listo para servir.
- **Qué pasó:** el standalone **no** copia `.next/static` (assets del cliente) ni `public`; hay que hacerlo a mano a `standalone/.next/static` y `standalone/public`, o todas las páginas dan 404 de assets (CSS/JS/imágenes).
- **Por qué importa:** sin esto, la app empaquetada renderiza sin estilos ni JS y el wizard no funciona.
- **Fix:** copiar ambos en el script de empaquetado (commit `fix(desktop): empaqueta .next/static y public en el bundle del shell`).

### H-022 — `electron-builder` descarta el `node_modules` raíz al copiar

- **Qué esperábamos:** `extraResources: { from: .next/standalone, to: standalone }` copiaría el bundle completo, `node_modules` incluido.
- **Qué pasó:** el `fileMatcher` de electron-builder excluye el `node_modules` de **toda** carpeta copiada (política anti-duplicación de dependencias); el `standalone/node_modules` no viaja y el server crashea al arrancar con `Cannot find module 'next'`.
- **Por qué importa:** el `.exe` instalaba pero el server hijo no levantaba.
- **Fix:** copiar `standalone/node_modules` como `extraResources` **aparte** (con su propio `from/to`), no como parte del bloque de `standalone`.

### H-021 — `validateNewOrder` valida presencia, no forma

- **Qué esperábamos:** un body malformado se rechazaría con 400 (la ruta llamaba `validateNewOrder` y ya existían schemas Zod).
- **Qué pasó:** `validateNewOrder` solo chequea `!input.items || input.items.length === 0`; un `items` no-array (número/objeto) hace `items.length === undefined` → pasa, y `for (const it of body.items)` lanza `TypeError` → **500**. `serviceType` tampoco se valida contra el enum → 500 al insertar. El cast `(await req.json()) as IncomingOrder` (`api/orders/route.ts:37`) evita que `tsc` lo detecte.
- **Por qué importa:** input malformado (curl, cliente viejo) devuelve 500 en vez de 400, y la regla "parse don't validate" se confía a un chequeo de longitud.
- **Fix:** [DT-028](deuda-tecnica.md).

### H-020 — `admin_sessions` es estado muerto; el logout no invalida

- **Qué esperábamos:** la tabla `admin_sessions` autorizaría cada request y el logout la invalidaría.
- **Qué pasó:** `grep admin_sessions` da 4 hits (crear en login, borrar en logout, schema). **Nadie hace SELECT**: el middleware autoriza solo con HMAC (`verifyToken`, `middleware.ts:28`). El borrado del logout no tiene efecto.
- **Por qué importa:** un token robado sobrevive al logout hasta 7 días; hay dos fuentes de verdad para "sesión" y la persistente es decorativa.
- **Fix:** [DT-027](deuda-tecnica.md).

### H-019 — `verifyBackup` crea una segunda instancia PGlite

- **Qué esperábamos:** la validación de restaurabilidad reusaría la instancia in-process.
- **Qué pasó:** `restore-verify.ts:10` hace `new PGlite()` por llamada y `close()` al salir (churn), **coexistiendo** con la instancia long-lived (`globalThis.__db`).
- **Por qué importa:** contradice la mitigación documentada de [H-001](#h-001--pglite-single-connection-y-concurrencia) / R2 ("reusar una instancia, no crear/cerrar en churn"). Validaciones repetidas o concurrentes multiplican instancias WASM y elevan el riesgo de crash del proceso único.
- **Fix:** [DT-026](deuda-tecnica.md).

### H-018 — `runBackup` reporta éxito sin haber escrito nada

- **Qué esperábamos:** si ningún destino escribió, sería un fallo.
- **Qué pasó:** `runBackup` (`backup-service.ts:52`) devuelve `ok` con `written: []`; `http-routes.ts:71` responde 200 `ok:true` y `backup-actions.tsx` muestra "Backup creado.". El fallo queda enterrado en `failures[]`, que la UI no mira.
- **Por qué importa:** el peor fallo posible de un backup es *creer* que hay respaldo y no tenerlo (p. ej. `BACKUP_DIR` inválido y sin USB).
- **Fix:** [DT-025](deuda-tecnica.md).

### H-017 — El bot fabrica identidad de producto (`name:"x"`)

- **Qué esperábamos:** la confirmación al cliente mostraría el nombre real del producto.
- **Qué pasó:** `toBotEvent` (`webhooks/whatsapp/route.ts:165-171`) construye `product_picked` con `name: "x"`, `basePrice: "0"` (solo tiene el `id`). El precio se re-hidrata en `createOrderFromBot`, pero el **nombre** queda "x" en el carrito → el resumen de `build-reply.ts` sale `• 1 x`.
- **Por qué importa:** bug visible al cliente en el camino principal del bot, no estético.
- **Fix:** [DT-024](deuda-tecnica.md).

### H-016 — El dark-mode del SO rompe el contraste

- **Qué esperábamos:** la app está diseñada light-only; el modo oscuro del SO no la afectaría.
- **Qué pasó:** `globals.css:15-20` define `--foreground: #ededed` bajo `@media (prefers-color-scheme: dark)`; `body` hereda ese color y `Card`/páginas usan `bg-white` sin `text-*` → texto casi blanco sobre blanco. Las páginas de impresión heredan el mismo color sobre papel blanco.
- **Por qué importa:** con el SO en modo oscuro, secciones de la UI quedan invisibles y los tickets pueden salir ilegibles.
- **Fix:** [DT-023](deuda-tecnica.md).

### H-015 — `/admin/backup` se prerenderiza como variante cloud

- **Qué esperábamos:** la página evaluaría `getBackupSource()` en runtime (PGlite presente → muestra la UI).
- **Qué pasó:** `admin/backup/page.tsx` es un server component async **sin** `export const dynamic`, y `next build` (sin DB) evalúa `getBackupSource()` → `null`, horneando el branch "solo escritorio" como HTML estático. Las páginas hermanas (`orders/page.tsx:12`, `menu/page.tsx:9`) sí declaran `force-dynamic` con comentario del porqué.
- **Por qué importa:** en el `.exe` (Fase 4) el server serviría el HTML estático y el operador no podría usar backups, pese a que el endpoint sí existe.
- **Fix:** [DT-022](deuda-tecnica.md).

### H-014 — `pglite-tools` fija el peer de PGlite en versión exacta

- **Qué esperábamos:** `@electric-sql/pglite-tools` aceptaría un rango (`^0.5.8`) de PGlite.
- **Qué pasó:** su `peerDependencies` es `"@electric-sql/pglite": "0.5.8"` — pin **exacto**. Subir PGlite sin subir tools (o viceversa) rompe la instalación.
- **Por qué importa:** el `pgDump` del backup vive acá; un bump desacompasado de PGlite rompe Fase 3.
- **Fix:** subir ambos en lockstep; ver [DT-019](deuda-tecnica.md).

### H-013 — `drivelist` es un addon nativo

- **Qué esperábamos:** importar `drivelist` siempre funcionaría.
- **Qué pasó:** su build script (`prebuild-install`) es ignorado por pnpm 10 y, sin bindings, el import falla.
- **Por qué importa:** la detección de USB de los backups depende de él, pero el backup no debe caerse por su ausencia.
- **Fix:** import **lazy** en `listDrivesFromDrivelist`, que degrada a `[]` y loguea un warning. Ver [DT-018](deuda-tecnica.md).

### H-012 — `pgDump` vacía el `search_path` y cualifica `public.*`

- **Qué esperábamos:** ejecutar el dump en una PGlite nueva y consultar `SELECT count(*) FROM orders` daría el conteo.
- **Qué pasó:** el dump de `pgDump` empieza con `SELECT pg_catalog.set_config('search_path', '', false)` y crea las tablas como `public.orders`. La consulta sin cualificar falla con `relation "orders" does not exist`.
- **Por qué importa:** `verifyBackup` (validación de restaurabilidad) contaba mal y devolvía `verify_failed`.
- **Fix:** consultar cualificado (`FROM public.${name}`) en `restore-verify.ts`, con comentario del porqué.

### H-011 — `drizzle-kit` crashea con los shadow files `._*`

- **Qué esperábamos:** `pnpm drizzle:generate` solo lee `drizzle/meta/*_snapshot.json` y `_journal.json`.
- **Qué pasó:** el volumen externo macOS dejó `drizzle/meta/._0001_snapshot.json` (AppleDouble); drizzle-kit hace glob de `drizzle/meta/*.json` e intenta `JSON.parse` del binario → `SyntaxError: Unexpected token ' ', "Ma"...` (la firma "Mac OS X").
- **Por qué importa:** cualquier `drizzle:generate` falla mientras haya un `._*` en `drizzle/meta`. Es la misma clase que [H-002](#h-002--volumen-externo-macos-shadow-files-), pero golpea una herramienta distinta.
- **Fix:** `find drizzle -name '._*' -delete` antes de generar. **Extender la limpieza pre-build de AGENTS.md a `drizzle/`.**

### H-010 — Snapshot duplicado rompía `drizzle-kit generate`

- **Qué esperábamos:** `drizzle:generate` generaría la migración del enum sin drama.
- **Qué pasó:** `drizzle/meta/0001_snapshot.json` era copia **byte-idéntica** de `0000_snapshot.json` (mismo `id` y `prevId`), de cuando se agregó a mano la migración `0001_orders_sequential_number_seq.sql`. drizzle-kit abortaba: `... are pointing to a parent snapshot ... which is a collision`.
- **Fix:** asignar `id` único a 0001 y `prevId` = id de 0000 (el contenido del snapshot queda igual, porque la secuencia no está en `schema.ts`). Commit `0888535`.
- **Por qué importa:** bloqueaba **toda** generación de migraciones futuras; no era del cambio en curso.

### H-009 — Documentación drift: comandos inexistentes

- **Qué esperábamos:** `AGENTS.md` §"Comandos esperados" lista `pnpm lint` y `pnpm db:seed`.
- **Qué pasó:** ninguno existe en `package.json`; no hay linter instalado.
- **Por qué importa:** un agente/dev nuevo corre `pnpm lint` esperando enforcement de estilo y falla. Reglas que solo viven en docs no se aplican solas.
- **Acción:** [DT-001](deuda-tecnica.md) / [DT-002](deuda-tecnica.md).

### H-008 — Integration tests fuera de CI

- **Qué esperábamos:** CI corre "los tests".
- **Qué pasó:** `verify` corre solo `pnpm test:unit`. La suite de integración (contra PGlite in-memory) no corre en CI.
- **Por qué importa:** regresiones en repos/adapters/APIs pueden mergear sin detección.
- **Acción:** [DT-003](deuda-tecnica.md).

### H-007 — El audit de transitivas bloquea todo el repo

- **Qué esperábamos:** los PRs de Dependabot fallaban por sus bumps.
- **Qué pasó:** el audit fallaba **en `main`** por advisories nuevos sobre deps transitivas (`source-map-js` vía `@tailwindcss/postcss`, `sharp` vía `next`). Bloqueaba *cualquier* PR.
- **Fix:** `pnpm.overrides` con las versiones parcheadas.
- **Por qué importa:** Dependabot no cubre transitivas ni overrides; el patrón se repite cada vez que aparece un advisory.
- **Documentado en:** [ADR 0004](../decisions/0004-pnpm-overrides-advisories.md).

### H-006 — `gh pr update-branch` rompe el lock de Dependabot

- **Qué esperábamos:** `gh pr update-branch` actualizaría la branch de Dependabot sin drama.
- **Qué pasó:** el merge server-side del `pnpm-lock.yaml` produjo `ERR_PNPM_BROKEN_LOCKFILE` (duplicated mapping key). Dependabot no pudo rebasear; hubo que reemplazar a mano.
- **Por qué importa:** es una trampa no obvia. Nunca usar `gh pr update-branch` sobre branches de Dependabot.
- **Documentado en:** `AGENTS.md` §"Mantenimiento: Dependabot y el audit en CI".

### H-005 — Dos PRs de Dependabot = por diseño

- **Qué esperábamos (usuario):** "raro que levantara dos PRs".
- **Qué pasó:** `.github/dependabot.yml` define `groups: { production, development }` → un PR por grupo.
- **Acción:** si se quiere uno solo, unificar los grupos. Ver [DT-010](deuda-tecnica.md).

### H-004 — dotenv-expand mutila `$` en `.env*`

- **Qué pasó:** Next.js trata `$` en valores de `.env*` como referencia a variable y trunca (bug clásico con hashes bcrypt `$2b$10$...`).
- **Fix:** escapar cada `$` como `\$` y usar comillas dobles.
- **Documentado en:** `AGENTS.md` §"Gotcha: variables en `.env*`".

### H-003 — Volumen externo macOS: file mode `700`

- **Qué pasó:** cada archivo se escribe `rwx------`; `chmod 644` es no-op; `git status` miente; rebase/merge fallan con "local changes would be overwritten".
- **Fix:** clonar a `/tmp` (filesystem local) para rebase/merge entre branches divergentes.
- **Documentado en:** `AGENTS.md` §"Mantenimiento: file mode 700".

### H-002 — Volumen externo macOS: shadow files `._*`

- **Qué pasó:** macOS crea AppleDouble `._*`; rompen vitest (`PARSE_ERROR`) y `next build` (SWC `Loading persistence directory failed`).
- **Fix:** excluir `**/._*` del glob de tests; `find .next -name '._*' -delete` antes de build.
- **Documentado en:** `AGENTS.md` §"Mantenimiento: shadow files de macOS".

### H-001 — PGlite: single connection y concurrencia

- **Qué esperábamos:** PGlite se comportaría como Postgres para el schema/repos.
- **Qué pasó (riesgo identificado en plan):** una sola conexión serializa queries; hay un issue conocido de crash V8 con instancias concurrentes.
- **Mitigación:** 1 instancia long-lived en prod; tests reusan instancia; nunca 2 procesos sobre el mismo `dataDir`.
- **Documentado en:** [Plan maestro desktop](../superpowers/plans/2026-10-03-migracion-desktop.md) R2/R5.
