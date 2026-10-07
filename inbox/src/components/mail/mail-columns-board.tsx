"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Archive, ArrowDownUp, MailOpen, MailPlus, Star, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { createAssistantDraggedEmailPayload, TRON_ASSISTANT_EMAIL_MIME } from "@/lib/assistant/email-dnd";
import { useMailSearchIndex } from "@/components/mail/mail-search-context";
import { MailAvatar } from "@/components/mail/mail-avatar";
import { useMailAvatars } from "@/components/mail/use-mail-avatars";
import { BrandButton } from "@/components/ui/brand-button";
import { appPath, stripAppMount } from "@/lib/app-path";
import {
  applyMailBoardMutation,
  type MailBoardMutation,
  type MailBoardSortOrder,
  sortMailBoardColumnMessages,
} from "@/lib/mail/mail-board-optimistic";
import type { InboxBoardData, MailColumn, MailMessageSummary, MailSectionId } from "@/lib/mail/mail-page-data";
import { getMailParticipantLabel, parseMailParticipant } from "@/lib/mail/participants";
import { cn } from "@/lib/utils";
import { formatMailDate, formatMailTime } from "@/lib/utils";

const RECENTLY_OPENED_STORAGE_KEY = "troninbox-recently-opened";
const RECENTLY_OPENED_LIMIT = 100;

type MailColumnsBoardProps = {
  data: InboxBoardData;
};

type InboxSectionFetchResult =
  | {
      status: "ready";
      column: MailColumn;
    }
  | {
      status: string;
      message?: string | null;
    };

type InteractiveMailColumn = MailColumn & {
  loadError: string | null;
  loadingMore: boolean;
  sortOrder: MailBoardSortOrder;
};

function readRecentOpened(): Record<string, number> {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(RECENTLY_OPENED_STORAGE_KEY);

    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw) as Record<string, number>;

    return Object.fromEntries(
      Object.entries(parsed).filter(
        ([key, value]) => Boolean(key) && typeof value === "number" && Number.isFinite(value),
      ),
    );
  } catch {
    return {};
  }
}

function writeRecentOpened(recentOpened: Record<string, number>) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const trimmed = Object.fromEntries(
      Object.entries(recentOpened)
        .sort((left, right) => right[1] - left[1])
        .slice(0, RECENTLY_OPENED_LIMIT),
    );

    window.localStorage.setItem(RECENTLY_OPENED_STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // Ignore localStorage errors and keep mailbox navigation working.
  }
}

function rememberRecentlyOpened(threadId: string) {
  const recentOpened = readRecentOpened();

  recentOpened[threadId] = Date.now();
  writeRecentOpened(recentOpened);

  return recentOpened;
}

function sortColumnMessages(
  column: Pick<InteractiveMailColumn, "id" | "sortOrder" | "messages">,
  recentOpened: Record<string, number>,
  messages = column.messages,
) {
  return sortMailBoardColumnMessages(column.id, messages, recentOpened, column.sortOrder);
}

function createInteractiveColumns(columns: MailColumn[]) {
  const recentOpened = readRecentOpened();

  return columns.map((column) => ({
    ...column,
    messages: sortColumnMessages({ ...column, sortOrder: "newest" }, recentOpened, column.messages),
    loadError: null,
    loadingMore: false,
    sortOrder: "newest" as const,
  }));
}

function formatLoadedCountLabel(loadedCount: number) {
  return `${loadedCount} loaded`;
}

function getColumnCountLabel(column: MailColumn) {
  if (column.countLabel) {
    return column.countLabel;
  }

  if (column.status === "ready") {
    return formatLoadedCountLabel(column.loadedCount);
  }

  return null;
}

function getMessageTitle(message: MailMessageSummary, columnId: MailSectionId) {
  if (columnId === "composed") {
    const recipients = formatRecipients(message.to);
    return recipients ? `To: ${recipients}` : message.subject || "Draft";
  }

  return getMailParticipantLabel(message.from) || message.subject || "Unknown sender";
}

function getMessagePreview(message: MailMessageSummary) {
  return message.snippet || "";
}

function getMessageAvatarParticipant(message: MailMessageSummary, columnId: MailSectionId) {
  if (columnId === "composed") {
    return parseMailParticipant(message.to[0] ?? null);
  }

  return parseMailParticipant(message.from);
}

function isReadyInboxSectionResult(result: InboxSectionFetchResult): result is Extract<InboxSectionFetchResult, { status: "ready" }> {
  return result.status === "ready";
}

function sortColumns(columns: InteractiveMailColumn[], recentOpened: Record<string, number>) {
  return columns.map((column) => ({
    ...column,
    messages: sortColumnMessages(column, recentOpened),
  }));
}

