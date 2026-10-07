import type { MailboxProvider, UserMailboxAccount } from "@prisma/client";
import type { MailAttachment, MailMessage, MailMessagePreview } from "@/lib/mail/types";

export type MailboxAccessState = {
  reason: string;
  title: string;
  description: string;
  actionLabel: string;
};

export type ConnectedMailboxAccount = Pick<
  UserMailboxAccount,
  | "id"
  | "provider"
  | "emailAddress"
  | "displayName"
  | "providerAccountId"
  | "status"
  | "lastSyncAt"
  | "syncError"
  | "createdAt"
  | "updatedAt"
>;

export type ProviderFolder = {
  id: string;
  name: string;
  kind: "system" | "user";
};

export type ProviderListMessagesInput = {
  labelIds?: string[];
  query?: string;
  pageToken?: string;
  maxResults?: number;
};

export type ProviderListMessagesResult = {
  messages: MailMessagePreview[];
  nextPageToken: string | null;
  resultSizeEstimate: number;
};

export type ProviderSendMessageInput = {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  bodyHtml?: string;
  plainTextMode?: boolean;
  attachments?: ProviderComposeAttachment[];
};

export type ProviderComposeAttachment = {
  filename: string;
  mimeType: string;
  contentBase64: string;
  inline?: boolean;
  contentId?: string;
};

export type ProviderDraft = {
  id: string;
  message: MailMessage;
};

export type ProviderSyncResult = {
  cursor: string | null;
  syncedCount: number;
};

export class UnsupportedMailboxProviderError extends Error {
  constructor(provider: MailboxProvider) {
    super(`${provider} is not a supported mailbox provider.`);
    this.name = "UnsupportedMailboxProviderError";
  }
}

export interface MailProviderAdapter {
  readonly provider: MailboxProvider;
  readonly implemented: boolean;

  listMessages(account: ConnectedMailboxAccount, input: ProviderListMessagesInput): Promise<ProviderListMessagesResult>;
  countMessages?(
    account: ConnectedMailboxAccount,
    input: Pick<ProviderListMessagesInput, "labelIds" | "query">,
  ): Promise<number>;
  getMessage(account: ConnectedMailboxAccount, messageId: string): Promise<MailMessage>;
  getThread?(account: ConnectedMailboxAccount, threadId: string): Promise<{ id: string; historyId?: string; messages: MailMessage[] }>;
  sendMessage(account: ConnectedMailboxAccount, input: ProviderSendMessageInput): Promise<unknown>;
  createDraft(account: ConnectedMailboxAccount, input: ProviderSendMessageInput): Promise<{ id?: string | null }>;
  getDraft?(account: ConnectedMailboxAccount, draftId: string): Promise<ProviderDraft>;
  updateDraft?(
    account: ConnectedMailboxAccount,
    input: ProviderSendMessageInput & { draftId: string },
  ): Promise<{ id?: string | null }>;
  deleteDraft?(account: ConnectedMailboxAccount, draftId: string): Promise<void>;
  archiveMessage(account: ConnectedMailboxAccount, messageId: string): Promise<void>;
  trashMessage(account: ConnectedMailboxAccount, messageId: string): Promise<void>;
  markRead(account: ConnectedMailboxAccount, messageId: string, read: boolean): Promise<void>;
  starMessage(account: ConnectedMailboxAccount, messageId: string, starred: boolean): Promise<void>;
  listFolders(account: ConnectedMailboxAccount): Promise<ProviderFolder[]>;
  getAttachments?(account: ConnectedMailboxAccount, messageId: string): Promise<MailAttachment[]>;
  downloadAttachment?(account: ConnectedMailboxAccount, messageId: string, attachmentId: string): Promise<string>;
  syncMessages(account: ConnectedMailboxAccount): Promise<ProviderSyncResult>;
  getAccessState?(reason: string): MailboxAccessState;
}
