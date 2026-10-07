import { Suspense } from "react";
import { redirect } from "next/navigation";
import { MailColumnsBoard } from "@/components/mail/mail-columns-board";
import { MailboxLoadStatePanel } from "@/components/mail/mailbox-load-state-panel";
import { appPath } from "@/lib/app-path";
import { attemptAutomaticGmailConnectionForCurrentUser } from "@/lib/mail/accounts";
import { loadInboxBoardData } from "@/lib/mail/mail-page-data";
import { getMailboxLoadStateFromReason } from "@/lib/mailbox-state";

export default function InboxPage() {
  return (
    <Suspense fallback={<InboxBoardFallback />}>
      <InboxBoardContent />
    </Suspense>
  );
}

export async function InboxBoardContent() {
  const autoConnectResult = await attemptAutomaticGmailConnectionForCurrentUser();

  if (autoConnectResult.status === "connected") {
    redirect(appPath("/mail/inbox"));
  }

  const data = await loadInboxBoardData();
  const panelState = data.status !== "ready"
    ? autoConnectResult.status === "failed" && !data.hasConnectedAccounts
      ? getMailboxLoadStateFromReason(autoConnectResult.reason)
      : data.loadState
    : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {panelState ? (
        <MailboxLoadStatePanel
          compact
          hasConnectedAccount={data.hasConnectedAccounts}
          state={panelState}
        />
      ) : null}
      <MailColumnsBoard data={data} />
    </div>
  );
}

function InboxBoardFallback() {
  return (
    <MailColumnsBoard
      data={{
        status: "syncing",
        loadState: {
          status: "syncing",
          reason: "MAILBOX_SYNC_TIMEOUT",
          message: "Mailbox sync is taking longer than expected.",
        },
        activeMailboxId: null,
        activeMailboxEmail: null,
        hasConnectedAccounts: true,
        columns: [
          {
            id: "unread",
            title: "Unread",
            messages: [],
            loadedCount: 0,
            resultSizeEstimate: null,
            totalCount: null,
            countLabel: null,
            nextPageToken: null,
            status: "loading",
          },
          {
            id: "opened",
            title: "Opened",
            messages: [],
            loadedCount: 0,
            resultSizeEstimate: null,
            totalCount: null,
            countLabel: null,
            nextPageToken: null,
            status: "loading",
          },
          {
            id: "composed",
            title: "Sent",
            messages: [],
            loadedCount: 0,
            resultSizeEstimate: null,
            totalCount: null,
            countLabel: null,
            nextPageToken: null,
            status: "loading",
          },
        ],
      }}
    />
  );
}
