import "server-only";

import { db } from "@/lib/db";
import { runtimeDebugLog, withRuntimeDebugStep } from "@/lib/debug/runtime-debug";
import { GmailAccessError } from "@/lib/gmail/client";
import { getProviderAdapter } from "@/lib/mail/providers";
import { messageMatchesPrefix, normalizeSearchText, searchMailMessages } from "@/lib/mail/search";
import type { MailMessagePreview } from "@/lib/mail/types";
import { getMailboxSetupDiagnostic, logMailboxStep } from "@/lib/mail/setup-diagnostics";
import { getMailboxLoadStateFromReason, mapMailboxFailure, type MailboxLoadState } from "@/lib/mailbox-state";
import { getMailboxContext } from "@/lib/mailbox";

export type MailMessageSummary = {
  id: string;
  threadId: string;
  subject: string;
  snippet: string;
  from?: string;
  to: string[];
  date?: string;
  internalDate?: string;
  unread: boolean;
  starred: boolean;
  labelIds: string[];
};

export type MailSectionId = "unread" | "opened" | "composed";

export type MailColumn = {
  id: MailSectionId;
  title: string;
  messages: MailMessageSummary[];
  loadedCount: number;
  resultSizeEstimate: number | null;
  totalCount: number | null;
  countLabel: string | null;
  nextPageToken: string | null;
  status: "ready" | "loading" | "error";
};

export type InboxBoardData =
  | {
      status: "ready";
      loadState: MailboxLoadState;
      activeMailboxId: string;
      activeMailboxEmail: string;
      hasConnectedAccounts: true;
      columns: MailColumn[];
    }
  | {
      status: Exclude<MailboxLoadState["status"], "ready">;
      loadState: Exclude<MailboxLoadState, { status: "ready" }>;
      activeMailboxId: string | null;
      activeMailboxEmail: string | null;
      hasConnectedAccounts: boolean;
      columns: MailColumn[];
    };

type MailPageResult =
  | {
      status: "ready";
      accountId: string;
      messages: MailMessagePreview[];
      nextPageHref: string | null;
      previousPageHref: string | null;
    }
  | Exclude<MailboxLoadState, { status: "ready" }>;

type LoadMailPageInput = {
  route: string;
  currentPath: string;
  labelIds?: string[];
  searchQuery?: string;
  includeQueryInPageHref?: boolean;
  pageToken?: string;
  history?: string[];
};

export const DEFAULT_INBOX_SECTION_PAGE_SIZE = 25;

export const INBOX_COLUMNS = [
  {
    id: "unread" as const,
    title: "Unread",
    query: "in:inbox is:unread",
  },
  {
    id: "opened" as const,
    title: "Opened",
    query: "in:inbox -is:unread",
  },
  {
    id: "composed" as const,
    title: "Sent",
    query: "in:sent",
  },
] as const;

type InboxColumnDefinition = (typeof INBOX_COLUMNS)[number];

export type InboxSectionPageData =
  | {
      status: "ready";
      column: MailColumn;
    }
  | Exclude<MailboxLoadState, { status: "ready" }>;

export type MailSearchResult =
  | {
      status: "ready";
      accountId: string;
      query: string;
      messages: MailMessagePreview[];
      nextPageToken: string | null;
      resultSizeEstimate: number | null;
    }
  | Exclude<MailboxLoadState, { status: "ready" }>;

const DEFAULT_MAIL_SEARCH_LIMIT = 10;
const MAX_MAIL_SEARCH_LIMIT = 50;
const MAIL_SEARCH_FETCH_BATCH = 50;
const MAIL_SEARCH_MAX_FIELD_FETCHES = 1;
const MAIL_SEARCH_RECENT_FALLBACK_PAGES = 4;
const MAIL_SEARCH_CACHE_CANDIDATE_LIMIT = 150;

