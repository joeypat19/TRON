import { MailColumnsBoard } from "@/components/mail/mail-columns-board";

export default function InboxLoading() {
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
