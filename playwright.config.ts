import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  testIgnore: ["**/._*"],
  fullyParallel: false,
  retries: 0,
  timeout: 60_000,
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // El wizard de primer arranque solo aparece sin hash en env, y la DB tiene
    // que estar vacía: se arranca el dev server con PGlite en memoria y
    // ADMIN_PASSWORD_HASH vacío (el .env.local de dev trae uno).
    command:
      "cross-env ADMIN_PASSWORD_HASH= DB_DRIVER=pglite DB_PATH=memory:// SESSION_SECRET=e2e-e2e-e2e-e2e-e2e-e2e-e2e-e2e-e2e pnpm dev",
    url: "http://localhost:3000/api/health",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