function buildColumnSkeleton(status: "loading" | "error"): MailColumn[] {
  return INBOX_COLUMNS.map((column) => ({
    id: column.id,
    title: column.title,
    messages: [],
    loadedCount: 0,
    resultSizeEstimate: null,
    totalCount: null,
    countLabel: null,
    nextPageToken: null,
    status,
  }));
}

function toMessageSummary(message: MailMessagePreview): MailMessageSummary {
  return {
    id: message.id,
    threadId: message.threadId,
    subject: message.subject,
    snippet: message.snippet,
    from: message.from,
    to: message.to,
    date: message.date,
    internalDate: message.internalDate,
    unread: message.unread,
    starred: message.starred,
    labelIds: message.labelIds,
  };
}

function getInboxColumnDefinition(sectionId: MailSectionId): InboxColumnDefinition {
  const column = INBOX_COLUMNS.find((candidate) => candidate.id === sectionId);

  if (!column) {
    throw new Error(`Unsupported inbox section: ${sectionId}`);
  }

  return column;
}

function getSafeMailboxErrorDetails(error: unknown) {
  if (!(error instanceof GmailAccessError) || !error.details || typeof error.details !== "object") {
    return {};
  }

  return error.details;
}

function formatLoadedCountLabel(loadedCount: number) {
  return `${loadedCount} loaded`;
}

function buildReadyColumn(
  column: InboxColumnDefinition,
  result: {
    messages: MailMessagePreview[];
    nextPageToken: string | null;
    resultSizeEstimate: number;
    totalCount: number | null;
  },
): MailColumn {
  const loadedCount = result.messages.length;
  const hasEstimate = Number.isFinite(result.resultSizeEstimate) && result.resultSizeEstimate >= 0;
  const resultSizeEstimate = hasEstimate ? result.resultSizeEstimate : null;
  const totalCount = Number.isFinite(result.totalCount) ? result.totalCount : null;

  return {
    id: column.id,
    title: column.title,
    messages: result.messages.map(toMessageSummary),
    loadedCount,
    resultSizeEstimate,
    totalCount,
    countLabel: totalCount !== null ? String(totalCount) : formatLoadedCountLabel(loadedCount),
    nextPageToken: result.nextPageToken,
    status: "ready",
  };
}

async function fetchInboxColumn(
  mailbox: Extract<Awaited<ReturnType<typeof getMailboxContext>>, { status: "ready" }>,
  column: InboxColumnDefinition,
  input?: {
    pageToken?: string;
    maxResults?: number;
    route?: string;
  },
) {
  const provider = getProviderAdapter(mailbox.activeMailbox.provider);

  return withRuntimeDebugStep(
    "gmail-inbox-section-fetch",
    {
      route: input?.route ?? "/mail/inbox",
      userId: mailbox.account.id,
      step: "gmail-inbox-section-fetch",
      section: column.id,
    },
    async () => {
      const [listResult, totalCount] = await Promise.all([
        withTimeout(
          provider.listMessages(mailbox.activeMailbox, {
            query: column.query,
            pageToken: input?.pageToken,
            maxResults: input?.maxResults ?? DEFAULT_INBOX_SECTION_PAGE_SIZE,
          }),
          10_000,
          `${column.id} mailbox section fetch`,
        ),
        input?.pageToken
          ? Promise.resolve(null)
          : provider.countMessages
            ? withTimeout(
                provider.countMessages(mailbox.activeMailbox, {
                  query: column.query,
                }),
                20_000,
                `${column.id} mailbox total count fetch`,
              )
            : Promise.resolve(null),
      ]);

      return {
        ...listResult,
        totalCount,
      };
    },
  );
}

