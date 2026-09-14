"use client";

import { useEffect, useState } from "react";

type Category = {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  active: boolean;
};

export default function AdminCategoriesPage() {
  const [items, setItems] = useState<Category[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    const r = await fetch("/api/menu/categories");
    const d = (await r.json()) as { ok: boolean; data: Category[] };
    if (d.ok) setItems(d.data);
  }

  useEffect(() => {
    load();
  }, []);

  async function add() {
    if (!name.trim()) return;
    setError(null);
    setLoading(true);
    const r = await fetch("/api/menu/categories", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setLoading(false);
    if (!r.ok) {
      const d = (await r.json()) as { error?: { message: string } };
      setError(d.error?.message ?? "Error");
      return;
    }
    setName("");
    load();
  }

  async function toggle(c: Category) {
    await fetch(`/api/menu/categories/${c.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ active: !c.active }),
    });
    load();
  }

  async function remove(id: string) {
    if (!confirm("¿Eliminar categoría?")) return;
    await fetch(`/api/menu/categories/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="mx-auto max-w-5xl p-6">
      <h1 className="mb-4 text-2xl font-bold">Categorías</h1>
      <div className="mb-4 flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nueva categoría"
          className="rounded border px-3 py-2"
        />
        <button
          onClick={add}
          disabled={loading}
          className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
        >
          Agregar
        </button>
        {error && <span className="self-center text-sm text-red-600">{error}</span>}
      </div>
      <ul className="divide-y rounded border bg-white">
        {items.map((c) => (
          <li key={c.id} className="flex items-center justify-between p-3">
            <span className={c.active ? "" : "text-gray-400 line-through"}>
              {c.name}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => toggle(c)}
                className="text-sm text-blue-600"
              >
                {c.active ? "Desactivar" : "Activar"}
              </button>
              <button
                onClick={() => remove(c.id)}
                className="text-sm text-red-600"
              >
                Eliminar
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}