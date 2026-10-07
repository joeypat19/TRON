"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { RotateCw } from "lucide-react";
import { BrandButton } from "@/components/ui/brand-button";

export function RefreshButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <BrandButton
      aria-label="Refresh mailbox"
      className="h-10 w-10 rounded-full p-0"
      disabled={isPending}
      onClick={() => startTransition(() => router.refresh())}
      tone="secondary"
    >
      <RotateCw className={`h-4 w-4 ${isPending ? "animate-spin" : ""}`} />
      <span className="sr-only">Refresh</span>
    </BrandButton>
  );
}