export async function loadInboxBoardData(): Promise<InboxBoardData> {
  const mailbox = await getMailboxContext();

  if (mailbox.status !== "ready") {
    return {
      status: mailbox.loadState.status,
      loadState: mailbox.loadState,
      activeMailboxId: mailbox.activeMailbox?.id ?? null,
      activeMailboxEmail: mailbox.activeMailbox?.emailAddress ?? null,
      hasConnectedAccounts: (mailbox.connectedAccounts?.length ?? 0) > 0,
      columns: buildColumnSkeleton(
        mailbox.loadState.status === "syncing" ? "loading" : "error",
      ),
    };
  }

  try {
    logMailboxStep({
      step: "initial_mailbox_query",
      status: "start",
      metadata: { route: "/mail/inbox", userId: mailbox.account.id },
    });
    const columns = await withTimeout(
      Promise.all(
        INBOX_COLUMNS.map((column) =>
          fetchInboxColumn(mailbox, column, {
            maxResults: DEFAULT_INBOX_SECTION_PAGE_SIZE,
            route: "/mail/inbox",
          }),
        ),
      ),
      8_000,
      "mailbox board fetch",
    );

    const readyState: InboxBoardData = {
      status: "ready",
      loadState: { status: "ready", reason: null, message: null },
      activeMailboxId: mailbox.activeMailbox.id,
      activeMailboxEmail: mailbox.activeMailbox.emailAddress,
      hasConnectedAccounts: true,
      columns: INBOX_COLUMNS.map((column, index) => buildReadyColumn(column, columns[index])),
    };
    logMailboxStep({
      step: "initial_mailbox_query",
      status: "ok",
      metadata: { route: "/mail/inbox", userId: mailbox.account.id },
    });
    return readyState;
  } catch (error) {
    const loadState =
      error instanceof Error && error.message.toLowerCase().includes("timed out")
        ? getMailboxLoadStateFromReason("MAILBOX_SYNC_TIMEOUT")
        : mapMailboxFailure(error).state.reason === "UNKNOWN_MAILBOX_SETUP_FAILURE"
          ? getMailboxLoadStateFromReason("MAILBOX_LIST_FETCH_FAILED")
          : mapMailboxFailure(error).state;

    logMailboxStep({
      step: "initial_mailbox_query",
      status: "fail",
      code: loadState.reason,
      metadata: { route: "/mail/inbox", userId: mailbox.account.id },
      recommendedAction: getMailboxSetupDiagnostic(loadState.reason, "initial_mailbox_query").recommendedAction,
    });

    runtimeDebugLog("mailbox-board-fetch-failed", {
      route: "/mail/inbox",
      userId: mailbox.account.id,
      step: "mailbox-board-fetch",
      ok: false,
      mappedReason: loadState.reason,
      activeMailboxEmail: mailbox.activeMailbox.emailAddress,
      errorName: error instanceof Error ? error.name : typeof error,
      errorMessage: error instanceof Error ? error.message : String(error),
      ...getSafeMailboxErrorDetails(error),
    });

    return {
      status: loadState.status,
      loadState,
      activeMailboxId: mailbox.activeMailbox.id,
      activeMailboxEmail: mailbox.activeMailbox.emailAddress,
      hasConnectedAccounts: (mailbox.connectedAccounts?.length ?? 0) > 0,
      columns: buildColumnSkeleton(loadState.status === "syncing" ? "loading" : "error"),
    };
  }
}