function mergeMailboxMessages(
  column: InteractiveMailColumn,
  incoming: MailMessageSummary[],
  recentOpened: Record<string, number>,
) {
  const merged = new Map<string, MailMessageSummary>();

  for (const message of column.messages) {
    merged.set(message.id, message);
  }

  for (const message of incoming) {
    merged.set(message.id, message);
  }

  return sortColumnMessages(column, recentOpened, [...merged.values()]);
}

function getMutationFromAction(
  action: "star" | "archive" | "read" | "trash",
  columnId: MailSectionId,
  message: MailMessageSummary,
): MailBoardMutation {
  if (action === "star") {
    return {
      type: "star",
      messageId: message.id,
      nextStarred: !message.starred,
    };
  }

  if (action === "read") {
    return {
      type: "read",
      messageId: message.id,
      nextUnread: !message.unread,
      sourceColumnId: columnId,
    };
  }

  return {
    type: action,
    messageId: message.id,
    sourceColumnId: columnId,
  };
}

function MessageRowAction({
  action,
  busy,
  message,
  onRun,
}: {
  action: "star" | "archive" | "read" | "trash";
  busy: boolean;
  message: MailMessageSummary;
  onRun: (action: "star" | "archive" | "read" | "trash") => void;
}) {
  const title =
    action === "star"
      ? message.starred ? "Unstar" : "Star"
      : action === "archive"
        ? "Archive"
        : action === "read"
          ? message.unread ? "Mark read" : "Mark unread"
          : "Trash";

  return (
    <button
      aria-label={title}
      className={cn(
        "inline-flex h-7 w-7 items-center justify-center rounded-full border bg-[var(--surface-overlay)] transition",
        action === "trash"
          ? "border-[var(--accent-strong)] text-[var(--accent-secondary)] hover:border-[var(--accent-strong)] hover:text-[var(--text)]"
          : "border-[var(--line)] text-[var(--text-muted)] hover:border-[var(--line)] hover:text-[var(--text)]",
      )}
      disabled={busy}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onRun(action);
      }}
      title={title}
      type="button"
    >
      {action === "star" ? (
        <Star className={cn("h-3.5 w-3.5", message.starred ? "fill-[var(--accent)] text-[var(--accent)]" : "")} />
      ) : null}
      {action === "archive" ? <Archive className="h-3.5 w-3.5" /> : null}
      {action === "read" ? (message.unread ? <MailOpen className="h-3.5 w-3.5" /> : <MailPlus className="h-3.5 w-3.5" />) : null}
      {action === "trash" ? <Trash2 className="h-3.5 w-3.5" /> : null}
    </button>
  );
}

