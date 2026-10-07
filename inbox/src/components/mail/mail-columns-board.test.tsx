import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TRON_ASSISTANT_EMAIL_MIME } from "@/lib/assistant/email-dnd";
import { MailColumnsBoard } from "@/components/mail/mail-columns-board";
import type { InboxBoardData } from "@/lib/mail/mail-page-data";

const mockPrefetch = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => "/mail/inbox",
  useRouter: () => ({
    prefetch: mockPrefetch,
  }),
}));

vi.mock("@/components/mail/use-mail-avatars", () => ({
  useMailAvatars: () => ({
    "sender@example.com": { photoUrl: "https://example.com/sender.jpg", displayName: "Sender", source: "contacts" },
  }),
}));

const boardData: InboxBoardData = {
  status: "ready",
  loadState: { status: "ready", reason: null, message: null },
  activeMailboxId: "acct_1",
  activeMailboxEmail: "owner@example.com",
  hasConnectedAccounts: true,
  columns: [
    {
      id: "unread",
      title: "Unread",
      loadedCount: 1,
      resultSizeEstimate: 2,
      totalCount: 81,
      countLabel: "81",
      nextPageToken: "unread-next",
      status: "ready",
      messages: [
        {
          id: "m1",
          threadId: "t1",
          subject: "Unread subject",
          snippet: "Unread snippet",
          from: "sender@example.com",
          to: ["owner@example.com"],
          date: "Mon, 13 May 2026 09:00:00 +0000",
          internalDate: "1715590800000",
          unread: true,
          starred: false,
          labelIds: ["INBOX", "UNREAD"],
        },
      ],
    },
    {
      id: "opened",
      title: "Opened",
      loadedCount: 1,
      resultSizeEstimate: 3,
      totalCount: 519,
      countLabel: "519",
      nextPageToken: null,
      status: "ready",
      messages: [
        {
          id: "m2",
          threadId: "t2",
          subject: "Opened subject",
          snippet: "Opened snippet",
          from: "reader@example.com",
          to: ["owner@example.com"],
          date: "Mon, 13 May 2026 08:00:00 +0000",
          internalDate: "1715587200000",
          unread: false,
          starred: false,
          labelIds: ["INBOX"],
        },
      ],
    },
    {
      id: "composed",
      title: "Sent",
      loadedCount: 1,
      resultSizeEstimate: 1,
      totalCount: 223,
      countLabel: "223",
      nextPageToken: null,
      status: "ready",
      messages: [
        {
          id: "m3",
          threadId: "t3",
          subject: "Composed subject",
          snippet: "Composed snippet",
          from: "owner@example.com",
          to: ["recipient@example.com", "other@example.com"],
          date: "Mon, 13 May 2026 07:00:00 +0000",
          internalDate: "1715583600000",
          unread: false,
          starred: false,
          labelIds: ["SENT"],
        },
      ],
    },
  ],
};

