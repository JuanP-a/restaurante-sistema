# 0002. Puerto de DB intercambiable (Postgres/PGlite)

- **Status:** Accepted
- **Date:** 2026-10-03
- **Deciders:** Usuario + agente

## Contexto

El sistema nace como app web sobre Postgres en la nube (ver [ADR 0001](0001-local-postgres-docker.md)). El plan de desktop (Fase 4) exige que el mismo código corra empaquetado, sin un servidor Postgres externo. Además, el ciclo de TDD de integración dependía de Docker: `docker compose up -d` antes de cada corrida, lento y frágil en máquinas sin Docker.

Necesitábamos:

- Un único punto de acceso a la DB para el código de negocio, sin acoplarlo al driver.
- Correr la misma suite de integración contra Postgres real en producción/CI y contra una DB embebida en dev/desktop.
- Que el empaquetado standalone de Next resuelva el driver embebido en Fase 4.

## Decisión

Introducimos un **puerto `Db`** (`src/infra/db/types.ts`) y adapters por motor:

```ts
export type Db = PgDatabase<NodePgQueryResultHKT | PgliteQueryResultHKT, typeof schema>;
```

El HKT es una **unión de los dos result kinds** (`NodePgQueryResultHKT | PgliteQueryResultHKT`). Usar el HKT base de `pg-core` borraría el tipo de `db.execute<T>().rows` a `unknown`; la unión preserva el tipado tanto para `node-postgres` como para `pglite`, que comparten la misma superficie `PgDatabase`.

- `src/infra/db/adapters/postgres.ts` → `createPostgresDb` (Pool de `pg`).
- `src/infra/db/adapters/pglite.ts` → `createPgliteDb` (Postgres WASM de `@electric-sql/pglite`, con `dataDir: "memory://"` para tests).
- Cada factory devuelve un `DbHandle { db, close }`: el adapter es dueño del recurso (Pool/handle PGlite) y el tipo `Db` es opaco, así que expone el `close` para liberarlo determinísticamente (tests y shutdown).

Selección por env en `src/infra/db/client.ts`:

- `DB_DRIVER=pglite` → PGlite, con `DB_PATH` (datos) y `MIGRATIONS_PATH` (carpeta que se migra en el boot).
- `DB_DRIVER=postgres` (default) → Postgres vía `DATABASE_URL`.

Ciclo de vida:

- `initDb()` se invoca en el boot (`src/instrumentation.ts`) y es **idempotente**: cachea la instancia y un **guard de promesa in-flight** evita que dos llamadas concurrentes construyan dos clientes PGlite sobre el mismo `DB_PATH` (corrompería el storage).
- `getDb()` es **fail-fast**: si se llama antes de `initDb()`, lanza error explícito. No hay lazy init escondido; el fallo es ruidoso y temprano.

Los tests de integración corren contra **PGlite in-memory** por default (`VITEST_INIT_DB=1`), sin Docker. Para parity con producción se corre con `DB_DRIVER=postgres DATABASE_URL=...`.

## Consecuencias

**A favor:**

- El core y los repos dependen solo del puerto `Db`; cambiar de motor no toca lógica de negocio.
- La suite de integración corre en milisegundos y sin infraestructura.
- Desktop y web comparten el mismo código de DB.
- El guard de concurrencia elimina una carrera real de inicialización en dev (HMR) y arranque.

**Trade-offs:**

- El `DbHandle` añade un `close` que hay que consumir en tests; el boot de larga vida no lo usa.
- El tipo union HKT es sutil: cualquier `execute()` debe tipar sus filas (`db.execute<T>`), porque el HKT no las infiere.
- PGlite no es byte-idéntico a Postgres en features avanzadas; el parity fino se valida con el test de contrato opt-in contra Postgres real.
- **Pendiente Fase 4:** `@electric-sql/pglite` no queda symlinkeado en `.next/standalone/node_modules` con el layout de pnpm. Se agregó a `outputFileTracingIncludes` en `next.config.ts`; queda verificar en el empaquetado real si la traza alcanza los assets WASM o si hay que copiarlos explícitamente.

## Alternativas consideradas

- **Usar el query-builder de Drizzle para la secuencia `nextval`** en vez de `db.execute().rows`: rechazada. El builder no tiene una forma tipada limpia de invocar `nextval('...')` sin casts; se prefirió `db.execute<{ next: string }>(sql\`SELECT nextval(...)\`)` manteniendo el `.rows` tipado. El ADR previo ya había fijado el uso de `execute().rows` en la refactorización `f9b7d42`.
- **SQLite / libSQL para dev y desktop**: rechazada. Drizzle cambia comportamiento entre dialectos (tipos, defaults, `nextval`, transacciones); PGlite conserva el mismo dialecto Postgres y evita sorpresas de parity.
- **Mockear la DB en tests de integración**: rechazada por la regla "no mocks" del proyecto. PGlite in-memory es infraestructura real.
- **Testcontainers**: descartada de nuevo por costo/velocidad; el test opt-in contra Postgres cubre el contrato del adapter real.
