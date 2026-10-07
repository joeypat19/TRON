import { NextResponse } from "next/server";
import { getMailboxAccountsForCurrentUser, getSafeDatabaseRuntimeDiagnostics } from "@/lib/mail/accounts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const database = await getSafeDatabaseRuntimeDiagnostics("/api/debug/gmail-connection", "troninbox-public");
  const accounts = await getMailboxAccountsForCurrentUser();

  return NextResponse.json({
    sessionPresent: false,
    accountId: null,
    accountEmail: null,
    externalProviderAccess: false,
    tronMailboxCount: accounts.length,
    tronMailboxAddresses: accounts.map((account) => account.emailAddress),
    stage: database.failureReason ? "mailbox_query_failed" : "tron_mailbox_ready",
    database,
  });
}
