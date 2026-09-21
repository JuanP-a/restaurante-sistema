"use client";
import { useEffect, useState } from "react";
import type { Colonia } from "@/types/domain";

type Zone = { id: string; name: string; cost: string; active: boolean };

export default function DeliveryZonesPage() {
  const [zones, setZones] = useState<Zone[]>([]);
  const [colonias, setColonias] = useState<Colonia[]>([]);
  const [newZoneName, setNewZoneName] = useState("");
  const [newZoneCost, setNewZoneCost] = useState("");
  const [newColonia, setNewColonia] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const [z, c] = await Promise.all([
      fetch("/api/delivery-zones").then((r) => r.json()),
      fetch("/api/delivery-zones/colonias").then((r) => r.json()),
    ]);
    setZones(z.data ?? []);
    setColonias(c.data ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function addZone() {
    setError(null);
    if (!newZoneName || !newZoneCost) {
      setError("Nombre y costo requeridos");
      return;
    }
    const r = await fetch("/api/delivery-zones", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: newZoneName, cost: newZoneCost }),
    });
    if (!r.ok) {
      const d = await r.json();
      setError(d.error?.message ?? "Error creando zona");
      return;
    }
    setNewZoneName("");
    setNewZoneCost("");
    load();
  }

  async function deleteZone(id: string) {
    if (!confirm("¿Borrar zona y todas sus colonias?")) return;
    await fetch(`/api/delivery-zones/${id}`, { method: "DELETE" });
    load();
  }

  async function addColonia(zoneId: string) {
    const name = newColonia[zoneId];
    if (!name) return;
    await fetch("/api/delivery-zones/colonias", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, zoneId }),
    });
    setNewColonia({ ...newColonia, [zoneId]: "" });
    load();
  }

  async function deleteColonia(id: string) {
    await fetch(`/api/delivery-zones/colonias/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="mb-4 text-2xl font-bold">Zonas de entrega</h1>

      <div className="mb-6 flex flex-wrap gap-2 rounded border bg-white p-4">
        <input
          value={newZoneName}
          onChange={(e) => setNewZoneName(e.target.value)}
          placeholder="Nombre zona"
          className="rounded border px-3 py-2"
        />
        <input
          value={newZoneCost}
          onChange={(e) => setNewZoneCost(e.target.value)}
          placeholder="Costo (10-30)"
          type="number"
          min={10}
          max={30}
          step={0.5}
          className="rounded border px-3 py-2"
        />
        <button
          onClick={addZone}
          className="rounded bg-black px-4 py-2 text-white"
        >
          + Zona
        </button>
        {error && <p className="w-full text-sm text-red-600">{error}</p>}
      </div>

      {zones.length === 0 && (
        <p className="text-sm text-gray-500">Sin zonas todavía.</p>
      )}

      {zones.map((z) => (
        <section
          key={z.id}
          className="mb-6 rounded border bg-white p-4 shadow-sm"
        >
          <header className="mb-2 flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              {z.name} — ${z.cost}
              {!z.active && (
                <span className="ml-2 text-xs text-gray-400">(inactiva)</span>
              )}
            </h2>
            <button
              onClick={() => deleteZone(z.id)}
              className="text-xs text-red-600 hover:underline"
            >
              Borrar zona
            </button>
          </header>
          <ul className="mb-3 space-y-1">
            {colonias
              .filter((c) => c.zoneId === z.id)
              .map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between text-sm"
                >
                  <span>
                    {c.name}
                    {!c.active && (
                      <span className="ml-2 text-xs text-gray-400">
                        (inactiva)
                      </span>
                    )}
                  </span>
                  <button
                    onClick={() => deleteColonia(c.id)}
                    className="text-xs text-red-600 hover:underline"
                  >
                    Eliminar
                  </button>
                </li>
              ))}
          </ul>
          <div className="flex gap-2">
            <input
              value={newColonia[z.id] ?? ""}
              onChange={(e) =>
                setNewColonia({ ...newColonia, [z.id]: e.target.value })
              }
              placeholder="Nueva colonia"
              className="flex-1 rounded border px-3 py-1"
            />
            <button
              onClick={() => addColonia(z.id)}
              className="rounded bg-gray-800 px-3 py-1 text-sm text-white"
            >
              + Colonia
            </button>
          </div>
        </section>
      ))}
    </div>
  );
}
