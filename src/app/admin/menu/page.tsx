import type { Metadata } from "next";
import { listAllProducts, listCategories } from "@/infra/db/menu-repository";
import { PageContainer } from "@/ui/PageContainer";
import { PageHeading } from "@/ui/PageHeading";
import { ProductsList } from "./products-list";

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
