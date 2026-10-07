import type { Metadata } from "next";
import { GmailAccessStateCard } from "@/components/auth/gmail-access-state";
import { ComposeForm } from "@/components/mail/compose-form";
import { MailboxLoadStatePanel } from "@/components/mail/mailbox-load-state-panel";
import { getMailboxErrorState } from "@/lib/mail/accounts";
import { GmailAuthError } from "@/lib/gmail/client";
import { getProviderAdapter } from "@/lib/mail/providers";
import { getMailboxContext } from "@/lib/mailbox";

export const metadata: Metadata = {
  title: "Compose",
};

export default async function ComposePage({
  searchParams,
}: {
  searchParams: Promise<{ draftId?: string }>;
}) {
  const mailbox = await getMailboxContext();

  if (mailbox.status !== "ready") {
    return <MailboxLoadStatePanel hasConnectedAccount={mailbox.connectedAccounts.length > 0} state={mailbox.loadState} />;
  }

  const { draftId } = await searchParams;
  let draft = null;
  const provider = getProviderAdapter(mailbox.activeMailbox.provider);

  if (draftId && provider.getDraft) {
    try {
      draft = await provider.getDraft(mailbox.activeMailbox, draftId);
    } catch (error) {
      if (error instanceof GmailAuthError) {
        return <GmailAccessStateCard state={getMailboxErrorState(error.reason)} />;
      }

      throw error;
    }
  }

  return (
    <ComposeForm
      activeMailboxEmail={mailbox.activeMailbox.emailAddress}
      defaultValues={
        draft
          ? {
              to: draft.message.to.join(", "),
              cc: draft.message.cc.join(", "),
              bcc: draft.message.bcc.join(", "),
              subject: draft.message.subject,
              body: draft.message.textBody ?? draft.message.htmlBody ?? "",
            }
          : undefined
      }
      draftId={draft?.id}
    />
  );
}
