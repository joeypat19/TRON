import { Inbox } from "lucide-react";
import { BrandPageShell } from "@/components/ui/brand-page-shell";

export default function Loading() {
  return (
    <BrandPageShell className="flex items-center justify-center px-6 py-16">
      <div className="flex w-full max-w-md flex-col items-center gap-5 px-8 py-10 text-center">
        <div className="flex flex-col items-center gap-3">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--surface-overlay)]">
            <Inbox className="h-8 w-8 text-[var(--accent)]" />
          </div>
          <p className="text-3xl font-semibold text-brand-gradient">Inbox</p>
        </div>
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.28em] text-[var(--accent)]">Syncing</p>
          <p className="mt-3 text-sm text-[var(--text-muted)]">Preparing your mailbox workspace inside Inbox.</p>
        </div>
      </div>
    </BrandPageShell>
  );
}
