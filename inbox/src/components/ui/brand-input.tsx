import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const inputClassName =
  "w-full rounded-[20px] border border-[var(--line)] bg-[var(--surface-overlay)] px-4 py-3 text-sm text-[var(--text)] outline-none transition placeholder:text-[var(--text-muted)] focus:border-[var(--line)] focus:bg-[var(--surface-overlay)]";

export const BrandInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function BrandInput(
  { className, ...props },
  ref,
) {
  return <input className={cn(inputClassName, className)} ref={ref} {...props} />;
});

export const BrandTextarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function BrandTextarea(
  { className, ...props },
  ref,
) {
  return <textarea className={cn(inputClassName, "min-h-80 rounded-[24px] px-4 py-4", className)} ref={ref} {...props} />;
});
