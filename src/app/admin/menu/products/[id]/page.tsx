"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Product } from "@/types/domain";

export default function AdminProductDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [original, setOriginal] = useState<Product | null>(null);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [desc, setDesc] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/menu/products/${id}`)
      .then((r) => r.json() as Promise<{ ok: boolean; data?: Product }>)
      .then((d) => {
        if (d.ok && d.data) {
          setOriginal(d.data);
          setName(d.data.name);
          setPrice(d.data.basePrice);
          setDesc(d.data.description ?? "");
        }
      });
  }, [id]);

  async function save() {
    if (!original) return;
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/menu/products/${original.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, basePrice: price, description: desc }),
    });
    setSaving(false);
    if (!res.ok) {
      const d = (await res.json()) as { error?: { message: string } };
      setError(d.error?.message ?? "Error");
      return;
    }
    router.push("/admin/menu");
  }

  if (!original) {
    return <div className="mx-auto max-w-2xl p-6">Cargando...</div>;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-6">
      <h1 className="text-2xl font-bold">Editar producto</h1>
      <label className="block">
        <span className="text-sm">Nombre</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded border px-3 py-2"
        />
      </label>
      <label className="block">
        <span className="text-sm">Precio base</span>
        <input
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="w-full rounded border px-3 py-2"
        />
      </label>
      <label className="block">
        <span className="text-sm">Descripción</span>
        <textarea
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          className="w-full rounded border px-3 py-2"
        />
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        onClick={save}
        disabled={saving}
        className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
      >
        {saving ? "Guardando..." : "Guardar"}
      </button>
    </div>
  );
}