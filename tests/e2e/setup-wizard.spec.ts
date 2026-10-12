import { expect, test } from "@playwright/test";

// El server de E2E (ver playwright.config.ts) arranca en modo "primer arranque":
// PGlite in-memory sin ADMIN_PASSWORD_HASH, por lo que `/` gatea a `/setup`.
// El estado es determinista: la DB en memoria se recrea con cada arranque y
// `NODE_ENV=test` evita que @next/env cargue `.env.local` (que sí trae un hash).

test("primer arranque muestra el wizard en /setup", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/setup$/);
  await expect(page.getByLabel("Contraseña del local")).toBeVisible();
});

test("acepta una contraseña y entra al panel", async ({ page }) => {
  await page.goto("/setup");
  await page.getByLabel("Contraseña del local").fill("clave-e2e");
  await page.getByRole("button", { name: /guardar/i }).click();
  await expect(page).toHaveURL(/\/admin\/orders/);
});
