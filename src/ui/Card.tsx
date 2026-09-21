import type { ReactNode } from "react";

export function Card({
  children,
  as: As = "div",
  className = "",
}: {
  children: ReactNode;
  as?: "div" | "ul" | "ol" | "section";
  className?: string;
}) {
  return (
    <As className={`rounded border bg-white ${className}`.trim()}>
      {children}
    </As>
  );
}

export function CardList({ children }: { children: ReactNode }) {
  return <ul className="divide-y rounded border bg-white">{children}</ul>;
}

export function CardListItem({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <li className={`flex items-center justify-between p-3 ${className}`.trim()}>
      {children}
    </li>
  );
}
