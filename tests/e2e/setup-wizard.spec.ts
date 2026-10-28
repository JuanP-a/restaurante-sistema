import { expect, test } from "@playwright/test";

// El orden importa: el primer test asume que la DB del server de E2E no tiene
// hash configurado (playwright.config arranca PGlite en memoria sin
// ADMIN_PASSWORD_HASH). El segundo setea la contraseña, así que reusa el mismo
// server: fullyParallel está en false por eso.

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

test("con el setup hecho, la landing muestra el link al panel", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: /panel/i })).toBeVisible();
});
