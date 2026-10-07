export type ParsedAddress = {
  name?: string;
  email: string;
};

export type AttachmentMetadata = {
  attachmentId: string;
  filename: string;
  mimeType: string;
  size: number;
  partId?: string;
  inline: boolean;
};

export type ParsedMessage = {
  id: string;
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
  attachments: AttachmentMetadata[];
};

export type MailboxListItem = {
  id: string;
  threadId: string;
  snippet: string;
  subject: string;
  from?: string;
  date?: string;
  labelIds: string[];
  unread: boolean;
  starred: boolean;
};
