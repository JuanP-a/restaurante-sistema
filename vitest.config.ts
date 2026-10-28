import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "happy-dom",
    globals: true,
    include: [
      "src/**/*.test.ts",
      "tests/unit/**/*.test.ts",
      "tests/integration/**/*.test.ts",
      "electron/**/*.test.ts",
    ],
    exclude: ["node_modules", ".next", "tests/e2e/**", "**/._*"],
    setupFiles: ["./vitest.setup.ts"],
    // PGlite arranca un worker WASM por test; en Windows eso pasa de los 5 s
    // por defecto (dump/restore son los más lentos).
    testTimeout: 30000,
  },
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
});