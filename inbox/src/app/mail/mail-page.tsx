import { notFound } from "next/navigation";
import { MessageListLoader } from "@/components/mail/message-list-loader";
import { MailboxLoadStatePanel } from "@/components/mail/mailbox-load-state-panel";
import { getMailboxContext, getSystemLabel } from "@/lib/mailbox";

type MailPageProps = {
  currentPath: string;
  labelIds?: string[];
  searchQuery?: string;
  searchMode?: boolean;
  includeQueryInPageHref?: boolean;
  pageToken?: string;
  history?: string[];
  title: string;
  emptyTitle: string;
  emptyDescription: string;
};

export async function MailPage({
  currentPath,
  labelIds,
  searchQuery,
  searchMode = false,
  includeQueryInPageHref = true,
  pageToken,
  history = [],
  title,
  emptyTitle,
  emptyDescription,
}: MailPageProps) {
  const mailbox = await getMailboxContext();

  if (mailbox.status !== "ready") {
    return <MailboxLoadStatePanel hasConnectedAccount={mailbox.connectedAccounts.length > 0} state={mailbox.loadState} />;
  }

  const inbox = getSystemLabel(mailbox.labels, "INBOX");

  if (!inbox) {
    notFound();
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <MessageListLoader
        currentPath={currentPath}
        emptyDescription={emptyDescription}
        emptyTitle={emptyTitle}
        history={history}
        key={[currentPath, searchQuery ?? "", pageToken ?? "", ...(labelIds ?? []), ...history].join("|")}
        labelIds={labelIds}
        pageToken={pageToken}
        route={currentPath}
        searchMode={searchMode}
        searchQuery={searchQuery}
        title={title}
        includeQueryInPageHref={includeQueryInPageHref}
      />
    </div>
  );
}
