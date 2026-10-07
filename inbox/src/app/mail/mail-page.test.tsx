import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getMailboxLoadStateFromReason } from "@/lib/mailbox-state";

const mailboxMockState = vi.hoisted(() => ({
  errorReason: "GMAIL_SCOPE_MISSING",
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={typeof href === "string" ? href : "#"} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/auth/google-auth-button", () => ({
  GoogleAuthButton: ({ label }: { label?: string }) => <button type="button">{label ?? "Continue with Google"}</button>,
}));

vi.mock("@/components/auth/connect-gmail-button", () => ({
  ConnectGmailButton: ({ label }: { label?: string }) => <button type="button">{label ?? "Connect Gmail"}</button>,
}));

vi.mock("@/components/auth/connect-microsoft-button", () => ({
  ConnectMicrosoftButton: ({ label }: { label?: string }) => <button type="button">{label ?? "Connect Outlook"}</button>,
}));

vi.mock("@/components/mail/message-list", () => ({
  MessageList: () => <div data-testid="message-list" />,
}));

vi.mock("@/lib/mailbox", () => ({
  getMailboxContext: vi.fn(async () => ({
    status: "unavailable",
    account: {
      id: "user_123",
      email: "test@example.com",
      image: null,
      name: "Test User",
    },
    connectedAccounts: [{ id: "acct_123", emailAddress: "owner@example.com", provider: "GMAIL" }],
    activeMailbox: { id: "acct_123", emailAddress: "owner@example.com", provider: "GMAIL" },
    labels: [],
    loadState: getMailboxLoadStateFromReason(mailboxMockState.errorReason as never),
  })),
  getCategoryTabs: vi.fn(() => []),
  getSystemLabel: vi.fn(() => null),
}));

describe("/mail/inbox error rendering", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    mailboxMockState.errorReason = "GMAIL_SCOPE_MISSING";
  });

  it("renders the Gmail access state instead of crashing when Gmail scope is missing", async () => {
    const { MailPage } = await import("@/app/mail/mail-page");

    render(
      await MailPage({
        currentPath: "/mail/inbox",
        emptyDescription: "Your Gmail inbox is empty.",
        emptyTitle: "No inbox messages",
        history: [],
        labelIds: ["INBOX"],
        title: "Inbox",
      }),
    );

    expect(screen.getByRole("heading", { name: "Reconnect Google to restore Gmail permissions" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reconnect Google" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Refresh inbox" })).toBeInTheDocument();
    expect(screen.queryByText("No inbox messages")).not.toBeInTheDocument();
  });

  it("renders the reconnect state instead of crashing when Google OAuth token is missing", async () => {
    mailboxMockState.errorReason = "GOOGLE_OAUTH_TOKEN_MISSING";

    const { MailPage } = await import("@/app/mail/mail-page");

    render(
      await MailPage({
        currentPath: "/mail/inbox",
        emptyDescription: "Your Gmail inbox is empty.",
        emptyTitle: "No inbox messages",
        history: [],
        labelIds: ["INBOX"],
        title: "Inbox",
      }),
    );

    expect(screen.getByRole("heading", { name: "Reconnect Google to load your inbox" })).toBeInTheDocument();
    expect(screen.getByText("Inbox could not find a usable Gmail authorization after Google authorization completed.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reconnect Google" })).toBeInTheDocument();
    expect(screen.queryByText("No inbox messages")).not.toBeInTheDocument();
  });
});
