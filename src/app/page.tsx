import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="rounded bg-white p-8 text-center shadow">
        <h1 className="mb-4 text-2xl font-bold">Sistema de pedidos</h1>
        <Link href="/login" className="text-blue-600 hover:underline">
          Acceder al panel
        </Link>
      </div>
    </div>
  );
}
