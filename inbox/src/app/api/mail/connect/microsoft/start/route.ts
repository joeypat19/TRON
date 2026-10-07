import { NextResponse } from "next/server";
import { authApiErrorResponse } from "@/lib/auth/api";
import { ensureMicrosoftMailboxAccountConnection, setActiveMailboxForCurrentUser } from "@/lib/mail/accounts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  try {
    const result = await ensureMicrosoftMailboxAccountConnection();
    if (result.status === "connected") {
      await setActiveMailboxForCurrentUser(result.mailboxId);
      return NextResponse.json({ status: "connected" });
    }

    return NextResponse.json({ status: "failed", reason: result.reason });
  } catch (error) {
    return authApiErrorResponse(error) ?? NextResponse.json({ error: "Unable to connect this mailbox." }, { status: 500 });
  }
}
