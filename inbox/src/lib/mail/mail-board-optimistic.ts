import type { MailColumn, MailMessageSummary, MailSectionId } from "@/lib/mail/mail-page-data";
import { compareMailByNewest, type SearchableMailMessage } from "@/lib/mail/search";

export type MailBoardSortOrder = "newest" | "oldest";

export type MailBoardMutation =
  | {
      type: "star";
      messageId: string;
      nextStarred: boolean;
    }
  | {
      type: "read";
      messageId: string;
      nextUnread: boolean;
      sourceColumnId: MailSectionId;
    }
  | {
      type: "archive" | "trash";
      messageId: string;
      sourceColumnId: MailSectionId;
    };

type SortOrderByColumn = Partial<Record<MailSectionId, MailBoardSortOrder>>;

function compareMailboxMessages(
  left: MailMessageSummary,
  right: MailMessageSummary,
  options?: {
    recentOpened?: Record<string, number>;
    sortOrder?: MailBoardSortOrder;
  },
) {
  if (options?.sortOrder === "oldest") {
    return compareMailByNewest(right as SearchableMailMessage, left as SearchableMailMessage);
  }

  const recentLeft = options?.recentOpened?.[left.threadId] ?? 0;
  const recentRight = options?.recentOpened?.[right.threadId] ?? 0;

  if (recentLeft !== recentRight) {
    return recentRight - recentLeft;
  }

  const leftTimestamp = Number(left.internalDate ?? 0);
  const rightTimestamp = Number(right.internalDate ?? 0);
  const normalizedLeftTimestamp = Number.isNaN(leftTimestamp) ? 0 : leftTimestamp;
  const normalizedRightTimestamp = Number.isNaN(rightTimestamp) ? 0 : rightTimestamp;

  if (normalizedLeftTimestamp !== normalizedRightTimestamp) {
    return normalizedRightTimestamp - normalizedLeftTimestamp;
  }

  const leftDate = Date.parse(left.date ?? "");
  const rightDate = Date.parse(right.date ?? "");

  if (!Number.isNaN(leftDate) && !Number.isNaN(rightDate) && leftDate !== rightDate) {
    return rightDate - leftDate;
  }

  return right.id.localeCompare(left.id);
}

export function sortMailBoardColumnMessages(
  columnId: MailSectionId,
  messages: MailMessageSummary[],
  recentOpened: Record<string, number>,
  sortOrder: MailBoardSortOrder,
) {
  return [...messages].sort((left, right) =>
    compareMailboxMessages(
      left,
      right,
      columnId === "opened"
        ? { recentOpened, sortOrder }
        : { sortOrder },
    ),
  );
}

function withColumnMessages(
  column: MailColumn,
  messages: MailMessageSummary[],
  totalDelta = 0,
): MailColumn {
  const totalCount = column.totalCount === null ? null : Math.max(0, column.totalCount + totalDelta);

  return {
    ...column,
    messages,
    loadedCount: messages.length,
    totalCount,
    countLabel: totalCount !== null ? String(totalCount) : `${messages.length} loaded`,
  };
}

function updateMessageLabelIds(message: MailMessageSummary, nextUnread: boolean) {
  const labelIds = new Set(message.labelIds);

  if (nextUnread) {
    labelIds.add("UNREAD");
  } else {
    labelIds.delete("UNREAD");
  }

  return [...labelIds];
}

function findMessage(columns: MailColumn[], messageId: string) {
  for (const column of columns) {
    const message = column.messages.find((candidate) => candidate.id === messageId);

    if (message) {
      return { column, message };
    }
  }

  return null;
}

export function applyMailBoardMutation(
  columns: MailColumn[],
  mutation: MailBoardMutation,
  options?: {
    recentOpened?: Record<string, number>;
    sortOrderByColumn?: SortOrderByColumn;
  },
) {
  const recentOpened = options?.recentOpened ?? {};
  const sortOrderByColumn = options?.sortOrderByColumn ?? {};

  if (mutation.type === "star") {
    return columns.map((column) =>
      withColumnMessages(
        column,
        column.messages.map((message) =>
          message.id === mutation.messageId
            ? {
                ...message,
                starred: mutation.nextStarred,
              }
            : message,
        ),
      ),
    );
  }

  if (mutation.type === "archive" || mutation.type === "trash") {
    return columns.map((column) => {
      const nextMessages = column.messages.filter((message) => message.id !== mutation.messageId);
      const removedCount = column.messages.length - nextMessages.length;

      return removedCount
        ? withColumnMessages(column, nextMessages, -removedCount)
        : column;
    });
  }

  if (mutation.type !== "read") {
    return columns;
  }

  const located = findMessage(columns, mutation.messageId);

  if (!located) {
    return columns;
  }

  const nextMessage: MailMessageSummary = {
    ...located.message,
    unread: mutation.nextUnread,
    labelIds: updateMessageLabelIds(located.message, mutation.nextUnread),
  };

  if (mutation.sourceColumnId === "unread" && !mutation.nextUnread) {
    return columns.map((column) => {
      if (column.id === "unread") {
        return withColumnMessages(
          column,
          column.messages.filter((message) => message.id !== mutation.messageId),
          -1,
        );
      }

      if (column.id === "opened") {
        const deduped = column.messages.filter((message) => message.id !== mutation.messageId);
        return withColumnMessages(
          column,
          sortMailBoardColumnMessages(
            "opened",
            [nextMessage, ...deduped],
            recentOpened,
            sortOrderByColumn.opened ?? "newest",
          ),
          1,
        );
      }

      return column;
    });
  }

  if (mutation.sourceColumnId === "opened" && mutation.nextUnread) {
    return columns.map((column) => {
      if (column.id === "opened") {
        return withColumnMessages(
          column,
          column.messages.filter((message) => message.id !== mutation.messageId),
          -1,
        );
      }

      if (column.id === "unread") {
        const deduped = column.messages.filter((message) => message.id !== mutation.messageId);
        return withColumnMessages(
          column,
          sortMailBoardColumnMessages(
            "unread",
            [nextMessage, ...deduped],
            recentOpened,
            sortOrderByColumn.unread ?? "newest",
          ),
          1,
        );
      }

      return column;
    });
  }

  return columns.map((column) =>
    withColumnMessages(
      column,
      column.messages.map((message) => (message.id === mutation.messageId ? nextMessage : message)),
    ),
  );
}
