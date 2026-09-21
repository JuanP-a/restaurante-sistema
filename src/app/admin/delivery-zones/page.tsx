"use client";
import { useEffect, useState } from "react";
import type { Colonia } from "@/types/domain";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { ErrorMessage } from "@/ui/ErrorMessage";
import { Input } from "@/ui/Input";
import { PageContainer } from "@/ui/PageContainer";
import { PageHeading } from "@/ui/PageHeading";

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
    setError(null);
    const r = await fetch("/api/delivery-zones/colonias", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, zoneId }),
    });
    if (!r.ok) {
      const d = await r.json();
      setError(d.error?.message ?? "Error creando colonia");
      return;
    }
    setNewColonia({ ...newColonia, [zoneId]: "" });
    load();
  }

  async function deleteColonia(id: string) {
    setError(null);
    const r = await fetch(`/api/delivery-zones/colonias/${id}`, { method: "DELETE" });
    if (!r.ok) {
      const d = await r.json();
      setError(d.error?.message ?? "Error eliminando colonia");
      return;
    }
    load();
  }

  return (
    <PageContainer width="md">
      <PageHeading className="mb-4">Zonas de entrega</PageHeading>

      <Card className="mb-6 p-4">
        <div className="flex flex-wrap gap-2">
          <Input
            name="zone-name"
            placeholder="Nombre zona"
            value={newZoneName}
            onChange={(e) => setNewZoneName(e.target.value)}
          />
          <Input
            name="zone-cost"
            placeholder="Costo (10-30)"
            type="number"
            min={10}
            max={30}
            step={0.5}
            value={newZoneCost}
            onChange={(e) => setNewZoneCost(e.target.value)}
          />
          <Button onClick={addZone}>+ Zona</Button>
        </div>
        {error && (
          <div className="mt-2">
            <ErrorMessage>{error}</ErrorMessage>
          </div>
        )}
      </Card>

      {zones.length === 0 && (
        <p className="text-sm text-gray-500">Sin zonas todavía.</p>
      )}

      {zones.map((z) => (
        <section key={z.id} className="mb-6">
          <Card className="p-4">
            <header className="mb-2 flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {z.name} — ${z.cost}
                {!z.active && (
                  <span className="ml-2 text-xs text-gray-400">(inactiva)</span>
                )}
              </h2>
              <Button onClick={() => deleteZone(z.id)} variant="danger">
                Borrar zona
              </Button>
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
                    <Button onClick={() => deleteColonia(c.id)} variant="danger">
                      Eliminar
                    </Button>
                  </li>
                ))}
            </ul>
            <div className="flex gap-2">
              <Input
                name="new-colonia"
                placeholder="Nueva colonia"
                className="flex-1 py-1"
                value={newColonia[z.id] ?? ""}
                onChange={(e) =>
                  setNewColonia({ ...newColonia, [z.id]: e.target.value })
                }
              />
              <Button onClick={() => addColonia(z.id)} variant="secondary" className="py-1">
                + Colonia
              </Button>
            </div>
          </Card>
        </section>
      ))}
    </PageContainer>
  );
}
