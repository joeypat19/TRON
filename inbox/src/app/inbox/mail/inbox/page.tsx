import { redirect } from "next/navigation";

/**
 * Keep old standalone Inbox URLs working after the app moved to the root
 * domain. Existing browser bookmarks used /inbox/mail/inbox, while the
 * standalone deployment now serves the mailbox at /mail/inbox.
 */
export default function LegacyInboxRoute() {
  redirect("/mail/inbox");
}
