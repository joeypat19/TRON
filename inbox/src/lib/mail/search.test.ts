import { describe, expect, it } from "vitest";
import { messageMatchesPrefix, normalizeSearchText, searchMailMessages } from "@/lib/mail/search";

const messages = [
  {
    id: "joey-from",
    threadId: "thread-joey-from",
    subject: "Build notice",
    snippet: "Chrono24 mention in body only",
    from: "joeypat19 <notifications@github.com>",
    to: ["owner@example.com"],
    date: "Mon, 13 May 2026 10:00:00 +0000",
    internalDate: "1715594400000",
  },
  {
    id: "chrono-body-only",
    threadId: "thread-chrono",
    subject: "TradeLocker update",
    snippet: "joey is mentioned in the body only",
    from: "Chrono24 <alerts@chrono24.com>",
    to: ["owner@example.com"],
    date: "Mon, 13 May 2026 11:00:00 +0000",
    internalDate: "1715598000000",
  },
  {
    id: "run-subject",
    threadId: "thread-run",
    subject: "Runbook status",
    snippet: "subject prefix match",
    from: "Ops <ops@example.com>",
    to: ["owner@example.com"],
    date: "Mon, 13 May 2026 09:00:00 +0000",
    internalDate: "1715590800000",
  },
];

describe("mail search helpers", () => {
  it("normalizes casing, quotes, and repeated whitespace", () => {
    expect(normalizeSearchText('  "Joey   Pat"  ')).toBe("joey pat");
  });

  it("matches strict prefixes on sender, recipient, and subject fields", () => {
    expect(messageMatchesPrefix(messages[0]!, "joey")).toBe(true);
    expect(messageMatchesPrefix(messages[2]!, "run")).toBe(true);
    expect(messageMatchesPrefix({
      ...messages[0]!,
      id: "recipient-prefix",
      to: ["Jo Runner <jo@example.com>"],
    }, "jo")).toBe(true);
  });

  it("does not match snippet-only or body-like text for dropdown prefix search", () => {
    expect(messageMatchesPrefix(messages[1]!, "joey")).toBe(false);
    expect(searchMailMessages(messages, "joey", { limit: 10, sort: "newest" }).map((message) => message.id)).toEqual([
      "joey-from",
    ]);
  });

  it("sorts strict prefix matches newest to oldest", () => {
    const sorted = searchMailMessages([
      {
        ...messages[0]!,
        id: "joey-older",
        date: "Mon, 13 May 2026 08:00:00 +0000",
        internalDate: "1715587200000",
      },
      messages[0]!,
    ], "joey", { limit: 10, sort: "newest" });

    expect(sorted.map((message) => message.id)).toEqual(["joey-from", "joey-older"]);
  });
});
