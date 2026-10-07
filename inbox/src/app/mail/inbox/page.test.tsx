import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockAttemptAutomaticGmailConnectionForCurrentUser = vi.fn<() => Promise<{
  status: "not_attempted" | "connected" | "failed";
  reason: string | null;
  mailboxId?: string | null;
  accountEmail?: string;
}>>(async () => ({
  status: "not_attempted" as const,
  reason: null,
}));

const mockLoadInboxBoardData = vi.fn();

vi.mock("@/lib/mail/mail-page-data", () => ({
  loadInboxBoardData: (...args: unknown[]) => mockLoadInboxBoardData(...args),
}));

vi.mock("@/lib/mail/accounts", () => ({
  attemptAutomaticGmailConnectionForCurrentUser: (...args: unknown[]) =>
    mockAttemptAutomaticGmailConnectionForCurrentUser(...args),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
  usePathname: () => "/mail/inbox",
  useRouter: () => ({
    prefetch: vi.fn(),
  }),
}));

vi.mock("@/components/auth/connect-gmail-button", () => ({
  ConnectGmailButton: ({ label }: { label?: string }) => <button type="button">{label ?? "Connect Gmail"}</button>,
}));

vi.mock("@/components/auth/connect-microsoft-button", () => ({
  ConnectMicrosoftButton: ({ label }: { label?: string }) => <button type="button">{label ?? "Connect Outlook"}</button>,
}));

function createBoardData(overrides?: Partial<Awaited<ReturnType<typeof mockLoadInboxBoardData>>>) {
  return {
    status: "ready" as const,
    loadState: { status: "ready" as const, reason: null, message: null },
    activeMailboxId: "acct_1",
    activeMailboxEmail: "owner@example.com",
    hasConnectedAccounts: true,
    columns: [
      { id: "unread" as const, title: "Unread", messages: [], loadedCount: 0, resultSizeEstimate: null, totalCount: null, countLabel: null, nextPageToken: null, status: "ready" as const },
      { id: "opened" as const, title: "Opened", messages: [], loadedCount: 0, resultSizeEstimate: null, totalCount: null, countLabel: null, nextPageToken: null, status: "ready" as const },
      { id: "composed" as const, title: "Sent", messages: [], loadedCount: 0, resultSizeEstimate: null, totalCount: null, countLabel: null, nextPageToken: null, status: "ready" as const },
    ],
    ...overrides,
  };
}

