import { expect, test, type Page } from "@playwright/test";

// El operador toma pedidos desde el celular, así que se fija el viewport de un
// teléfono chico y se vigilan las tres cosas que lo hacían inusable: columnas
// aplastadas, nav desbordando la página y controles de <44px.

test.use({ viewport: { width: 375, height: 667 }, hasTouch: true });

const PASSWORD = "clave-e2e";

// Autónomo respecto a setup-wizard.spec.ts: en la DB en memoria del server de
// E2E el primer login llegó a responder 409 setup_required aun después del
// wizard. /api/setup deja la sesión abierta si la DB está virgen; si ya estaba
// configurada (409), se entra por login. Se evita el formulario: el login por
// UI se quedaba en /login en la primera carga en frío del dev server.
async function entrar(page: Page): Promise<void> {
  const setup = await page.request.post("/api/setup", { data: { password: PASSWORD } });
  if (setup.ok()) return;
  const login = await page.request.post("/api/admin/login", { data: { password: PASSWORD } });
  expect(login.ok(), `${login.status()} ${await login.text()}`).toBeTruthy();
}

async function alturaMinima(page: Page, selector: string): Promise<number> {
  const alturas = await page
    .locator(selector)
    .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().height));
  return Math.min(...alturas);
}

test("nuevo pedido no desborda horizontalmente en 375px", async ({ page }) => {
  await entrar(page);
  await page.goto("/admin/orders/new");
  const desborde = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(desborde).toBeLessThanOrEqual(0);
});

test("el carrito ocupa el ancho completo en vez de una columna aplastada", async ({
  page,
}) => {
  await entrar(page);
  await page.goto("/admin/orders/new");
  const ancho = await page
    .locator("form")
    .first()
    .evaluate((el) => el.getBoundingClientRect().width);
  expect(ancho).toBeGreaterThan(300);
});

test("el nav principal tiene enlaces tocables (>=44px)", async ({ page }) => {
  await entrar(page);
  await page.goto("/admin/orders/new");
  const min = await alturaMinima(page, 'nav[aria-label="Navegación principal"] a');
  expect(min).toBeGreaterThanOrEqual(44);
});
