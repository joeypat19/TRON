import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MessageListLoader } from "@/components/mail/message-list-loader";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}));

vi.mock("@/components/mail/use-mail-avatars", () => ({
  useMailAvatars: () => ({}),
}));

describe("MessageListLoader", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads search results from the Gmail search endpoint and appends newer-first pages", async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        json: async () => ({
          status: "ready",
          accountId: "acct_1",
          query: "joey",
          messages: [
            {
              id: "message-older",
              threadId: "thread-older",
              subject: "Older match",
              snippet: "Older snippet",
              from: "older@example.com",
              to: ["owner@example.com"],
              date: "Mon, 13 May 2026 09:00:00 +0000",
              internalDate: "1715590800000",
              labelIds: ["INBOX"],
              unread: false,
              starred: false,
            },
          ],
          nextPageToken: "next-search-page",
          resultSizeEstimate: 2,
        }),
      })
      .mockResolvedValueOnce({
        json: async () => ({
          status: "ready",
          accountId: "acct_1",
          query: "joey",
          messages: [
            {
              id: "message-newer",
              threadId: "thread-newer",
              subject: "Newest match",
              snippet: "Newest snippet",
              from: "newer@example.com",
              to: ["owner@example.com"],
              date: "Mon, 13 May 2026 10:00:00 +0000",
              internalDate: "1715594400000",
              labelIds: ["SENT"],
              unread: false,
              starred: false,
            },
          ],
          nextPageToken: null,
          resultSizeEstimate: 2,
        }),
      });

    vi.stubGlobal("fetch", fetchMock);

    const { container } = render(
      <MessageListLoader
        currentPath="/mail/search"
        emptyDescription="No search results"
        emptyTitle="No search results"
        route="/mail/search"
        searchMode
        searchQuery="joey"
      />,
    );

    expect(await screen.findByText("Older match")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/mail/search?"),
      expect.objectContaining({ cache: "no-store", credentials: "same-origin" }),
    );

    await user.click(screen.getByRole("button", { name: "Load more results" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(fetchMock.mock.calls[1]?.[0]).toContain("pageToken=next-search-page");
    });

    expect(await screen.findByText("Newest match")).toBeInTheDocument();
    const threadLinks = [...container.querySelectorAll("a[href^='/mail/thread/']")].map((link) => link.getAttribute("href"));
    expect(threadLinks.indexOf("/mail/thread/thread-newer")).toBeLessThan(threadLinks.indexOf("/mail/thread/thread-older"));
    expect(screen.queryByRole("button", { name: "Load more results" })).not.toBeInTheDocument();
  });

  it("loads folder views from the mailbox messages endpoint without treating them as search pages", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({
        status: "ready",
        accountId: "acct_1",
        messages: [
          {
            id: "message-unread",
            threadId: "thread-unread",
            subject: "Unread message",
            snippet: "Unread snippet",
            from: "sender@example.com",
            to: ["owner@example.com"],
            date: "Mon, 13 May 2026 10:00:00 +0000",
            internalDate: "1715594400000",
            labelIds: ["INBOX", "UNREAD"],
            unread: true,
            starred: false,
          },
        ],
        nextPageHref: null,
        previousPageHref: null,
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    render(
      <MessageListLoader
        currentPath="/mail/view/unread"
        emptyDescription="No unread mail found."
        emptyTitle="No messages"
        includeQueryInPageHref={false}
        route="/mail/view/unread"
        searchQuery="is:unread"
        title="Unread"
      />,
    );

    expect(await screen.findByText("Unread message")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/mail/messages?"),
      expect.objectContaining({ cache: "no-store", credentials: "same-origin" }),
    );
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("q=is%3Aunread");
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("includeQueryInPageHref=false");
  });
});
