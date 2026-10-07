import type { MailboxProvider } from "@prisma/client";
import { CONNECTABLE_MAILBOX_PROVIDERS, REQUIRED_MICROSOFT_SCOPES } from "@/lib/mail/provider-config";
import { appPath } from "@/lib/app-path";

export type ProviderCardConfig = {
  title: string;
  shortName: string;
  copy: string;
  href: string;
  implemented: boolean;
  disabledMessage?: string;
  plannedScopes?: readonly string[];
};

export const providerDirectory: Record<MailboxProvider, ProviderCardConfig> = {
  TRON: {
    title: "TRON Mail",
    shortName: "TRON Mail",
    copy: "Native TRON mailbox storage.",
    href: appPath("/mail/inbox"),
    implemented: true,
  },
  GMAIL: {
    title: "Connect Gmail",
    shortName: "Gmail",
    copy: "For Gmail and Google Workspace.",
    href: appPath("/connect/gmail"),
    implemented: true,
  },
  MICROSOFT: {
    title: "Connect Outlook",
    shortName: "Outlook",
    copy: "For Outlook, Hotmail, Microsoft 365, and Exchange Online.",
    href: appPath("/connect/microsoft"),
    implemented: true,
    plannedScopes: REQUIRED_MICROSOFT_SCOPES,
  },
  IMAP_SMTP: {
    title: "Unsupported",
    shortName: "Unsupported",
    copy: "Unsupported providers are not available in Inbox.",
    href: appPath("/connect"),
    implemented: false,
    disabledMessage: "Unsupported providers are hidden from the product.",
  },
};

export function getConnectableProviders() {
  return CONNECTABLE_MAILBOX_PROVIDERS.map((provider) => providerDirectory[provider]);
}
