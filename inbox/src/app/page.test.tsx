import { beforeEach, describe, expect, it, vi } from "vitest";

const redirect = vi.fn((destination: string) => {
  throw new Error(`NEXT_REDIRECT:${destination}`);
});

vi.mock("next/navigation", () => ({
  redirect: (destination: string) => redirect(destination),
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedUser: vi.fn(async () => ({
    id: "user_123",
    email: "user@example.com",
    displayName: "User",
    emailVerifiedAt: null,
  })),
}));

describe("HomePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("opens the authenticated mailbox workspace", async () => {
    const { default: HomePage } = await import("@/app/page");

    await expect(HomePage()).rejects.toThrow("NEXT_REDIRECT:/mail/inbox");
    expect(redirect).toHaveBeenCalledWith("/mail/inbox");
  });
});
