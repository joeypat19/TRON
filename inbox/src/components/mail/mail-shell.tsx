import { MailShellClient } from "@/components/mail/mail-shell-client";
import type { MailShellProps } from "@/components/mail/mail-shell-client";

export function MailShell(props: MailShellProps) {
  return <MailShellClient {...props} />;
}
