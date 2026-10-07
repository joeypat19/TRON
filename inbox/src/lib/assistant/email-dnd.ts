export const TRON_ASSISTANT_EMAIL_MIME = "application/x-troninbox-assistant-email";

const MAX_PREVIEW_TEXT_CHARS = 240;

export type AssistantDraggedEmailPayload = {
  messageId: string;
  subject?: string;
  sender?: string;
  snippet?: string;
};

export function createAssistantDraggedEmailPayload(input: {
  messageId: string;
  subject?: string | null;
  sender?: string | null;
  snippet?: string | null;
}): AssistantDraggedEmailPayload {
  return {
    messageId: input.messageId.trim(),
    subject: normalizePreviewText(input.subject),
    sender: normalizePreviewText(input.sender),
    snippet: normalizePreviewText(input.snippet),
  };
}

export function parseAssistantDraggedEmailPayload(raw: string): AssistantDraggedEmailPayload | null {
  if (!raw.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }

    const candidate = parsed as Record<string, unknown>;
    const messageId = normalizeIdentifier(candidate.messageId);

    if (!messageId) {
      return null;
    }

    return {
      messageId,
      subject: normalizePreviewText(candidate.subject),
      sender: normalizePreviewText(candidate.sender),
      snippet: normalizePreviewText(candidate.snippet),
    };
  } catch {
    return null;
  }
}

export function isAssistantDraggedEmailDataTransfer(types: Iterable<string> | ArrayLike<string>) {
  return Array.from(types).includes(TRON_ASSISTANT_EMAIL_MIME);
}

function normalizeIdentifier(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, 256) : undefined;
}

function normalizePreviewText(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized ? normalized.slice(0, MAX_PREVIEW_TEXT_CHARS) : undefined;
}
