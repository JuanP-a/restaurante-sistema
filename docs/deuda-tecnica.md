# Registro de deuda técnica

> Trabajo que **debemos** (código, tests, infra, docs) que no está hecho, o compromisos conscientes que tomamos por ahora. Distinto de [`hallazgos.md`](hallazgos.md): acá va lo que hay que *pagar*, no lo que *descubrimos*.
>
> **Regla de uso:** cuando un hallazgo implique trabajo pendiente, o cuando tomemos un atajo consciente, agregar una entrada. Al resolver, marcar `Resuelta` con fecha y el commit/PR — no borrar la fila (el historial importa).

**Convenciones:**

- ID `DT-NNN` incremental, nunca se reutiliza.
- Prioridad: **Alta** (bloquea o degrada calidad/seguridad), **Media**, **Baja**.
- Esfuerzo: **S** (<1h), **M** (1 día), **L** (varios días).
- Estado: `Abierta` · `En progreso` · `Aceptada` (decisión consciente, no se paga) · `Resuelta`.

---

## Índice

| ID | Área | Deuda | Prioridad | Esfuerzo | Estado | Origen |
|----|------|-------|-----------|----------|--------|--------|
| DT-001 | Tooling | Sin linter; `pnpm lint` documentado pero inexistente | Alta | S | Abierta | [H-009](hallazgos.md) |
| DT-003 | CI | Integration tests no corren en CI (solo unit) | Alta | M | Abierta | [H-008](hallazgos.md) |
| DT-009 | Dominio | Nº de pedido global, no reinicia diario (spec pedía 4 AM) | Media | M | Abierta | Plan desktop Q1 |
| DT-004 | Feature | Modificadores de menú pausados (falta UI) | Media | L | En progreso | `feature/modifiers-completion` |
| DT-005 | Feature | Import de menú: `includes`/`extras`/`optionGroups` se parsean pero no persisten | Media | M | Abierta | Import menú |
| DT-006 | Deps | Override de `sharp` (módulo nativo) — riesgo de binario en deploy | Media | S | Abierta | [ADR 0004](../decisions/0004-pnpm-overrides-advisories.md) |
| DT-007 | Seguridad | 1 advisory **moderate** residual (bajo el umbral `high`) | Baja | S | Abierta | [H-007](hallazgos.md) |
| DT-008 | Desktop | Verificar que `drizzle/` + WASM PGlite viajan en el bundle standalone | Media | S | Abierta | Fase 4 |
| DT-011 | Desktop | Cookie `secure` en HTTP intranet rompe login | Media | S | Abierta | Plan desktop R6 |
| DT-015 | Desktop | Fases desktop sin plan escrito (regla: plan antes de código) | Media | M | En progreso | Plan maestro |
| DT-016 | Testing | Anti-doble-impresión en `/print/...` sin test automático (solo typecheck) | Media | S | Abierta | Fase 2 |
| DT-017 | API | `id` malformado (no-UUID) en rutas de pedido → 500 en vez de 404 | Baja | S | Abierta | Fase 2 |
| DT-002 | Tooling | `pnpm db:seed` documentado pero inexistente | Baja | S | Abierta | [H-009](hallazgos.md) |
| DT-010 | Tooling | Grupos de Dependabot abren 2 PRs/semana; podrían unificarse | Baja | S | Aceptada | [H-005](hallazgos.md) |
| DT-012 | Entorno | Workarounds macOS (file mode / shadow files) en volumen externo | Baja | — | Aceptada | [H-002](hallazgos.md) / [H-003](hallazgos.md) |
| DT-013 | Desktop | Adapter de impresión USB previsto, no implementado | Baja | M | Aceptada | Plan desktop (fuera de alcance) |
| DT-014 | Desktop | Sin firma de código (SmartScreen) | Baja | M | Aceptada | Plan desktop |

---

## Detalle

### DT-001 — Sin linter

- **Qué:** no hay ESLint/Biome instalado ni script `lint`. `AGENTS.md` lo documenta como si existiera.
- **Por qué importa:** las reglas del proyecto (sin `any`, sin `!`, sin `as Tipo`, sin `console.log`, boundaries de capas) dependen de que un humano las recuerde. Deberían ser mecánicas.
- **Fix propuesto:** ESLint flat config (o Biome) + reglas de `mechanical-enforcement`; wire en `hk`/pre-commit y en CI `verify`.
- **Criterio de cierre:** `pnpm lint` existe, corre en CI, y `AGENTS.md` deja de mentir.

