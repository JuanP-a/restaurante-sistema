import { describe, expect, it } from "vitest";
import { parseMenuImport } from "./parse-import";

const valid = {
  categories: [
    {
      name: "Hamburguesas",
      includes: "Lechuga, jitomate",
      extras: [{ name: "Tocino", price: "10" }],
      optionGroups: [{ name: "Sabor", selection: "single", options: ["Búfalo", "BBQ"] }],
      products: [{ name: "Sencilla", basePrice: "55", description: "Carne" }],
    },
  ],
};

describe("parseMenuImport", () => {
  it("acepta un menú válido y normaliza opcionales ausentes", () => {
    const result = parseMenuImport({
      categories: [{ name: "Tortas", products: [{ name: "Cubana", basePrice: "80" }] }],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const cat = result.value.categories[0];
    expect(cat?.includes).toBe("");
    expect(cat?.extras).toEqual([]);
    expect(cat?.optionGroups).toEqual([]);
    expect(cat?.products[0]?.description).toBe("");
  });

  it("preserva includes, extras y optionGroups", () => {
    const result = parseMenuImport(valid);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const cat = result.value.categories[0];
    expect(cat?.extras).toEqual([{ name: "Tocino", price: "10" }]);
    expect(cat?.optionGroups[0]?.options).toEqual(["Búfalo", "BBQ"]);
  });

  it("rechaza input que no es objeto", () => {
    const result = parseMenuImport(null);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("not-an-object");
  });

  it("rechaza menú sin categorías", () => {
    const result = parseMenuImport({ categories: [] });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("no-categories");
  });

  it("rechaza categoría sin nombre, con path", () => {
    const result = parseMenuImport({ categories: [{ products: [] }] });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("bad-category");
    if (result.error.kind !== "bad-category") return;
    expect(result.error.path).toBe("categories[0].name");
  });

  it("rechaza producto sin nombre o precio, con path", () => {
    const result = parseMenuImport({
      categories: [{ name: "X", products: [{ basePrice: "10" }] }],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("bad-product");
  });

  it("rechaza precio no numérico o negativo con bad-price", () => {
    const result = parseMenuImport({
      categories: [{ name: "X", products: [{ name: "A", basePrice: "abc" }] }],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("bad-price");
    if (result.error.kind !== "bad-price") return;
    expect(result.error.path).toBe("categories[0].products[0].basePrice");
  });
});
