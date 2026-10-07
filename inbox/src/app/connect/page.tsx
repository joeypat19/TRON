import { ConnectGmailButton } from "@/components/auth/connect-gmail-button";
import { ConnectMicrosoftButton } from "@/components/auth/connect-microsoft-button";
import { Logo } from "@/components/brand/logo";
import { BrandCard } from "@/components/ui/brand-card";
import { BrandPageShell } from "@/components/ui/brand-page-shell";
import { CONNECTABLE_MAILBOX_PROVIDERS } from "@/lib/mail/provider-config";
import { providerDirectory } from "@/lib/mail/providers/catalog";

const providerOrder = CONNECTABLE_MAILBOX_PROVIDERS;

export default function ConnectPage() {
  return (
    <BrandPageShell className="min-h-screen px-5 py-10">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <div className="max-w-3xl">
          <Logo framed={false} priority size="md" />
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[var(--accent)]">Mailbox Connections</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em] text-brand-gradient">
            Connect a supported mailbox
          </h1>
          <p className="mt-4 text-base leading-7 text-[var(--text-muted)]">
            Inbox only shows supported mailbox connections here. Unsupported providers are hidden from the product.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          {providerOrder.map((provider) => {
            const entry = providerDirectory[provider];

            return (
              <BrandCard className="flex h-full flex-col justify-between p-6" key={provider} tone="strong">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
                    {entry.shortName}
                  </p>
                  <h2 className="mt-3 text-2xl font-semibold text-[var(--text)]">{entry.title}</h2>
                  <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">{entry.copy}</p>
                </div>

                <div className="mt-6">
                  {entry.implemented ? (
                    entry.shortName === "Outlook" ? (
                      <ConnectMicrosoftButton
                        buttonClassName="min-h-11 w-full md:w-auto"
                        label={entry.title}
                      />
                    ) : (
                      <ConnectGmailButton
                        buttonClassName="min-h-11 w-full md:w-auto"
                        label={entry.title}
                      />
                    )
                  ) : (
                    <div className="space-y-3">
                      <span className="inline-flex items-center rounded-full border border-[var(--line)] bg-[var(--surface-overlay)] px-4 py-2 text-sm text-[var(--text-muted)]">
                        Not available yet
                      </span>
                      <p className="text-sm text-[var(--text-muted)]">{entry.disabledMessage}</p>
                    </div>
                  )}
                </div>
              </BrandCard>
            );
          })}
        </div>
      </main>
    </BrandPageShell>
  );
}
