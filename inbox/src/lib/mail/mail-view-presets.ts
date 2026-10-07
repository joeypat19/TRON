export type MailViewKey =
  | "unread"
  | "starred"
  | "snoozed"
  | "sent"
  | "drafts"
  | "spam"
  | "trash"
  | "promotions"
  | "social"
  | "updates";

export type MailViewPreset = {
  title: string;
  query: string;
  emptyTitle: string;
  emptyDescription: string;
  kind: "mail" | "system" | "category";
};

export const MAIL_VIEW_PRESETS: Record<MailViewKey, MailViewPreset> = {
  unread: {
    title: "Unread",
    query: "is:unread",
    emptyTitle: "No messages",
    emptyDescription: "No unread mail found.",
    kind: "mail",
  },
  starred: {
    title: "Starred",
    query: "is:starred",
    emptyTitle: "No messages",
    emptyDescription: "No starred mail found.",
    kind: "mail",
  },
  snoozed: {
    title: "Snoozed",
    query: "in:snoozed",
    emptyTitle: "No messages",
    emptyDescription: "No snoozed mail found.",
    kind: "mail",
  },
  sent: {
    title: "Sent",
    query: "in:sent",
    emptyTitle: "No messages",
    emptyDescription: "No sent mail found.",
    kind: "mail",
  },
  drafts: {
    title: "Drafts",
    query: "in:drafts",
    emptyTitle: "No messages",
    emptyDescription: "No draft mail found.",
    kind: "mail",
  },
  spam: {
    title: "Spam",
    query: "in:spam",
    emptyTitle: "No messages",
    emptyDescription: "No spam mail found.",
    kind: "system",
  },
  trash: {
    title: "Trash",
    query: "in:trash",
    emptyTitle: "No messages",
    emptyDescription: "No trash mail found.",
    kind: "system",
  },
  promotions: {
    title: "Promotions",
    query: "category:promotions",
    emptyTitle: "No messages",
    emptyDescription: "No promotions mail found.",
    kind: "category",
  },
  social: {
    title: "Social",
    query: "category:social",
    emptyTitle: "No messages",
    emptyDescription: "No social mail found.",
    kind: "category",
  },
  updates: {
    title: "Updates",
    query: "category:updates",
    emptyTitle: "No messages",
    emptyDescription: "No updates mail found.",
    kind: "category",
  },
};

export function getMailViewPreset(view?: string | null) {
  if (!view) {
    return null;
  }

  return MAIL_VIEW_PRESETS[view as MailViewKey] ?? null;
}

export function buildMailViewHref(view: MailViewKey) {
  return `/mail/view/${encodeURIComponent(view)}`;
}

const SYSTEM_LABEL_TITLE_BY_ID: Partial<Record<string, MailViewKey>> = {
  STARRED: "starred",
  SENT: "sent",
  DRAFT: "drafts",
  SPAM: "spam",
  TRASH: "trash",
  CATEGORY_PROMOTIONS: "promotions",
  CATEGORY_SOCIAL: "social",
  CATEGORY_UPDATES: "updates",
};

export function getMailSystemLabelTitle(labelId?: string | null, fallbackName?: string | null) {
  if (labelId) {
    const presetKey = SYSTEM_LABEL_TITLE_BY_ID[labelId];

    if (presetKey) {
      return MAIL_VIEW_PRESETS[presetKey].title;
    }
  }

  return fallbackName ?? labelId ?? "Label";
}

export function getMailSystemLabelEmptyDescription(labelId?: string | null, fallbackName?: string | null) {
  if (labelId) {
    const presetKey = SYSTEM_LABEL_TITLE_BY_ID[labelId];

    if (presetKey) {
      return MAIL_VIEW_PRESETS[presetKey].emptyDescription;
    }
  }

  return `No ${fallbackName ?? labelId ?? "label"} mail found.`;
}
