import { describe, expect, it } from "vitest";
import { applyMailBoardMutation } from "@/lib/mail/mail-board-optimistic";
import type { MailColumn } from "@/lib/mail/mail-page-data";

const columns: MailColumn[] = [
  {
    id: "unread",
    title: "Unread",
    messages: [
      {
        id: "m1",
        threadId: "t1",
        subject: "Unread",
        snippet: "snippet",
        from: "sender@example.com",
        to: ["owner@example.com"],
        date: "Mon, 13 May 2026 09:00:00 +0000",
        internalDate: "1715590800000",
        unread: true,
        starred: false,
        labelIds: ["INBOX", "UNREAD"],
      },
    ],
    loadedCount: 1,
    resultSizeEstimate: 1,
    totalCount: 1,
    countLabel: "1",
    nextPageToken: null,
    status: "ready",
  },
  {
    id: "opened",
    title: "Opened",
    messages: [],
    loadedCount: 0,
    resultSizeEstimate: 0,
    totalCount: 0,
    countLabel: "0",
    nextPageToken: null,
    status: "ready",
  },
  {
    id: "composed",
    title: "Sent",
    messages: [],
    loadedCount: 0,
    resultSizeEstimate: 0,
    totalCount: 0,
    countLabel: "0",
    nextPageToken: null,
    status: "ready",
  },
];

describe("applyMailBoardMutation", () => {
  it("toggles star without replacing the rest of the board", () => {
    const next = applyMailBoardMutation(columns, {
      type: "star",
      messageId: "m1",
      nextStarred: true,
    });

    expect(next[0]?.messages[0]?.starred).toBe(true);
    expect(next[1]?.messages).toHaveLength(0);
  });

  it("removes a row locally when archiving", () => {
    const next = applyMailBoardMutation(columns, {
      type: "archive",
      messageId: "m1",
      sourceColumnId: "unread",
    });

    expect(next[0]?.messages).toHaveLength(0);
    expect(next[0]?.totalCount).toBe(0);
  });

  it("moves an unread row into opened when marking it read", () => {
    const next = applyMailBoardMutation(
      columns,
      {
        type: "read",
        messageId: "m1",
        nextUnread: false,
        sourceColumnId: "unread",
      },
      {
        recentOpened: { t1: 10 },
        sortOrderByColumn: { unread: "newest", opened: "newest" },
      },
    );

    expect(next[0]?.messages).toHaveLength(0);
    expect(next[1]?.messages[0]?.id).toBe("m1");
    expect(next[1]?.messages[0]?.unread).toBe(false);
  });
});
