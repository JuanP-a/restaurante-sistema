"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/ui/Button";
import { ErrorMessage } from "@/ui/ErrorMessage";
import { Input } from "@/ui/Input";

export function SetupForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/setup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const body: unknown = await res.json().catch(() => null);
        const message =
          typeof body === "object" &&
          body !== null &&
          "error" in body &&
          typeof body.error === "object" &&
          body.error !== null &&
          "message" in body.error &&
          typeof body.error.message === "string"
            ? body.error.message
            : "No se pudo guardar la contraseña";
        setError(message);
        return;
      }
      router.push("/admin/orders");
    } catch {
      setError("Error de red. Reintentá.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-3">
      <Input
        label="Contraseña del local"
        name="password"
        type="password"
        autoComplete="new-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      {error && <ErrorMessage>{error}</ErrorMessage>}
      <Button type="submit" disabled={busy}>
        {busy ? "Guardando…" : "Guardar y entrar"}
      </Button>
    </form>
  );
}
