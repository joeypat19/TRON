"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, MailOpen, MailPlus, Paperclip, Star, Trash2 } from "lucide-react";
import { useMemo, useRef, useState, useTransition } from "react";
import { bulkMessageAction } from "@/app/mail/actions";
import { BrandButton } from "@/components/ui/brand-button";
import { appPath } from "@/lib/app-path";
import { getMailParticipantLabel } from "@/lib/mail/participants";
import type { MailMessagePreview } from "@/lib/mail/types";
import { cn, formatMailDate, formatMailTime } from "@/lib/utils";

type MessageListProps = {
  messages: MailMessagePreview[];
  currentPath: string;
  title: string;
  labelIds?: string[];
  searchQuery?: string;
  nextPageHref?: string | null;
  previousPageHref?: string | null;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
  emptyTitle: string;
  emptyDescription: string;
};

type RowMutation =
  | {
      type: "star";
      messageId: string;
      nextStarred: boolean;
    }
  | {
      type: "read";
      messageId: string;
      nextUnread: boolean;
    }
  | {
      type: "archive" | "trash";
      messageId: string;
    };

function normalizeQuery(query?: string) {
  return query?.trim().toLowerCase() ?? "";
}

function removeMessage(messages: MailMessagePreview[], messageId: string) {
  return messages.filter((message) => message.id !== messageId);
}

function updateMessage(messages: MailMessagePreview[], messageId: string, updater: (message: MailMessagePreview) => MailMessagePreview) {
  return messages.map((message) => (message.id === messageId ? updater(message) : message));
}

function shouldRemoveFromCurrentList({
  mutation,
  labelIds,
  searchQuery,
}: {
  mutation: RowMutation;
  labelIds?: string[];
  searchQuery?: string;
}) {
  const normalizedQuery = normalizeQuery(searchQuery);
  const labelSet = new Set(labelIds ?? []);

  if (mutation.type === "archive") {
    return true;
  }

  if (mutation.type === "trash") {
    return true;
  }

  if (mutation.type === "star" && !mutation.nextStarred) {
    return normalizedQuery === "is:starred" || labelSet.has("STARRED");
  }

  if (mutation.type === "read" && !mutation.nextUnread) {
    return normalizedQuery === "is:unread";
  }

  return false;
}

function applyRowMutation(
  messages: MailMessagePreview[],
  mutation: RowMutation,
  context: {
    labelIds?: string[];
    searchQuery?: string;
  },
) {
  if (shouldRemoveFromCurrentList({ mutation, ...context })) {
    return removeMessage(messages, mutation.messageId);
  }

  if (mutation.type === "star") {
    return updateMessage(messages, mutation.messageId, (message) => ({
      ...message,
      starred: mutation.nextStarred,
    }));
  }

  if (mutation.type === "read") {
    return updateMessage(messages, mutation.messageId, (message) => ({
      ...message,
      unread: mutation.nextUnread,
    }));
  }

  return removeMessage(messages, mutation.messageId);
}

function getListRowTitle(message: MailMessagePreview, labelIds?: string[], searchQuery?: string) {
  const normalizedQuery = normalizeQuery(searchQuery);
  const labelSet = new Set(labelIds ?? []);

  if (normalizedQuery === "in:sent" || labelSet.has("SENT") || normalizedQuery === "in:drafts" || labelSet.has("DRAFT")) {
    const recipients = message.to.filter(Boolean);
    return recipients.length ? `To: ${recipients[0]}${recipients.length > 1 ? ` +${recipients.length - 1}` : ""}` : message.subject || "Draft";
  }

  return getMailParticipantLabel(message.from) || "Unknown sender";
}

