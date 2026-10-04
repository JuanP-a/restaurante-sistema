import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output is required for the Fase 4 desktop packaging and to ship
  // the Drizzle migrations, whose runtime path is env-driven and thus invisible
  // to the file tracer without an explicit include.
  output: "standalone",
  outputFileTracingIncludes: {
    "/**": ["./drizzle/**"],
  },
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
};

export default nextConfig;
