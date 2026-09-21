"use client";
import type { ButtonHTMLAttributes } from "react";

const variantClasses = {
  primary: "rounded bg-black px-4 py-2 text-white disabled:opacity-50",
  secondary: "rounded bg-gray-800 px-3 py-1 text-white disabled:opacity-50",
  success: "rounded bg-green-100 px-3 py-1 text-xs text-green-800",
  inactive: "rounded bg-gray-200 px-3 py-1 text-xs text-gray-600",
  danger:
    "text-xs text-red-600 hover:underline disabled:opacity-50",
  link: "text-sm text-blue-600 hover:underline disabled:opacity-50",
  ghost: "rounded border px-3 py-2 disabled:opacity-50",
} as const;

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variantClasses;
};

export function Button({
  variant = "primary",
  className = "",
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`${variantClasses[variant]} ${className}`.trim()}
      {...rest}
    />
  );
}