function MessageRowAction({
  action,
  busy,
  message,
  onRun,
}: {
  action: "star" | "archive" | "read" | "trash";
  busy: boolean;
  message: MailMessagePreview;
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

export function MessageList({
  messages,
  currentPath,
  title,
  labelIds,
  searchQuery,
  nextPageHref,
  previousPageHref,
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
  emptyTitle,
  emptyDescription,
}: MessageListProps) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [committedMutations, setCommittedMutations] = useState<RowMutation[]>([]);
  const [optimisticMutations, setOptimisticMutations] = useState<Array<{ id: string; mutation: RowMutation }>>([]);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const mutationSequenceRef = useRef(0);
  const selectedMessageIds = useMemo(() => selectedIds.join(","), [selectedIds]);

  const renderedMessages = useMemo(
    () =>
      optimisticMutations.reduce(
        (current, entry) => applyRowMutation(current, entry.mutation, { labelIds, searchQuery }),
        committedMutations.reduce(
          (current, mutation) => applyRowMutation(current, mutation, { labelIds, searchQuery }),
          messages,
        ),
      ),
    [committedMutations, labelIds, messages, optimisticMutations, searchQuery],
  );

  const pendingMessageIds = new Set(optimisticMutations.map((entry) => entry.mutation.messageId));

  async function runRowMutation(mutation: RowMutation) {
    mutationSequenceRef.current += 1;
    const mutationId = `${mutation.type}-${mutation.messageId}-${mutationSequenceRef.current}`;

    setActionError(null);
    setOptimisticMutations((current) => [...current, { id: mutationId, mutation }]);

    try {
      const response = await fetch(appPath(`/api/mail/messages/${encodeURIComponent(mutation.messageId)}`), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          mutation.type === "read"
            ? {
                type: "read",
                messageId: mutation.messageId,
                nextUnread: mutation.nextUnread,
                sourceColumnId: "opened",
              }
            : mutation.type === "star"
              ? mutation
              : {
                  type: mutation.type,
                  messageId: mutation.messageId,
                  sourceColumnId: "opened",
                },
        ),
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Mailbox action failed.");
      }

      setCommittedMutations((current) => [...current, mutation]);
      setOptimisticMutations((current) => current.filter((entry) => entry.id !== mutationId));
    } catch (error) {
      setOptimisticMutations((current) => current.filter((entry) => entry.id !== mutationId));
      setActionError(error instanceof Error ? error.message : "Mailbox action failed.");
    }
  }

  if (!renderedMessages.length) {
    return (
      <div className="flex min-h-[16rem] flex-1 items-center justify-center px-4 py-12 text-center">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text)]">{emptyTitle}</h2>
          <p className="mt-2 text-sm text-[var(--text-muted)]">{emptyDescription}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] px-4 py-3">
        <div className="flex items-center gap-2">
          <input
            aria-label="Select all messages"
            checked={selectedIds.length === renderedMessages.length}
            onChange={(event) =>
              setSelectedIds(event.target.checked ? renderedMessages.map((message) => message.id) : [])
            }
            type="checkbox"
          />
          <span className="text-sm text-[var(--text-muted)]">
            {selectedIds.length ? `${selectedIds.length} selected` : title}
          </span>
        </div>

        <form
          action={(formData) =>
            startTransition(async () => {
              await bulkMessageAction(formData);
              setSelectedIds([]);
              router.refresh();
            })
          }
          className="flex flex-wrap items-center gap-2"
        >
          <input name="messageIds" type="hidden" value={selectedMessageIds} />
          <input name="nextPath" type="hidden" value={currentPath} />
          <BrandButton
            className="px-3 py-2"
            disabled={!selectedIds.length || isPending}
            name="bulkAction"
            type="submit"
            value="read"
            tone="secondary"
          >
            <MailOpen className="h-4 w-4" />
            Mark read
          </BrandButton>
          <BrandButton
            className="px-3 py-2"
            disabled={!selectedIds.length || isPending}
            name="bulkAction"
            type="submit"
            value="unread"
            tone="secondary"
          >
            <MailPlus className="h-4 w-4" />
            Mark unread
          </BrandButton>
          <BrandButton
            className="px-3 py-2"
            disabled={!selectedIds.length || isPending}
            name="bulkAction"
            type="submit"
            value="archive"
            tone="secondary"
          >
            <Archive className="h-4 w-4" />
            Archive
          </BrandButton>
          <BrandButton
            className="px-3 py-2"
            disabled={!selectedIds.length || isPending}
            name="bulkAction"
            type="submit"
            value="trash"
            tone="danger"
          >
            <Trash2 className="h-4 w-4" />
            Trash
          </BrandButton>
        </form>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="divide-y divide-[var(--line)]">
          {renderedMessages.map((message) => {
            const checked = selectedIds.includes(message.id);
        const threadPath = appPath(`/mail/thread/${message.threadId}`);
            const busy = pendingMessageIds.has(message.id);
            const senderLabel = getListRowTitle(message, labelIds, searchQuery);
            const hasAttachment = message.labelIds.includes("HAS_ATTACHMENTS");
            const messageTimestamp = message.date ? formatMailTime(message.date) || formatMailDate(message.date) : null;

            return (
              <div
                className={cn(
                  "group relative grid min-h-[64px] grid-cols-[auto_auto_minmax(10rem,14rem)_minmax(0,1fr)] items-start gap-3 px-4 py-3 pr-36 transition-colors hover:bg-[var(--surface-overlay)]",
                  message.unread ? "text-[var(--text)]" : "text-[var(--text-muted)]",
                )}
                key={message.id}
                onFocus={() => router.prefetch(threadPath)}
                onMouseEnter={() => router.prefetch(threadPath)}
              >
                <input
                  aria-label={`Select message ${message.subject}`}
                  checked={checked}
                  onChange={(event) =>
                    setSelectedIds((current) =>
                      event.target.checked
                        ? [...current, message.id]
                        : current.filter((id) => id !== message.id),
                    )
                  }
                  type="checkbox"
                />

                <MessageRowAction action="star" busy={busy} message={message} onRun={(action) => void runRowMutation(getListMutation(action, message))} />

                <Link className="min-w-0 truncate pt-0.5 text-sm font-semibold" href={threadPath}>
                  <span className={cn("truncate", message.unread ? "font-semibold text-[var(--text)]" : "font-medium text-[var(--text-muted)]")}>
                    {senderLabel}
                  </span>
                </Link>

                <Link className="min-w-0 pt-0.5 text-sm" href={threadPath}>
                  <div className="min-w-0 truncate">
                    <span className={cn("truncate", message.unread ? "font-semibold text-[var(--text)]" : "font-medium text-[var(--text)]")}>
                      {message.subject || "(no subject)"}
                    </span>
                    {message.snippet ? (
                      <span className="truncate text-[var(--text-muted)]">{` - ${message.snippet}`}</span>
                    ) : null}
                    {hasAttachment ? <Paperclip className="ml-2 inline h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" /> : null}
                  </div>
                </Link>

                <div className="absolute right-4 top-3 flex items-center gap-1 group-hover:hidden group-focus-within:hidden">
                  {messageTimestamp ? (
                    <span className={cn("text-xs", message.unread ? "font-semibold text-[var(--text)]" : "text-[var(--text-muted)]")}>
                      {messageTimestamp}
                    </span>
                  ) : null}
                </div>

                <div className="absolute right-4 top-3 hidden items-center gap-1 group-hover:flex group-focus-within:flex">
                  <MessageRowAction action="archive" busy={busy} message={message} onRun={(action) => void runRowMutation(getListMutation(action, message))} />
                  <MessageRowAction action="read" busy={busy} message={message} onRun={(action) => void runRowMutation(getListMutation(action, message))} />
                  <MessageRowAction action="trash" busy={busy} message={message} onRun={(action) => void runRowMutation(getListMutation(action, message))} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {actionError ? (
        <div className="border-t border-[var(--line)] px-4 py-3 text-sm text-[var(--accent-strong)]" role="status">
          {actionError}
        </div>
      ) : null}

      <div className="flex items-center justify-end gap-3 border-t border-[var(--line)] px-4 py-3">
        {onLoadMore && hasMore ? (
          <BrandButton
            className="px-4 py-2"
            disabled={isLoadingMore}
            onClick={onLoadMore}
            tone="secondary"
            type="button"
          >
            {isLoadingMore ? "Loading more results..." : "Load more results"}
          </BrandButton>
        ) : null}
        {previousPageHref ? (
          <Link
            className="rounded-full border border-[var(--line)] bg-[var(--surface-overlay)] px-4 py-2 text-sm text-[var(--text)] transition hover:border-[var(--line)] hover:bg-[var(--surface-overlay)]"
            href={previousPageHref}
          >
            Previous
          </Link>
        ) : null}
        {!onLoadMore && nextPageHref ? (
          <Link
            className="rounded-full border border-[var(--line)] bg-[var(--surface-overlay)] px-4 py-2 text-sm text-[var(--text)] transition hover:border-[var(--line)] hover:bg-[var(--surface-overlay)]"
            href={nextPageHref}
          >
            Next
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function getListMutation(action: "star" | "archive" | "read" | "trash", message: MailMessagePreview): RowMutation {
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
    };
  }

  return {
    type: action,
    messageId: message.id,
  };
}
