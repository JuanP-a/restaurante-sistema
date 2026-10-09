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
