export function Loading({ children = "Cargando..." }: { children?: string }) {
  return (
    <div role="status" aria-live="polite" className="p-6 text-gray-500">
      {children}
    </div>
  );
}
