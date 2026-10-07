import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mockGetMailboxContext = vi.fn();
const mockGetThread = vi.fn();

vi.mock("@/lib/mailbox", () => ({
  getMailboxContext: (...args: unknown[]) => mockGetMailboxContext(...args),
}));

vi.mock("@/lib/mail/providers", () => ({
  getProviderAdapter: () => ({
    getThread: (...args: unknown[]) => mockGetThread(...args),
  }),
}));

vi.mock("@/components/mail/thread-read-marker", () => ({
  ThreadReadMarker: ({ messageId, unread }: { messageId: string; unread: boolean }) => (
    <div data-testid="thread-read-marker">{`${messageId}:${String(unread)}`}</div>
  ),
}));

describe("/mail/thread/[threadId]", () => {
  it("renders the thread once and defers read tracking to the client marker", async () => {
    mockGetMailboxContext.mockResolvedValue({
      status: "ready",
      connectedAccounts: [{ id: "acct_123" }],
      activeMailbox: { id: "acct_123", provider: "GMAIL", emailAddress: "owner@example.com" },
    });
    mockGetThread
      .mockResolvedValueOnce({
        id: "thread_1",
        messages: [
          {
            id: "message_1",
            threadId: "thread_1",
            labelIds: ["INBOX", "UNREAD"],
            snippet: "body",
            subject: "Unread subject",
            htmlBody: "<p>Rendered <strong>HTML</strong></p>",
            textBody: "Fallback text",
            to: ["owner@example.com"],
            cc: [],
            bcc: [],
            attachments: [],
          },
        ],
      });

    const { default: ThreadPage } = await import("@/app/mail/thread/[threadId]/page");
    render(await ThreadPage({ params: Promise.resolve({ threadId: "thread_1" }) }));

    expect(mockGetThread).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("thread-read-marker")).toHaveTextContent("message_1:true");
    expect(screen.getAllByText("Unread subject")).toHaveLength(2);
    const renderedBody = document.querySelector(".tron-email-body");
    expect(renderedBody).not.toBeNull();
    expect(renderedBody).toHaveTextContent("Rendered HTML");
    expect(renderedBody).not.toHaveTextContent("Fallback text");
  });
});
