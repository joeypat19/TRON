import type { ComponentPropsWithoutRef } from "react";
import { GlowBorder } from "@/components/ui/glow-border";
import { cn } from "@/lib/utils";

type BrandCardProps = ComponentPropsWithoutRef<"div"> & {
  tone?: "default" | "strong";
};

export function BrandCard({ className, tone = "default", ...props }: BrandCardProps) {
  return (
    <GlowBorder
      className={cn("rounded-[28px] p-5 md:p-6", className)}
      intensity={tone === "strong" ? "strong" : "default"}
      {...props}
    />
  );
}
