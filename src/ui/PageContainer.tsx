import type { ReactNode } from "react";

const widthClasses = {
  sm: "max-w-2xl",
  md: "max-w-3xl",
  lg: "max-w-5xl",
} as const;

export type PageContainerProps = {
  children: ReactNode;
  width?: keyof typeof widthClasses;
  className?: string;
};

export function PageContainer({
  children,
  width = "md",
  className = "",
}: PageContainerProps) {
  return (
    <div
      className={`mx-auto ${widthClasses[width]} p-6 ${className}`.trim()}
    >
      {children}
    </div>
  );
}
