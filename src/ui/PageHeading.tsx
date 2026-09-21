import type { ReactNode } from "react";

export function PageHeading({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <h1 className={`text-2xl font-bold ${className}`.trim()}>{children}</h1>
  );
}
