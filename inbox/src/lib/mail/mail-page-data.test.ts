import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetMailboxContext = vi.fn();
const mockListMessages = vi.fn();
const mockCountMessages = vi.fn();
const mockMailboxMessageFindMany = vi.fn();

vi.mock("@/lib/mailbox", () => ({
  getMailboxContext: mockGetMailboxContext,
}));

vi.mock("@/lib/mail/providers", () => ({
  getProviderAdapter: () => ({
    listMessages: mockListMessages,
    countMessages: mockCountMessages,
  }),
}));

vi.mock("@/lib/db", () => ({
  db: {
    mailboxMessage: {
      findMany: mockMailboxMessageFindMany,
    },
  },
}));

describe("loadInboxBoardData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMailboxMessageFindMany.mockResolvedValue([]);
  });

  it("returns paginated ready columns for unread, opened, and composed", async () => {
    mockGetMailboxContext.mockResolvedValue({
      status: "ready",
      account: { id: "user_123" },
      connectedAccounts: [{ id: "acct_123", emailAddress: "owner@example.com", provider: "GMAIL" }],
      activeMailbox: { id: "acct_123", emailAddress: "owner@example.com", provider: "GMAIL" },
      loadState: { status: "ready", reason: null, message: null },
    });
    mockListMessages
      .mockResolvedValueOnce({
        messages: [{ id: "1", threadId: "t1", subject: "Unread", snippet: "body", from: "sender@example.com", to: ["owner@example.com"], unread: true, starred: false, labelIds: ["INBOX", "UNREAD"] }],
        nextPageToken: "unread-next",
        resultSizeEstimate: 41,
      })
      .mockResolvedValueOnce({
        messages: [{ id: "2", threadId: "t2", subject: "Opened", snippet: "body", from: "reader@example.com", to: ["owner@example.com"], unread: false, starred: false, labelIds: ["INBOX"] }],
        nextPageToken: "opened-next",
        resultSizeEstimate: 72,
      })
      .mockResolvedValueOnce({
        messages: [{ id: "3", threadId: "t3", subject: "Composed", snippet: "body", from: "owner@example.com", to: ["recipient@example.com"], unread: false, starred: false, labelIds: ["SENT"] }],
        nextPageToken: "composed-next",
        resultSizeEstimate: 13,
      });
    mockCountMessages
      .mockResolvedValueOnce(81)
      .mockResolvedValueOnce(519)
      .mockResolvedValueOnce(223);

    const { loadInboxBoardData } = await import("@/lib/mail/mail-page-data");
    const result = await loadInboxBoardData();

    expect(result.status).toBe("ready");
    expect(result.columns.map((column) => column.title)).toEqual(["Unread", "Opened", "Sent"]);
    expect(result.columns.map((column) => column.totalCount)).toEqual([81, 519, 223]);
    expect(result.columns.map((column) => column.resultSizeEstimate)).toEqual([41, 72, 13]);
    expect(result.columns.map((column) => column.countLabel)).toEqual(["81", "519", "223"]);
    expect(result.columns.map((column) => column.nextPageToken)).toEqual(["unread-next", "opened-next", "composed-next"]);
    expect(result.columns[2]?.messages[0]?.to).toEqual(["recipient@example.com"]);
    expect(mockListMessages).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.objectContaining({ query: "in:inbox is:unread", maxResults: 25 }),
    );
    expect(mockListMessages).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      expect.objectContaining({ query: "in:inbox -is:unread", maxResults: 25 }),
    );
    expect(mockListMessages).toHaveBeenNthCalledWith(
      3,
      expect.anything(),
      expect.objectContaining({ query: "in:sent", maxResults: 25 }),
    );
  });

  it("keeps section estimates independent instead of sharing one count across columns", async () => {
    mockGetMailboxContext.mockResolvedValue({
      status: "ready",
      account: { id: "user_123" },
      connectedAccounts: [{ id: "acct_123", emailAddress: "owner@example.com", provider: "GMAIL" }],
      activeMailbox: { id: "acct_123", emailAddress: "owner@example.com", provider: "GMAIL" },
      loadState: { status: "ready", reason: null, message: null },
    });
    mockListMessages
      .mockResolvedValueOnce({
        messages: [],
        nextPageToken: null,
        resultSizeEstimate: 201,
      })
      .mockResolvedValueOnce({
        messages: [],
        nextPageToken: null,
        resultSizeEstimate: 14,
      })
      .mockResolvedValueOnce({
        messages: [],
        nextPageToken: null,
        resultSizeEstimate: 9,
      });
    mockCountMessages
      .mockResolvedValueOnce(801)
      .mockResolvedValueOnce(412)
      .mockResolvedValueOnce(223);

    const { loadInboxBoardData } = await import("@/lib/mail/mail-page-data");
    const result = await loadInboxBoardData();

    expect(result.status).toBe("ready");
    expect(result.columns.map((column) => column.resultSizeEstimate)).toEqual([201, 14, 9]);
    expect(result.columns.map((column) => column.totalCount)).toEqual([801, 412, 223]);
    expect(result.columns.map((column) => column.countLabel)).toEqual(["801", "412", "223"]);
    expect(result.columns[0]?.totalCount).not.toBe(result.columns[1]?.totalCount);
    expect(result.columns[1]?.totalCount).not.toBe(result.columns[2]?.totalCount);
  });

  it("loads a single inbox section with an independent page token", async () => {
    mockGetMailboxContext.mockResolvedValue({
      status: "ready",
      account: { id: "user_123" },
      connectedAccounts: [{ id: "acct_123", emailAddress: "owner@example.com", provider: "GMAIL" }],
      activeMailbox: { id: "acct_123", emailAddress: "owner@example.com", provider: "GMAIL" },
      loadState: { status: "ready", reason: null, message: null },
    });
    mockListMessages.mockResolvedValueOnce({
      messages: [{ id: "2", threadId: "t2", subject: "Opened", snippet: "body", from: "reader@example.com", to: ["owner@example.com"], unread: false, starred: false, labelIds: ["INBOX"] }],
      nextPageToken: "opened-next-2",
      resultSizeEstimate: 72,
    });
    mockCountMessages.mockResolvedValueOnce(519);

    const { loadInboxSectionData } = await import("@/lib/mail/mail-page-data");
    const result = await loadInboxSectionData("opened", { pageToken: "opened-next-1" });

    expect(result).toMatchObject({
      status: "ready",
      column: {
        id: "opened",
        nextPageToken: "opened-next-2",
        loadedCount: 1,
        totalCount: null,
        countLabel: "1 loaded",
      },
    });
    expect(mockListMessages).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        pageToken: "opened-next-1",
        query: "in:inbox -is:unread",
        maxResults: 25,
      }),
    );
    expect(mockCountMessages).not.toHaveBeenCalled();
  });

  it("maps a missing Gmail token to needs_google_reconnect without throwing", async () => {
    mockGetMailboxContext.mockResolvedValue({
      status: "unavailable",
      connectedAccounts: [],
      activeMailbox: null,
      loadState: {
        status: "needs_google_reconnect",
        reason: "GOOGLE_OAUTH_TOKEN_MISSING",
        message: "Google authorization finished, but Gmail access was not attached to this session.",
      },
    });

    const { loadInboxBoardData } = await import("@/lib/mail/mail-page-data");
    const result = await loadInboxBoardData();

    expect(result).toMatchObject({
      status: "needs_google_reconnect",
      loadState: {
        reason: "GOOGLE_OAUTH_TOKEN_MISSING",
      },
    });
  });

  it("maps Gmail timeouts to syncing columns", async () => {
    mockGetMailboxContext.mockResolvedValue({
      status: "ready",
      account: { id: "user_123" },
      connectedAccounts: [{ id: "acct_123", emailAddress: "owner@example.com", provider: "GMAIL" }],
      activeMailbox: { id: "acct_123", emailAddress: "owner@example.com", provider: "GMAIL" },
      loadState: { status: "ready", reason: null, message: null },
    });
    mockListMessages.mockRejectedValue(new Error("mailbox board fetch timed out after 8000ms"));

    const { loadInboxBoardData } = await import("@/lib/mail/mail-page-data");
    const result = await loadInboxBoardData();

    expect(result.status).toBe("syncing");
    expect(result.columns.every((column) => column.status === "loading")).toBe(true);
  });

  it("keeps dropdown search strict so snippet-only or contains-only matches do not appear", async () => {
    mockGetMailboxContext.mockResolvedValue({
      status: "ready",
      account: { id: "user_123" },
      connectedAccounts: [{ id: "acct_123", emailAddress: "owner@example.com", provider: "GMAIL" }],
      activeMailbox: { id: "acct_123", emailAddress: "owner@example.com", provider: "GMAIL" },
      loadState: { status: "ready", reason: null, message: null },
    });
    mockListMessages
      .mockResolvedValueOnce({
        messages: [
          {
            id: "joey-prefix",
            threadId: "thread-joey-prefix",
            subject: "Build passed",
            snippet: "newest joey prefix",
            from: "joeypat19 <notifications@github.com>",
            to: ["owner@example.com"],
            date: "Mon, 13 May 2026 11:00:00 +0000",
            internalDate: "1715598000000",
            unread: false,
            starred: false,
            labelIds: ["INBOX"],
          },
        ],
        nextPageToken: null,
        resultSizeEstimate: 1,
      })
      .mockResolvedValueOnce({
        messages: [
          {
            id: "chrono24-body-only",
            threadId: "thread-chrono24-body-only",
            subject: "TradeLocker update",
            snippet: "joey mentioned in the body only",
            from: "Chrono24 <alerts@chrono24.com>",
            to: ["owner@example.com"],
            date: "Mon, 13 May 2026 09:00:00 +0000",
            internalDate: "1715590800000",
            unread: false,
            starred: false,
            labelIds: ["INBOX"],
          },
        ],
        nextPageToken: null,
        resultSizeEstimate: 1,
      })
      .mockResolvedValue({
        messages: [],
        nextPageToken: null,
        resultSizeEstimate: 0,
      });

    const { loadMailboxSearchData } = await import("@/lib/mail/mail-page-data");
    const result = await loadMailboxSearchData({ query: "jo", limit: 10 });

    expect(result.status).toBe("ready");
    if (result.status !== "ready") {
      throw new Error("Expected ready search results.");
    }

    expect(result.messages.map((message) => message.id)).toEqual(["joey-prefix"]);
  });

  it("searches cached mailbox metadata before Gmail and falls back to Gmail only when needed", async () => {
    mockGetMailboxContext.mockResolvedValue({
      status: "ready",
      account: { id: "user_123" },
      connectedAccounts: [{ id: "acct_123", emailAddress: "owner@example.com", provider: "GMAIL" }],
      activeMailbox: { id: "acct_123", emailAddress: "owner@example.com", provider: "GMAIL" },
      loadState: { status: "ready", reason: null, message: null },
    });
    mockMailboxMessageFindMany.mockResolvedValueOnce(
      Array.from({ length: 10 }, (_, index) => ({
        providerMessageId: index === 0 ? "cached-joey" : `cached-joey-${index}`,
        providerThreadId: index === 0 ? "cached-thread-joey" : `cached-thread-joey-${index}`,
        subject: `Build passed ${index}`,
        snippet: "Cached match",
        fromName: `joeypat19-${index}`,
        fromEmail: `notifications${index}@github.com`,
        toJson: JSON.stringify([{ email: "owner@example.com" }]),
        date: new Date(`2026-05-13T12:${String(index).padStart(2, "0")}:00.000Z`),
        isRead: false,
        isStarred: false,
        hasAttachments: false,
      })),
    );
    mockListMessages.mockResolvedValue({
      messages: [
        {
          id: "gmail-search-hit-ignored",
          threadId: "thread-gmail-search-hit-ignored",
          subject: "Rune deploy",
          snippet: "Fetched from Gmail",
          from: "runtime@example.com",
          to: ["owner@example.com"],
          date: "Mon, 13 May 2026 12:00:00 +0000",
          internalDate: "1715601600000",
          unread: false,
          starred: false,
          labelIds: ["INBOX"],
        },
      ],
      nextPageToken: null,
      resultSizeEstimate: 1,
    });

    const { loadMailboxSearchData } = await import("@/lib/mail/mail-page-data");
    const result = await loadMailboxSearchData({ query: "joey", limit: 10 });

    expect(result.status).toBe("ready");
    if (result.status !== "ready") {
      throw new Error("Expected ready search results.");
    }

    expect(result.messages).toHaveLength(10);
    expect(result.messages.some((message) => message.id === "cached-joey")).toBe(true);
    expect(mockListMessages).not.toHaveBeenCalled();
  });

  it("queries Gmail with field-specific searches and still filters strict prefixes locally", async () => {
    mockGetMailboxContext.mockResolvedValue({
      status: "ready",
      account: { id: "user_123" },
      connectedAccounts: [{ id: "acct_123", emailAddress: "owner@example.com", provider: "GMAIL" }],
      activeMailbox: { id: "acct_123", emailAddress: "owner@example.com", provider: "GMAIL" },
      loadState: { status: "ready", reason: null, message: null },
    });
    mockListMessages
      .mockResolvedValueOnce({
        messages: [
          {
            id: "gmail-joey",
            threadId: "thread-gmail-joey",
            subject: "Build passed",
            snippet: "GitHub notification",
            from: "joeypat19 <notifications@github.com>",
            to: ["owner@example.com"],
            date: "Mon, 13 May 2026 12:00:00 +0000",
            internalDate: "1715601600000",
            unread: false,
            starred: false,
            labelIds: ["INBOX"],
          },
        ],
        nextPageToken: null,
        resultSizeEstimate: 1,
      })
      .mockResolvedValueOnce({
        messages: [
          {
            id: "gmail-bad-match",
            threadId: "thread-gmail-bad-match",
            subject: "Google Search Console",
            snippet: "joey in body only",
            from: "Chrono24 <alerts@chrono24.com>",
            to: ["owner@example.com"],
            date: "Mon, 13 May 2026 13:00:00 +0000",
            internalDate: "1715605200000",
            unread: false,
            starred: false,
            labelIds: ["INBOX"],
          },
        ],
        nextPageToken: null,
        resultSizeEstimate: 1,
      })
      .mockResolvedValueOnce({
        messages: [],
        nextPageToken: null,
        resultSizeEstimate: 0,
      });

    const { loadMailboxSearchData } = await import("@/lib/mail/mail-page-data");
    const result = await loadMailboxSearchData({ query: "joey", limit: 10 });

    expect(result.status).toBe("ready");
    if (result.status !== "ready") {
      throw new Error("Expected ready search results.");
    }

    expect(result.messages.map((message) => message.id)).toEqual(["gmail-joey"]);
    expect(mockListMessages.mock.calls.slice(0, 3).map(([, input]) => (input as { query?: string }).query)).toEqual([
      "from:joey",
      "to:joey",
      "subject:joey",
    ]);
  });
});
