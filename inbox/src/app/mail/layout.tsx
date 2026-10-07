import { MailShell } from "@/components/mail/mail-shell";
import { getMailboxContext } from "@/lib/mailbox";

export default async function MailLayout({ children }: { children: React.ReactNode }) {
  const mailbox = await getMailboxContext();

  return (
    <MailShell
      account={mailbox.account}
      activeMailbox={mailbox.activeMailbox}
      connectedAccounts={mailbox.connectedAccounts}
      labels={mailbox.labels}
      loadState={mailbox.loadState}
    >
      {children}
    </MailShell>
  );
}
