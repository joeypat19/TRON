import { redirect } from "next/navigation";
import { MailShell } from "@/components/mail/mail-shell";
import { appPath } from "@/lib/app-path";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { getMailboxContext } from "@/lib/mailbox";

export default async function MailLayout({ children }: { children: React.ReactNode }) {
  if (!(await getAuthenticatedUser())) {
    redirect(appPath("/auth"));
  }

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
