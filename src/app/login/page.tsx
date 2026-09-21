"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/ui/Input";
import { Button } from "@/ui/Button";
import { ErrorMessage } from "@/ui/ErrorMessage";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      router.push("/admin/orders");
    } else {
      const data = await res.json();
      setError(data.error.message);
    }
    setLoading(false);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <form
        onSubmit={onSubmit}
        className="w-80 space-y-4 rounded bg-white p-6 shadow"
      >
        <h1 className="text-xl font-bold">Acceso al sistema</h1>
        <Input
          type="password"
          name="password"
          label="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full"
          autoFocus
          required
        />
        {error && <ErrorMessage>{error}</ErrorMessage>}
        <Button type="submit" disabled={loading} className="w-full py-2">
          {loading ? "Entrando..." : "Entrar"}
        </Button>
      </form>
    </div>
  );
}
