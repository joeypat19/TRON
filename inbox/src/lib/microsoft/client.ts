// Compatibility error surface retained for the unchanged Inbox UI.
// No Microsoft Graph calls are made by the TRON mailbox runtime.
export type MicrosoftAccessErrorCode = string;

export class MicrosoftAccessError extends Error {
  name = "MailboxAccessError";
  details: Record<string, unknown>;

  constructor(
    public code: MicrosoftAccessErrorCode,
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

export function toMicrosoftAccessError(error: unknown) {
  if (error instanceof MicrosoftAccessError) return error;
  return new MicrosoftAccessError(
    "TRON_MAIL_TRANSPORT_NOT_CONFIGURED",
    error instanceof Error ? error.message : "TRON Mail is not configured yet.",
    { cause: error },
  );
}
