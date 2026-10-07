import type { MailMessage } from "@/lib/mail/types";

// Compatibility types retained so the existing Inbox UI can remain unchanged.
// The TRON mailbox runtime never calls Google APIs or stores Google tokens.
export type GmailAccessErrorCode = string;
export type GmailAccessReason = GmailAccessErrorCode;

export type GmailAccessState = {
  eyebrow: string;
  title: string;
  description: string;
  helpText: string;
  actionLabel: string;
  actionKind: "google-oauth" | "link";
  actionHref: string;
  secondaryActionHref: string | null;
  secondaryActionLabel: string | null;
  reason: string;
};

export class GmailAccessError extends Error {
  name = "MailboxAccessError";
  details: Record<string, unknown>;

  constructor(
    public code: GmailAccessErrorCode,
    message: string,
    options?: { cause?: unknown; details?: Record<string, unknown> },
  ) {
    super(message, options?.cause === undefined ? undefined : { cause: options.cause });
    this.details = options?.details ?? {};
  }

  get reason() {
    return this.code;
  }
}

export { GmailAccessError as GmailAuthError };

export function getApiErrorStatusCode() {
  return null;
}

export function isProviderTokenFetchError() {
  return false;
}

export function isGmailScopeMissingError() {
  return false;
}

export function toGmailAccessError(error: unknown) {
  if (error instanceof GmailAccessError) return error;
  return new GmailAccessError(
    "TRON_MAIL_TRANSPORT_NOT_CONFIGURED",
    error instanceof Error ? error.message : "TRON Mail is not configured yet.",
    { cause: error },
  );
}

export function getGmailAccessState(input: GmailAccessError | GmailAccessReason | string): GmailAccessState {
  const reason = input instanceof GmailAccessError ? input.reason : String(input);

  return {
    eyebrow: "TRON Mail",
    title: "TRON Mail is not configured yet",
    description: "This mailbox is waiting for TRON’s mail transport to be connected.",
    helpText: "Google and Microsoft mailbox connections are not used by this Inbox.",
    actionLabel: "Back to Inbox",
    actionKind: "link",
    actionHref: "/mail/inbox",
    secondaryActionHref: null,
    secondaryActionLabel: null,
    reason,
  };
}

export function getPrimaryMessage(thread: { messages: MailMessage[] }) {
  return thread.messages[0] ?? null;
}
