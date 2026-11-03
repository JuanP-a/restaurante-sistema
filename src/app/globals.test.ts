// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const css = readFileSync(join(__dirname, "globals.css"), "utf8");

// La UI usa fondos y textos claros fijos (bg-white, text-gray-*) sin variantes `dark:`.
// Con un tema oscuro del SO, `--foreground` pasaba a #ededed sobre fondos claros y el
// texto quedaba casi invisible (DT-023, H-016). Hasta migrar a tokens, la app es solo clara.
describe("tema", () => {
  test("la app fija el tema claro", () => {
    expect(css).toMatch(/color-scheme:\s*light/);
  });

  test("no cambia de colores con el tema oscuro del sistema", () => {
    expect(css).not.toMatch(/prefers-color-scheme:\s*dark/);
  });
});
