import { redirect } from "next/navigation";
import { ensureMicrosoftMailboxAccountConnection } from "@/lib/mail/accounts";
import { runtimeDebugLog } from "@/lib/debug/runtime-debug";
import { appPath } from "@/lib/app-path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function ConnectMicrosoftPage() {
  runtimeDebugLog("microsoft-connect-finalizer-start", {
    route: "/connect/microsoft",
    step: "microsoft-connect-finalizer",
    ok: true,
  });

  const result = await ensureMicrosoftMailboxAccountConnection();

  if (result.status === "connected") {
    runtimeDebugLog("microsoft-connect-finalizer-result", {
      route: "/connect/microsoft",
      step: "microsoft-connect-finalizer",
      ok: true,
      accountEmail: result.accountEmail,
    });
    redirect(appPath("/mail/inbox"));
  }

  runtimeDebugLog("microsoft-connect-finalizer-result", {
    route: "/connect/microsoft",
    step: "microsoft-connect-finalizer",
    ok: false,
    mappedReason: result.reason,
  });
  redirect(appPath(`/mail/inbox?connectError=${encodeURIComponent(result.reason ?? "UNKNOWN_MAILBOX_SETUP_FAILURE")}`));
}