describe("MailColumnsBoard", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    mockPrefetch.mockReset();
  });

  it("renders unread, opened, and sent sections without delivered", () => {
    render(<MailColumnsBoard data={boardData} />);

    expect(screen.getByTestId("mail-columns-board")).not.toHaveClass("brand-grid");
    expect(screen.getByRole("heading", { name: "Unread" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Opened" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Sent" })).toBeInTheDocument();
    expect(screen.queryByText("Delivered")).not.toBeInTheDocument();
  });

  it("renders independent scroll containers for each section", () => {
    render(<MailColumnsBoard data={boardData} />);

    expect(screen.getByTestId("mail-column-scroll-unread")).toHaveClass("scrollbar-none");
    expect(screen.getByTestId("mail-column-scroll-opened")).toHaveClass("scrollbar-none");
    expect(screen.getByTestId("mail-column-scroll-composed")).toHaveClass("scrollbar-none");
  });

  it("uses one stable three-column board layout with aligned column separators", () => {
    render(<MailColumnsBoard data={boardData} />);

    expect(screen.getByTestId("mail-columns-board")).toHaveClass("grid-cols-1", "lg:grid-cols-3");
    expect(screen.getByTestId("mail-column-opened")).toHaveClass("lg:border-l");
    expect(screen.getByTestId("mail-column-composed")).toHaveClass("lg:border-l");
    expect(screen.getByTestId("mail-column-unread")).not.toHaveClass("lg:border-l");
  });

  it("renders sender, subject, and snippet content without status or helper labels", () => {
    render(<MailColumnsBoard data={boardData} />);

    expect(screen.getByText("sender@example.com")).toBeInTheDocument();
    expect(screen.getByText("reader@example.com")).toBeInTheDocument();
    expect(screen.getByText("To: recipient@example.com +1")).toBeInTheDocument();
    expect(screen.getByText("Unread subject")).toBeInTheDocument();
    expect(screen.getByText("Opened subject")).toBeInTheDocument();
    expect(screen.getByText("Composed subject")).toBeInTheDocument();
    expect(screen.queryByText("UNREAD")).not.toBeInTheDocument();
    expect(screen.queryByText("READ")).not.toBeInTheDocument();
    expect(screen.queryByText("SENT")).not.toBeInTheDocument();
    expect(screen.queryByText("SENDER")).not.toBeInTheDocument();
    expect(screen.queryByText("RECIPIENT")).not.toBeInTheDocument();
    expect(screen.getByText("Unread snippet")).toBeInTheDocument();
  });

  it("sets a draggable payload with the message id and safe preview fields", () => {
    render(<MailColumnsBoard data={boardData} />);

    const row = screen.getByTestId("mail-row-unread-m1");
    const setData = vi.fn();
    const dataTransfer = {
      effectAllowed: "none",
      setData,
    };

    fireEvent.dragStart(row, { dataTransfer });

    expect(row).toHaveAttribute("draggable", "true");
    expect(setData).toHaveBeenCalledWith(
      TRON_ASSISTANT_EMAIL_MIME,
      JSON.stringify({
        messageId: "m1",
        subject: "Unread subject",
        sender: "sender@example.com",
        snippet: "Unread snippet",
      }),
    );
  });

  it("renders avatars and stacks the date above the time for message rows", () => {
    const { container } = render(<MailColumnsBoard data={boardData} />);

    const unreadColumn = screen.getByTestId("mail-column-unread");
    const dateLabel = container.querySelector(".tron-mail-date");
    const timeLabel = container.querySelector(".tron-mail-time");

    expect(within(unreadColumn).getByAltText("")).toHaveAttribute("src", "https://example.com/sender.jpg");
    expect(dateLabel?.textContent).toBeTruthy();
    expect(timeLabel?.textContent).toBeTruthy();
  });

  it("renders separate count labels for each section", () => {
    render(<MailColumnsBoard data={boardData} />);

    expect(screen.getByText("81")).toBeInTheDocument();
    expect(screen.getByText("519")).toBeInTheDocument();
    expect(screen.getByText("223")).toBeInTheDocument();
    expect(screen.queryByText("201")).not.toBeInTheDocument();
    expect(screen.getByTestId("mail-column-sort-unread")).toHaveTextContent("Newest");
    expect(screen.getByTestId("mail-column-sort-opened")).toHaveTextContent("Newest");
    expect(screen.getByTestId("mail-column-sort-composed")).toHaveTextContent("Newest");
  });

  it("loads more messages for one section without duplicating existing rows", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({
        status: "ready",
        column: {
          id: "unread",
          title: "Unread",
          loadedCount: 2,
          resultSizeEstimate: 2,
          totalCount: 81,
          countLabel: "81",
          nextPageToken: null,
          status: "ready",
          messages: [
            {
              id: "m1",
              threadId: "t1",
              subject: "Unread subject",
              snippet: "Unread snippet updated",
              from: "sender@example.com",
              to: ["owner@example.com"],
              date: "Mon, 13 May 2026 09:00:00 +0000",
              internalDate: "1715590800000",
              unread: true,
              starred: false,
              labelIds: ["INBOX", "UNREAD"],
            },
            {
              id: "m4",
              threadId: "t4",
              subject: "Newest unread",
              snippet: "New snippet",
              from: "later@example.com",
              to: ["owner@example.com"],
              date: "Mon, 13 May 2026 10:00:00 +0000",
              internalDate: "1715594400000",
              unread: true,
              starred: false,
              labelIds: ["INBOX", "UNREAD"],
            },
          ],
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<MailColumnsBoard data={boardData} />);

    await user.click(screen.getByRole("button", { name: "Load more unread" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    expect(await screen.findByText("Newest unread")).toBeInTheDocument();
    expect(screen.getAllByText(/Unread subject|Newest unread/)).toHaveLength(2);
    expect(screen.getByText("81")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Load more unread" })).not.toBeInTheDocument();
  });

  it("uses the subject before falling back to No recipient for composed rows", () => {
    const composedWithoutRecipient = {
      ...boardData,
      columns: boardData.columns.map((column) =>
        column.id === "composed"
          ? {
              ...column,
              messages: [
                {
                  ...column.messages[0]!,
                  to: [],
                  subject: "Sent without To header",
                },
              ],
            }
          : column,
      ),
    } satisfies InboxBoardData;

    render(<MailColumnsBoard data={composedWithoutRecipient} />);

    expect(screen.getAllByText("Sent without To header")).toHaveLength(2);
    expect(screen.queryByText("No recipient")).not.toBeInTheDocument();
  });

  it("uses a single row surface highlight and keeps the full row clickable", () => {
    render(<MailColumnsBoard data={boardData} />);

    const unreadRowLink = within(screen.getByTestId("mail-column-unread")).getAllByRole("link")[0];
    const unreadRow = screen.getByTestId("mail-row-unread-m1");

    expect(unreadRow).toHaveClass(
      "group",
      "relative",
      "hover:bg-[var(--surface-overlay)]",
      "transition-colors",
    );
    expect(unreadRowLink).toHaveClass(
      "block",
      "w-full",
      "cursor-pointer",
    );
    expect(unreadRowLink).not.toHaveClass(
      "group",
      "hover:bg-[var(--surface-overlay)]",
    );
  });

  it("moves a newly opened unread thread to the top of opened regardless of original date", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const boostedData: InboxBoardData = {
      ...boardData,
      columns: [
        {
          ...boardData.columns[0]!,
          messages: [
            {
              id: "u-1",
              threadId: "thread-unread-newly-opened",
              subject: "Unread to open",
              snippet: "Unread snippet",
              from: "fresh@example.com",
              to: ["owner@example.com"],
              date: "Mon, 13 May 2024 09:00:00 +0000",
              internalDate: "1715590800000",
              unread: true,
              starred: false,
              labelIds: ["INBOX", "UNREAD"],
            },
          ],
        },
        {
          ...boardData.columns[1]!,
          messages: [
            {
              id: "o-older",
              threadId: "thread-unread-newly-opened",
              subject: "Unread to open",
              snippet: "Opened snippet",
              from: "fresh@example.com",
              to: ["owner@example.com"],
              date: "Mon, 13 May 2024 09:00:00 +0000",
              internalDate: "1715590800000",
              unread: false,
              starred: false,
              labelIds: ["INBOX"],
            },
            {
              id: "o-newer",
              threadId: "thread-existing-opened",
              subject: "Already opened newer by date",
              snippet: "Opened newer snippet",
              from: "older@example.com",
              to: ["owner@example.com"],
              date: "Tue, 14 May 2024 12:00:00 +0000",
              internalDate: "1715688000000",
              unread: false,
              starred: false,
              labelIds: ["INBOX"],
            },
          ],
        },
        boardData.columns[2]!,
      ],
    };

    render(<MailColumnsBoard data={boostedData} />);

    await user.click(
      within(screen.getByTestId("mail-column-unread")).getByRole("link", { name: /unread to open/i }),
    );

    const openedLinks = within(screen.getByTestId("mail-column-opened")).getAllByRole("link");
    expect(openedLinks[0]).toHaveAttribute("href", "/mail/thread/thread-unread-newly-opened");
  });

  it("toggles the star immediately and keeps it changed after a successful request", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { container } = render(<MailColumnsBoard data={boardData} />);

    const starButton = within(screen.getByTestId("mail-column-unread")).getByRole("button", { name: "Star" });
    await user.click(starButton);

    const starredIcon = Array.from(container.querySelectorAll("svg"))
      .find((icon) => icon.getAttribute("class")?.includes("fill-[var(--accent)]")) ?? null;
    expect(starredIcon).not.toBeNull();

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  it("rolls back the star state and shows an inline error when the request fails", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Star request failed." }),
    }));

    const { container } = render(<MailColumnsBoard data={boardData} />);

    await user.click(within(screen.getByTestId("mail-column-unread")).getByRole("button", { name: "Star" }));

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("Star request failed.");
    });

    const starredIcon = Array.from(container.querySelectorAll("svg"))
      .find((icon) => icon.getAttribute("class")?.includes("fill-[var(--accent)]")) ?? null;
    expect(starredIcon).toBeNull();
  });

  it("removes an unread row immediately, then restores it when archiving fails", async () => {
    const user = userEvent.setup();
    let resolveRequest: ((value: { ok: boolean; json: () => Promise<{ error?: string }> }) => void) | undefined;
    const request = new Promise<{ ok: boolean; json: () => Promise<{ error?: string }> }>((resolve) => {
      resolveRequest = resolve;
    });
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(request));

    render(<MailColumnsBoard data={boardData} />);

    await user.click(within(screen.getByTestId("mail-column-unread")).getByRole("button", { name: "Archive" }));
    expect(screen.queryByText("Unread subject")).not.toBeInTheDocument();

    resolveRequest?.({
      ok: false,
      json: async () => ({ error: "Archive failed." }),
    });

    expect(await screen.findByText("Unread subject")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Archive failed.");
  });

  it("moves a row between unread and opened immediately when marking it read", async () => {
    const user = userEvent.setup();
    let resolveRequest: ((value: { ok: boolean; json: () => Promise<{ ok: boolean }> }) => void) | undefined;
    const request = new Promise<{ ok: boolean; json: () => Promise<{ ok: boolean }> }>((resolve) => {
      resolveRequest = resolve;
    });
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(request));

    render(<MailColumnsBoard data={boardData} />);

    await user.click(within(screen.getByTestId("mail-column-unread")).getByRole("button", { name: "Mark read" }));

    expect(within(screen.getByTestId("mail-column-unread")).queryByText("Unread subject")).not.toBeInTheDocument();
    expect(within(screen.getByTestId("mail-column-opened")).getByText("Unread subject")).toBeInTheDocument();

    resolveRequest?.({
      ok: true,
      json: async () => ({ ok: true }),
    });
  });

  it("sorts each column independently between newest and oldest", async () => {
    const user = userEvent.setup();
    const sortableData: InboxBoardData = {
      ...boardData,
      columns: boardData.columns.map((column) =>
        column.id === "unread"
          ? {
              ...column,
              messages: [
                {
                  id: "unread-newest",
                  threadId: "thread-unread-newest",
                  subject: "Unread newest",
                  snippet: "Newest unread",
                  from: "newest@example.com",
                  to: ["owner@example.com"],
                  date: "Mon, 13 May 2026 10:00:00 +0000",
                  internalDate: "1715594400000",
                  unread: true,
                  starred: false,
                  labelIds: ["INBOX", "UNREAD"],
                },
                {
                  id: "unread-oldest",
                  threadId: "thread-unread-oldest",
                  subject: "Unread oldest",
                  snippet: "Oldest unread",
                  from: "oldest@example.com",
                  to: ["owner@example.com"],
                  date: "Mon, 13 May 2026 08:00:00 +0000",
                  internalDate: "1715587200000",
                  unread: true,
                  starred: false,
                  labelIds: ["INBOX", "UNREAD"],
                },
              ],
            }
          : column.id === "opened"
            ? {
                ...column,
                messages: [
                  {
                    id: "opened-newest",
                    threadId: "thread-opened-newest",
                    subject: "Opened newest",
                    snippet: "Newest opened",
                    from: "opened-newest@example.com",
                    to: ["owner@example.com"],
                    date: "Mon, 13 May 2026 10:00:00 +0000",
                    internalDate: "1715594400000",
                    unread: false,
                    starred: false,
                    labelIds: ["INBOX"],
                  },
                  {
                    id: "opened-oldest",
                    threadId: "thread-opened-oldest",
                    subject: "Opened oldest",
                    snippet: "Oldest opened",
                    from: "opened-oldest@example.com",
                    to: ["owner@example.com"],
                    date: "Mon, 13 May 2026 08:00:00 +0000",
                    internalDate: "1715587200000",
                    unread: false,
                    starred: false,
                    labelIds: ["INBOX"],
                  },
                ],
              }
            : column,
      ),
    };

    render(<MailColumnsBoard data={sortableData} />);

    await user.click(screen.getByTestId("mail-column-sort-unread"));

    const unreadLinks = within(screen.getByTestId("mail-column-unread")).getAllByRole("link");
    const openedLinks = within(screen.getByTestId("mail-column-opened")).getAllByRole("link");

    expect(unreadLinks[0]).toHaveAttribute("href", "/mail/thread/thread-unread-oldest");
    expect(openedLinks[0]).toHaveAttribute("href", "/mail/thread/thread-opened-newest");
    expect(screen.getByTestId("mail-column-sort-unread")).toHaveTextContent("Oldest");
    expect(screen.getByTestId("mail-column-sort-opened")).toHaveTextContent("Newest");
  });

  it("keeps the selected sort order when loading more messages into a column", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({
        status: "ready",
        column: {
          id: "unread",
          title: "Unread",
          loadedCount: 3,
          resultSizeEstimate: 3,
          totalCount: 81,
          countLabel: "81",
          nextPageToken: null,
          status: "ready",
          messages: [
            {
              id: "m1",
              threadId: "t1",
              subject: "Unread subject",
              snippet: "Unread snippet",
              from: "sender@example.com",
              to: ["owner@example.com"],
              date: "Mon, 13 May 2026 09:00:00 +0000",
              internalDate: "1715590800000",
              unread: true,
              starred: false,
              labelIds: ["INBOX", "UNREAD"],
            },
            {
              id: "m4",
              threadId: "t4",
              subject: "Ancient unread",
              snippet: "Older item",
              from: "later@example.com",
              to: ["owner@example.com"],
              date: "Mon, 13 May 2026 06:00:00 +0000",
              internalDate: "1715580000000",
              unread: true,
              starred: false,
              labelIds: ["INBOX", "UNREAD"],
            },
          ],
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<MailColumnsBoard data={boardData} />);

    await user.click(screen.getByTestId("mail-column-sort-unread"));
    await user.click(screen.getByRole("button", { name: "Load more unread" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    const unreadLinks = within(screen.getByTestId("mail-column-unread")).getAllByRole("link");
    expect(unreadLinks[0]).toHaveAttribute("href", "/mail/thread/t4");
    expect(screen.getByTestId("mail-column-sort-unread")).toHaveTextContent("Oldest");
  });
});
