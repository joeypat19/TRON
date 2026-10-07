import { parseMailParticipant } from "@/lib/mail/participants";

export type SearchableMailMessage = {
  id: string;
  threadId: string;
  subject: string;
  snippet?: string;
  from?: string;
  to: string[];
  date?: string;
  internalDate?: string | number;
};

export type SearchMatchRank = 0 | 1 | 2 | 3;

type RankedSearchMessage<T extends SearchableMailMessage> = {
  message: T;
  rank: SearchMatchRank;
};

export function normalizeSearchText(value?: string | null) {
  return (value ?? "")
    .trim()
    .replace(/^"+|"+$/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function compareMailByNewest<T extends Pick<SearchableMailMessage, "id" | "date" | "internalDate">>(left: T, right: T) {
  const leftInternalDate = Number(left.internalDate ?? 0);
  const rightInternalDate = Number(right.internalDate ?? 0);
  const normalizedLeftInternalDate = Number.isNaN(leftInternalDate) ? 0 : leftInternalDate;
  const normalizedRightInternalDate = Number.isNaN(rightInternalDate) ? 0 : rightInternalDate;

  if (normalizedLeftInternalDate !== normalizedRightInternalDate) {
    return normalizedRightInternalDate - normalizedLeftInternalDate;
  }

  const leftDate = Date.parse(left.date ?? "");
  const rightDate = Date.parse(right.date ?? "");

  if (!Number.isNaN(leftDate) && !Number.isNaN(rightDate) && leftDate !== rightDate) {
    return rightDate - leftDate;
  }

  return right.id.localeCompare(left.id);
}

export function compareMailByOldest<T extends Pick<SearchableMailMessage, "id" | "date" | "internalDate">>(left: T, right: T) {
  return compareMailByNewest(right, left);
}

function getSearchFieldGroups(message: SearchableMailMessage) {
  const fromParticipant = parseMailParticipant(message.from);
  const recipients = message.to.map((recipient) => parseMailParticipant(recipient));

  return {
    sender: [
      normalizeSearchText(fromParticipant.name),
      normalizeSearchText(fromParticipant.email),
    ].filter(Boolean),
    recipients: recipients.flatMap((recipient) => [
      normalizeSearchText(recipient.name),
      normalizeSearchText(recipient.email),
    ]).filter(Boolean),
    subject: [normalizeSearchText(message.subject)].filter(Boolean),
  };
}

export function getMessagePrefixRank(message: SearchableMailMessage, query: string, options?: { allowContainsFallback?: boolean }) {
  const normalizedQuery = normalizeSearchText(query);

  if (!normalizedQuery) {
    return null;
  }

  const fields = getSearchFieldGroups(message);

  if (fields.sender.some((field) => field.startsWith(normalizedQuery))) {
    return 0 satisfies SearchMatchRank;
  }

  if (fields.recipients.some((field) => field.startsWith(normalizedQuery))) {
    return 1 satisfies SearchMatchRank;
  }

  if (fields.subject.some((field) => field.startsWith(normalizedQuery))) {
    return 2 satisfies SearchMatchRank;
  }

  if (!options?.allowContainsFallback) {
    return null;
  }

  const allFields = [...fields.sender, ...fields.recipients, ...fields.subject];

  if (allFields.some((field) => field.includes(normalizedQuery))) {
    return 3 satisfies SearchMatchRank;
  }

  return null;
}

export function messageMatchesPrefix(message: SearchableMailMessage, query: string) {
  const rank = getMessagePrefixRank(message, query, { allowContainsFallback: false });
  return rank !== null && rank <= 2;
}

export function searchMailMessages<T extends SearchableMailMessage>(
  messages: T[],
  query: string,
  options?: {
    allowContainsFallback?: boolean;
    limit?: number;
    sort?: "newest" | "oldest";
  },
) {
  const normalizedQuery = normalizeSearchText(query);

  if (!normalizedQuery) {
    return [];
  }

  const dedupedMessages = new Map<string, T>();

  for (const message of messages) {
    dedupedMessages.set(message.id, message);
  }

  const ranked = [...dedupedMessages.values()]
    .map((message) => ({
      message,
      rank: getMessagePrefixRank(message, normalizedQuery, {
        allowContainsFallback: options?.allowContainsFallback,
      }),
    }))
    .filter((entry): entry is RankedSearchMessage<T> => entry.rank !== null)
    .sort((left, right) => {
      if (left.rank !== right.rank) {
        return left.rank - right.rank;
      }

      return options?.sort === "oldest"
        ? compareMailByOldest(left.message, right.message)
        : compareMailByNewest(left.message, right.message);
    });

  if (typeof options?.limit === "number") {
    return ranked.slice(0, options.limit).map((entry) => entry.message);
  }

  return ranked.map((entry) => entry.message);
}
