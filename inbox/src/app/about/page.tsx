import type { Metadata } from "next";
import Link from "next/link";
import { PublicPageShell } from "@/components/site/public-page-shell";
import { appPath } from "@/lib/app-path";

export const metadata: Metadata = {
  title: "About",
};

export default function AboutPage() {
  return (
    <PublicPageShell
      actions={
        <Link
          className="inline-flex items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--accent)_0%,var(--accent-strong)_100%)] px-4 py-2 text-sm font-medium text-[var(--accent-contrast)] shadow-[0_0_24px_var(--accent-glow)] transition hover:brightness-110"
          href={appPath("/mail/inbox")}
        >
          Open Inbox
        </Link>
      }
    >
      <main className="mx-auto flex w-full max-w-[800px] flex-1 flex-col px-5 py-10 sm:py-14">
        <div className="brand-panel-strong overflow-hidden px-6 py-8 sm:px-8 sm:py-10">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[var(--accent)]">Inbox</p>
          <h1 className="mt-3 text-3xl font-semibold text-brand-gradient sm:text-4xl">Inbox</h1>
          <p className="mt-3 text-lg text-[var(--text)]">A focused mailbox workspace for supported providers.</p>
          <p className="mt-5 text-base leading-7 text-[var(--text-muted)]">
            Inbox connects to supported mailbox providers so you can access inbox, threads, search, drafts, and
            sending inside Inbox. Provider permissions are used only to provide the mailbox features you choose to
            use.
          </p>

          <div className="mt-8 grid gap-4">
            <section className="rounded-[20px] border border-[var(--line)] bg-[var(--surface-overlay)] px-5 py-4">
              <h2 className="text-base font-semibold text-[var(--text)]">What Inbox does</h2>
              <p className="mt-2 text-sm leading-7 text-[var(--text-muted)]">
                Inbox provides a mailbox workspace for reading inbox content, reviewing threads, searching mail,
                preparing drafts, and sending messages from your connected mailbox.
              </p>
            </section>

            <section className="rounded-[20px] border border-[var(--line)] bg-[var(--surface-overlay)] px-5 py-4">
              <h2 className="text-base font-semibold text-[var(--text)]">Why mailbox access is requested</h2>
              <p className="mt-2 text-sm leading-7 text-[var(--text-muted)]">
                Mailbox permissions are requested so Inbox can load mailbox content, support search, create drafts,
                and send messages when you choose to use those features.
              </p>
            </section>

            <section className="rounded-[20px] border border-[var(--line)] bg-[var(--surface-overlay)] px-5 py-4">
              <h2 className="text-base font-semibold text-[var(--text)]">User control</h2>
              <p className="mt-2 text-sm leading-7 text-[var(--text-muted)]">
                You control whether to connect a mailbox, can revoke access through your provider permissions, and can
                contact support to request deletion.
              </p>
            </section>

            <section className="rounded-[20px] border border-[var(--line)] bg-[var(--surface-overlay)] px-5 py-4">
              <h2 className="text-base font-semibold text-[var(--text)]">Privacy and terms</h2>
              <div className="mt-3 flex flex-wrap gap-3 text-sm">
                <Link className="text-[var(--accent-secondary)] transition hover:text-[var(--accent-secondary)]" href={appPath("/privacy")}>
                  Privacy Policy
                </Link>
                <Link className="text-[var(--accent-secondary)] transition hover:text-[var(--accent-secondary)]" href={appPath("/terms")}>
                  Terms of Service
                </Link>
              </div>
            </section>
          </div>
        </div>
      </main>
    </PublicPageShell>
  );
}