describe("/mail/inbox page", () => {
  beforeEach(() => {
    mockAttemptAutomaticGmailConnectionForCurrentUser.mockReset();
    mockAttemptAutomaticGmailConnectionForCurrentUser.mockResolvedValue({
      status: "not_attempted",
      reason: null,
    });
    mockLoadInboxBoardData.mockReset();
    mockLoadInboxBoardData.mockResolvedValue(createBoardData());
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("shows an empty inbox state for a connected account with no messages", async () => {
    vi.resetModules();
    const { InboxBoardContent } = await import("@/app/mail/inbox/page");

    render(await InboxBoardContent());

    expect(screen.queryByText("Connect Gmail to load your inbox.")).not.toBeInTheDocument();
    expect(screen.getAllByText("No emails yet.")).toHaveLength(3);
    expect(screen.getByTestId("mail-column-unread")).toBeInTheDocument();
  });

  it("shows a retry/error panel for a temporary mailbox failure instead of the connect prompt", async () => {
    mockLoadInboxBoardData.mockResolvedValueOnce(createBoardData({
      status: "temporary_error",
      loadState: {
        status: "temporary_error",
        reason: "MAILBOX_LIST_FETCH_FAILED",
        message: "Temporary mailbox issue.",
      },
      activeMailboxId: null,
      activeMailboxEmail: null,
      hasConnectedAccounts: false,
      columns: [
        { id: "unread" as const, title: "Unread", messages: [], loadedCount: 0, resultSizeEstimate: null, totalCount: null, countLabel: null, nextPageToken: null, status: "error" as const },
        { id: "opened" as const, title: "Opened", messages: [], loadedCount: 0, resultSizeEstimate: null, totalCount: null, countLabel: null, nextPageToken: null, status: "error" as const },
        { id: "composed" as const, title: "Sent", messages: [], loadedCount: 0, resultSizeEstimate: null, totalCount: null, countLabel: null, nextPageToken: null, status: "error" as const },
      ],
    }));

    vi.resetModules();
    const { InboxBoardContent } = await import("@/app/mail/inbox/page");

    render(await InboxBoardContent());

    expect(screen.queryByText("Connect Gmail to load your inbox.")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Refresh inbox" })).toBeInTheDocument();
    expect(screen.getByText("Mailbox temporarily unavailable")).toBeInTheDocument();
  });

  it("shows the connect prompt when no connected mailbox account exists", async () => {
    mockLoadInboxBoardData.mockResolvedValueOnce(createBoardData({
      status: "needs_google_reconnect",
      loadState: {
        status: "needs_google_reconnect",
        reason: "GOOGLE_OAUTH_TOKEN_MISSING",
        message: "Connect Gmail to continue.",
      },
      activeMailboxId: null,
      activeMailboxEmail: null,
      hasConnectedAccounts: false,
      columns: [
        { id: "unread" as const, title: "Unread", messages: [], loadedCount: 0, resultSizeEstimate: null, totalCount: null, countLabel: null, nextPageToken: null, status: "error" as const },
        { id: "opened" as const, title: "Opened", messages: [], loadedCount: 0, resultSizeEstimate: null, totalCount: null, countLabel: null, nextPageToken: null, status: "error" as const },
        { id: "composed" as const, title: "Sent", messages: [], loadedCount: 0, resultSizeEstimate: null, totalCount: null, countLabel: null, nextPageToken: null, status: "error" as const },
      ],
    }));

    vi.resetModules();
    const { InboxBoardContent } = await import("@/app/mail/inbox/page");

    render(await InboxBoardContent());

    expect(screen.getByText("Connect Gmail to load your inbox.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Connect Gmail" })).toBeInTheDocument();
  });

  it("shows the reconnect prompt when Gmail needs reconnect", async () => {
    mockLoadInboxBoardData.mockResolvedValueOnce(createBoardData({
      status: "needs_google_reconnect",
      loadState: {
        status: "needs_google_reconnect",
        reason: "GMAIL_SCOPES_MISSING",
        message: "Reconnect required.",
      },
      activeMailboxId: null,
      activeMailboxEmail: null,
      hasConnectedAccounts: false,
      columns: [
        { id: "unread" as const, title: "Unread", messages: [], loadedCount: 0, resultSizeEstimate: null, totalCount: null, countLabel: null, nextPageToken: null, status: "error" as const },
        { id: "opened" as const, title: "Opened", messages: [], loadedCount: 0, resultSizeEstimate: null, totalCount: null, countLabel: null, nextPageToken: null, status: "error" as const },
        { id: "composed" as const, title: "Sent", messages: [], loadedCount: 0, resultSizeEstimate: null, totalCount: null, countLabel: null, nextPageToken: null, status: "error" as const },
      ],
    }));

    vi.resetModules();
    const { InboxBoardContent } = await import("@/app/mail/inbox/page");

    render(await InboxBoardContent());

    expect(screen.getByText("Google authorization worked, but Gmail authorization failed.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reconnect Google" })).toBeInTheDocument();
  });

  it("renders the board when connected data loads successfully", async () => {
    mockLoadInboxBoardData.mockResolvedValueOnce(createBoardData({
      columns: [
        {
          id: "unread" as const,
          title: "Unread",
          messages: [{
            id: "message_1",
            threadId: "thread_1",
            subject: "Subject",
            snippet: "Snippet",
            from: "sender@example.com",
            to: ["owner@example.com"],
            unread: true,
            starred: false,
            labelIds: ["INBOX"],
          }],
          loadedCount: 1,
          resultSizeEstimate: 1,
          totalCount: 1,
          countLabel: "1",
          nextPageToken: null,
          status: "ready" as const,
        },
        { id: "opened" as const, title: "Opened", messages: [], loadedCount: 0, resultSizeEstimate: null, totalCount: null, countLabel: null, nextPageToken: null, status: "ready" as const },
        { id: "composed" as const, title: "Sent", messages: [], loadedCount: 0, resultSizeEstimate: null, totalCount: null, countLabel: null, nextPageToken: null, status: "ready" as const },
      ],
    }));

    vi.resetModules();
    const { InboxBoardContent } = await import("@/app/mail/inbox/page");

    render(await InboxBoardContent());

    expect(screen.queryByText("Connect Gmail to load your inbox.")).not.toBeInTheDocument();
    expect(screen.getByText("Subject")).toBeInTheDocument();
    expect(screen.getByTestId("mail-columns-board")).toBeInTheDocument();
  });

  it("redirects back to /mail/inbox after a successful auto-connect", async () => {
    mockAttemptAutomaticGmailConnectionForCurrentUser.mockResolvedValueOnce({
      status: "connected",
      reason: null,
      mailboxId: "mailbox_1",
      accountEmail: "owner@example.com",
    });

    vi.resetModules();
    const { InboxBoardContent } = await import("@/app/mail/inbox/page");

    await expect(InboxBoardContent()).rejects.toThrow("NEXT_REDIRECT:/mail/inbox");
  });
});
