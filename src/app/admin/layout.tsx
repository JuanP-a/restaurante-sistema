import Link from "next/link";
import type { ReactNode } from "react";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-full bg-gray-50">
      <header className="border-b bg-white">
        <nav className="mx-auto flex max-w-5xl gap-4 px-6 py-3 text-sm">
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
          <Link href="/admin/delivery-zones" className="text-gray-700">
            Zonas
          </Link>
        </nav>
      </header>
      <main>{children}</main>
    </div>
  );
}