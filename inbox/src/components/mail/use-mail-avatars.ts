"use client";

import { useEffect, useMemo, useState } from "react";
import { normalizeMailboxEmail } from "@/lib/mail/participants";
import { appPath } from "@/lib/app-path";

export type MailAvatarRecord = {
  photoUrl: string | null;
  displayName: string | null;
  source: "contacts" | "otherContacts" | "directory" | "fallback" | null;
};

const avatarCache = new Map<string, MailAvatarRecord>();
const inflightEmails = new Set<string>();

export function useMailAvatars(emails: string[]) {
  const normalizedEmails = useMemo(
    () => [...new Set(emails.map((email) => normalizeMailboxEmail(email)).filter(Boolean))],
    [emails],
  );
  const cachedAvatars = useMemo(
    () =>
      Object.fromEntries(
        normalizedEmails.flatMap((email) => (avatarCache.has(email) ? [[email, avatarCache.get(email)!]] : [])),
      ),
    [normalizedEmails],
  );
  const [fetchedAvatars, setFetchedAvatars] = useState<Record<string, MailAvatarRecord>>({});

  useEffect(() => {
    const missing = normalizedEmails.filter((email) => !avatarCache.has(email) && !inflightEmails.has(email));

    if (!missing.length) {
      return;
    }

    for (const email of missing) {
      inflightEmails.add(email);
    }

    void fetch(appPath("/api/mail/avatars"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ emails: missing }),
    })
      .then(async (response) => {
        const payload = (await response.json()) as {
          avatars?: Record<string, MailAvatarRecord>;
        };

        const nextAvatars = payload.avatars ?? {};

        for (const [email, avatar] of Object.entries(nextAvatars)) {
          avatarCache.set(email, avatar);
        }

        setFetchedAvatars((current) => ({
          ...current,
          ...nextAvatars,
        }));
      })
      .catch(() => {
        // Ignore avatar lookup errors and keep fallback initials in place.
      })
      .finally(() => {
        for (const email of missing) {
          inflightEmails.delete(email);
        }
      });
  }, [normalizedEmails]);

  return useMemo(
    () => ({
      ...cachedAvatars,
      ...fetchedAvatars,
    }),
    [cachedAvatars, fetchedAvatars],
  );
}
