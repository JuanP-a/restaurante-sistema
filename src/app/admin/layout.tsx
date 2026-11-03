import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { isSetupRequired } from "@/infra/settings/setup-state";

export const dynamic = "force-dynamic";

const NAV_LINKS = [
  { href: "/admin/orders", label: "Pedidos" },
  { href: "/admin/orders/new", label: "Nuevo" },
  { href: "/admin/menu", label: "Menú" },
  { href: "/admin/menu/categories", label: "Categorías" },
  { href: "/admin/import", label: "Importar" },
  { href: "/admin/delivery-zones", label: "Zonas" },
  { href: "/admin/backup", label: "Backups" },
  { href: "/admin/conectar", label: "Conectar" },
  { href: "/admin/ajustes", label: "Ajustes" },
] as const;

export default async function AdminLayout({ children }: { children: ReactNode }) {
  if (await isSetupRequired()) redirect("/setup");

  return (
    <div className="min-h-full bg-gray-50">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-black focus:px-3 focus:py-2 focus:text-white"
      >
        Saltar al contenido
      </a>
      <header className="border-b bg-white">
        {/* Una sola fila con scroll horizontal: en celular 9 enlaces no caben, y
            Pedidos/Nuevo (los de uso constante) van primero, siempre a la vista. */}
        <nav
          aria-label="Navegación principal"
          className="mx-auto flex max-w-5xl overflow-x-auto px-2 text-sm sm:px-6"
        >
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="flex min-h-11 shrink-0 items-center px-3 text-gray-700 first:font-semibold"
            >
              {label}
            </Link>
          ))}
        </nav>
      </header>
      <main id="main" tabIndex={-1}>
        {children}
      </main>
    </div>
  );
}
