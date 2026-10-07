import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type BrandButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: "primary" | "secondary" | "ghost" | "danger";
};

const toneClasses: Record<NonNullable<BrandButtonProps["tone"]>, string> = {
  primary:
    "bg-[linear-gradient(135deg,var(--accent)_0%,var(--accent-strong)_100%)] text-[var(--accent-contrast)] shadow-[0_0_24px_var(--accent-glow)] hover:brightness-110",
  secondary:
    "border border-[var(--line)] bg-[var(--surface-overlay)] text-[var(--text)] hover:border-[var(--line)] hover:bg-[var(--surface-overlay)]",
  ghost:
    "border border-transparent bg-transparent text-[var(--text-muted)] hover:border-[var(--line)] hover:bg-[var(--surface-overlay)] hover:text-[var(--text)]",
  danger:
    "border border-[var(--accent-strong)] bg-[var(--surface-overlay)] text-[var(--text)] hover:border-[var(--accent-strong)] hover:bg-[var(--surface-overlay)]",
};

export function BrandButton({
  className,
  tone = "primary",
  type = "button",
  ...props
}: BrandButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium tracking-[0.01em] transition disabled:cursor-not-allowed disabled:opacity-60",
        toneClasses[tone],
        className,
      )}
      type={type}
      {...props}
    />
  );
}
