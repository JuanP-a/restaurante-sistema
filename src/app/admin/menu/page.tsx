"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Category, Product } from "@/types/domain";
import {
  CategoryListResponse,
  ProductListResponse,
} from "@/types/api-schemas";
import { Button } from "@/ui/Button";
import { CardList, CardListItem } from "@/ui/Card";
import { PageContainer } from "@/ui/PageContainer";
import { PageHeading } from "@/ui/PageHeading";

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [showInactive, setShowInactive] = useState(true);

  async function load() {
    const [p, c] = await Promise.all([
      fetch("/api/menu/products")
        .then((r) => r.json())
        .then(ProductListResponse.parse),
      fetch("/api/menu/categories")
        .then((r) => r.json())
        .then(CategoryListResponse.parse),
    ]);
    setProducts(p.data);
    setCats(c.data);
  }

  useEffect(() => {
    load();
  }, []);

  async function toggle(p: Product) {
    await fetch(`/api/menu/products/${p.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ active: !p.active }),
    });
    load();
  }

  const visible = useMemo(
    () => (showInactive ? products : products.filter((p) => p.active)),
    [products, showInactive],
  );

  return (
    <PageContainer width="lg">
      <div className="mb-4 flex items-center justify-between">
        <PageHeading>Productos</PageHeading>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
          />
          Mostrar agotados
        </label>
      </div>
      {cats.map((cat) => {
        const items = visible.filter((p) => p.categoryId === cat.id);
        if (items.length === 0) return null;
        return (
          <section key={cat.id} className="mb-6">
            <h2 className="mb-2 text-lg font-semibold">{cat.name}</h2>
            <CardList>
              {items.map((p) => (
                <CardListItem key={p.id}>
                  <Link
                    href={`/admin/menu/products/${p.id}`}
                    className="flex-1 underline-offset-2 hover:underline"
                  >
                    {p.name} — ${p.basePrice}
                  </Link>
                  <Button
                    onClick={() => toggle(p)}
                    variant={p.active ? "success" : "inactive"}
                  >
                    {p.active ? "DISPONIBLE" : "AGOTADO"}
                  </Button>
                </CardListItem>
              ))}
            </CardList>
          </section>
        );
      })}
    </PageContainer>
  );
}
