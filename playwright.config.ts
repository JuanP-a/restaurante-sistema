import { defineConfig, devices } from "@playwright/test";

// El E2E corre contra un server en modo "primer arranque": sin
// ADMIN_PASSWORD_HASH y con PGlite in-memory, para que `/` gatee a `/setup` de
// forma determinista (la DB se recrea en cada arranque del server).
//
// Por qué `NODE_ENV=test`: @next/env NO carga `.env.local` cuando NODE_ENV=test
// (ver loadEnvConfig en @next/env), y ese archivo es el que trae un
// ADMIN_PASSWORD_HASH en dev. Sin esta variable, el server arrancaría ya
// configurado y el wizard nunca se mostraría. El resto de las vars requeridas
// (SESSION_SECRET) se pasan explícitas porque `.env.local` queda fuera.
//
// Por qué el puerto 3100: no colisiona con un `pnpm dev` normal en :3000.
const E2E_PORT = "3100";

export default defineConfig({
  testDir: "./tests/e2e",
  testIgnore: ["**/._*"],
  fullyParallel: false,
  retries: 0,
  timeout: 60_000,
  use: {
    baseURL: `http://localhost:${E2E_PORT}`,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "pnpm dev",
    url: `http://localhost:${E2E_PORT}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: {
      NODE_ENV: "test",
      PORT: E2E_PORT,
      DB_DRIVER: "pglite",
      DB_PATH: "memory://",
      MIGRATIONS_PATH: "./drizzle",
      SESSION_SECRET: "e2e-playwright-secret-at-least-32-chars-long",
      // LAN HTTP: el cookie no se guardaría con `Secure` y el wizard fallaría.
      SESSION_COOKIE_SECURE: "false",
      // Deliberadamente SIN ADMIN_PASSWORD_HASH → primer arranque requiere wizard.
    },
  },
});