export async function loadInboxSectionData(
  sectionId: MailSectionId,
  input?: {
    pageToken?: string;
    maxResults?: number;
    route?: string;
  },
): Promise<InboxSectionPageData> {
  const mailbox = await getMailboxContext();

  if (mailbox.status !== "ready") {
    return mailbox.loadState;
  }

  const column = getInboxColumnDefinition(sectionId);

  try {
    logMailboxStep({
      step: "mailbox_list_fetch",
      status: "start",
      metadata: {
        route: input?.route ?? "/api/mail/messages",
        userId: mailbox.account.id,
        section: sectionId,
      },
    });

    const result = await fetchInboxColumn(mailbox, column, input);

    logMailboxStep({
      step: "mailbox_list_fetch",
      status: "ok",
      metadata: {
        route: input?.route ?? "/api/mail/messages",
        userId: mailbox.account.id,
        section: sectionId,
        messageCount: result.messages.length,
      },
    });

    return {
      status: "ready",
      column: buildReadyColumn(column, result),
    };
  } catch (error) {
    const mapped =
      error instanceof Error && error.message.toLowerCase().includes("timed out")
        ? getMailboxLoadStateFromReason("MAILBOX_SYNC_TIMEOUT")
        : (() => {
            const state = mapMailboxFailure(error).state;
            return state.reason === "UNKNOWN_MAILBOX_SETUP_FAILURE"
              ? getMailboxLoadStateFromReason("MAILBOX_LIST_FETCH_FAILED")
              : state;
          })();

    logMailboxStep({
      step: "mailbox_list_fetch",
      status: "fail",
      code: mapped.reason,
      metadata: {
        route: input?.route ?? "/api/mail/messages",
        userId: mailbox.account.id,
        section: sectionId,
      },
      recommendedAction: getMailboxSetupDiagnostic(mapped.reason, "mailbox_list_fetch").recommendedAction,
    });

    runtimeDebugLog("gmail-inbox-section-fetch-failed", {
      route: input?.route ?? "/api/mail/messages",
      userId: mailbox.account.id,
      step: "gmail-inbox-section-fetch",
      ok: false,
      section: sectionId,
      mappedReason: mapped.reason,
      errorName: error instanceof Error ? error.name : typeof error,
      errorMessage: error instanceof Error ? error.message : String(error),
      ...getSafeMailboxErrorDetails(error),
    });

    return mapped;
  }
}

export async function loadMailPageData(input: LoadMailPageInput): Promise<MailPageResult> {
  const mailbox = await getMailboxContext();

  if (mailbox.status !== "ready") {
    return mailbox.loadState;
  }

  const provider = getProviderAdapter(mailbox.activeMailbox.provider);
  const history = input.history ?? [];

  try {
    logMailboxStep({
      step: "mailbox_list_fetch",
      status: "start",
      metadata: { route: input.route, userId: mailbox.account.id },
    });
    const result = await withRuntimeDebugStep(
      "gmail-message-list-fetch",
      {
        route: input.route,
        userId: mailbox.account.id,
        step: "gmail-message-list-fetch",
      },
      async () =>
        withTimeout(
          provider.listMessages(mailbox.activeMailbox, {
            labelIds: input.labelIds,
            query: input.searchQuery,
            pageToken: input.pageToken,
          }),
          10_000,
          "gmail message list fetch",
        ),
    );

    const nextParams = new URLSearchParams();
    const prevParams = new URLSearchParams();

    if (input.searchQuery && input.includeQueryInPageHref !== false) {
      nextParams.set("q", input.searchQuery);
      prevParams.set("q", input.searchQuery);
    }

    if (result.nextPageToken) {
      nextParams.set("pageToken", result.nextPageToken);
    }

    if ([...history, input.pageToken].filter(Boolean).length) {
      nextParams.set("history", [...history, input.pageToken].filter(Boolean).join(","));
    }

    const previousHistory = [...history];
    const previousToken = previousHistory.pop();

    if (previousToken) {
      prevParams.set("pageToken", previousToken);
    }

    if (previousHistory.length) {
      prevParams.set("history", previousHistory.join(","));
    }

    const readyState: MailPageResult = {
      status: "ready",
      accountId: mailbox.activeMailbox.id,
      messages: result.messages,
      nextPageHref: result.nextPageToken ? `${input.currentPath}?${nextParams.toString()}` : null,
      previousPageHref: previousToken || previousHistory.length ? `${input.currentPath}?${prevParams.toString()}` : null,
    };
    logMailboxStep({
      step: "mailbox_list_fetch",
      status: "ok",
      metadata: { route: input.route, userId: mailbox.account.id, messageCount: result.messages.length },
    });
    return readyState;
  } catch (error) {
    const mapped =
      error instanceof Error && error.message.toLowerCase().includes("timed out")
        ? getMailboxLoadStateFromReason("MAILBOX_SYNC_TIMEOUT")
        : (() => {
            const state = mapMailboxFailure(error).state;
            return state.reason === "UNKNOWN_MAILBOX_SETUP_FAILURE"
              ? getMailboxLoadStateFromReason("MAILBOX_LIST_FETCH_FAILED")
              : state;
          })();

    logMailboxStep({
      step: "mailbox_list_fetch",
      status: "fail",
      code: mapped.reason,
      metadata: { route: input.route, userId: mailbox.account.id },
      recommendedAction: getMailboxSetupDiagnostic(mapped.reason, "mailbox_list_fetch").recommendedAction,
    });

    runtimeDebugLog("gmail-message-list-fetch-failed", {
      route: input.route,
      userId: mailbox.account.id,
      step: "gmail-message-list-fetch",
      ok: false,
      mappedReason: mapped.reason,
      errorName: error instanceof Error ? error.name : typeof error,
      errorMessage: error instanceof Error ? error.message : String(error),
      ...getSafeMailboxErrorDetails(error),
    });

    return mapped;
  }
}

