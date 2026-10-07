"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/ui/Button";
import { ErrorMessage } from "@/ui/ErrorMessage";
import { Input } from "@/ui/Input";

type ImportReport = {
  categories: number;
  products: number;
  deferred: { extras: number; optionGroups: number };
};

type ApiResponse = {
  ok: boolean;
  data?: ImportReport;
  error?: { message: string; path?: string };
};

export function ImportForm() {
  const [mode, setMode] = useState<"append" | "replace">("append");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [report, setReport] = useState<ImportReport | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setReport(null);
    setError("");
    setStatus("Importando…");

    const fileInput = event.currentTarget.elements.namedItem("file");
    if (!(fileInput instanceof HTMLInputElement) || !fileInput.files?.[0]) {
      setError("Elegí un archivo JSON.");
      setStatus("");
      return;
    }

    let menu: unknown;
    try {
      menu = JSON.parse(await fileInput.files[0].text());
    } catch {
      setError("El archivo no es JSON válido.");
      setStatus("");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/admin/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ menu, mode }),
      });
      const json = (await res.json()) as ApiResponse;
      if (!json.ok) {
        const where = json.error?.path ? ` (${json.error.path})` : "";
        setError(`${json.error?.message ?? "Error desconocido"}${where}`);
        setStatus("");
        return;
      }
      setReport(json.data ?? null);
      setStatus("Importado.");
    } catch {
      setError("No se pudo conectar con el servidor.");
      setStatus("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-semibold">Modo</legend>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="mode"
            checked={mode === "append"}
            onChange={() => setMode("append")}
          />
          Agregar al menú existente
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="mode"
            checked={mode === "replace"}
            onChange={() => setMode("replace")}
          />
          Reemplazar todo el menú
        </label>
      </fieldset>

      <Input type="file" name="file" accept="application/json,.json" label="Archivo JSON" required />

      <Button type="submit" disabled={busy}>
        {busy ? "Importando…" : "Importar"}
      </Button>

      <p role="status" aria-live="polite" className="text-sm text-gray-600">
        {status}
      </p>
      {error ? <ErrorMessage>{error}</ErrorMessage> : null}
      {report ? (
        <pre className="rounded bg-gray-100 p-3 text-sm">
          {`Categorías: ${report.categories}\nProductos: ${report.products}\nDiferidos → extras: ${report.deferred.extras}, grupos de opciones: ${report.deferred.optionGroups}`}
        </pre>
      ) : null}
    </form>
  );
}
