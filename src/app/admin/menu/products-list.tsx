"use client";
import Link from "next/link";
import { useState } from "react";
import type { Category, Product } from "@/types/domain";
import { Button } from "@/ui/Button";
import { CardList, CardListItem } from "@/ui/Card";

export function ProductsList({
  categories,
  products,
}: {
  categories: Category[];
  products: Product[];
}) {
  const [showInactive, setShowInactive] = useState(true);
  const [current, setCurrent] = useState<Product[]>(products);

  async function toggle(p: Product): Promise<void> {
    await fetch(`/api/menu/products/${p.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ active: !p.active }),
    });
    setCurrent((prev) =>
      prev.map((x) => (x.id === p.id ? { ...x, active: !x.active } : x)),
    );
  }

  const visible = showInactive
    ? current
    : current.filter((p) => p.active);

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
          />
          Mostrar agotados
        </label>
      </div>
      {categories.map((cat) => {
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
                    onClick={() => void toggle(p)}
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
    </>
  );
}
