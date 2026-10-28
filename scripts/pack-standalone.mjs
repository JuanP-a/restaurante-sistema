// electron-builder no sigue los junctions con los que pnpm enlaza
// node_modules en .next/standalone, y además ignora cualquier `node_modules`
// dentro de extraResources. Copiar el layout de pnpm tal cual tampoco sirve:
// `next` vive en .pnpm/next@x/node_modules/next y resuelve sus hermanos
// (@swc/helpers) desde ese mismo directorio.
//
// Este paso arma un `vendor/` hoisted y autocontenido. Ojo: el store de pnpm
// tiene entradas "parciales" (solo package.json) para resolver peers, así que
// de cada paquete se elige la entrada más completa, no la primera.
// El shell pasa `vendor` al server hijo vía NODE_PATH.
import { cp, readdir, rename, rm } from "node:fs/promises";
import { join } from "node:path";

const SRC = ".next/standalone";
const DEST = "dist-standalone";

async function listDir(path) {
  try {
    return await readdir(path);
  } catch {
    return null;
  }
}

async function collectBest(vendor, pnpmDir) {
  const best = new Map();

  async function consider(key, from) {
    const entries = await listDir(from);
    if (entries === null) return;
    const weight = entries.length;
    const previous = best.get(key);
    if (!previous || weight > previous.weight) best.set(key, { from, weight });
  }

  for (const entry of await readdir(pnpmDir)) {
    const storeModules = join(pnpmDir, entry, "node_modules");
    const names = await listDir(storeModules);
    if (names === null) continue;
    for (const name of names) {
      if (name.startsWith(".")) continue;
      const base = join(storeModules, name);
      if (name.startsWith("@")) {
        const scoped = (await listDir(base)) ?? [];
        for (const sub of scoped) await consider(`${name}/${sub}`, join(base, sub));
      } else {
        await consider(name, base);
      }
    }
  }

  return best;
}

await rm(DEST, { recursive: true, force: true });
await cp(SRC, DEST, { recursive: true, dereference: true });

const vendor = join(DEST, "vendor");
await rm(vendor, { recursive: true, force: true });
await rename(join(DEST, "node_modules"), vendor);

const pnpmDir = join(vendor, ".pnpm");
const best = await collectBest(vendor, pnpmDir);

for (const [key, { from }] of best) {
  const to = join(vendor, ...key.split("/"));
  await rm(to, { recursive: true, force: true });
  await cp(from, to, { recursive: true, dereference: true });
}

await rm(pnpmDir, { recursive: true, force: true });

console.log(`standalone empaquetable listo en ${DEST} (deps hoisted en vendor/)`);
