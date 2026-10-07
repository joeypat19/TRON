import type { ComponentPropsWithoutRef, ReactNode } from "react";
import Link from "next/link";
import { appPath } from "@/lib/app-path";
import { Logo } from "@/components/brand/logo";
import { BrandPageShell } from "@/components/ui/brand-page-shell";
import { cn } from "@/lib/utils";
import { SiteFooter } from "@/components/site/site-footer";

type PublicPageShellProps = ComponentPropsWithoutRef<"div"> & {
  actions?: ReactNode;
};

export function PublicPageShell({ actions, children, className, ...props }: PublicPageShellProps) {
  return (
    <BrandPageShell className={cn("flex min-h-screen flex-col", className)} {...props}>
      <header className="border-b border-[var(--line)]">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-4">
          <Link aria-label="Inbox home" href={appPath("/")}>
            <Logo framed={false} priority size="md" />
          </Link>
          <div className="flex items-center gap-3">{actions}</div>
        </div>
      </header>
      <div className="flex-1">{children}</div>
      <SiteFooter />
    </BrandPageShell>
  );
}