### DT-003 — Integration tests fuera de CI

- **Qué:** `verify` corre solo `pnpm test:unit`.
- **Por qué importa:** repos, adapters y API routes pueden regresar sin que CI lo detecte.
- **Fix propuesto:** job con PGlite in-memory (no requiere Docker) o service container Postgres + provisioning de env vars de test.
- **Criterio de cierre:** `pnpm test:integration` verde dentro de `verify`.

### DT-009 — Nº de pedido no reinicia diario

- **Qué:** `nextval('orders_sequential_number_seq')` es global y monótono; el spec pedía reset diario a las 4:00 AM.
- **Por qué importa:** en operación diaria los números crecen indefinidamente; el cliente espera "pedido #1" cada mañana.
- **Fix propuesto:** `MAX(sequential_number)+1 WHERE date = HOY` (recomendado en el plan) o reset programado. Decidir en Fase 1 de secuencia desktop.
- **Criterio de cierre:** número reinicia por día; test que cubre el borde de medianoche.

### DT-004 — Modificadores de menú pausados

- **Qué:** core + repo + API de ingredientes hechos en `feature/modifiers-completion`; falta UI y el resto.
- **Por qué importa:** es una feature de spec sin terminar; el import de menú ya parsea `optionGroups` que dependen de esto (ver DT-005).
- **Criterio de cierre:** feature completa y mergeada, o spec actualizado para sacarla de alcance.

### DT-005 — Import no persiste `includes`/`extras`/`optionGroups`

- **Qué:** `parseMenuImport` los valida/parsea pero `importMenu` no los guarda.
- **Por qué importa:** el menú importado queda incompleto hasta que existan los modificadores (DT-004).
- **Criterio de cierre:** persistencia de grupos/opciones o nota explícita en el spec de que quedan fuera.

### DT-006 — Override de `sharp`

- **Qué:** `pnpm.overrides` fuerza `sharp@0.35.5` por encima de lo que declara `next`.
- **Por qué importa:** `sharp` es nativo (binarios por plataforma); el empaquetado real podría romper.
- **Fix propuesto:** revisar en cada deploy; borrar el override cuando upstream suba la versión parcheada.
- **Criterio de cierre:** override eliminado sin que vuelva el advisory.

### DT-015 — Fases desktop sin plan escrito

- **Qué:** el proyecto exige spec/plan antes de implementar. Fase 2 (impresión ESC/POS) ya tiene spec + plan y está implementada; **Fases 3 (backup), 4 (Electron) y 5 (túnel WhatsApp) siguen sin plan**.
- **Criterio de cierre:** plan por fase en `docs/superpowers/plans/` antes de tocar código.

### DT-016 — Anti-doble-impresión sin test automático

- **Qué:** el gate de las páginas `/print/[id]/{kitchen,bill}` (`window.print()` solo si `printed === "browser"`) se verifica únicamente con `pnpm typecheck`. Una regresión que quite la condición pasaría desapercibida.
- **Por qué importa:** es exactamente la regresión que la Fase 2 evita (doble impresión en desktop).
- **Fix propuesto:** E2E Playwright que afirme que NO se llama `window.print()` cuando la respuesta es `printed:"server"`, o extraer el predicado a una función pura testeable.
- **Criterio de cierre:** test que falle si el gate desaparece.

### DT-017 — `id` malformado en rutas de pedido → 500

- **Qué:** `getOrder(id)` con un id no-UUID llega a Postgres y explota con `invalid input syntax for type uuid` → 500 en vez de 404. Pre-existente, aplica a todas las rutas de pedido (no solo impresión).
- **Fix propuesto:** validar/parsear el id en el borde (`src/infra/db/order-repository.ts` o el handler) antes de tocar la DB.
- **Criterio de cierre:** id no-UUID → 404.

### DT-010 / DT-012 / DT-013 / DT-014 — Aceptadas

Compromisos conscientes que no se pagan ahora:

- **DT-010:** dos PRs de Dependabot/semana es tolerable; se unifica si molesta.
- **DT-012:** los workarounds de macOS son del entorno del dev, no del producto; se documentan en `AGENTS.md` y se vive con ellos.
- **DT-013:** impresión USB fuera de alcance (MVP usa térmica de red ESC/POS).
- **DT-014:** sin firma de código (1 cliente); se revisa al escalar.
