import { test, expect } from "@playwright/test";

test.describe("public surface", () => {
  test("health endpoint responde ok", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(typeof body.ts).toBe("number");
  });

  test("landing muestra link a login", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: /panel/i })).toBeVisible();
  });

  test("login page es pública", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test("admin redirige a login sin sesión", async ({ page }) => {
    await page.goto("/admin/orders");
    await expect(page).toHaveURL(/\/login/);
  });

  test("api protegida rechaza sin sesión", async ({ page }) => {
    const res = await page.request.get("/api/orders");
    expect([307, 401]).toContain(res.status());
  });
});
