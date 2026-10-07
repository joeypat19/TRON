import { ConnectGmailButton } from "@/components/auth/connect-gmail-button";
import { ConnectMicrosoftButton } from "@/components/auth/connect-microsoft-button";
import { BrandCard } from "@/components/ui/brand-card";
import { BrandPageShell } from "@/components/ui/brand-page-shell";
import {
  getMailboxAccountsForCurrentUser,
  getMailboxProviderLabel,
  getMailboxStatusLabel,
  requireSessionUser,
} from "@/lib/mail/accounts";

export default async function AccountsSettingsPage() {
  const [sessionUser, accounts] = await Promise.all([requireSessionUser(), getMailboxAccountsForCurrentUser()]);

  return (
    <BrandPageShell className="min-h-screen px-5 py-10">
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[var(--accent)]">Settings</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em] text-brand-gradient">
              Connected mailboxes
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-[var(--text-muted)]">
              Signed in as {sessionUser.email ?? sessionUser.name ?? "your TRON Mail account"}. Connected mailboxes are
              stored separately from your TRON account session.
            </p>
          </div>

          <div className="w-full md:w-auto">
            <div className="flex flex-col gap-3 md:flex-row">
              <ConnectGmailButton
                buttonClassName="min-h-11 w-full md:w-auto"
                label="Add Gmail"
              />
              <ConnectMicrosoftButton
                buttonClassName="min-h-11 w-full md:w-auto"
                label="Add Outlook"
              />
            </div>
          </div>
        </div>
        {accounts.length ? (
          <div className="grid gap-4">
            {accounts.map((account) => (
              <BrandCard className="p-6" key={account.id}>
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="rounded-full border border-[var(--line)] bg-[var(--surface-overlay)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
                        {getMailboxProviderLabel(account.provider)}
                      </span>
                      <span className="rounded-full border border-[var(--line)] bg-[var(--surface-overlay)] px-3 py-1 text-xs text-[var(--text-muted)]">
                        {getMailboxStatusLabel(account.status)}
                      </span>
                    </div>
                    <h2 className="mt-4 text-2xl font-semibold text-[var(--text)]">{account.emailAddress}</h2>
                    <p className="mt-2 text-sm text-[var(--text-muted)]">
                      {account.displayName ?? "No mailbox display name stored."}
                    </p>
                  </div>

                  <div className="text-sm text-[var(--text-muted)]">
                    <p>Connected: {account.createdAt.toLocaleString()}</p>
                    <p className="mt-1">Updated: {account.updatedAt.toLocaleString()}</p>
                    {account.lastSyncAt ? <p className="mt-1">Last sync: {account.lastSyncAt.toLocaleString()}</p> : null}
                    {account.syncError ? <p className="mt-2 text-[var(--text-muted)]">This mailbox needs attention before it can sync again.</p> : null}
                  </div>
                </div>
              </BrandCard>
            ))}
          </div>
        ) : (
          <BrandCard className="p-8 text-center" tone="strong">
            <h2 className="text-2xl font-semibold text-[var(--text)]">No mailbox accounts connected yet</h2>
              <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
              Connect Gmail or Outlook to start loading your inbox.
              </p>
          </BrandCard>
        )}
      </main>
    </BrandPageShell>
  );
}
