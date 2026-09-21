"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { CartItem, Category, Colonia, Product } from "@/types/domain";
import {
  CategoryListResponse,
  ColoniaListResponse,
  ErrorResponse,
  ProductListResponse,
} from "@/types/api-schemas";
import { Button } from "@/ui/Button";
import { ErrorMessage } from "@/ui/ErrorMessage";
import { Input, Textarea } from "@/ui/Input";

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
      ([p, c, co]) => {
        const products = ProductListResponse.parse(p).data;
        const categories = CategoryListResponse.parse(c).data;
        const colonias = ColoniaListResponse.parse(co).data;
        setProducts(products);
        const activeCats = categories.filter((x) => x.active);
        setCategories(activeCats);
        if (activeCats[0]) setActiveCategory(activeCats[0].id);
        setColonias(colonias ?? []);
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

  const subtotal = useMemo(
    () =>
      cart.reduce(
        (s, i) =>
          s +
          Number(i.basePrice) * i.quantity +
          i.extras.reduce((e, x) => e + Number(x.price), 0) * i.quantity,
        0,
      ),
    [cart],
  );
  const selectedColonia = colonias.find((c) => c.id === coloniaId);
  const deliveryCost = useMemo(
    () =>
      overrideCost
        ? Number(overrideCost)
        : selectedColonia
          ? Number(selectedColonia.zoneCost)
          : 0,
    [overrideCost, selectedColonia],
  );
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
      const d = ErrorResponse.parse(await res.json());
      setError(d.error.message);
      return;
    }
    const { data } = (await res.json()) as { data: { id: string } };
    router.push(`/admin/orders/${data.id}`);
  }

  return (
    <div className="grid h-screen grid-cols-2 gap-4 p-4">
      <div className="overflow-y-auto">
        <Input
          name="search"
          placeholder="Buscar producto"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-2 w-full"
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
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="flex flex-col overflow-y-auto rounded border bg-white p-4"
      >
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
              <Button
                type="button"
                onClick={() => removeFromCart(idx)}
                variant="danger"
              >
                Quitar
              </Button>
            </li>
          ))}
        </ul>
        <div className="space-y-2 border-t pt-3">
          <Input
            name="customerName"
            label="Nombre cliente"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            className="w-full"
          />
          <Input
            name="phone"
            label="Teléfono"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full"
            required
          />
          <fieldset>
            <legend className="sr-only">Tipo de servicio</legend>
            <div className="flex gap-2">
              <label className="flex flex-1 items-center gap-2">
                <input
                  type="radio"
                  name="serviceType"
                  value="local"
                  checked={serviceType === "local"}
                  onChange={() => setServiceType("local")}
                />
                Local
              </label>
              <label className="flex flex-1 items-center gap-2">
                <input
                  type="radio"
                  name="serviceType"
                  value="delivery"
                  checked={serviceType === "delivery"}
                  onChange={() => setServiceType("delivery")}
                />
                Domicilio
              </label>
            </div>
          </fieldset>
          {serviceType === "delivery" && (
            <>
              <Textarea
                name="address"
                label="Dirección completa"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full"
                rows={2}
                required
              />
              <label className="block">
                <span className="mb-1 block text-sm">Colonia</span>
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
              </label>
              <Input
                name="overrideCost"
                label="Costo envío manual (10-30)"
                type="number"
                min={10}
                max={30}
                step={0.5}
                value={overrideCost}
                onChange={(e) => setOverrideCost(e.target.value)}
                className="w-full"
              />
            </>
          )}
          <Textarea
            name="notes"
            label="Notas"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full"
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
          {error && <ErrorMessage>{error}</ErrorMessage>}
          <Button
            type="submit"
            disabled={submitting}
            className="w-full bg-green-600 py-3"
          >
            {submitting ? "Creando..." : "Finalizar pedido"}
          </Button>
        </div>
      </form>
    </div>
  );
}
