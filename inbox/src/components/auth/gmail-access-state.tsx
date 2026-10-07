import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { ConnectGmailButton } from "@/components/auth/connect-gmail-button";
import { BrandPageShell } from "@/components/ui/brand-page-shell";
import { cn } from "@/lib/utils";
import type { GmailAccessState } from "@/lib/gmail/client";

type GmailAccessStateProps = {
  state: GmailAccessState;
  fullScreen?: boolean;
};

export function GmailAccessStateCard({ state, fullScreen = false }: GmailAccessStateProps) {
  const containerClassName = fullScreen
    ? "flex min-h-screen items-center justify-center px-6 py-16"
    : "flex min-h-[60vh] items-center justify-center px-2 py-6";

  const card = (
    <div
      className={cn(
        "brand-panel-strong relative w-full overflow-hidden p-10",
        fullScreen ? "max-w-xl" : "max-w-3xl",
      )}
    >
      <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-[linear-gradient(90deg,transparent,var(--line),transparent)]" />
      <Logo className="w-fit" framed={false} priority size="md" />
      <p className="mt-8 text-sm font-medium uppercase tracking-[0.28em] text-[var(--accent)]">{state.eyebrow}</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-brand-gradient">{state.title}</h1>
      <p className="mt-4 text-base leading-7 text-[var(--text-muted)]">{state.description}</p>
      {state.helpText ? <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">{state.helpText}</p> : null}
      <div className="mt-8 flex flex-wrap items-center gap-3">
        {state.actionKind === "google-oauth" ? (
          <div className="w-full max-w-xs">
            <ConnectGmailButton label={state.actionLabel} showNote={false} />
          </div>
        ) : (
          <Link
            className="inline-flex items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--accent)_0%,var(--accent-strong)_100%)] px-6 py-3 text-sm font-medium text-[var(--accent-contrast)] shadow-[0_0_24px_var(--accent-glow)] transition hover:brightness-110"
            href={state.actionHref}
          >
            {state.actionLabel}
          </Link>
        )}
        {state.secondaryActionHref && state.secondaryActionLabel ? (
          <Link
            className="inline-flex items-center justify-center rounded-full border border-[var(--line)] bg-[var(--surface-overlay)] px-6 py-3 text-sm font-medium text-[var(--text)] transition hover:border-[var(--line)] hover:bg-[var(--surface-overlay)]"
            href={state.secondaryActionHref}
          >
            {state.secondaryActionLabel}
          </Link>
        ) : null}
      </div>
    </div>
  );

  if (fullScreen) {
    return (
      <BrandPageShell className={containerClassName}>
        {card}
      </BrandPageShell>
    );
  }

  return <main className={containerClassName}>{card}</main>;
}
