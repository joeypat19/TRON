import type { MailboxProvider } from "@prisma/client";
import { SUPPORTED_MAILBOX_PROVIDERS } from "@/lib/mail/provider-config";

export type MailboxProviderValue = MailboxProvider;

export const MAILBOX_PROVIDER_VALUES = SUPPORTED_MAILBOX_PROVIDERS;

export const MAILBOX_PROVIDER_LABELS: Record<MailboxProviderValue, string> = {
  TRON: "TRON Mail",
  GMAIL: "Gmail",
  MICROSOFT: "Outlook",
  IMAP_SMTP: "Unsupported",
};
