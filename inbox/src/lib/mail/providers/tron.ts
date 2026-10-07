import "server-only";

import { MailboxProvider } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import type { MailAttachment, MailMessage, MailMessagePreview } from "@/lib/mail/types";
import type {
  ConnectedMailboxAccount,
  MailProviderAdapter,
  ProviderDraft,
  ProviderFolder,
  ProviderListMessagesInput,
  ProviderListMessagesResult,
  ProviderSendMessageInput,
  ProviderSyncResult,
} from "@/lib/mail/providers/types";

const SYSTEM_FOLDERS: ProviderFolder[] = [
  { id: "INBOX", name: "Inbox", kind: "system" },
  { id: "STARRED", name: "Starred", kind: "system" },
  { id: "SENT", name: "Sent", kind: "system" },
  { id: "DRAFT", name: "Drafts", kind: "system" },
  { id: "IMPORTANT", name: "Important", kind: "system" },
  { id: "TRASH", name: "Trash", kind: "system" },
];

function parseStringArray(value: string | null | undefined) {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function toDateString(value: Date | null | undefined) {
  return value ? value.toISOString() : undefined;
}

function rowToPreview(row: {
  id: string;
  provider: MailboxProvider;
  providerMessageId: string;
  providerThreadId: string | null;
  subject: string;
  fromName: string | null;
  fromEmail: string;
  toJson: string;
  date: Date;
  snippet: string | null;
  isRead: boolean;
  isStarred: boolean;
}) : MailMessagePreview {
  return {
    id: row.id,
    provider: row.provider,
    accountId: undefined,
    rawProviderId: row.providerMessageId,
    threadId: row.providerThreadId ?? row.id,
    snippet: row.snippet ?? "",
    subject: row.subject,
    from: row.fromName ? `${row.fromName} <${row.fromEmail}>` : row.fromEmail,
    to: parseStringArray(row.toJson),
    date: toDateString(row.date),
    internalDate: String(row.date.getTime()),
    labelIds: ["INBOX"],
    unread: !row.isRead,
    starred: row.isStarred,
  };
}

function rowToMessage(row: {
  id: string;
  provider: MailboxProvider;
  mailboxAccountId: string;
  providerMessageId: string;
  providerThreadId: string | null;
  subject: string;
  fromName: string | null;
  fromEmail: string;
  toJson: string;
  ccJson: string | null;
  date: Date;
  snippet: string | null;
  plainTextBody: string | null;
  sanitizedHtmlBody: string | null;
  isRead: boolean;
  isStarred: boolean;
  isArchived: boolean;
  isTrashed: boolean;
}) : MailMessage {
  const labelIds = [
    ...(row.isTrashed ? ["TRASH"] : []),
    ...(!row.isTrashed && !row.isArchived ? ["INBOX"] : []),
    ...(row.isStarred ? ["STARRED"] : []),
  ];

  return {
    id: row.id,
    provider: row.provider,
    accountId: row.mailboxAccountId,
    rawProviderId: row.providerMessageId,
    threadId: row.providerThreadId ?? row.id,
    labelIds,
    snippet: row.snippet ?? "",
    subject: row.subject,
    from: row.fromName ? `${row.fromName} <${row.fromEmail}>` : row.fromEmail,
    to: parseStringArray(row.toJson),
    cc: parseStringArray(row.ccJson),
    bcc: [],
    date: toDateString(row.date),
    internalDate: String(row.date.getTime()),
    htmlBody: row.sanitizedHtmlBody ?? undefined,
    textBody: row.plainTextBody ?? undefined,
    attachments: [],
  };
}

function matchesQuery(row: MailMessagePreview, query: string) {
  const normalized = query.trim().toLowerCase();

  if (!normalized) {
    return true;
  }

  return [row.subject, row.snippet, row.from, ...row.to]
    .filter((value): value is string => Boolean(value))
    .some((value) => value.toLowerCase().includes(normalized));
}

function matchesLabels(row: MailMessagePreview, query: string | undefined) {
  const normalized = query?.toLowerCase() ?? "";
  if (normalized.includes("is:unread") && !row.unread) return false;
  if (normalized.includes("-is:unread") && row.unread) return false;
  if (normalized.includes("is:starred") && !row.starred) return false;
  if (normalized.includes("in:trash") && !row.labelIds.includes("TRASH")) return false;
  if (normalized.includes("in:sent")) return false;
  return true;
}

async function getRows(account: ConnectedMailboxAccount) {
  return db.mailboxMessage.findMany({
    where: {
      mailboxAccountId: account.id,
      ownerId: account.providerAccountId ?? undefined,
      isTrashed: false,
    },
    orderBy: { date: "desc" },
  });
}

async function getMessageRow(account: ConnectedMailboxAccount, messageId: string) {
  return db.mailboxMessage.findFirst({
    where: {
      mailboxAccountId: account.id,
      OR: [{ id: messageId }, { providerMessageId: messageId }],
    },
  });
}

function composeRow(account: ConnectedMailboxAccount, input: ProviderSendMessageInput, id: string) {
  const now = new Date();
  return {
    id,
    ownerId: account.providerAccountId ?? "",
    mailboxAccountId: account.id,
    provider: MailboxProvider.TRON,
    sourceEmail: account.emailAddress,
    providerMessageId: `tron-${randomUUID()}`,
    providerThreadId: id,
    subject: input.subject,
    fromName: account.displayName,
    fromEmail: account.emailAddress,
    toJson: JSON.stringify(input.to),
    ccJson: JSON.stringify(input.cc ?? []),
    date: now,
    snippet: input.body.slice(0, 240),
    plainTextBody: input.body,
    sanitizedHtmlBody: input.bodyHtml ?? null,
    isRead: true,
    isStarred: false,
    isArchived: true,
    isTrashed: false,
    hasAttachments: Boolean(input.attachments?.length),
  };
}

export const tronProviderAdapter: MailProviderAdapter = {
  provider: MailboxProvider.TRON,
  implemented: true,

  async listMessages(account, input): Promise<ProviderListMessagesResult> {
    const rows = await getRows(account);
    const messages = rows
      .map(rowToPreview)
      .filter((message) => matchesLabels(message, input.query))
      .filter((message) => matchesQuery(message, input.query?.replace(/\b(?:in|is):\S+|-[^\s]+/g, "").trim() ?? ""));
    const offset = Math.max(0, Number.parseInt(input.pageToken ?? "0", 10) || 0);
    const limit = Math.max(1, Math.min(input.maxResults ?? 25, 100));
    const page = messages.slice(offset, offset + limit);

    return {
      messages: page,
      nextPageToken: offset + limit < messages.length ? String(offset + limit) : null,
      resultSizeEstimate: messages.length,
    };
  },

  async countMessages(account, input) {
    const result = await this.listMessages(account, { ...input, maxResults: 100 });
    return result.resultSizeEstimate;
  },

  async getMessage(account, messageId) {
    const row = await getMessageRow(account, messageId);
    if (!row) throw new Error("TRON Mail message not found.");
    return rowToMessage(row);
  },

  async getThread(account, threadId) {
    const rows = await db.mailboxMessage.findMany({
      where: { mailboxAccountId: account.id, providerThreadId: threadId },
      orderBy: { date: "asc" },
    });
    return {
      id: threadId,
      historyId: undefined,
      messages: rows.map(rowToMessage),
    };
  },

  async sendMessage() {
    throw new Error("TRON Mail sending is not configured yet.");
  },

  async createDraft(account, input) {
    const id = `draft-${randomUUID()}`;
    await db.mailboxMessage.create({ data: composeRow(account, input, id) });
    return { id };
  },

  async getDraft(account, draftId): Promise<ProviderDraft> {
    const message = await this.getMessage(account, draftId);
    return { id: draftId, message };
  },

  async updateDraft(account, input) {
    const row = await getMessageRow(account, input.draftId);
    if (!row) throw new Error("TRON Mail draft not found.");
    await db.mailboxMessage.update({
      where: { id: row.id },
      data: {
        subject: input.subject,
        toJson: JSON.stringify(input.to),
        ccJson: JSON.stringify(input.cc ?? []),
        plainTextBody: input.body,
        sanitizedHtmlBody: input.bodyHtml ?? null,
        snippet: input.body.slice(0, 240),
      },
    });
    return { id: row.id };
  },

  async deleteDraft(account, draftId) {
    const row = await getMessageRow(account, draftId);
    if (row) await db.mailboxMessage.update({ where: { id: row.id }, data: { isTrashed: true } });
  },

  async archiveMessage(account, messageId) {
    const row = await getMessageRow(account, messageId);
    if (row) await db.mailboxMessage.update({ where: { id: row.id }, data: { isArchived: true } });
  },

  async trashMessage(account, messageId) {
    const row = await getMessageRow(account, messageId);
    if (row) await db.mailboxMessage.update({ where: { id: row.id }, data: { isTrashed: true } });
  },

  async markRead(account, messageId, read) {
    const row = await getMessageRow(account, messageId);
    if (row) await db.mailboxMessage.update({ where: { id: row.id }, data: { isRead: read } });
  },

  async starMessage(account, messageId, starred) {
    const row = await getMessageRow(account, messageId);
    if (row) await db.mailboxMessage.update({ where: { id: row.id }, data: { isStarred: starred } });
  },

  async listFolders() {
    return SYSTEM_FOLDERS;
  },

  async getAttachments(): Promise<MailAttachment[]> {
    return [];
  },

  async downloadAttachment() {
    throw new Error("TRON Mail attachments are not available yet.");
  },

  async syncMessages(): Promise<ProviderSyncResult> {
    return { cursor: null, syncedCount: 0 };
  },
};
