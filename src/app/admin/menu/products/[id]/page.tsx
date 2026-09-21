"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Product } from "@/types/domain";
import { ProductResponse, parseErrorMessage } from "@/types/api-schemas";
import { Button } from "@/ui/Button";
import { ErrorMessage } from "@/ui/ErrorMessage";
import { Input, Textarea } from "@/ui/Input";
import { Loading } from "@/ui/Loading";
import { PageContainer } from "@/ui/PageContainer";
import { PageHeading } from "@/ui/PageHeading";

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
      .then((r) => r.json())
      .then(ProductResponse.parse)
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
      setError(await parseErrorMessage(res));
      return;
    }
    router.push("/admin/menu");
  }

  if (!original) {
    return <Loading />;
  }

  return (
    <PageContainer width="sm" className="space-y-4">
      <PageHeading>Editar producto</PageHeading>
      <Input
        name="name"
        label="Nombre"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full"
      />
      <Input
        name="price"
        label="Precio base"
        value={price}
        onChange={(e) => setPrice(e.target.value)}
        className="w-full"
      />
      <Textarea
        name="description"
        label="Descripción"
        value={desc}
        onChange={(e) => setDesc(e.target.value)}
        className="w-full"
      />
      {error && <ErrorMessage>{error}</ErrorMessage>}
      <Button onClick={save} disabled={saving}>
        {saving ? "Guardando..." : "Guardar"}
      </Button>
    </PageContainer>
  );
}
