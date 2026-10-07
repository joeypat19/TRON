"use client";

import { Check, ChevronDown } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { setActiveMailboxAction } from "@/app/mail/actions";
import { ConnectGmailButton } from "@/components/auth/connect-gmail-button";
import { ConnectMicrosoftButton } from "@/components/auth/connect-microsoft-button";
import { appPath } from "@/lib/app-path";
import type { MailboxProviderValue } from "@/lib/mail/shared";
import { cn } from "@/lib/utils";

type MailAccountSwitcherProps = {
  accounts: Array<{
    id: string;
    provider: MailboxProviderValue;
    emailAddress: string;
    status: string;
  }>;
  activeMailboxId?: string | null;
};

export function MailAccountSwitcher({
  accounts,
  activeMailboxId,
}: MailAccountSwitcherProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="relative">
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--surface-overlay)] px-4 py-2 text-sm font-medium text-[var(--text)] transition hover:border-[var(--line)] hover:bg-[var(--surface-overlay)]"
        data-testid="emails-control"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        Emails
        <ChevronDown className={cn("h-4 w-4 transition", open ? "rotate-180" : "")} />
      </button>

      {open ? (
        <div
          className="absolute right-0 top-[calc(100%+0.75rem)] z-40 w-[23rem] rounded-[24px] border border-[var(--line)] bg-[var(--surface-overlay)] p-3 shadow-[0_20px_50px_var(--shadow-color)] backdrop-blur-xl"
          data-testid="emails-dropdown"
          role="menu"
        >
          <div className="mb-3 rounded-[18px] border border-[var(--line)] bg-[var(--surface-overlay)] px-4 py-3">
            <p className="text-sm font-semibold text-[var(--text)]">Email accounts</p>
          </div>

          <div className="space-y-3">
            <section className="rounded-[18px] border border-[var(--line)] bg-[var(--surface-overlay)] px-4 py-4">
              <div className="space-y-2">
                <ConnectGmailButton
                  buttonClassName="min-h-0 w-full rounded-full bg-[linear-gradient(135deg,var(--accent)_0%,var(--accent-strong)_100%)] px-4 py-2 text-sm font-semibold text-[var(--accent-contrast)] transition hover:brightness-110"
                  label="Add Gmail"
                />
                <ConnectMicrosoftButton
                  buttonClassName="min-h-0 w-full rounded-full border border-[var(--line)] bg-[var(--surface-overlay)] px-4 py-2 text-sm font-semibold text-[var(--text)] transition hover:border-[var(--line)]"
                  label="Add Outlook"
                />
              </div>
            </section>

            <section className="rounded-[18px] border border-[var(--line)] bg-[var(--surface-overlay)] px-4 py-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">Connected accounts</p>

              {accounts.length ? (
                <div className="space-y-2">
                  {accounts.map((account) => {
                    const active = account.id === activeMailboxId;

                    return (
                      <form action={setActiveMailboxAction} key={account.id}>
                        <input name="mailboxId" type="hidden" value={account.id} />
                        <input name="nextPath" type="hidden" value={appPath(pathname || "/mail/inbox")} />
                        <button
                          className={cn(
                            "flex w-full items-center justify-between gap-3 rounded-[18px] border px-4 py-3 text-left transition",
                            active
                              ? "border-[var(--line)] bg-[var(--surface-overlay)]"
                              : "border-[var(--line)] bg-[var(--surface-overlay)] hover:border-[var(--line)] hover:bg-[var(--surface-overlay)]",
                          )}
                          type="submit"
                        >
                          <p className="min-w-0 truncate text-sm font-medium text-[var(--text)]">{account.emailAddress}</p>
                          {active ? <Check className="h-4 w-4 text-[var(--accent)]" /> : null}
                        </button>
                      </form>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-[var(--text-muted)]">No connected email accounts.</p>
              )}
            </section>
          </div>
        </div>
      ) : null}
    </div>
  );
}
