import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MailSearchIndexProvider, useMailSearchIndex } from "@/components/mail/mail-search-context";
import { SearchForm } from "@/components/mail/search-form";

const push = vi.fn();
let mockedPathname = "/mail/inbox";
let mockedSearchParams = "";

vi.mock("next/navigation", () => ({
  usePathname: () => mockedPathname,
  useRouter: () => ({
    push,
  }),
  useSearchParams: () => new URLSearchParams(mockedSearchParams),
}));

function SearchIndexSeed({ messages }: { messages: Array<{
  id: string;
  threadId: string;
  subject: string;
  snippet: string;
  from?: string;
  to: string[];
  date?: string;
  internalDate?: string;
}> }) {
  const { registerSourceMessages, clearSourceMessages } = useMailSearchIndex();

  useEffect(() => {
    registerSourceMessages("test-seed", messages);
    return () => clearSourceMessages("test-seed");
  }, [clearSourceMessages, messages, registerSourceMessages]);

  return null;
}

function renderSearchForm(options?: {
  messages?: Array<{
    id: string;
    threadId: string;
    subject: string;
    snippet: string;
    from?: string;
    to: string[];
    date?: string;
    internalDate?: string;
  }>;
}) {
  return render(
    <MailSearchIndexProvider>
      <SearchIndexSeed messages={options?.messages ?? []} />
      <SearchForm />
    </MailSearchIndexProvider>,
  );
}

