import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";

export function BrandPageShell({ className, ...props }: ComponentPropsWithoutRef<"div">) {
  return <div className={cn("brand-page", className)} {...props} />;
}
