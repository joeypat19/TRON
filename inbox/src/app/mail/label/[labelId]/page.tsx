import { notFound } from "next/navigation";
import { MailPage } from "@/app/mail/mail-page";
import { MailboxLoadStatePanel } from "@/components/mail/mailbox-load-state-panel";
import { getMailSystemLabelEmptyDescription, getMailSystemLabelTitle } from "@/lib/mail/mail-view-presets";
import { getMailboxContext } from "@/lib/mailbox";

export default async function LabelPage({
  params,
  searchParams,
}: {
  params: Promise<{ labelId: string }>;
  searchParams: Promise<{ pageToken?: string; history?: string }>;
}) {
  const [{ labelId }, query] = await Promise.all([params, searchParams]);
  const mailbox = await getMailboxContext();

  if (mailbox.status !== "ready") {
    return <MailboxLoadStatePanel hasConnectedAccount={mailbox.connectedAccounts.length > 0} state={mailbox.loadState} />;
  }

  const label = mailbox.labels.find((item) => item.id === labelId);

  if (!label?.id) {
    notFound();
  }

  return (
    <MailPage
      currentPath={`/mail/label/${encodeURIComponent(label.id)}`}
      emptyDescription={getMailSystemLabelEmptyDescription(label.id, label.name)}
      emptyTitle="No messages"
      history={query.history ? query.history.split(",").filter(Boolean) : []}
      labelIds={[label.id]}
      pageToken={query.pageToken}
      title={getMailSystemLabelTitle(label.id, label.name)}
    />
  );
}