describe("SearchForm", () => {
  beforeEach(() => {
    push.mockClear();
    mockedPathname = "/mail/inbox";
    mockedSearchParams = "";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "ready",
        query: "",
        messages: [],
        nextPageToken: null,
      }),
    }));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  async function advanceSearch() {
    await new Promise((resolve) => setTimeout(resolve, SEARCH_DEBOUNCE_MS + 25));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  const SEARCH_DEBOUNCE_MS = 250;

  it("shows instant local prefix matches before the server response returns", async () => {
    renderSearchForm({
      messages: [
        {
          id: "local-joey",
          threadId: "thread-local-joey",
          subject: "Build passed",
          snippet: "Local cache",
          from: "joeypat19 <notifications@github.com>",
          to: ["owner@example.com"],
          date: "Mon, 13 May 2026 10:00:00 +0000",
          internalDate: "1715594400000",
        },
      ],
    });

    fireEvent.change(screen.getByRole("searchbox", { name: "Search mail" }), {
      target: { value: "joey" },
    });

    expect(screen.getByTestId("mail-search-dropdown")).toBeInTheDocument();
    expect(screen.getByText("joeypat19")).toBeInTheDocument();
  });

  it("calls the search API after debounce when local results are insufficient and ignores stale responses", async () => {
    let resolveFirst: ((value: Response) => void) | undefined;
    let resolveSecond: ((value: Response) => void) | undefined;
    const fetchMock = vi.mocked(fetch);

    fetchMock
      .mockImplementationOnce(() => new Promise((resolve) => {
        resolveFirst = resolve as (value: Response) => void;
      }))
      .mockImplementationOnce(() => new Promise((resolve) => {
        resolveSecond = resolve as (value: Response) => void;
      }));

    renderSearchForm();

    fireEvent.change(screen.getByRole("searchbox", { name: "Search mail" }), {
      target: { value: "jo" },
    });
    await advanceSearch();

    fireEvent.change(screen.getByRole("searchbox", { name: "Search mail" }), {
      target: { value: "joey" },
    });
    await advanceSearch();

    resolveFirst?.({
      ok: true,
      json: async () => ({
        status: "ready",
        query: "jo",
        messages: [
          {
            id: "stale-result",
            threadId: "thread-stale-result",
            title: "John",
            subject: "Job",
            snippet: "stale",
            timestamp: "Mon, 13 May 2026 09:00:00 +0000",
            internalDate: 1715590800000,
            from: "john@example.com",
            to: ["owner@example.com"],
          },
        ],
        nextPageToken: null,
      }),
    } as Response);
    resolveSecond?.({
      ok: true,
      json: async () => ({
        status: "ready",
        query: "joey",
        messages: [
          {
            id: "fresh-result",
            threadId: "thread-fresh-result",
            title: "joeypat19",
            subject: "Build passed",
            snippet: "fresh",
            timestamp: "Mon, 13 May 2026 10:00:00 +0000",
            internalDate: 1715594400000,
            from: "joeypat19 <notifications@github.com>",
            to: ["owner@example.com"],
          },
        ],
        nextPageToken: null,
      }),
    } as Response);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchMock.mock.calls[0]?.[0]).toContain("/api/mail/search?q=jo&limit=10");
    expect(fetchMock.mock.calls[1]?.[0]).toContain("/api/mail/search?q=joey&limit=10");
    expect(screen.queryByText("John")).not.toBeInTheDocument();
    expect(screen.getByText("joeypat19")).toBeInTheDocument();
  });

  it("does not call the server when the local index already has 10 prefix matches", async () => {
    const fetchMock = vi.mocked(fetch);

    renderSearchForm({
      messages: Array.from({ length: 10 }, (_, index) => ({
        id: `local-${index}`,
        threadId: `thread-local-${index}`,
        subject: `Job ${index}`,
        snippet: `Snippet ${index}`,
        from: `joey${index}@example.com`,
        to: ["owner@example.com"],
        date: "Mon, 13 May 2026 10:00:00 +0000",
        internalDate: String(1715594400000 - index),
      })),
    });

    fireEvent.change(screen.getByRole("searchbox", { name: "Search mail" }), {
      target: { value: "joey" },
    });
    await advanceSearch();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getAllByRole("option")).toHaveLength(10);
  });

  it("opens the selected dropdown thread when a result is clicked", () => {
    renderSearchForm({
      messages: [
        {
          id: "local-ru",
          threadId: "thread-ru",
          subject: "Runbook",
          snippet: "Ops note",
          from: "Rune Team <ops@example.com>",
          to: ["owner@example.com"],
          date: "Mon, 13 May 2026 09:00:00 +0000",
          internalDate: "1715590800000",
        },
      ],
    });

    fireEvent.change(screen.getByRole("searchbox", { name: "Search mail" }), {
      target: { value: "ru" },
    });
    fireEvent.mouseDown(screen.getByRole("button", { name: /rune team/i }));

    expect(push).toHaveBeenCalledWith("/mail/thread/thread-ru");
  });

  it("supports keyboard navigation, Enter to open the highlighted result, and Escape to close the dropdown", () => {
    renderSearchForm({
      messages: [
        {
          id: "local-jill",
          threadId: "thread-jill",
          subject: "January recap",
          snippet: "First",
          from: "Jill <jill@example.com>",
          to: ["owner@example.com"],
          date: "Mon, 13 May 2026 10:00:00 +0000",
          internalDate: "1715594400000",
        },
        {
          id: "local-john",
          threadId: "thread-john",
          subject: "Job alert",
          snippet: "Second",
          from: "John <john@example.com>",
          to: ["owner@example.com"],
          date: "Mon, 13 May 2026 09:00:00 +0000",
          internalDate: "1715590800000",
        },
      ],
    });

    const input = screen.getByRole("searchbox", { name: "Search mail" });
    fireEvent.change(input, { target: { value: "j" } });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(push).toHaveBeenCalledWith("/mail/thread/thread-jill");

    fireEvent.change(input, { target: { value: "j" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.queryByTestId("mail-search-dropdown")).not.toBeInTheDocument();
  });

  it("keeps the dropdown scrollable when more than 10 results are available", () => {
    renderSearchForm({
      messages: Array.from({ length: 12 }, (_, index) => ({
        id: `local-${index}`,
        threadId: `thread-local-${index}`,
        subject: `Job ${index}`,
        snippet: `Snippet ${index}`,
        from: `joey${index}@example.com`,
        to: ["owner@example.com"],
        date: "Mon, 13 May 2026 10:00:00 +0000",
        internalDate: String(1715594400000 - index),
      })),
    });

    fireEvent.change(screen.getByRole("searchbox", { name: "Search mail" }), {
      target: { value: "joey" },
    });

    const results = screen.getByTestId("mail-search-results");
    expect(results).toHaveClass("max-h-[30rem]", "overflow-y-auto");
    expect(screen.getAllByRole("option")).toHaveLength(10);
  });

  it("runs the full search route when no dropdown result is selected", () => {
    renderSearchForm();

    fireEvent.change(screen.getByRole("searchbox", { name: "Search mail" }), {
      target: { value: "from:alex newer_than:7d" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Search mail" }));

    expect(push).toHaveBeenCalledWith("/mail/search?q=from%3Aalex+newer_than%3A7d");
  });

  it("clearing the query closes the dropdown and routes back to the inbox from search mode", () => {
    mockedPathname = "/mail/search";
    mockedSearchParams = "q=jo";

    renderSearchForm();

    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));

    expect(push).toHaveBeenCalledWith("/mail/inbox");
    expect(screen.queryByTestId("mail-search-dropdown")).not.toBeInTheDocument();
  });
});