function mapCachedMailboxMessageToPreview(message: {
  providerMessageId: string;
  providerThreadId: string | null;
  subject: string;
  snippet: string | null;
  fromName: string | null;
  fromEmail: string;
  toJson: string;
  date: Date;
  isRead: boolean;
  isStarred: boolean;
  hasAttachments: boolean;
}) {
  let recipients: string[] = [];

  try {
    const parsed = JSON.parse(message.toJson) as Array<{ name?: string | null; email?: string | null }>;
    recipients = parsed
      .map((recipient) => {
        const email = recipient.email?.trim();
        const name = recipient.name?.trim();

        if (name && email) {
          return `${name} <${email}>`;
        }

        return name || email || "";
      })
      .filter(Boolean);
  } catch {
    recipients = [];
  }

  return {
    id: message.providerMessageId,
    threadId: message.providerThreadId ?? message.providerMessageId,
    subject: message.subject,
    snippet: message.snippet ?? "",
    from: message.fromName ? `${message.fromName} <${message.fromEmail}>` : message.fromEmail,
    to: recipients,
    date: message.date.toUTCString(),
    internalDate: String(message.date.getTime()),
    unread: !message.isRead,
    starred: message.isStarred,
    labelIds: [
      ...(!message.isRead ? ["UNREAD"] : []),
      ...(message.isStarred ? ["STARRED"] : []),
      ...(message.hasAttachments ? ["HAS_ATTACHMENTS"] : []),
    ],
  } satisfies MailMessagePreview;
}

export function rankMailboxSearchMessages(messages: MailMessagePreview[], query: string, limit = DEFAULT_MAIL_SEARCH_LIMIT) {
  return searchMailMessages(messages, query, {
    limit,
    sort: "newest",
  });
}

async function searchCachedMailboxMessages(
  mailbox: Extract<Awaited<ReturnType<typeof getMailboxContext>>, { status: "ready" }>,
  query: string,
  limit: number,
) {
  const normalizedQuery = normalizeSearchText(query);

  if (!normalizedQuery) {
    return [];
  }

  const cachedMessages = await db.mailboxMessage.findMany({
    where: {
      ownerId: mailbox.account.id,
      mailboxAccountId: mailbox.activeMailbox.id,
      OR: [
        { fromName: { startsWith: normalizedQuery, mode: "insensitive" } },
        { fromEmail: { startsWith: normalizedQuery, mode: "insensitive" } },
        { subject: { startsWith: normalizedQuery, mode: "insensitive" } },
        { toJson: { contains: normalizedQuery, mode: "insensitive" } },
      ],
    },
    orderBy: [{ date: "desc" }],
    take: MAIL_SEARCH_CACHE_CANDIDATE_LIMIT,
    select: {
      providerMessageId: true,
      providerThreadId: true,
      subject: true,
      snippet: true,
      fromName: true,
      fromEmail: true,
      toJson: true,
      date: true,
      isRead: true,
      isStarred: true,
      hasAttachments: true,
    },
  });

  return rankMailboxSearchMessages(
    cachedMessages.map(mapCachedMailboxMessageToPreview),
    query,
    limit,
  );
}

