import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";

type GlowBorderProps = ComponentPropsWithoutRef<"div"> & {
  intensity?: "default" | "strong";
};

export function GlowBorder({
  className,
  intensity = "default",
  ...props
}: GlowBorderProps) {
  return (
    <div
      className={cn(intensity === "strong" ? "brand-panel-strong" : "brand-panel", className)}
      {...props}
    />
  );
}
