"use client";

import { useCallback, useEffect, useState } from "react";
import { MailListLoading } from "@/components/mail/mail-list-loading";
import { useMailSearchIndex } from "@/components/mail/mail-search-context";
import { MessageList } from "@/components/mail/message-list";
import { MailboxLoadStatePanel } from "@/components/mail/mailbox-load-state-panel";
import type { MailboxLoadState } from "@/lib/mailbox-state";
import type { MailMessagePreview } from "@/lib/mail/types";
import { appPath } from "@/lib/app-path";

type MessageListLoaderProps = {
  route: string;
  currentPath: string;
  title: string;
  emptyTitle: string;
  emptyDescription: string;
  labelIds?: string[];
  searchQuery?: string;
  searchMode?: boolean;
  includeQueryInPageHref?: boolean;
  pageToken?: string;
  history?: string[];
};

type MessageListLoaderState =
  | {
      status: "loading";
    }
  | {
      status: "ready";
      accountId: string;
      messages: Parameters<typeof MessageList>[0]["messages"];
      nextPageHref: string | null;
      previousPageHref: string | null;
    }
  | Exclude<MailboxLoadState, { status: "ready" }>;

type MailSearchApiResponse =
  | {
      status: "ready";
      accountId: string;
      messages: Parameters<typeof MessageList>[0]["messages"];
      nextPageToken: string | null;
      resultSizeEstimate: number | null;
      query: string;
    }
  | Exclude<MailboxLoadState, { status: "ready" }>;

function compareMessagesByNewest(left: MailMessagePreview, right: MailMessagePreview) {
  const leftInternalDate = Number(left.internalDate ?? 0);
  const rightInternalDate = Number(right.internalDate ?? 0);

  if (leftInternalDate !== rightInternalDate) {
    return rightInternalDate - leftInternalDate;
  }

  const leftDate = Date.parse(left.date ?? "");
  const rightDate = Date.parse(right.date ?? "");

  if (!Number.isNaN(leftDate) && !Number.isNaN(rightDate) && leftDate !== rightDate) {
    return rightDate - leftDate;
  }

  return right.id.localeCompare(left.id);
}

function mergeSearchMessages(existing: MailMessagePreview[], incoming: MailMessagePreview[]) {
  const merged = new Map<string, MailMessagePreview>();

  for (const message of existing) {
    merged.set(message.id, message);
  }

  for (const message of incoming) {
    merged.set(message.id, message);
  }

  return [...merged.values()].sort(compareMessagesByNewest);
}

export function MessageListLoader(props: MessageListLoaderProps) {
  const requestKey = JSON.stringify({
    route: props.route,
    currentPath: props.currentPath,
      labelIds: props.labelIds ?? [],
      searchQuery: props.searchQuery ?? null,
      searchMode: props.searchMode ?? false,
      pageToken: props.pageToken ?? null,
      history: props.history ?? [],
    });
  const [state, setState] = useState<MessageListLoaderState>({ status: "loading" });
  const [searchNextPageToken, setSearchNextPageToken] = useState<string | null>(null);
  const [searchLoadingMore, setSearchLoadingMore] = useState(false);
  const { registerSourceMessages, clearSourceMessages } = useMailSearchIndex();

  const loadMessages = useCallback(async (options?: { append?: boolean; pageToken?: string | null }) => {
    const params = new URLSearchParams();
    params.set("route", props.route);
    params.set("currentPath", props.currentPath);

    if (props.searchQuery) {
      params.set("q", props.searchQuery);
    }

    if (props.includeQueryInPageHref === false) {
      params.set("includeQueryInPageHref", "false");
    }

    const pageToken = options?.pageToken ?? props.pageToken ?? null;

    if (pageToken) {
      params.set("pageToken", pageToken);
    }

    for (const labelId of props.labelIds ?? []) {
      params.append("labelId", labelId);
    }

    if (props.history?.length) {
      params.set("history", props.history.join(","));
    }

    try {
      const endpoint = props.searchMode ? "/api/mail/search" : "/api/mail/messages";
      const response = await fetch(appPath(`${endpoint}?${params.toString()}`), {
        credentials: "same-origin",
        cache: "no-store",
      });

      if (props.searchMode) {
        const data = (await response.json()) as MailSearchApiResponse;

        if (data.status === "ready") {
          setSearchNextPageToken(data.nextPageToken);

          setState((current) => ({
            status: "ready",
            accountId: data.accountId,
            messages:
              options?.append && current.status === "ready"
                ? mergeSearchMessages(current.messages, data.messages)
                : [...data.messages].sort(compareMessagesByNewest),
            nextPageHref: null,
            previousPageHref: null,
          }));
        } else {
          setState(data);
        }

        return;
      }

      const data = (await response.json()) as MessageListLoaderState;
      setState(data);
    } catch (error) {
      console.error("[Inbox message list fetch error]", error);
      setState({
        status: "temporary_error",
        reason: "UNKNOWN_MAILBOX_SETUP_FAILURE",
        message: "Inbox could not load the first inbox page from the browser.",
      });
    }
  }, [props.currentPath, props.history, props.includeQueryInPageHref, props.labelIds, props.pageToken, props.route, props.searchMode, props.searchQuery]);

  useEffect(() => {
    const timeoutHandle = setTimeout(() => {
      void loadMessages();
    }, 0);

    return () => clearTimeout(timeoutHandle);
  }, [loadMessages, requestKey]);

  useEffect(() => {
    if (state.status === "ready") {
      registerSourceMessages(`message-list-loader:${props.currentPath}`, state.messages);
      return () => {
        clearSourceMessages(`message-list-loader:${props.currentPath}`);
      };
    }

    clearSourceMessages(`message-list-loader:${props.currentPath}`);

    return () => {
      clearSourceMessages(`message-list-loader:${props.currentPath}`);
    };
  }, [clearSourceMessages, props.currentPath, registerSourceMessages, state]);

  async function handleLoadMore() {
    if (!props.searchMode || !props.searchQuery || !searchNextPageToken || searchLoadingMore) {
      return;
    }

    setSearchLoadingMore(true);

    try {
      await loadMessages({ append: true, pageToken: searchNextPageToken });
    } finally {
      setSearchLoadingMore(false);
    }
  }

  if (state.status === "loading") {
    return <MailListLoading title={`Loading ${props.title}`} />;
  }

  if (state.status !== "ready") {
    return <MailboxLoadStatePanel compact hasConnectedAccount state={state} />;
  }

  return (
    <MessageList
      currentPath={props.currentPath}
      emptyDescription={props.emptyDescription}
      emptyTitle={props.emptyTitle}
      labelIds={props.labelIds}
      messages={state.messages}
      hasMore={Boolean(props.searchMode && props.searchQuery && searchNextPageToken)}
      isLoadingMore={searchLoadingMore}
      nextPageHref={state.nextPageHref}
      onLoadMore={props.searchMode ? () => void handleLoadMore() : undefined}
      previousPageHref={state.previousPageHref}
      searchQuery={props.searchQuery}
      title={props.title}
    />
  );
}