async function collectGmailFieldCandidates(
  provider: ReturnType<typeof getProviderAdapter>,
  mailbox: Extract<Awaited<ReturnType<typeof getMailboxContext>>, { status: "ready" }>,
  query: string,
  initialPageToken?: string,
) {
  const collected = new Map<string, MailMessagePreview>();
  let primaryNextPageToken: string | null = null;
  let primaryResultSizeEstimate: number | null = null;
  const fieldQueries = [`from:${query}`, `to:${query}`, `subject:${query}`];

  for (const [queryIndex, fieldQuery] of fieldQueries.entries()) {
    let nextPageToken: string | undefined = queryIndex === 0 ? initialPageToken : undefined;

    for (let fetchIndex = 0; fetchIndex < MAIL_SEARCH_MAX_FIELD_FETCHES; fetchIndex += 1) {
      const result = await provider.listMessages(mailbox.activeMailbox, {
        query: fieldQuery,
        pageToken: nextPageToken,
        maxResults: MAIL_SEARCH_FETCH_BATCH,
      });

      if (queryIndex === 0 && fetchIndex === 0) {
        primaryNextPageToken = result.nextPageToken;
        primaryResultSizeEstimate = result.resultSizeEstimate ?? null;
      }

      for (const message of result.messages) {
        if (messageMatchesPrefix(message, query)) {
          collected.set(message.id, message);
        }
      }

      if (!result.nextPageToken) {
        break;
      }

      nextPageToken = result.nextPageToken;
    }
  }

  return {
    messages: [...collected.values()],
    nextPageToken: primaryNextPageToken,
    resultSizeEstimate: primaryResultSizeEstimate,
  };
}

async function collectRecentGmailPrefixCandidates(
  provider: ReturnType<typeof getProviderAdapter>,
  mailbox: Extract<Awaited<ReturnType<typeof getMailboxContext>>, { status: "ready" }>,
  existingMessages: MailMessagePreview[],
  limit: number,
  query: string,
) {
  const rankedExisting = rankMailboxSearchMessages(existingMessages, query, limit);

  if (rankedExisting.length >= limit) {
    return existingMessages;
  }

  const collected = new Map(existingMessages.map((message) => [message.id, message]));
  let nextPageToken: string | undefined;

  for (let pageIndex = 0; pageIndex < MAIL_SEARCH_RECENT_FALLBACK_PAGES; pageIndex += 1) {
    const result = await provider.listMessages(mailbox.activeMailbox, {
      pageToken: nextPageToken,
      maxResults: MAIL_SEARCH_FETCH_BATCH,
    });

    for (const message of result.messages) {
      if (messageMatchesPrefix(message, query)) {
        collected.set(message.id, message);
      }
    }

    const ranked = rankMailboxSearchMessages([...collected.values()], query, limit);

    if (ranked.length >= limit || !result.nextPageToken) {
      break;
    }

    nextPageToken = result.nextPageToken;
  }

  return [...collected.values()];
}

