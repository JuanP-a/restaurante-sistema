"use client";
import { useEffect, useState } from "react";
import type { Category } from "@/types/domain";
import { Button } from "@/ui/Button";
import { CardList, CardListItem } from "@/ui/Card";
import { ErrorMessage } from "@/ui/ErrorMessage";
import { Input } from "@/ui/Input";
import { PageContainer } from "@/ui/PageContainer";
import { PageHeading } from "@/ui/PageHeading";

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
      const d = await r.json();
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
    <PageContainer width="lg">
      <PageHeading className="mb-4">Categorías</PageHeading>
      <div className="mb-4 flex flex-wrap items-start gap-2">
        <Input
          name="name"
          placeholder="Nueva categoría"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Button onClick={add} disabled={loading}>
          Agregar
        </Button>
        {error && (
          <div className="basis-full">
            <ErrorMessage>{error}</ErrorMessage>
          </div>
        )}
      </div>
      <CardList>
        {items.map((c) => (
          <CardListItem key={c.id}>
            <span className={c.active ? "" : "text-gray-400 line-through"}>
              {c.name}
            </span>
            <div className="flex gap-2">
              <Button onClick={() => toggle(c)} variant="link">
                {c.active ? "Desactivar" : "Activar"}
              </Button>
              <Button onClick={() => remove(c.id)} variant="link" className="text-red-600">
                Eliminar
              </Button>
            </div>
          </CardListItem>
        ))}
      </CardList>
    </PageContainer>
  );
}
