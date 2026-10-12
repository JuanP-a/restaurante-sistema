"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/ui/Button";
import { ErrorMessage } from "@/ui/ErrorMessage";

export type BackupListing = {
  id: string;
  label: string;
  backups: { name: string; bytes: number }[];
};

type ApiError = { message: string };

function parseError(body: unknown): ApiError | null {
  if (typeof body !== "object" || body === null) return null;
  if (!("error" in body)) return null;
  const { error } = body;
  if (typeof error !== "object" || error === null) return null;
  if (!("message" in error) || typeof error.message !== "string") return null;
  return { message: error.message };
}

function parseOk(body: unknown): boolean {
  return typeof body === "object" && body !== null && "ok" in body && body.ok === true;
}

function parseTables(body: unknown): { name: string; rows: number }[] {
  if (typeof body !== "object" || body === null || !("data" in body)) return [];
  const { data } = body;
  if (typeof data !== "object" || data === null || !("tables" in data)) return [];
  const { tables } = data;
  if (!Array.isArray(tables)) return [];
  return tables.filter(
    (t): t is { name: string; rows: number } =>
      typeof t === "object" &&
      t !== null &&
      "name" in t &&
      typeof t.name === "string" &&
      "rows" in t &&
      typeof t.rows === "number",
  );
}

export function BackupActions({ destinations }: { destinations: BackupListing[] }) {
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function createBackup() {
    setBusy(true);
    setError("");
    setStatus("Creando backup…");
    try {
      const res = await fetch("/api/backup", { method: "POST" });
      const json: unknown = await res.json();
      if (!parseOk(json)) {
        setError(parseError(json)?.message ?? "No se pudo crear el backup");
        setStatus("");
        return;
      }
      setStatus("Backup creado.");
      router.refresh();
    } catch {
      setError("No se pudo conectar con el servidor.");
      setStatus("");
    } finally {
      setBusy(false);
    }
  }

  async function validate(destinationId: string, name: string) {
    setBusy(true);
    setError("");
    setStatus(`Validando ${name}…`);
    try {
      const res = await fetch("/api/backup/restore", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ destinationId, name }),
      });
      const json: unknown = await res.json();
      if (!parseOk(json)) {
        setError(parseError(json)?.message ?? "Backup no restaurable");
        setStatus("");
        return;
      }
      const total = parseTables(json).reduce((sum, t) => sum + t.rows, 0);
      setStatus(`Backup válido (${total} filas).`);
    } catch {
      setError("No se pudo conectar con el servidor.");
      setStatus("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Button onClick={createBackup} disabled={busy}>
        {busy ? "Procesando…" : "Crear backup"}
      </Button>
      <p role="status" aria-live="polite" className="text-sm text-gray-600">
        {status}
      </p>
      {error ? <ErrorMessage>{error}</ErrorMessage> : null}

      {destinations.map((destination) => (
        <section key={destination.id} className="space-y-2">
          <h2 className="text-sm font-semibold">{destination.label}</h2>
          {destination.backups.length === 0 ? (
            <p className="text-sm text-gray-500">Sin backups.</p>
          ) : (
            <ul className="divide-y rounded border bg-white">
              {destination.backups.map((backup) => (
                <li key={backup.name} className="flex items-center justify-between p-3">
                  <span className="text-sm">{backup.name}</span>
                  <Button
                    variant="ghost"
                    onClick={() => validate(destination.id, backup.name)}
                    disabled={busy}
                    aria-label={`Validar ${backup.name}`}
                  >
                    Validar
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
