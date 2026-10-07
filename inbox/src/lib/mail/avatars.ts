import "server-only";

import { normalizeMailboxEmail } from "@/lib/mail/participants";

export type MailAvatarLookup = {
  photoUrl: string | null;
  displayName: string | null;
  source: "contacts" | "otherContacts" | "directory" | "fallback" | null;
};

export async function resolveMailAvatars(emails: string[]) {
  return Object.fromEntries(
    emails.map((email) => [
      normalizeMailboxEmail(email),
      { photoUrl: null, displayName: null, source: "fallback" as const },
    ]),
  );
}
