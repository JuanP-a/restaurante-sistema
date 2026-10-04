import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output is required for the Fase 4 desktop packaging and to ship
  // the Drizzle migrations, whose runtime path is env-driven and thus invisible
  // to the file tracer without an explicit include.
  output: "standalone",
  outputFileTracingIncludes: {
    // PGlite's WASM/worker assets are resolved at runtime from node_modules,
    // which the tracer can miss when pnpm's symlinked layout is flattened into
    // the standalone bundle. Include them explicitly for Fase 4 packaging.
    "/**": ["./drizzle/**", "./node_modules/@electric-sql/pglite/**"],
  },
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
};

export default nextConfig;
