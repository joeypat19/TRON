import type { ReactNode } from "react";
import { PublicPageShell } from "@/components/site/public-page-shell";
import { SUPPORT_EMAIL } from "@/components/site/site-footer";

type LegalPageProps = {
  title: string;
  summary: string;
  children: ReactNode;
};

export function LegalPage({ title, summary, children }: LegalPageProps) {
  return (
    <PublicPageShell
      actions={
        <a
          className="inline-flex items-center justify-center rounded-full border border-[var(--line)] bg-[var(--surface-overlay)] px-4 py-2 text-sm font-medium text-[var(--text)] transition hover:border-[var(--line)] hover:bg-[var(--surface-overlay)]"
          href={`mailto:${SUPPORT_EMAIL}`}
        >
          Contact
        </a>
      }
    >
      <main className="mx-auto flex w-full max-w-[800px] flex-1 flex-col px-5 py-10 sm:py-14">
        <div className="brand-panel-strong overflow-hidden px-6 py-8 sm:px-8 sm:py-10">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[var(--accent)]">Inbox</p>
          <h1 className="mt-3 text-3xl font-semibold text-brand-gradient sm:text-4xl">{title}</h1>
          <p className="mt-4 text-base leading-7 text-[var(--text-muted)]">{summary}</p>
          <p className="mt-4 text-sm text-[var(--text-muted)]">Last updated: May 2026</p>
          <div className="prose prose-invert mt-8 max-w-none prose-headings:text-[var(--text)] prose-p:text-[var(--text-muted)] prose-li:text-[var(--text-muted)] prose-strong:text-[var(--text)] prose-a:text-[var(--accent-secondary)]">
            {children}
          </div>
        </div>
      </main>
    </PublicPageShell>
  );
}
