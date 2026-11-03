"use client";

import { useState } from "react";
import { Button } from "@/ui/Button";
import { ErrorMessage } from "@/ui/ErrorMessage";
import { Input } from "@/ui/Input";

type Values = { host: string; port: string };

function messageOf(body: unknown, fallback: string): string {
  if (typeof body !== "object" || body === null || !("error" in body)) return fallback;
  const { error } = body;
  if (typeof error !== "object" || error === null || !("message" in error)) return fallback;
  return typeof error.message === "string" ? error.message : fallback;
}

function isOk(body: unknown): boolean {
  return typeof body === "object" && body !== null && "ok" in body && body.ok === true;
}

export function PrinterForm({ initial }: { initial: Values }) {
  const [values, setValues] = useState<Values>(initial);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function send(path: string, method: "PUT" | "POST", doing: string, done: string) {
    setBusy(true);
    setError("");
    setStatus(doing);
    try {
      const res = await fetch(path, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(values),
      });
      const json: unknown = await res.json();
      if (!isOk(json)) {
        setError(messageOf(json, "No se pudo completar la operación"));
        setStatus("");
        return;
      }
      setStatus(done);
    } catch {
      setError("No se pudo conectar con el servidor.");
      setStatus("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        void send("/api/settings/printer", "PUT", "Guardando…", "Guardado.");
      }}
    >
      <Input
        label="IP de la impresora"
        name="host"
        placeholder="192.168.1.50"
        autoComplete="off"
        inputMode="decimal"
        className="w-full"
        value={values.host}
        onChange={(event) => setValues({ ...values, host: event.target.value })}
      />
      <Input
        label="Puerto"
        name="port"
        inputMode="numeric"
        autoComplete="off"
        className="w-32"
        value={values.port}
        onChange={(event) => setValues({ ...values, port: event.target.value })}
      />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy}>
          Guardar
        </Button>
        <Button
          variant="ghost"
          disabled={busy}
          onClick={() =>
            void send("/api/settings/printer/test", "POST", "Imprimiendo prueba…", "Prueba enviada: revisa el papel.")
          }
        >
          Imprimir prueba
        </Button>
      </div>
      <p role="status" aria-live="polite" className="text-sm text-gray-600">
        {status}
      </p>
      {error ? <ErrorMessage>{error}</ErrorMessage> : null}
    </form>
  );
}
