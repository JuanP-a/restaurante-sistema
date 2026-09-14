# 0001. Postgres local vía Docker para desarrollo

- **Status:** Accepted
- **Date:** 2026-09-13
- **Deciders:** Usuario + agente

## Contexto

El spec original menciona Postgres en Neon serverless como opción de deploy. Neon ofrece conexión HTTP/WebSocket y free tier, pero para el ciclo de desarrollo local presenta fricciones:

- Cada query contra Neon sale a internet → latencia perceptible en tests de integración y `pnpm drizzle:migrate` iterativo.
- El free tier impone límites de compute-hour y storage que cortan el flujo de trabajo en sesiones largas.
- El feedback loop de TDD se resiente cuando cada test tarda 200–500 ms en lugar de <5 ms.
- El spec nunca exige features específicas de Neon (branching, autoscaling), solo "Postgres".

## Decisión

Para desarrollo local usamos **Postgres 16 corriendo en Docker** vía `docker-compose.yml` en la raíz del repo. Conexión por defecto: `postgresql://postgres:postgres@localhost:5432/restaurante`.

Neon queda como **opción válida para deploy** (junto a Render Postgres y Railway Postgres). El Drizzle schema y los repos son portable; ningún cambio de código de producción necesario al cambiar de proveedor.

## Consecuencias

**A favor:**

- Tests unitarios del core puro siguen siendo 100% sin DB (instantáneos, como manda la regla "functional core, imperative shell").
- Tests de integración y migraciones iteran en milisegundos.
- No dependemos de red ni credenciales externas para `pnpm dev`.
- El repo es self-contained: clonar + `docker compose up -d` + `pnpm install` + `pnpm drizzle:migrate` levanta todo.
- Misma major version de Postgres (16) entre dev y prod evita sorpresas de comportamiento.

**Trade-offs:**

- Devs necesitan Docker instalado (asumido: Mac con Docker Desktop, ya estándar en el entorno).
- La versión exacta de Postgres local puede diverger de la de prod en el futuro; mitigado pineando la imagen a `postgres:16-alpine`.
- Hay que mantener el `docker-compose.yml` versionado en el repo (un archivo más, documentado en README).

## Alternativas consideradas

- **Postgres.app / homebrew postgres**: funciona, pero requiere setup manual por máquina y no es self-contained para nuevos devs.
- **SQLite para dev, Postgres para prod**: rechazada. Drizzle tiene diferencias de comportamiento (tipos, defaults, sequences) entre dialectos; queremos parity exacta con prod.
- **Neon free tier dev**: rechazada por latencia y límites mencionados arriba.
- **Testcontainers por test**: overkill para el ciclo actual. Se re-evalúa si añadimos tests de integración herméticos en CI.