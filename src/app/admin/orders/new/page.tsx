"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { CartItem, Category, Colonia, Product } from "@/types/domain";

export default function NewOrderPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [serviceType, setServiceType] = useState<"local" | "delivery">("local");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [colonias, setColonias] = useState<Colonia[]>([]);
  const [coloniaId, setColoniaId] = useState("");
  const [overrideCost, setOverrideCost] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/menu/products?active=true").then((r) => r.json()),
      fetch("/api/menu/categories").then((r) => r.json()),
      fetch("/api/delivery-zones/colonias").then((r) => r.json()),
    ]).then(
      ([p, c, co]: [
        { data: Product[] },
        { data: Category[] },
        { data: Colonia[] },
      ]) => {
        setProducts(p.data);
        const activeCats = c.data.filter((x) => x.active);
        setCategories(activeCats);
        if (activeCats[0]) setActiveCategory(activeCats[0].id);
        setColonias(co.data ?? []);
      },
    );
  }, []);

  function addToCart(p: Product): void {
    setCart((prev) => {
      const idx = prev.findIndex(
        (i) =>
          i.productId === p.id && i.extras.length === 0 && i.removed.length === 0,
      );
      if (idx >= 0) {
        const copy = [...prev];
        const existing = copy[idx];
        if (existing) {
          copy[idx] = { ...existing, quantity: existing.quantity + 1 };
        }
        return copy;
      }
      return [
        ...prev,
        {
          productId: p.id,
          name: p.name,
          basePrice: p.basePrice,
          quantity: 1,
          extras: [],
          removed: [],
        },
      ];
    });
  }

  function removeFromCart(idx: number): void {
    setCart((prev) => prev.filter((_, i) => i !== idx));
  }

  const filteredProducts = useMemo(
    () =>
      products.filter(
        (p) =>
          (!activeCategory || p.categoryId === activeCategory) &&
          p.name.toLowerCase().includes(search.toLowerCase()),
      ),
    [products, activeCategory, search],
  );

  const subtotal = cart.reduce(
    (s, i) =>
      s +
      Number(i.basePrice) * i.quantity +
      i.extras.reduce((e, x) => e + Number(x.price), 0) * i.quantity,
    0,
  );
  const selectedColonia = colonias.find((c) => c.id === coloniaId);
  const deliveryCost = overrideCost
    ? Number(overrideCost)
    : selectedColonia
      ? Number(selectedColonia.zoneCost)
      : 0;
  const total = subtotal + deliveryCost;

  async function submit(): Promise<void> {
    setError(null);
    if (cart.length === 0) {
      setError("Agrega productos al carrito");
      return;
    }
    if (!phone.trim()) {
      setError("Falta teléfono del cliente");
      return;
    }
    if (serviceType === "delivery" && !address.trim()) {
      setError("Falta dirección de entrega");
      return;
    }
    if (serviceType === "delivery" && !coloniaId && !overrideCost) {
      setError("Selecciona colonia o captura costo manual");
      return;
    }
    setSubmitting(true);
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        serviceType,
        customerPhone: phone,
        customerName,
        deliveryAddress: serviceType === "delivery" ? address : undefined,
        deliveryColoniaId: coloniaId || undefined,
        deliveryCostOverride: overrideCost || undefined,
        notes,
        source: "staff",
        items: cart.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          removed: i.removed,
          extras: i.extras,
        })),
      }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const d = (await res.json()) as { error: { message: string } };
      setError(d.error.message);
      return;
    }
    const { data } = (await res.json()) as { data: { id: string } };
    router.push(`/admin/orders/${data.id}`);
  }

  return (
    <div className="grid h-screen grid-cols-2 gap-4 p-4">
      <div className="overflow-y-auto">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar producto"
          className="mb-2 w-full rounded border px-3 py-2"
        />
        <div className="mb-2 flex gap-1 overflow-x-auto">
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveCategory(c.id)}
              className={`rounded px-3 py-1 text-sm ${
                activeCategory === c.id ? "bg-black text-white" : "bg-gray-200"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {filteredProducts.map((p) => (
            <button
              key={p.id}
              onClick={() => addToCart(p)}
              className="rounded border bg-white p-3 text-left hover:bg-gray-50"
            >
              <div className="font-semibold">{p.name}</div>
              <div className="text-sm text-gray-600">${p.basePrice}</div>
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-col overflow-y-auto rounded border bg-white p-4">
        <h2 className="mb-2 text-lg font-bold">Carrito</h2>
        <ul className="mb-4 flex-1 divide-y">
          {cart.map((i, idx) => (
            <li
              key={`${i.productId}-${idx}`}
              className="flex items-center justify-between py-2"
            >
              <span>
                {i.quantity}x {i.name}
              </span>
              <span>${(Number(i.basePrice) * i.quantity).toFixed(2)}</span>
              <button
                onClick={() => removeFromCart(idx)}
                className="text-xs text-red-600"
              >
                Quitar
              </button>
            </li>
          ))}
        </ul>
        <div className="space-y-2 border-t pt-3">
          <input
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="Nombre cliente"
            className="w-full rounded border px-3 py-2"
          />
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Teléfono *"
            className="w-full rounded border px-3 py-2"
          />
          <div className="flex gap-2">
            <label className="flex-1">
              <input
                type="radio"
                checked={serviceType === "local"}
                onChange={() => setServiceType("local")}
              />{" "}
              Local
            </label>
            <label className="flex-1">
              <input
                type="radio"
                checked={serviceType === "delivery"}
                onChange={() => setServiceType("delivery")}
              />{" "}
              Domicilio
            </label>
          </div>
          {serviceType === "delivery" && (
            <>
              <textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Dirección completa *"
                className="w-full rounded border px-3 py-2"
                rows={2}
              />
              <select
                value={coloniaId}
                onChange={(e) => setColoniaId(e.target.value)}
                className="w-full rounded border px-3 py-2"
              >
                <option value="">— Seleccionar colonia —</option>
                {colonias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.zoneName} · ${c.zoneCost})
                  </option>
                ))}
              </select>
              <input
                value={overrideCost}
                onChange={(e) => setOverrideCost(e.target.value)}
                placeholder="Costo envío manual (10-30)"
                type="number"
                min={10}
                max={30}
                step={0.5}
                className="w-full rounded border px-3 py-2"
              />
            </>
          )}
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notas"
            className="w-full rounded border px-3 py-2"
            rows={2}
          />
          <div className="text-right text-sm">
            Subtotal: ${subtotal.toFixed(2)}
          </div>
          {deliveryCost > 0 && (
            <div className="text-right text-sm">
              Envío: ${deliveryCost.toFixed(2)}
            </div>
          )}
          <div className="text-right text-xl font-bold">
            Total: ${total.toFixed(2)}
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            onClick={() => void submit()}
            disabled={submitting}
            className="w-full rounded bg-green-600 py-3 text-white disabled:opacity-50"
          >
            {submitting ? "Creando..." : "Finalizar pedido"}
          </button>
        </div>
      </div>
    </div>
  );
}
