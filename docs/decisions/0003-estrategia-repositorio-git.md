# 0003. Estrategia de repositorio y flujo Git (monorepo, una rama)

- **Status:** Accepted
- **Date:** 2026-10-04
- **Deciders:** Usuario + agente

## Contexto

El plan de desktop ([`docs/superpowers/plans/2026-10-03-migracion-desktop.md`](../superpowers/plans/2026-10-03-migracion-desktop.md)) introduce una **segunda forma de distribuir** el mismo producto: además de la versión web/cloud (SaaS futuro), habrá una versión de escritorio (LAN, Electron, PGlite) para pequeños restaurantes de pago único. Ambas comparten el **mismo dominio**: precios, state machines del pedido y del bot, validaciones, `schema`, repos.

Surgió la pregunta de cómo versionar dos variantes. La propuesta inicial era **una rama larga por variante** (`main` = core, `lan`, `web`). Se investigaron las prácticas de la industria antes de decidir.

## Decisión

**Un solo repositorio** (`JuanP-a/restaurante-sistema`), **una sola rama troncal** (`main`), flujo **GitHub Flow**. Las variantes se separan **por carpeta, no por rama**.

Estructura destino (se alcanza incrementalmente; Fase 4 crea `apps/desktop`):

```
packages/
  core/     # dominio puro (pricing, order, bot)
  db/       # puerto Db + adapters (pglite | postgres)
  ui/       # primitives compartidos
apps/
  web/      # versión cloud/SaaS
  desktop/  # versión LAN (Electron + PGlite)
```

Reglas:

- `main` siempre desplegable. Ramas de trabajo **cortas** (`feat/*`, `fix/*`, `chore/*`) con PR obligatorio y squash-merge. Sin `develop`.
- CI por path: un cambio en `apps/desktop/**` corre los tests de ese app; un cambio en `packages/core/**` corre core + sus consumidores.
- Deploy: `apps/web` desde `main`; `apps/desktop` se empaqueta por tag (`desktop-vX.Y.Z`) desde `main`.
- El **import de menú** y demás features de negocio viven en el core compartido, no duplicados por variante.

## Consecuencias

**A favor:**

- Un cambio de core y sus dos consumidores se prueba en **un solo PR atómico**.
- Sin trabajo duplicado de re-aplicar fixes a dos ramas de producto.
- Sin "merge hell": desaparece el evento de merge de semanas, principal riesgo de las ramas largas de producto.
- El core ya nace portable: Fase 1 dejó `src/core/` sin I/O y un puerto `Db` con adapters (ver [ADR 0002](0002-puerto-db-pglite.md)).

**Trade-offs:**

- El repo crece en tamaño (dos apps, shells nativos). Mitigado con CI por path.
- Requiere disciplina de ramas cortas (1–3 días) y PRs revisados; sin eso, GitHub Flow degenera.
- La migración a workspace (`packages/*`, `apps/*`) es trabajo de Fase 4, no inmediato.

## Alternativas consideradas

- **`main` = core + ramas largas `lan`/`web`**: **rechazada**. Es el anti-patrón de "long-lived feature branches": cada rama diverge de trunk, los conflictos se descubren tarde y cerca del release, y cada fix de core hay que re-aplicarlo a cada variante. MinimumCD lo lista como anti-patrón; DORA correlaciona ramas de semanas con peor performance.
- **Un repo por variante** (web / desktop): rechazada. Produce *version drift* y fixes duplicados; el core quedaría copiado en dos lugares.
- **Monorepo con multi-trunk / Mainline** (una trunk por producto): rechazada. Trunk-based-development.com advierte que "many trunks becomes undesirable"; se pierde el commit atómico entre core y consumidores.
- **GitFlow completo (develop + release + hotfix) ahora**: rechazada. Su ceremonia solo paga cuando se **soportan múltiples versiones en el mundo**; hoy hay una sola versión continua. Driessen (autor de GitFlow, 2020) recomienda un flujo más simple para web de entrega continua.

## Nota para el futuro

Cuando la versión de escritorio esté **instalada en clientes** y haya que parchear versiones antiguas, sí se justifica una **release branch por artefacto** (`release/desktop-1.x`) para hotfix del paquete desktop — con la regla de **arreglar primero en `main` y hacer cherry-pick** a la release branch. Eso es una release branch de producto, **no** de core, y **no aplica todavía**.
