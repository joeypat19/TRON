import { describe, expect, it, vi } from "vitest";

const redirect = vi.fn((path: string) => {
  throw new Error(`NEXT_REDIRECT:${path}`);
});

const mockEnsureMicrosoftMailboxAccountConnection = vi.fn();

vi.mock("next/navigation", () => ({
  redirect,
}));

vi.mock("@/lib/mail/accounts", () => ({
  ensureMicrosoftMailboxAccountConnection: (...args: unknown[]) => mockEnsureMicrosoftMailboxAccountConnection(...args),
}));

describe("/connect/microsoft page", () => {
  it("redirects into the inbox after a successful Outlook connection finalizer", async () => {
    mockEnsureMicrosoftMailboxAccountConnection.mockResolvedValue({
      status: "connected",
      reason: null,
      message: null,
      mailboxId: "mailbox_1",
      accountEmail: "owner@outlook.com",
    });

    const pageModule = await import("@/app/connect/microsoft/page");

    await expect(pageModule.default()).rejects.toThrow("NEXT_REDIRECT:/mail/inbox");
    expect(redirect).toHaveBeenCalledWith("/mail/inbox");
  });
});
