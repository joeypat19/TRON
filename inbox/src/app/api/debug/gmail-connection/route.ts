import { NextResponse } from "next/server";
import { authApiErrorResponse } from "@/lib/auth/api";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import { getMailboxAccountsForCurrentUser, getSafeDatabaseRuntimeDiagnostics } from "@/lib/mail/accounts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await requireAuthenticatedUser();
    const database = await getSafeDatabaseRuntimeDiagnostics("/api/debug/gmail-connection", user.id);
    const accounts = await getMailboxAccountsForCurrentUser();

    return NextResponse.json({
      sessionPresent: true,
      accountId: user.id,
      accountEmail: user.email,
      externalProviderAccess: false,
      tronMailboxCount: accounts.length,
      tronMailboxAddresses: accounts.map((account) => account.emailAddress),
      stage: database.failureReason ? "mailbox_query_failed" : "tron_mailbox_ready",
      database,
    });
  } catch (error) {
    return authApiErrorResponse(error) ?? NextResponse.json({ error: "Unable to load diagnostics." }, { status: 500 });
  }
}
