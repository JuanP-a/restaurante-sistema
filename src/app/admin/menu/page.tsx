import type { Metadata } from "next";
import { listAllProducts, listCategories } from "@/infra/db/menu-repository";
import { PageContainer } from "@/ui/PageContainer";
import { PageHeading } from "@/ui/PageHeading";
import { ProductsList } from "./products-list";

// Server-side DB access needs DATABASE_URL at build time; skip prerender so
// `next build` in CI (no .env) doesn't blow up on env.ts Zod parse.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Productos · Restaurante",
};

export default async function AdminProductsPage() {
  const [products, categories] = await Promise.all([
    listAllProducts(true),
    listCategories(true),
  ]);

  return (
    <PageContainer width="lg">
      <PageHeading className="mb-4">Productos</PageHeading>
      <ProductsList categories={categories} products={products} />
    </PageContainer>
  );
}
