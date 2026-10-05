import { asc, eq } from "drizzle-orm";
import type { MenuImport } from "@/core/menu/types";
import { getDb } from "@/infra/db/client";
import {
  categories,
  products,
  type Category,
  type Product,
} from "@/infra/db/schema";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function listCategories(activeOnly = false): Promise<Category[]> {
  const db = getDb();
  const baseQuery = db.select().from(categories);
  const filtered = activeOnly
    ? baseQuery.where(eq(categories.active, true))
    : baseQuery;
  return filtered.orderBy(asc(categories.sortOrder), asc(categories.name));
}

export async function createCategory(input: {
  name: string;
  sortOrder?: number;
}): Promise<Category> {
  const db = getDb();
  const [row] = await db
    .insert(categories)
    .values({
      name: input.name,
      slug: slugify(input.name),
      sortOrder: input.sortOrder ?? 0,
    })
    .returning();
  if (!row) throw new Error("createCategory: insert returned no row");
  return row;
}

export async function updateCategory(
  id: string,
  patch: Partial<Pick<Category, "name" | "sortOrder" | "active">>,
): Promise<Category> {
  const db = getDb();
  const [row] = await db
    .update(categories)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(categories.id, id))
    .returning();
  if (!row) throw new Error(`updateCategory: category ${id} not found`);
  return row;
}

export async function deleteCategory(id: string): Promise<void> {
  const db = getDb();
  await db.delete(categories).where(eq(categories.id, id));
}

export async function listAllProducts(activeOnly = false): Promise<Product[]> {
  const db = getDb();
  const baseQuery = db.select().from(products);
  const filtered = activeOnly
    ? baseQuery.where(eq(products.active, true))
    : baseQuery;
  return filtered.orderBy(asc(products.sortOrder), asc(products.name));
}

export async function getProduct(id: string): Promise<Product | null> {
  const db = getDb();
  const [row] = await db.select().from(products).where(eq(products.id, id));
  return row ?? null;
}

export async function createProduct(input: {
  categoryId: string;
  name: string;
  basePrice: string;
  description?: string;
}): Promise<Product> {
  const db = getDb();
  const [row] = await db
    .insert(products)
    .values({
      categoryId: input.categoryId,
      name: input.name,
      basePrice: input.basePrice,
      description: input.description ?? "",
    })
    .returning();
  if (!row) throw new Error("createProduct: insert returned no row");
  return row;
}

export async function updateProduct(
  id: string,
  patch: Partial<Pick<Product, "name" | "basePrice" | "description" | "active" | "sortOrder" | "categoryId">>,
): Promise<Product> {
  const db = getDb();
  const [row] = await db
    .update(products)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(products.id, id))
    .returning();
  if (!row) throw new Error(`updateProduct: product ${id} not found`);
  return row;
}

export async function deleteProduct(id: string): Promise<void> {
  const db = getDb();
  await db.delete(products).where(eq(products.id, id));
}

export type ImportMode = "replace" | "append";
export type ImportReport = {
  categories: number;
  products: number;
  deferred: { extras: number; optionGroups: number };
};

export async function importMenu(
  menu: MenuImport,
  options: { mode: ImportMode },
): Promise<ImportReport> {
  const db = getDb();
  let categoriesCount = 0;
  let productsCount = 0;
  let extrasCount = 0;
  let optionGroupsCount = 0;

  await db.transaction(async (tx) => {
    if (options.mode === "replace") {
      // order_items referencia products; borrar products antes que categories
      // evita violar la FK de category_id en el camino.
      await tx.delete(products);
      await tx.delete(categories);
    }

    for (let i = 0; i < menu.categories.length; i++) {
      const category = menu.categories[i];
      if (!category) continue;
      const slug = slugify(category.name);

      // append es idempotente por slug: no duplica una categoría existente
      // (y con ella sus productos). Re-importar el mismo archivo es no-op.
      if (options.mode === "append") {
        const [existing] = await tx
          .select({ id: categories.id })
          .from(categories)
          .where(eq(categories.slug, slug));
        if (existing) continue;
      }

      const [created] = await tx
        .insert(categories)
        .values({ name: category.name, slug, sortOrder: i })
        .returning();
      if (!created) throw new Error(`importMenu: categoría ${category.name} no se insertó`);
      categoriesCount += 1;
      extrasCount += category.extras.length;
      optionGroupsCount += category.optionGroups.length;

      for (let j = 0; j < category.products.length; j++) {
        const product = category.products[j];
        if (!product) continue;
        await tx.insert(products).values({
          categoryId: created.id,
          name: product.name,
          basePrice: product.basePrice,
          description: product.description,
          sortOrder: j,
        });
        productsCount += 1;
      }
    }
  });

  return {
    categories: categoriesCount,
    products: productsCount,
    deferred: { extras: extrasCount, optionGroups: optionGroupsCount },
  };
}