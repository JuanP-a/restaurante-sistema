"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Category, Product } from "@/types/domain";

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [showInactive, setShowInactive] = useState(true);

  async function load() {
    const [p, c] = await Promise.all([
      fetch("/api/menu/products").then((r) => r.json() as Promise<{ data: Product[] }>),
      fetch("/api/menu/categories").then((r) => r.json() as Promise<{ data: Category[] }>),
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

  const visible = showInactive ? products : products.filter((p) => p.active);

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Productos</h1>
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
            <ul className="divide-y rounded border bg-white">
              {items.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between p-3"
                >
                  <Link
                    href={`/admin/menu/products/${p.id}`}
                    className="flex-1 underline-offset-2 hover:underline"
                  >
                    {p.name} — ${p.basePrice}
                  </Link>
                  <button
                    onClick={() => toggle(p)}
                    className={`rounded px-3 py-1 text-xs ${
                      p.active
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-200 text-gray-600"
                    }`}
                  >
                    {p.active ? "DISPONIBLE" : "AGOTADO"}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}