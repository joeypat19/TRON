import { notFound } from "next/navigation";
import { BrandCard } from "@/components/ui/brand-card";
import { BrandPageShell } from "@/components/ui/brand-page-shell";
import { getMailboxSetupDebugSnapshot } from "@/lib/mail/accounts";

export default async function MailboxSetupDebugPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  const snapshot = await getMailboxSetupDebugSnapshot();
  const googleTokenOk =
    snapshot.tokenProviderDiagnostics &&
    typeof snapshot.tokenProviderDiagnostics.google === "object" &&
    snapshot.tokenProviderDiagnostics.google &&
    "ok" in snapshot.tokenProviderDiagnostics.google
      ? String(snapshot.tokenProviderDiagnostics.google.ok)
      : "false";
  const oauthGoogleTokenOk =
    snapshot.tokenProviderDiagnostics &&
    typeof snapshot.tokenProviderDiagnostics.oauthGoogle === "object" &&
    snapshot.tokenProviderDiagnostics.oauthGoogle &&
    "ok" in snapshot.tokenProviderDiagnostics.oauthGoogle
      ? String(snapshot.tokenProviderDiagnostics.oauthGoogle.ok)
      : "false";

  return (
    <BrandPageShell className="min-h-screen px-5 py-10">
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[var(--accent)]">Mailbox diagnostics</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em] text-brand-gradient">Debug mailbox setup</h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-[var(--text-muted)]">
            This page is dev-only and never displays secrets, raw tokens, or the full database URL.
          </p>
        </div>

        <BrandCard className="p-6" tone="strong">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">Final code</p>
          <h2 className="mt-3 text-2xl font-semibold text-[var(--text)]">{snapshot.finalCode}</h2>
          <p className="mt-3 text-sm text-[var(--text-muted)]">Probable cause: {snapshot.probableCause}</p>
          <p className="mt-2 text-sm text-[var(--text-muted)]">Recommended action: {snapshot.recommendedAction}</p>
        </BrandCard>

        <div className="grid gap-4 md:grid-cols-2">
          <DiagnosticCard
            entries={[
              ["Session present", String(snapshot.sessionPresent)],
              ["TRON mailbox owner present", String(Boolean(snapshot.ownerId))],
              ["Session id present", String(snapshot.sessionIdPresent)],
              ["Connected Google external accounts", String(snapshot.googleExternalAccountCount)],
            ]}
            title="Session"
          />
          <DiagnosticCard
            entries={[
              ["DB URL present", String(snapshot.database.diagnostics.hasDatabaseUrl)],
              ["DB URL malformed", String(snapshot.database.diagnostics.databaseUrlMalformed)],
              ["Private Railway host on Vercel", String(snapshot.database.diagnostics.databaseUrlUsesRailwayInternal && snapshot.database.diagnostics.isVercel)],
              ["Prisma connect ok", String(snapshot.database.diagnostics.prismaCanConnect)],
              ["Migrations exist", String(snapshot.database.diagnostics.migrationsExist)],
              ["Required tables exist", String(snapshot.database.diagnostics.requiredTablesExist)],
            ]}
            title="Database"
          />
          <DiagnosticCard
            entries={[
              ["Selected token provider", String(snapshot.tokenProviderDiagnostics?.selectedProvider ?? "none")],
              ["google token ok", googleTokenOk],
              ["Google token check", oauthGoogleTokenOk],
              ["Gmail scopes", snapshot.gmailScopePresence.join(", ") || "none"],
            ]}
            title="OAuth"
          />
          <DiagnosticCard
            entries={[
              ["Gmail profile fetch ok", String(snapshot.gmailProfileFetch?.ok ?? false)],
              ["Gmail profile code", String(snapshot.gmailProfileFetch?.code ?? "none")],
              ["Prisma write test ok", String(snapshot.prismaWriteTest?.ok ?? false)],
              ["Prisma write code", String(snapshot.prismaWriteTest?.code ?? "none")],
            ]}
            title="Mailbox flow"
          />
        </div>
      </main>
    </BrandPageShell>
  );
}

function DiagnosticCard({ title, entries }: { title: string; entries: Array<[string, string]> }) {
  return (
    <BrandCard className="p-6">
      <h2 className="text-lg font-semibold text-[var(--text)]">{title}</h2>
      <dl className="mt-4 space-y-3">
        {entries.map(([label, value]) => (
          <div className="flex items-start justify-between gap-4" key={label}>
            <dt className="text-sm text-[var(--text-muted)]">{label}</dt>
            <dd className="max-w-[60%] break-words text-right text-sm text-[var(--text)]">{value}</dd>
          </div>
        ))}
      </dl>
    </BrandCard>
  );
}
