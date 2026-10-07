export type MailParticipant = {
  name: string | null;
  email: string | null;
};

export function normalizeMailboxEmail(value?: string | null) {
  return value?.trim().toLowerCase() ?? "";
}

export function parseMailParticipant(value?: string | null): MailParticipant {
  if (!value) {
    return { name: null, email: null };
  }

  const trimmed = value.trim();
  const angleMatch = trimmed.match(/^(?:"?([^"]*)"?\s*)?<([^<>]+)>$/);

  if (angleMatch) {
    return {
      name: angleMatch[1]?.trim() || null,
      email: normalizeMailboxEmail(angleMatch[2]),
    };
  }

  const emailMatch = trimmed.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);

  if (emailMatch) {
    const email = normalizeMailboxEmail(emailMatch[0]);
    const name = trimmed.replace(emailMatch[0], "").replace(/[<>"]/g, "").trim();

    return {
      name: name || null,
      email,
    };
  }

  return {
    name: trimmed || null,
    email: null,
  };
}

export function getMailParticipantLabel(value?: string | null) {
  const participant = parseMailParticipant(value);
  return participant.name || participant.email || "Unknown sender";
}
