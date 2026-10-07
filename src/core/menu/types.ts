export type ImportProduct = { name: string; basePrice: string; description: string };
export type ImportExtra = { name: string; price: string };
export type ImportOptionGroup = { name: string; selection: "single"; options: string[] };
export type ImportCategory = {
  name: string;
  includes: string;
  extras: ImportExtra[];
  optionGroups: ImportOptionGroup[];
  products: ImportProduct[];
};
export type MenuImport = { categories: ImportCategory[] };

export type ImportError =
  | { kind: "not-an-object"; message: string }
  | { kind: "no-categories"; message: string }
  | { kind: "bad-category"; message: string; path: string }
  | { kind: "bad-product"; message: string; path: string }
  | { kind: "bad-price"; message: string; path: string };
