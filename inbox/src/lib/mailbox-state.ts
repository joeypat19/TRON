import { GmailAccessError, getGmailAccessState } from "@/lib/gmail/client";
import { MicrosoftAccessError } from "@/lib/microsoft/client";
import {
  classifyMailboxSetupError,
  getMailboxSetupDiagnostic,
  type MailboxSetupCode,
} from "@/lib/mail/setup-diagnostics";

export type MailboxFailureReason = MailboxSetupCode;

export type MailboxLoadState =
  | { status: "ready"; reason: null; message: null }
  | { status: "syncing"; reason: MailboxFailureReason; message: string; developerMessage?: string | null }
  | { status: "needs_google_reconnect"; reason: MailboxFailureReason; message: string; developerMessage?: string | null }
  | { status: "setup_error"; reason: MailboxFailureReason; message: string; developerMessage?: string | null }
  | { status: "temporary_error"; reason: MailboxFailureReason; message: string; developerMessage?: string | null };

export type MailboxFailureMapping = {
  state: Exclude<MailboxLoadState, { status: "ready" }>;
  errorName: string;
  errorMessage: string;
};

export function getMailboxLoadStateMessage(reason: MailboxFailureReason) {
  return getMailboxSetupDiagnostic(reason, "mailbox-state").userMessage;
}

export function getMailboxDeveloperMessage(reason: MailboxFailureReason) {
  return getMailboxSetupDiagnostic(reason, "mailbox-state").devMessage;
}

export function getMailboxLoadStateFromReason(reason: MailboxFailureReason): Exclude<MailboxLoadState, { status: "ready" }> {
  const diagnostic = getMailboxSetupDiagnostic(reason, "mailbox-state");

  if (reason === "MAILBOX_SYNC_TIMEOUT") {
    return { status: "syncing", reason, message: diagnostic.userMessage, developerMessage: diagnostic.devMessage };
  }

  if (reason.startsWith("DATABASE_") || reason === "PRISMA_CLIENT_INIT_FAILED" || reason === "DATABASE_QUERY_FAILED" || reason === "DATABASE_WRITE_FAILED") {
    return { status: "setup_error", reason, message: diagnostic.userMessage, developerMessage: diagnostic.devMessage };
  }

  if (
    [
      "GOOGLE_EXTERNAL_ACCOUNT_MISSING",
      "GOOGLE_OAUTH_TOKEN_MISSING",
      "GMAIL_TOKEN_MISSING",
      "GMAIL_SCOPE_MISSING",
      "GMAIL_SCOPES_MISSING",
      "GOOGLE_TOKEN_REFRESH_FAILED",
      "MICROSOFT_TOKEN_MISSING",
      "MICROSOFT_SCOPE_MISSING",
      "MICROSOFT_ADMIN_CONSENT_REQUIRED",
    ].includes(reason)
  ) {
    return { status: "needs_google_reconnect", reason, message: diagnostic.userMessage, developerMessage: diagnostic.devMessage };
  }

  return { status: "temporary_error", reason, message: diagnostic.userMessage, developerMessage: diagnostic.devMessage };
}

export function mapMailboxFailure(error: unknown): MailboxFailureMapping {
  const reason = error instanceof GmailAccessError || error instanceof MicrosoftAccessError
    ? "UNKNOWN_MAILBOX_SETUP_FAILURE"
    : classifyMailboxSetupError(error, "mailbox-error").code;
  const state = getMailboxLoadStateFromReason(reason);

  return {
    state,
    errorName: error instanceof Error ? error.name : typeof error,
    errorMessage: error instanceof Error ? error.message : String(error),
  };
}

export function getReconnectGmailAccessState(reason: MailboxFailureReason | string) {
  return getGmailAccessState(String(reason));
}
