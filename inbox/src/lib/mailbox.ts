import "server-only";

import { cache } from "react";
import { getMailboxAccountsSnapshotForCurrentUser } from "@/lib/mail/accounts";
import { getProviderAdapter } from "@/lib/mail/providers";
import type { ConnectedMailboxAccount, ProviderFolder } from "@/lib/mail/providers/types";
import { getReconnectGmailAccessState, type MailboxLoadState } from "@/lib/mailbox-state";

export const SYSTEM_LABEL_ORDER = [
  "INBOX",
  "STARRED",
  "SENT",
  "DRAFT",
  "IMPORTANT",
  "TRASH",
  "CATEGORY_PRIMARY",
  "CATEGORY_PROMOTIONS",
  "CATEGORY_SOCIAL",
  "CATEGORY_UPDATES",
] as const;

const DEFAULT_SYSTEM_LABELS: ProviderFolder[] = [
  { id: "INBOX", name: "Inbox", kind: "system" },
  { id: "STARRED", name: "Starred", kind: "system" },
  { id: "SENT", name: "Sent", kind: "system" },
  { id: "DRAFT", name: "Drafts", kind: "system" },
  { id: "IMPORTANT", name: "Important", kind: "system" },
  { id: "TRASH", name: "Trash", kind: "system" },
  { id: "CATEGORY_PRIMARY", name: "Primary", kind: "system" },
  { id: "CATEGORY_PROMOTIONS", name: "Promotions", kind: "system" },
  { id: "CATEGORY_SOCIAL", name: "Social", kind: "system" },
  { id: "CATEGORY_UPDATES", name: "Updates", kind: "system" },
];

type MailboxReadyContext = {
  status: "ready";
  loadState: MailboxLoadState;
  account: Awaited<ReturnType<typeof getMailboxAccountsSnapshotForCurrentUser>>["sessionUser"];
  connectedAccounts: ConnectedMailboxAccount[];
  activeMailbox: ConnectedMailboxAccount;
  labels: ProviderFolder[];
};

type MailboxUnavailableContext = {
  status: "unavailable";
  loadState: Exclude<MailboxLoadState, { status: "ready" }>;
  account: Awaited<ReturnType<typeof getMailboxAccountsSnapshotForCurrentUser>>["sessionUser"];
  connectedAccounts: ConnectedMailboxAccount[];
  activeMailbox: ConnectedMailboxAccount | null;
  labels: ProviderFolder[];
  errorState: ReturnType<typeof getReconnectGmailAccessState>;
};

export type MailboxContext = MailboxReadyContext | MailboxUnavailableContext;

export const requireSession = async () => (await getMailboxAccountsSnapshotForCurrentUser()).sessionUser;

function isFolder(value: ProviderFolder | undefined): value is ProviderFolder {
  return Boolean(value?.id);
}

export const getMailboxContext = cache(async (): Promise<MailboxContext> => {
  const snapshot = await getMailboxAccountsSnapshotForCurrentUser();

  if (snapshot.loadState.status !== "ready" || !snapshot.activeMailbox) {
    return {
      status: "unavailable",
      loadState: snapshot.loadState as Exclude<MailboxLoadState, { status: "ready" }>,
      account: snapshot.sessionUser,
      connectedAccounts: snapshot.accounts,
      activeMailbox: snapshot.activeMailbox,
      labels: DEFAULT_SYSTEM_LABELS,
      errorState: getReconnectGmailAccessState(snapshot.loadState.reason ?? "UNKNOWN_MAILBOX_SETUP_FAILURE"),
    };
  }

  let labels = DEFAULT_SYSTEM_LABELS;

  try {
    const provider = getProviderAdapter(snapshot.activeMailbox.provider);
    const providerLabels = await provider.listFolders(snapshot.activeMailbox);

    if (providerLabels.length) {
      labels = providerLabels;
    }
  } catch {
    labels = DEFAULT_SYSTEM_LABELS;
  }

  return {
    status: "ready",
    loadState: snapshot.loadState,
    account: snapshot.sessionUser,
    connectedAccounts: snapshot.accounts,
    activeMailbox: snapshot.activeMailbox,
    labels,
  };
});

export function getSystemLabel(
  labels: ProviderFolder[],
  id: (typeof SYSTEM_LABEL_ORDER)[number],
) {
  return labels.find((label) => label.id === id);
}

export function getVisibleSidebarLabels(labels: ProviderFolder[]) {
  const system = SYSTEM_LABEL_ORDER.map((id) => labels.find((label) => label.id === id)).filter(isFolder);
  const custom = labels.filter((label) => label.kind === "user");

  return {
    system,
    custom,
  };
}

export function getCategoryTabs(labels: ProviderFolder[]) {
  const categories = [
    labels.find((label) => label.id === "CATEGORY_PRIMARY"),
    labels.find((label) => label.id === "CATEGORY_PROMOTIONS"),
    labels.find((label) => label.id === "CATEGORY_SOCIAL"),
    labels.find((label) => label.id === "CATEGORY_UPDATES"),
  ].filter(isFolder);

  return categories.length
    ? categories.map((label) => ({
        id: label.id,
        name: label.name,
      }))
    : [{ id: "INBOX", name: "Inbox" }];
}

export function getDefaultMailboxLabels() {
  return DEFAULT_SYSTEM_LABELS;
}
