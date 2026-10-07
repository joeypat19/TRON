"use client";

import { Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import { useMailSearchIndex } from "@/components/mail/mail-search-context";
import { appPath, stripAppMount } from "@/lib/app-path";
import { searchMailMessages, type SearchableMailMessage } from "@/lib/mail/search";
import { getMailParticipantLabel } from "@/lib/mail/participants";
import { formatMailDate, formatMailTime } from "@/lib/utils";

type SearchFormProps = {
  initialQuery?: string;
};

type SearchResultMessage = {
  id: string;
  threadId: string;
  title?: string | null;
  subject: string;
  snippet: string;
  timestamp?: string | null;
  internalDate?: number | string;
  from?: string;
  date?: string;
  to: string[];
};

type SearchApiResponse =
  | {
      status: "ready";
      query: string;
      messages: SearchResultMessage[];
      nextPageToken: string | null;
    }
  | {
      status: string;
      reason?: string | null;
      message?: string | null;
    };

const SEARCH_DEBOUNCE_MS = 250;
const SEARCH_RESULT_LIMIT = 10;
const DROPDOWN_MAX_HEIGHT_CLASS = "max-h-[30rem]";

function isReadySearchApiResponse(payload: SearchApiResponse): payload is Extract<SearchApiResponse, { status: "ready" }> {
  return payload.status === "ready";
}

function normalizeSearchResultMessage(message: SearchResultMessage): SearchResultMessage {
  return {
    ...message,
    snippet: message.snippet ?? "",
    to: message.to ?? [],
  };
}

function toSearchResultMessage(message: SearchableMailMessage): SearchResultMessage {
  return {
    ...message,
    snippet: message.snippet ?? "",
    to: message.to,
  };
}

function mergeSearchResults(localMessages: SearchableMailMessage[], remoteMessages: SearchResultMessage[], query: string) {
  const deduped = new Map<string, SearchResultMessage>();

  for (const message of [
    ...localMessages.map(toSearchResultMessage),
    ...remoteMessages.map(normalizeSearchResultMessage),
  ]) {
    deduped.set(message.id, message);
  }

  return searchMailMessages([...deduped.values()], query, {
    limit: SEARCH_RESULT_LIMIT,
    sort: "newest",
  });
}

export function SearchForm({ initialQuery = "" }: SearchFormProps) {
  const searchParams = useSearchParams();
  const currentQuery = searchParams.get("q") ?? initialQuery;

  return <SearchFormInner initialQuery={currentQuery} key={currentQuery} />;
}

function SearchFormInner({ initialQuery }: { initialQuery: string }) {
  const dropdownId = useId();
  const pathname = usePathname();
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const latestRequestId = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState(initialQuery);
  const [remoteResults, setRemoteResults] = useState<SearchResultMessage[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasCompletedSearch, setHasCompletedSearch] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const { messages: indexedMessages } = useMailSearchIndex();

  const localMatches = useMemo(() => searchMailMessages(indexedMessages, query, {
    limit: SEARCH_RESULT_LIMIT,
    sort: "newest",
  }), [indexedMessages, query]);
  const results = useMemo(
    () => mergeSearchResults(localMatches, remoteResults, query),
    [localMatches, query, remoteResults],
  );

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, []);

  useEffect(() => {
    const trimmedQuery = query.trim();

    if (!trimmedQuery || localMatches.length >= SEARCH_RESULT_LIMIT) {
      abortControllerRef.current?.abort();
      return;
    }

    const requestId = latestRequestId.current + 1;
    latestRequestId.current = requestId;

    const timeoutHandle = window.setTimeout(() => {
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;
      const params = new URLSearchParams({
        q: trimmedQuery,
        limit: String(SEARCH_RESULT_LIMIT),
      });

      void fetch(appPath(`/api/mail/search?${params.toString()}`), {
        credentials: "same-origin",
        cache: "no-store",
        signal: controller.signal,
      })
        .then(async (response) => {
          if (!response.ok) {
            throw new Error(`Search failed with status ${response.status}`);
          }

          return response.json() as Promise<SearchApiResponse>;
        })
        .then((payload) => {
          if (latestRequestId.current !== requestId) {
            return;
          }

          if (!isReadySearchApiResponse(payload)) {
            setRemoteResults([]);
            setHasCompletedSearch(true);
            setActiveIndex(-1);
            return;
          }

          setRemoteResults(payload.messages);
          setHasCompletedSearch(true);
          setActiveIndex(-1);
        })
        .catch((error: unknown) => {
          if ((error as { name?: string })?.name === "AbortError") {
            return;
          }

          if (latestRequestId.current === requestId) {
            setRemoteResults([]);
            setHasCompletedSearch(true);
            setActiveIndex(-1);
          }
        })
        .finally(() => {
          if (latestRequestId.current === requestId) {
            setIsLoading(false);
          }
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timeoutHandle);
  }, [localMatches, query]);

  function runFullSearch(searchQuery: string) {
    const trimmedQuery = searchQuery.trim();

    startTransition(() => {
      if (!trimmedQuery) {
        setIsOpen(false);
        router.push(appPath("/mail/inbox"));
        return;
      }

      const params = new URLSearchParams();
      params.set("q", trimmedQuery);
      setIsOpen(false);
      router.push(appPath(`/mail/search?${params.toString()}`));
    });
  }

  function openThread(threadId: string) {
    abortControllerRef.current?.abort();
    setIsOpen(false);
    startTransition(() => {
      router.push(appPath(`/mail/thread/${threadId}`));
    });
  }

  function handleClear() {
    abortControllerRef.current?.abort();
    setQuery("");
    setRemoteResults([]);
    setIsOpen(false);
    setIsLoading(false);
    setHasCompletedSearch(false);
    setActiveIndex(-1);

    if (stripAppMount(pathname).startsWith("/mail/search")) {
      startTransition(() => {
        router.push(appPath("/mail/inbox"));
      });
    }
  }

  function handleQueryChange(nextQuery: string) {
    setQuery(nextQuery);

    if (!nextQuery.trim()) {
      abortControllerRef.current?.abort();
      setRemoteResults([]);
      setIsOpen(false);
      setIsLoading(false);
      setHasCompletedSearch(false);
      setActiveIndex(-1);
      return;
    }

    const instantLocalMatches = searchMailMessages(indexedMessages, nextQuery, {
      limit: SEARCH_RESULT_LIMIT,
      sort: "newest",
    });

    setRemoteResults([]);
    setIsOpen(true);
    setIsLoading(instantLocalMatches.length < SEARCH_RESULT_LIMIT);
    setHasCompletedSearch(instantLocalMatches.length >= SEARCH_RESULT_LIMIT);
    setActiveIndex(-1);
  }

  const showDropdown = isOpen && Boolean(query.trim());

  return (
    <div className="flex items-center gap-3" ref={containerRef}>
      <div className="relative min-w-0 flex-1">
        <form
          className="tron-mail-search"
          onSubmit={(event) => {
            event.preventDefault();

            if (activeIndex >= 0 && results[activeIndex]) {
              openThread(results[activeIndex].threadId);
              return;
            }

            runFullSearch(query);
          }}
        >
          <input
            aria-activedescendant={activeIndex >= 0 ? `${dropdownId}-option-${activeIndex}` : undefined}
            aria-label="Search mail"
            aria-autocomplete="list"
            autoComplete="off"
            name="q"
            onChange={(event) => handleQueryChange(event.target.value)}
            onFocus={() => {
              if (query.trim()) {
                setIsOpen(true);
              }
            }}
            onKeyDown={(event) => {
              if (!showDropdown) {
                if (event.key === "Escape") {
                  setIsOpen(false);
                }

                return;
              }

              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActiveIndex((current) => {
                  if (!results.length) {
                    return -1;
                  }

                  if (current < 0) {
                    return 0;
                  }

                  return (current + 1) % results.length;
                });
                return;
              }

              if (event.key === "ArrowUp") {
                event.preventDefault();
                setActiveIndex((current) => {
                  if (!results.length) {
                    return -1;
                  }

                  if (current <= 0) {
                    return results.length - 1;
                  }

                  return current - 1;
                });
                return;
              }

              if (event.key === "Enter" && activeIndex >= 0 && results[activeIndex]) {
                event.preventDefault();
                openThread(results[activeIndex].threadId);
                return;
              }

              if (event.key === "Escape") {
                event.preventDefault();
                setIsOpen(false);
              }
            }}
            placeholder="Search mail"
            role="searchbox"
            type="search"
            value={query}
          />
          <button aria-label="Search mail" disabled={isPending} type="submit">
            <Search className="mx-auto h-4 w-4" />
          </button>
        </form>

        {showDropdown ? (
          <div
            className="absolute left-0 right-0 top-[calc(100%-1px)] z-30 mt-2 overflow-hidden rounded-[20px] border border-[var(--line)] bg-[var(--surface-overlay)] shadow-[0_18px_40px_var(--shadow-color)] backdrop-blur-xl"
            data-testid="mail-search-dropdown"
          >
            {isLoading ? (
              <div className="px-4 py-3 text-sm text-[var(--text-muted)]">Searching more emails...</div>
            ) : null}

            {!isLoading && hasCompletedSearch && !results.length ? (
              <div className="px-4 py-3 text-sm text-[var(--text-muted)]">No matching emails</div>
            ) : null}

            {results.length ? (
              <ul
                className={`${DROPDOWN_MAX_HEIGHT_CLASS} overflow-y-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}
                data-testid="mail-search-results"
                id={dropdownId}
                role="listbox"
              >
                {results.map((message, index) => {
                  const label = message.title || getMailParticipantLabel(message.from) || "Unknown sender";
                  const timestamp = message.timestamp ?? message.date ?? null;
                  const active = index === activeIndex;

                  return (
                    <li key={message.id} role="option" aria-selected={active}>
                      <button
                        className={[
                          "flex w-full items-start justify-between gap-4 px-4 py-3 text-left transition",
                          active
                            ? "bg-[var(--surface-overlay)]"
                            : "hover:bg-[var(--surface-overlay)]",
                        ].join(" ")}
                        data-testid={`mail-search-result-${index}`}
                        id={`${dropdownId}-option-${index}`}
                        onMouseDown={(event) => {
                          event.preventDefault();
                          openThread(message.threadId);
                        }}
                        onMouseEnter={() => setActiveIndex(index)}
                        type="button"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold text-[var(--text)]">{label}</div>
                          <div className="mt-1 truncate text-sm text-[var(--text)]">{message.subject || "(no subject)"}</div>
                          {message.snippet ? (
                            <div className="mt-1 truncate text-xs text-[var(--text-muted)]">{message.snippet}</div>
                          ) : null}
                        </div>
                        {timestamp ? (
                          <div className="shrink-0 text-right text-[11px] text-[var(--text-muted)]">
                            <div>{formatMailDate(timestamp)}</div>
                            <div>{formatMailTime(timestamp)}</div>
                          </div>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>

      {(initialQuery || query) ? (
        <button
          aria-label="Clear search"
          className="shrink-0 rounded-full border border-[var(--line)] px-3 py-2 text-xs font-semibold text-[var(--text-muted)] transition hover:border-[var(--line)] hover:text-[var(--text)]"
          onClick={(event) => {
            event.preventDefault();
            handleClear();
          }}
          type="button"
        >
          Clear
        </button>
      ) : null}
    </div>
  );
}
