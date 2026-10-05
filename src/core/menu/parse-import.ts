import { ok, err, type Result } from "../result";
import type {
  ImportCategory,
  ImportError,
  ImportExtra,
  ImportOptionGroup,
  ImportProduct,
  MenuImport,
} from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function parsePrice(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const n = Number(value);
  if (value.trim() === "" || Number.isNaN(n) || n < 0) return null;
  return value;
}

function parseExtras(raw: unknown, categoryPath: string): Result<ImportExtra[], ImportError> {
  if (raw === undefined) return ok([]);
  if (!Array.isArray(raw)) {
    return err({
      kind: "bad-category",
      message: "extras debe ser un arreglo",
      path: `${categoryPath}.extras`,
    });
  }
  const extras: ImportExtra[] = [];
  for (let i = 0; i < raw.length; i++) {
    const item = raw[i];
    const name = isRecord(item) ? asString(item.name) : null;
    const price = isRecord(item) ? parsePrice(item.price) : null;
    if (!name || price === null) {
      return err({
        kind: "bad-category",
        message: "extra inválido",
        path: `${categoryPath}.extras[${i}]`,
      });
    }
    extras.push({ name, price });
  }
  return ok(extras);
}

function parseOptionGroups(
  raw: unknown,
  categoryPath: string,
): Result<ImportOptionGroup[], ImportError> {
  if (raw === undefined) return ok([]);
  if (!Array.isArray(raw)) {
    return err({
      kind: "bad-category",
      message: "optionGroups debe ser un arreglo",
      path: `${categoryPath}.optionGroups`,
    });
  }
  const groups: ImportOptionGroup[] = [];
  for (let i = 0; i < raw.length; i++) {
    const item = raw[i];
    const name = isRecord(item) ? asString(item.name) : null;
    const options =
      isRecord(item) && Array.isArray(item.options)
        ? item.options.filter((o): o is string => typeof o === "string")
        : null;
    if (!name || !options || options.length === 0) {
      return err({
        kind: "bad-category",
        message: "optionGroup inválido",
        path: `${categoryPath}.optionGroups[${i}]`,
      });
    }
    groups.push({ name, selection: "single", options });
  }
  return ok(groups);
}

function parseProducts(raw: unknown, categoryPath: string): Result<ImportProduct[], ImportError> {
  if (!Array.isArray(raw)) {
    return err({
      kind: "bad-category",
      message: "products debe ser un arreglo",
      path: `${categoryPath}.products`,
    });
  }
  const products: ImportProduct[] = [];
  for (let i = 0; i < raw.length; i++) {
    const item = raw[i];
    const path = `${categoryPath}.products[${i}]`;
    const name = isRecord(item) ? asString(item.name) : null;
    if (!name || name.trim() === "") {
      return err({ kind: "bad-product", message: "producto sin nombre", path: `${path}.name` });
    }
    const rawPrice = isRecord(item) ? item.basePrice : undefined;
    const price = parsePrice(rawPrice);
    if (price === null) {
      return err({ kind: "bad-price", message: "basePrice inválido", path: `${path}.basePrice` });
    }
    const description = isRecord(item) ? asString(item.description) ?? "" : "";
    products.push({ name, basePrice: price, description });
  }
  return ok(products);
}

export function parseMenuImport(raw: unknown): Result<MenuImport, ImportError> {
  if (!isRecord(raw)) {
    return err({ kind: "not-an-object", message: "El menú debe ser un objeto JSON" });
  }
  const rawCategories = raw.categories;
  if (!Array.isArray(rawCategories) || rawCategories.length === 0) {
    return err({ kind: "no-categories", message: "Debe haber al menos una categoría" });
  }

  const categories: ImportCategory[] = [];
  for (let i = 0; i < rawCategories.length; i++) {
    const item = rawCategories[i];
    const path = `categories[${i}]`;
    const name = isRecord(item) ? asString(item.name) : null;
    if (!name || name.trim() === "") {
      return err({ kind: "bad-category", message: "categoría sin nombre", path: `${path}.name` });
    }
    const extras = parseExtras(isRecord(item) ? item.extras : undefined, path);
    if (!extras.ok) return extras;
    const optionGroups = parseOptionGroups(isRecord(item) ? item.optionGroups : undefined, path);
    if (!optionGroups.ok) return optionGroups;
    const products = parseProducts(isRecord(item) ? item.products : undefined, path);
    if (!products.ok) return products;

    categories.push({
      name,
      includes: (isRecord(item) ? asString(item.includes) : null) ?? "",
      extras: extras.value,
      optionGroups: optionGroups.value,
      products: products.value,
    });
  }

  return ok({ categories });
}
