import { describe, expect, it, vi } from "vitest";

const mockLoadMailPageData = vi.fn();
const mockLoadInboxSectionData = vi.fn();

vi.mock("@/lib/mail/mail-page-data", () => ({
  loadMailPageData: (...args: unknown[]) => mockLoadMailPageData(...args),
  loadInboxSectionData: (...args: unknown[]) => mockLoadInboxSectionData(...args),
}));

describe("/api/mail/messages", () => {
  it("uses the section loader when a mailbox section is requested", async () => {
    mockLoadInboxSectionData.mockResolvedValueOnce({
      status: "ready",
      column: {
        id: "unread",
        title: "Unread",
        messages: [],
        loadedCount: 25,
        resultSizeEstimate: 201,
        totalCount: 801,
        countLabel: "801",
        nextPageToken: "next-token",
        status: "ready",
      },
    });

    const { GET } = await import("@/app/api/mail/messages/route");
    const response = await GET(new Request("http://localhost/api/mail/messages?section=unread&pageToken=page-1"));
    const payload = await response.json();

    expect(payload.status).toBe("ready");
    expect(mockLoadInboxSectionData).toHaveBeenCalledWith("unread", {
      pageToken: "page-1",
      route: "/api/mail/messages",
    });
    expect(mockLoadMailPageData).not.toHaveBeenCalled();
  });
});
