import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { isSetupRequired } from "@/infra/settings/setup-state";

export const dynamic = "force-dynamic";

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
        <nav
          aria-label="Navegación principal"
          className="mx-auto flex max-w-5xl gap-4 px-6 py-3 text-sm"
        >
          <Link href="/admin/orders" className="font-semibold">
            Pedidos
          </Link>
          <Link href="/admin/orders/new" className="text-gray-700">
            Nuevo
          </Link>
          <Link href="/admin/menu" className="text-gray-700">
            Menú
          </Link>
          <Link href="/admin/menu/categories" className="text-gray-700">
            Categorías
          </Link>
          <Link href="/admin/import" className="text-gray-700">
            Importar
          </Link>
          <Link href="/admin/delivery-zones" className="text-gray-700">
            Zonas
          </Link>
          <Link href="/admin/backup" className="text-gray-700">
            Backups
          </Link>
          <Link href="/admin/conectar" className="text-gray-700">
            Conectar
          </Link>
        </nav>
      </header>
      <main id="main" tabIndex={-1}>
        {children}
      </main>
    </div>
  );
}
