# 0004. Overrides de pnpm para parchear advisories de deps transitivas

- **Status:** Accepted
- **Date:** 2026-10-07
- **Deciders:** Usuario + agente

## Contexto

CI corre `pnpm audit --audit-level=high` como parte del check `verify`, requerido para mergear a `main` (branch protection). La semana del 2026-10-07 aparecieron dos advisories **high** sobre dependencias **transitivas** (no directas) que rompieron el audit **en `main`**, bloqueando todo PR — incluidos los de Dependabot, que no los cubren porque no son deps directas:

| Paquete | Advisory | Ruta | Versión parcheada |
|---------|----------|------|-------------------|
| `source-map-js` <1.2.2 | GHSA-68fv-2mgg-jv7q (DoS por event-loop) | `@tailwindcss/postcss > @tailwindcss/node` | 1.2.2 |
| `sharp` <0.35.5 | GHSA-wq5f-xc86-pv6w (CVE-2026-96889, librsvg) | `next > sharp` | 0.35.5 |

El problema no era "subir una dep directa": las versiones vulnerables las arrastra el árbol de `@tailwindcss/postcss` y `next`. Esperar a que los mantenedores upstream publiquen no desbloquea el CI ya.

## Decisión

Pinneamos las versiones parcheadas con `pnpm.overrides` en `package.json`:

```json
"pnpm": {
  "overrides": {
    "source-map-js@<1.2.2": "1.2.2",
    "sharp@<0.35.5": "0.35.5"
  }
}
```

La sintaxis con rango (`pkg@<X`) hace el override **selectivo**: solo afecta a las versiones vulnerables, deja intactas las ramas ya parcheadas por upstream si suben por encima. Es el mecanismo recomendado por pnpm para forzar una resolución transitiva sin tocar el `package.json` de los padres.

## Consecuencias

**A favor:**

- Desbloquea el CI sin esperar a upstream; el check `verify` vuelve a pasar (queda 1 advisory moderate, por debajo del umbral `high`).
- Es declarativo y versionado: cualquiera que clone obtiene las versiones seguras.
- Cuando upstream publique el fix, el override se puede borrar sin cambios de código.

**Trade-offs:**

- `sharp` es un **módulo nativo** (binarios por plataforma, usado por `next` para optimización de imágenes). Forzar la versión por encima de la que `next` declara puede romper el binario en el empaquetado real. Se verificó `pnpm build` local OK; queda vigilar en deploy.
- Los overrides **ocultan** el pin original: si se acumulan, el árbol de deps diverge de lo que los mantenedores probaron. Revisar periódicamente si siguen siendo necesarios (`pnpm why <pkg>`).
- Dependabot **no** gestiona overrides: cada advisory nuevo sobre transitivas hay que atacarlo a mano con este mismo patrón.

## Alternativas consideradas

- **Relajar el audit en CI** (`--audit-level=critical` o ignorar advisories): rechazada. Bajar el listón de seguridad para destrabar CI es el antipatrón; el audit existe justamente para forzar el fix.
- **Bumpear `next`/`@tailwindcss/postcss` a majors** que arrastren las versiones parcheadas: rechazada como primera opción. Salto de major por un advisory transitivo es desproporcionado y mete riesgo mayor; se prefiere el override quirúrgico.
- **`pnpm.auditConfig.ignoreCves`**: rechazada. Ignorar CVEs por ID no arregla la vulnerabilidad, solo silencia el reporte.
- **Esperar el fix upstream**: rechazada. Bloquea todo merge indefinidamente.