export function MailColumnsBoard({ data }: MailColumnsBoardProps) {
  const [baseColumns, setBaseColumns] = useState<InteractiveMailColumn[]>(() => createInteractiveColumns(data.columns));
  const [recentOpened, setRecentOpened] = useState<Record<string, number>>(() => readRecentOpened());
  const [optimisticMutations, setOptimisticMutations] = useState<Array<{ id: string; mutation: MailBoardMutation }>>([]);
  const [actionError, setActionError] = useState<string | null>(null);
  const { registerSourceMessages, clearSourceMessages } = useMailSearchIndex();
  const router = useRouter();
  const recentOpenedRef = useRef(recentOpened);

  useEffect(() => {
    recentOpenedRef.current = recentOpened;
  }, [recentOpened]);

  const columns = useMemo(
    () =>
      optimisticMutations.reduce<InteractiveMailColumn[]>(
        (current, entry) =>
          applyMailBoardMutation(current, entry.mutation, {
            recentOpened,
            sortOrderByColumn: Object.fromEntries(current.map((column) => [column.id, column.sortOrder])),
          }) as InteractiveMailColumn[],
        baseColumns,
      ),
    [baseColumns, optimisticMutations, recentOpened],
  );

  useEffect(() => {
    setBaseColumns(createInteractiveColumns(data.columns));
    setOptimisticMutations([]);
    setRecentOpened(readRecentOpened());
  }, [data]);

  useEffect(() => {
    registerSourceMessages(
      "mail-columns-board",
      columns.flatMap((column) => column.messages),
    );

    return () => {
      clearSourceMessages("mail-columns-board");
    };
  }, [clearSourceMessages, columns, registerSourceMessages]);

  function logDev(event: string, details: Record<string, unknown>) {
    if (process.env.NODE_ENV !== "development") {
      return;
    }

    console.info(`[mail-board] ${event}`, details);
  }

  async function runMessageMutation(mutation: MailBoardMutation) {
    const mutationId = `${mutation.type}-${mutation.messageId}-${Date.now()}`;
    const startedAt = typeof performance !== "undefined" ? performance.now() : Date.now();

    logDev("action started", { mutation });
    setActionError(null);
    setOptimisticMutations((current) => [...current, { id: mutationId, mutation }]);
    logDev("optimistic UI applied", { mutation });

    try {
      const response = await fetch(appPath(`/api/mail/messages/${encodeURIComponent(mutation.messageId)}`), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(mutation),
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Mailbox action failed.");
      }

      setBaseColumns((current) =>
        applyMailBoardMutation(current, mutation, {
          recentOpened: recentOpenedRef.current,
          sortOrderByColumn: Object.fromEntries(current.map((column) => [column.id, column.sortOrder])),
        }) as InteractiveMailColumn[],
      );
      setOptimisticMutations((current) => current.filter((entry) => entry.id !== mutationId));

      logDev("API request completed", {
        mutation,
        durationMs: Math.round((typeof performance !== "undefined" ? performance.now() : Date.now()) - startedAt),
      });
    } catch (error) {
      setOptimisticMutations((current) => current.filter((entry) => entry.id !== mutationId));
      setActionError(error instanceof Error ? error.message : "Mailbox action failed.");
      logDev("action rolled back", {
        mutation,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async function loadMore(sectionId: MailSectionId) {
    const targetColumn = columns.find((column) => column.id === sectionId);

    if (!targetColumn?.nextPageToken || targetColumn.loadingMore) {
      return;
    }

    setBaseColumns((current) =>
      current.map((column) =>
        column.id === sectionId
          ? {
              ...column,
              loadingMore: true,
              loadError: null,
            }
          : column,
      ),
    );

    try {
      const params = new URLSearchParams({
        route: "/api/mail/messages",
        section: sectionId,
        pageToken: targetColumn.nextPageToken,
      });
      const response = await fetch(appPath(`/api/mail/messages?${params.toString()}`), {
        credentials: "same-origin",
        cache: "no-store",
      });
      const result = (await response.json()) as InboxSectionFetchResult;

      if (!isReadyInboxSectionResult(result)) {
        const errorMessage = "message" in result ? result.message : null;
        throw new Error(errorMessage ?? `Inbox could not load more ${sectionId} messages.`);
      }

      const readyResult = result;

      setBaseColumns((current) =>
        current.map((column) => {
          if (column.id !== sectionId) {
            return column;
          }

          const mergedMessages = mergeMailboxMessages(
            column,
            readyResult.column.messages,
            recentOpenedRef.current,
          );

          return {
            ...column,
            ...readyResult.column,
            messages: mergedMessages,
            loadedCount: mergedMessages.length,
            countLabel:
              (readyResult.column.totalCount ?? column.totalCount) !== null
                ? String(readyResult.column.totalCount ?? column.totalCount)
                : formatLoadedCountLabel(mergedMessages.length),
            totalCount: readyResult.column.totalCount ?? column.totalCount,
            loadError: null,
            loadingMore: false,
          };
        }),
      );
    } catch (error) {
      setBaseColumns((current) =>
        current.map((column) =>
          column.id === sectionId
            ? {
                ...column,
                loadingMore: false,
                loadError: error instanceof Error ? error.message : `Inbox could not load more ${sectionId} messages.`,
              }
            : column,
        ),
      );
    }
  }

  function handleThreadOpen(columnId: MailSectionId, message: MailMessageSummary) {
    const nextRecentOpened = rememberRecentlyOpened(message.threadId);
    setRecentOpened(nextRecentOpened);
    logDev("thread navigation started", { threadId: message.threadId, sourceColumnId: columnId });
    void router.prefetch(appPath(`/mail/thread/${message.threadId}`));

    if (columnId === "unread" && message.unread) {
      void runMessageMutation({
        type: "read",
        messageId: message.id,
        nextUnread: false,
        sourceColumnId: columnId,
      });
    }
  }

  function toggleSortOrder(sectionId: MailSectionId) {
    setBaseColumns((current) =>
      sortColumns(
        current.map((column) =>
          column.id === sectionId
            ? {
                ...column,
                sortOrder: column.sortOrder === "newest" ? "oldest" : "newest",
              }
            : column,
        ),
        recentOpenedRef.current,
      ),
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div
        className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden rounded-[28px] border border-[var(--line)] bg-[var(--bg)] lg:grid-cols-3"
        data-testid="mail-columns-board"
      >
        {columns.map((column, index) => (
          <section
            className={[
              "flex min-h-0 flex-col overflow-hidden",
              index > 0 ? "border-t border-[var(--line)] lg:border-t-0 lg:border-l" : "",
            ].join(" ")}
            data-testid={`mail-column-${column.id}`}
            key={column.id}
          >
            <header className="sticky top-0 z-10 border-b border-[var(--line)] bg-[var(--surface-overlay)] px-5 py-4 backdrop-blur-xl">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-[var(--text)]">{column.title}</h2>
                  {getColumnCountLabel(column) ? (
                    <span className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--text-muted)]">
                      {getColumnCountLabel(column)}
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="inline-flex items-center gap-1 rounded-full border border-[var(--line)] bg-[var(--surface-overlay)] px-3 py-1.5 text-[11px] font-medium text-[var(--text-muted)] transition hover:border-[var(--line)] hover:text-[var(--text)]"
                    data-testid={`mail-column-sort-${column.id}`}
                    onClick={() => toggleSortOrder(column.id)}
                    type="button"
                  >
                    <ArrowDownUp className="h-3.5 w-3.5" />
                    {column.sortOrder === "newest" ? "Newest" : "Oldest"}
                  </button>
                </div>
              </div>
            </header>

            <div
              className="scrollbar-none flex-1 overflow-y-auto"
              data-testid={`mail-column-scroll-${column.id}`}
            >
              {column.status === "loading" ? <ColumnLoadingState title={column.title} /> : null}
              {column.status === "error" ? <ColumnErrorState title={column.title} /> : null}
              {column.status === "ready" && !column.messages.length ? <ColumnEmptyState title={column.title} /> : null}
              {column.status === "ready" && column.messages.length ? (
                <ColumnMessages
                  column={column}
                  pendingMessageIds={new Set(optimisticMutations.map((entry) => entry.mutation.messageId))}
                  onMessageAction={(message, action) => void runMessageMutation(getMutationFromAction(action, column.id, message))}
                  onOpenThread={(message) => handleThreadOpen(column.id, message)}
                  onLoadMore={() => void loadMore(column.id)}
                />
              ) : null}
            </div>
          </section>
        ))}
      </div>

      {actionError ? (
        <div className="rounded-[20px] border border-[var(--accent-strong)] bg-[var(--surface-overlay)] px-4 py-3 text-sm text-[var(--text)]" role="status">
          {actionError}
        </div>
      ) : null}
    </div>
  );
}

function ColumnMessages({
  column,
  pendingMessageIds,
  onMessageAction,
  onOpenThread,
  onLoadMore,
}: {
  column: InteractiveMailColumn;
  pendingMessageIds: Set<string>;
  onMessageAction: (message: MailMessageSummary, action: "star" | "archive" | "read" | "trash") => void;
  onOpenThread: (message: MailMessageSummary) => void;
  onLoadMore: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const avatarEmails = column.messages.map((message) => getMessageAvatarParticipant(message, column.id).email ?? "");
  const avatars = useMailAvatars(avatarEmails);
  const handleDragStart = (event: DragEvent<HTMLDivElement>, message: MailMessageSummary) => {
    const payload = createAssistantDraggedEmailPayload({
      messageId: message.id,
      subject: message.subject,
      sender: getMessageTitle(message, column.id),
      snippet: message.snippet,
    });

    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData(TRON_ASSISTANT_EMAIL_MIME, JSON.stringify(payload));
  };

  return (
    <div className="divide-y divide-[var(--line)]">
      {column.messages.map((message) => {
        const preview = getMessagePreview(message);
        const participant = getMessageAvatarParticipant(message, column.id);
        const normalizedEmail = participant.email ?? "";
        const avatar = avatars[normalizedEmail];
        const threadPath = appPath(`/mail/thread/${message.threadId}`);
        const busy = pendingMessageIds.has(message.id);
        const isCurrentThread = stripAppMount(pathname) === stripAppMount(threadPath);
        const rowSurfaceClass = isCurrentThread
          ? "bg-[var(--surface-overlay)] focus-within:bg-[var(--surface-overlay)]"
          : "hover:bg-[var(--surface-overlay)] focus-within:bg-[var(--surface-overlay)]";

        return (
          <div
            className={cn(
              "group relative border-l-2 px-[18px] transition-colors duration-150",
              message.unread ? "border-l-[var(--accent)]" : "border-l-transparent",
              rowSurfaceClass,
            )}
            data-testid={`mail-row-${column.id}-${message.id}`}
            draggable
            key={`${column.id}-${message.id}`}
            onDragStart={(event) => handleDragStart(event, message)}
            onFocus={() => router.prefetch(threadPath)}
            onMouseEnter={() => router.prefetch(threadPath)}
          >
            <div className="absolute right-[18px] top-4 z-10 hidden items-center gap-1 group-hover:flex group-focus-within:flex">
              <MessageRowAction action="star" busy={busy} message={message} onRun={(action) => onMessageAction(message, action)} />
              <MessageRowAction action="archive" busy={busy} message={message} onRun={(action) => onMessageAction(message, action)} />
              <MessageRowAction action="read" busy={busy} message={message} onRun={(action) => onMessageAction(message, action)} />
              <MessageRowAction action="trash" busy={busy} message={message} onRun={(action) => onMessageAction(message, action)} />
            </div>

            <Link
              className="block w-full cursor-pointer"
              href={threadPath}
              onClick={() => onOpenThread(message)}
            >
              <div className="tron-mail-row">
                <MailAvatar
                  avatarUrl={avatar?.photoUrl ?? null}
                  email={participant.email}
                  name={participant.name}
                />
                <div className="tron-mail-row-main">
                  <div className="tron-mail-row-top">
                    <div className="flex min-w-0 items-center gap-2">
                      {message.unread ? <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--accent)]" /> : null}
                      <p className={cn("tron-mail-sender", message.unread ? "text-[var(--text)]" : "text-[var(--text-muted)]")}>
                        {getMessageTitle(message, column.id)}
                      </p>
                      {message.starred ? <Star className="h-3.5 w-3.5 shrink-0 fill-[var(--accent)] text-[var(--accent)]" /> : null}
                    </div>
                    <div className="tron-mail-meta group-hover:hidden group-focus-within:hidden">
                      {message.date ? (
                        <div className="tron-mail-dateStack">
                        <div className="tron-mail-date">{formatMailDate(message.date)}</div>
                        <div className="tron-mail-time">{formatMailTime(message.date)}</div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div className={cn("tron-mail-subject", message.unread ? "text-[var(--text)] font-semibold" : "text-[var(--text)] font-medium")}>
                    {message.subject || "(no subject)"}
                  </div>
                  {preview ? <div className={cn("tron-mail-snippet", message.unread ? "text-[var(--text-muted)]" : "text-[var(--text-muted)]")}>{preview}</div> : null}
                </div>
              </div>
            </Link>
          </div>
        );
      })}
      {column.loadError ? (
        <div className="px-5 py-4 text-sm text-[var(--accent-strong)]" role="status">
          {column.loadError}
        </div>
      ) : null}
      {column.nextPageToken ? (
        <div className="px-5 py-4">
          <BrandButton
            className="w-full justify-center"
            disabled={column.loadingMore}
            onClick={onLoadMore}
            tone="secondary"
            type="button"
          >
            {column.loadingMore ? `Loading more ${column.title.toLowerCase()}...` : `Load more ${column.title.toLowerCase()}`}
          </BrandButton>
        </div>
      ) : null}
    </div>
  );
}

function ColumnLoadingState({ title }: { title: string }) {
  return (
    <div className="space-y-4 px-5 py-5" data-testid={`mail-column-loading-${title.toLowerCase()}`}>
      <p className="text-sm text-[var(--text-muted)]">Syncing your mailbox...</p>
      {Array.from({ length: 4 }).map((_, index) => (
        <div className="px-0 py-2" key={`${title}-${index}`}>
          <div className="h-3 w-24 rounded-full bg-[var(--surface-overlay)]" />
          <div className="mt-3 h-4 w-3/4 rounded-full bg-[var(--surface-overlay)]" />
          <div className="mt-3 h-3 w-full rounded-full bg-[var(--surface-overlay)]" />
          <div className="mt-2 h-3 w-5/6 rounded-full bg-[var(--surface-overlay)]" />
        </div>
      ))}
    </div>
  );
}

function ColumnEmptyState({ title }: { title: string }) {
  return (
    <div className="flex h-full items-center justify-center px-5 py-10 text-center">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">{title}</p>
        <p className="mt-3 text-sm text-[var(--text-muted)]">No emails yet.</p>
      </div>
    </div>
  );
}

function ColumnErrorState({ title }: { title: string }) {
  return (
    <div className="flex h-full items-center justify-center px-5 py-10 text-center">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">{title}</p>
        <p className="mt-3 text-sm text-[var(--text-muted)]">No emails yet.</p>
      </div>
    </div>
  );
}

function formatRecipients(recipients: string[]) {
  if (!recipients.length) {
    return null;
  }

  if (recipients.length === 1) {
    return recipients[0];
  }

  return `${recipients[0]} +${recipients.length - 1}`;
}
