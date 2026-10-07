"use client";

import Link from "next/link";
import { ConnectGmailButton } from "@/components/auth/connect-gmail-button";
import { ConnectMicrosoftButton } from "@/components/auth/connect-microsoft-button";
import { BrandCard } from "@/components/ui/brand-card";
import { appPath } from "@/lib/app-path";
import type { MailboxLoadState } from "@/lib/mailbox-state";

type MailboxLoadStatePanelProps = {
  state?: Exclude<MailboxLoadState, { status: "ready" }>;
  compact?: boolean;
  hasConnectedAccount?: boolean;
};

const CONNECT_PROMPT_REASONS = new Set<Exclude<MailboxLoadState, { status: "ready" }>["reason"]>([
  "GOOGLE_EXTERNAL_ACCOUNT_MISSING",
  "GOOGLE_OAUTH_TOKEN_MISSING",
  "GMAIL_TOKEN_MISSING",
  "MICROSOFT_TOKEN_MISSING",
]);

export function MailboxLoadStatePanel({
  state,
  compact = false,
  hasConnectedAccount = false,
}: MailboxLoadStatePanelProps) {
  const safeState = state ?? {
    status: "temporary_error" as const,
    reason: "UNKNOWN_MAILBOX_SETUP_FAILURE" as const,
    message: "Inbox hit an unexpected mailbox state.",
  };
  const copy = getCopy(safeState, hasConnectedAccount);
  const connectProvider = getConnectProvider(safeState.reason);
  const showConnectPrompt =
    !hasConnectedAccount &&
    (safeState.status === "needs_google_reconnect" || CONNECT_PROMPT_REASONS.has(safeState.reason));

  if (showConnectPrompt) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-[24px] border border-[var(--line)] bg-[var(--surface-overlay)] px-4 py-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-[var(--text)]">{copy.title}</p>
          <p className="mt-1 text-sm text-[var(--text-muted)]">{copy.description}</p>
          {"helpText" in copy && copy.helpText ? (
            <p className="mt-1 text-xs leading-6 text-[var(--text-muted)]">{copy.helpText}</p>
          ) : null}
        </div>
        <div className="w-full max-w-xs sm:w-auto sm:max-w-none">
          {connectProvider === "microsoft" ? (
            <ConnectMicrosoftButton
              buttonClassName="min-h-11 w-full sm:w-auto"
              label={copy.retryLabel ?? "Connect Outlook"}
            />
          ) : (
            <ConnectGmailButton
              buttonClassName="min-h-11 w-full sm:w-auto"
              label={copy.retryLabel ?? "Connect Gmail"}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <BrandCard className={compact ? "p-5" : "p-6"} tone="strong">
      <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[var(--accent)]">{copy.eyebrow}</p>
      <h2 className="mt-3 text-xl font-semibold text-brand-gradient">{copy.title}</h2>
      <p className="mt-3 text-sm leading-7 text-[var(--text-muted)]">{copy.description}</p>
      {"helpText" in copy && copy.helpText ? (
        <p className="mt-2 text-xs leading-6 text-[var(--text-muted)]">{copy.helpText}</p>
      ) : null}
      <div className="mt-6 flex flex-wrap gap-3">
        {copy.retryHref ? (
          <Link
            className="inline-flex items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--accent)_0%,var(--accent-strong)_100%)] px-5 py-3 text-sm font-medium text-[var(--accent-contrast)] shadow-[0_0_24px_var(--accent-glow)] transition hover:brightness-110"
            href={copy.retryHref}
          >
            {copy.retryLabel}
          </Link>
        ) : null}
        {copy.action === "google-oauth" ? (
          <div className="w-full max-w-xs">
            <ConnectGmailButton buttonClassName="min-h-11 w-full" label="Reconnect Google" />
          </div>
        ) : null}
        {copy.action === "microsoft-oauth" ? (
          <div className="w-full max-w-xs">
            <ConnectMicrosoftButton buttonClassName="min-h-11 w-full" label="Reconnect Outlook" />
          </div>
        ) : null}
        {copy.secondaryHref && copy.secondaryLabel ? (
          <Link
            className="inline-flex items-center justify-center rounded-full border border-[var(--line)] bg-[var(--surface-overlay)] px-5 py-3 text-sm font-medium text-[var(--text)] transition hover:border-[var(--line)] hover:bg-[var(--surface-overlay)]"
            href={copy.secondaryHref}
          >
            {copy.secondaryLabel}
          </Link>
        ) : null}
      </div>
    </BrandCard>
  );
}

function getCopy(state: Exclude<MailboxLoadState, { status: "ready" }>, hasConnectedAccount: boolean) {
  if (!hasConnectedAccount && CONNECT_PROMPT_REASONS.has(state.reason)) {
      return {
        eyebrow: "Inbox",
        title: getConnectProvider(state.reason) === "microsoft" ? "Connect Outlook to load your inbox." : "Connect Gmail to load your inbox.",
        description: getConnectProvider(state.reason) === "microsoft"
          ? "Choose the Microsoft account you want to use with Inbox."
          : "Choose the Google account you want to use with Inbox.",
        action: "connect" as const,
        retryHref: undefined,
        retryLabel: getConnectProvider(state.reason) === "microsoft" ? "Connect Outlook" : "Connect Gmail",
        secondaryHref: undefined,
        secondaryLabel: undefined,
      };
  }

  if (!hasConnectedAccount && state.status === "needs_google_reconnect") {
    const failureType = getFailureTypeLabel(state.reason);

    if (failureType) {
      return {
        eyebrow: "Gmail authorization failed",
        title: "Google authorization worked, but Gmail authorization failed.",
        description: getFailureDescription(state.reason),
        helpText: `Failure type: ${failureType}.`,
        action: state.status === "needs_google_reconnect" ? ("google-oauth" as const) : ("connect" as const),
        retryHref: undefined,
        retryLabel: getConnectProvider(state.reason) === "microsoft" ? "Reconnect Outlook" : "Reconnect Google",
        secondaryHref: state.status === "needs_google_reconnect" ? appPath("/mail/inbox") : undefined,
        secondaryLabel: state.status === "needs_google_reconnect" ? "Refresh inbox" : undefined,
      };
    }
  }

  switch (state.status) {
    case "needs_google_reconnect":
      return {
        eyebrow: "Inbox",
        title: getReconnectTitle(state.reason),
        description: getFailureDescription(state.reason),
        helpText: `Failure type: ${getFailureTypeLabel(state.reason) ?? "Mailbox authorization"}.`,
        action: getConnectProvider(state.reason) === "microsoft" ? ("microsoft-oauth" as const) : ("google-oauth" as const),
        retryHref: appPath("/mail/inbox"),
        retryLabel: "Refresh inbox",
        secondaryHref: undefined,
        secondaryLabel: undefined,
      };
    case "syncing":
      return {
        eyebrow: "Syncing mailbox",
        title: "Syncing your mailbox...",
        description: "Live messages will appear here as soon as your mailbox finishes syncing.",
        action: "retry" as const,
        retryHref: appPath("/mail/inbox"),
        retryLabel: "Refresh inbox",
        secondaryHref: undefined,
        secondaryLabel: undefined,
      };
    case "setup_error":
      return {
        eyebrow: "Inbox",
        title: hasConnectedAccount ? "We're getting your inbox ready" : "We couldn't verify mailbox access yet",
        description: hasConnectedAccount
          ? "Your workspace is still coming online. Refresh the inbox or add another email account in the meantime."
          : "Inbox could not confirm the mailbox connection yet. Refresh the inbox after the current setup issue clears.",
        action: "retry" as const,
        retryHref: appPath("/mail/inbox"),
        retryLabel: "Refresh inbox",
        secondaryHref: undefined,
        secondaryLabel: undefined,
      };
    default:
      return {
        eyebrow: "Inbox",
        title: hasConnectedAccount ? "We're getting your inbox ready" : "Mailbox temporarily unavailable",
        description: hasConnectedAccount
          ? "Your workspace is still warming up. Try refreshing the inbox in a moment."
          : "Inbox hit a temporary mailbox issue. Refresh the inbox instead of reconnecting Gmail.",
        action: "retry" as const,
        retryHref: appPath("/mail/inbox"),
        retryLabel: "Refresh inbox",
        secondaryHref: undefined,
        secondaryLabel: undefined,
      };
  }
}

function getFailureTypeLabel(reason: Exclude<MailboxLoadState, { status: "ready" }>["reason"]) {
  if (["GOOGLE_OAUTH_PROVIDER_ERROR", "GOOGLE_OAUTH_TOKEN_MISSING", "GMAIL_TOKEN_MISSING", "GOOGLE_EXTERNAL_ACCOUNT_MISSING"].includes(reason)) {
    return "Token retrieval";
  }

  if (reason === "GMAIL_SCOPE_MISSING" || reason === "GMAIL_SCOPES_MISSING") {
    return "Missing scopes";
  }

  if (["MAILBOX_ACCOUNT_CREATE_FAILED", "MAILBOX_ACCOUNT_UPDATE_FAILED", "MAILBOX_TOKEN_ENCRYPT_FAILED"].includes(reason)) {
    return "Missing mailbox row";
  }

  if (["GMAIL_PROFILE_FETCH_FAILED", "GMAIL_API_CALL_FAILED", "GMAIL_API_DISABLED", "GOOGLE_TOKEN_REFRESH_FAILED"].includes(reason)) {
    return "Gmail API failure";
  }

  return null;
}

function getFailureDescription(reason: Exclude<MailboxLoadState, { status: "ready" }>["reason"]) {
  switch (reason) {
    case "GOOGLE_OAUTH_TOKEN_MISSING":
    case "GMAIL_TOKEN_MISSING":
    case "GOOGLE_EXTERNAL_ACCOUNT_MISSING":
      return "Inbox could not find a usable Gmail authorization after Google authorization completed.";
    case "MICROSOFT_TOKEN_MISSING":
      return "Inbox could not find a usable Outlook authorization after Microsoft authorization completed.";
    case "GMAIL_SCOPE_MISSING":
      return "Google authorization completed, but the returned token is missing one or more required Gmail scopes.";
    case "MICROSOFT_SCOPE_MISSING":
      return "Microsoft authorization completed, but the returned token is missing one or more required Outlook scopes.";
    case "MICROSOFT_ADMIN_CONSENT_REQUIRED":
      return "Microsoft authorization completed, but the tenant requires administrator approval for the requested mail scopes.";
    case "MAILBOX_ACCOUNT_CREATE_FAILED":
    case "MAILBOX_ACCOUNT_UPDATE_FAILED":
    case "MAILBOX_TOKEN_ENCRYPT_FAILED":
      return "Google authorization and Gmail consent progressed, but Inbox could not store the connected mailbox row.";
    case "GMAIL_PROFILE_FETCH_FAILED":
    case "GMAIL_API_CALL_FAILED":
    case "GMAIL_API_DISABLED":
    case "GOOGLE_TOKEN_REFRESH_FAILED":
      return "A Gmail API call failed before Inbox could finish connecting and loading this mailbox.";
    default:
      return "Connect Gmail to load your inbox.";
  }
}

function getReconnectTitle(reason: Exclude<MailboxLoadState, { status: "ready" }>["reason"]) {
  switch (reason) {
    case "GOOGLE_TOKEN_REFRESH_FAILED":
      return "Reconnect Google to refresh mailbox access";
    case "GMAIL_SCOPE_MISSING":
    case "GMAIL_SCOPES_MISSING":
      return "Reconnect Google to restore Gmail permissions";
    case "MICROSOFT_SCOPE_MISSING":
      return "Reconnect Outlook to restore mailbox permissions";
    case "MICROSOFT_ADMIN_CONSENT_REQUIRED":
      return "Outlook access needs administrator approval";
    case "MICROSOFT_TOKEN_MISSING":
      return "Reconnect Outlook to load your inbox";
    default:
      return "Reconnect Google to load your inbox";
  }
}

function getConnectProvider(reason: Exclude<MailboxLoadState, { status: "ready" }>["reason"]) {
  return reason.startsWith("MICROSOFT_") ? "microsoft" : "google";
}
