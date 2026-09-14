import Link from "next/link";
import type { ReactNode } from "react";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-full bg-gray-50">
      <header className="border-b bg-white">
        <nav className="mx-auto flex max-w-5xl gap-4 px-6 py-3 text-sm">
          <Link href="/admin/menu" className="font-semibold">
            Menú
          </Link>
          <Link href="/admin/menu/categories" className="text-gray-700">
            Categorías
          </Link>
        </nav>
      </header>
      <main>{children}</main>
    </div>
  );
}