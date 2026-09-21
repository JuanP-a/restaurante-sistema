"use client";
import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";

const baseInputClass = "rounded border px-3 py-2";

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  className?: string;
};

export function Input({
  label,
  className = "",
  id,
  ...rest
}: InputProps) {
  const inputId = id ?? rest.name ?? undefined;
  const inputEl = (
    <input
      id={inputId}
      className={`${baseInputClass} ${className}`.trim()}
      {...rest}
    />
  );
  if (!label) return inputEl;
  return (
    <label className="block">
      <span className="mb-1 block text-sm">{label}</span>
      {inputEl}
    </label>
  );
}

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  className?: string;
};

export function Textarea({
  label,
  className = "",
  id,
  ...rest
}: TextareaProps) {
  const inputId = id ?? rest.name ?? undefined;
  const inputEl = (
    <textarea
      id={inputId}
      className={`${baseInputClass} ${className}`.trim()}
      {...rest}
    />
  );
  if (!label) return inputEl;
  return (
    <label className="block">
      <span className="mb-1 block text-sm">{label}</span>
      {inputEl}
    </label>
  );
}