export async function loadMailboxSearchData(input: {
  query: string;
  pageToken?: string;
  limit?: number;
  route?: string;
}): Promise<MailSearchResult> {
  const mailbox = await getMailboxContext();

  if (mailbox.status !== "ready") {
    return mailbox.loadState;
  }

  const provider = getProviderAdapter(mailbox.activeMailbox.provider);
  const limit = Number.isFinite(input.limit)
    ? Math.min(Math.max(Math.floor(input.limit ?? DEFAULT_MAIL_SEARCH_LIMIT), 1), MAX_MAIL_SEARCH_LIMIT)
    : DEFAULT_MAIL_SEARCH_LIMIT;
  const normalizedQuery = normalizeSearchText(input.query);

  if (!normalizedQuery) {
    return {
      status: "ready",
      accountId: mailbox.activeMailbox.id,
      query: "",
      messages: [],
      nextPageToken: null,
      resultSizeEstimate: 0,
    };
  }

  try {
    logMailboxStep({
      step: "mailbox_list_fetch",
      status: "start",
      metadata: { route: input.route ?? "/api/mail/search", userId: mailbox.account.id, query: normalizedQuery },
    });

    const result = await withRuntimeDebugStep(
      "gmail-mail-search-fetch",
      {
        route: input.route ?? "/api/mail/search",
        userId: mailbox.account.id,
        step: "gmail-mail-search-fetch",
      },
      async () => {
        const cachedMessages = await searchCachedMailboxMessages(mailbox, input.query, limit);

        if (cachedMessages.length >= limit) {
          return {
            messages: cachedMessages,
            nextPageToken: null,
            resultSizeEstimate: cachedMessages.length,
          };
        }

        const fieldCandidates = await collectGmailFieldCandidates(
          provider,
          mailbox,
          normalizedQuery,
          input.pageToken,
        );
        const strictCandidates = rankMailboxSearchMessages(
          [...cachedMessages, ...fieldCandidates.messages],
          normalizedQuery,
          limit,
        );

        if (strictCandidates.length >= limit) {
          return {
            messages: strictCandidates,
            nextPageToken: fieldCandidates.nextPageToken,
            resultSizeEstimate: fieldCandidates.resultSizeEstimate ?? strictCandidates.length,
          };
        }

        const recentCandidates = await collectRecentGmailPrefixCandidates(
          provider,
          mailbox,
          [...cachedMessages, ...fieldCandidates.messages],
          limit,
          normalizedQuery,
        );
        const candidates = rankMailboxSearchMessages(recentCandidates, normalizedQuery, limit);

        return {
          messages: candidates,
          nextPageToken: fieldCandidates.nextPageToken,
          resultSizeEstimate: fieldCandidates.resultSizeEstimate ?? candidates.length,
        };
      },
    );

    logMailboxStep({
      step: "mailbox_list_fetch",
      status: "ok",
      metadata: {
        route: input.route ?? "/api/mail/search",
        userId: mailbox.account.id,
        query: input.query,
        messageCount: result.messages.length,
      },
    });

    return {
      status: "ready",
      accountId: mailbox.activeMailbox.id,
      messages: result.messages,
      nextPageToken: result.nextPageToken,
      resultSizeEstimate: result.resultSizeEstimate ?? null,
      query: normalizedQuery,
    };
  } catch (error) {
    const mapped =
      error instanceof Error && error.message.toLowerCase().includes("timed out")
        ? getMailboxLoadStateFromReason("MAILBOX_SYNC_TIMEOUT")
        : (() => {
            const state = mapMailboxFailure(error).state;
            return state.reason === "UNKNOWN_MAILBOX_SETUP_FAILURE"
              ? getMailboxLoadStateFromReason("MAILBOX_LIST_FETCH_FAILED")
              : state;
          })();

    runtimeDebugLog("gmail-mail-search-fetch-failed", {
      route: input.route ?? "/api/mail/search",
      userId: mailbox.account.id,
      step: "gmail-mail-search-fetch",
      ok: false,
      mappedReason: mapped.reason,
      errorName: error instanceof Error ? error.name : typeof error,
      errorMessage: error instanceof Error ? error.message : String(error),
      ...getSafeMailboxErrorDetails(error),
    });

    return mapped;
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string) {
  let timeoutHandle: NodeJS.Timeout | undefined;

  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutHandle = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}
