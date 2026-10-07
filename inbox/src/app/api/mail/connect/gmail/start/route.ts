import { NextResponse } from "next/server";
import { ensureGmailMailboxAccountConnection, setActiveMailboxForCurrentUser } from "@/lib/mail/accounts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  const result = await ensureGmailMailboxAccountConnection();
  if (result.status === "connected") {
    await setActiveMailboxForCurrentUser(result.mailboxId);
    return NextResponse.json({ status: "connected" });
  }

  return NextResponse.json({ status: "failed", reason: result.reason });
}
