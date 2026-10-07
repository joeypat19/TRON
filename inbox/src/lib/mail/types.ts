import type { MailboxProvider } from "@prisma/client";

export type MailAddress = {
  name?: string;
  email: string;
};

export type MailAttachment = {
  attachmentId: string;
  filename: string;
  mimeType: string;
  size: number;
  partId?: string;
  inline: boolean;
};

export type MailMessage = {
  id: string;
  provider?: MailboxProvider;
  accountId?: string;
  rawProviderId?: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  historyId?: string;
  internalDate?: string;
  subject: string;
  from?: string;
  to: string[];
  cc: string[];
  bcc: string[];
  date?: string;
  messageId?: string;
  htmlBody?: string;
  textBody?: string;
  attachments: MailAttachment[];
};

export type MailMessagePreview = {
  id: string;
  provider?: MailboxProvider;
  accountId?: string;
  rawProviderId?: string;
  threadId: string;
  snippet: string;
  subject: string;
  from?: string;
  to: string[];
  date?: string;
  internalDate?: string;
  labelIds: string[];
  unread: boolean;
  starred: boolean;
};
