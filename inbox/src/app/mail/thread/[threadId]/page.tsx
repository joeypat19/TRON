import Link from "next/link";
import { Archive, ArrowLeft, Download, MailOpen, MailPlus, Star, Trash2 } from "lucide-react";
import {
  archiveMessageAction,
  markMessageReadAction,
  toggleStarAction,
  trashMessageAction,
} from "@/app/mail/actions";
import { GmailAccessStateCard } from "@/components/auth/gmail-access-state";
import { MailboxLoadStatePanel } from "@/components/mail/mailbox-load-state-panel";
import { ThreadReadMarker } from "@/components/mail/thread-read-marker";
import { appPath } from "@/lib/app-path";
import { BrandCard } from "@/components/ui/brand-card";
import { getMailboxErrorState } from "@/lib/mail/accounts";
import { GmailAuthError, getPrimaryMessage } from "@/lib/gmail/client";
import { plainTextToHtml } from "@/lib/gmail/parse";
import { MicrosoftAccessError } from "@/lib/microsoft/client";
import { getProviderAdapter } from "@/lib/mail/providers";
import { getMailboxContext } from "@/lib/mailbox";
import { getMailboxLoadStateFromReason } from "@/lib/mailbox-state";
import { cn, formatAttachmentSize, formatMailboxDate } from "@/lib/utils";

const chromeButtonClassName =
  "inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--surface-overlay)] px-4 py-2 text-sm text-[var(--text)] transition hover:border-[var(--line)] hover:bg-[var(--surface-overlay)]";

export default async function ThreadPage({ params }: { params: Promise<{ threadId: string }> }) {
  const mailbox = await getMailboxContext();

  if (mailbox.status !== "ready") {
    return <MailboxLoadStatePanel hasConnectedAccount={mailbox.connectedAccounts.length > 0} state={mailbox.loadState} />;
  }

  const { threadId } = await params;
  const provider = getProviderAdapter(mailbox.activeMailbox.provider);
  let thread: Awaited<ReturnType<NonNullable<typeof provider.getThread>>>;

  try {
    if (!provider.getThread) {
      throw new Error("Thread views are not implemented for this provider.");
    }

    thread = await provider.getThread(mailbox.activeMailbox, threadId);
    } catch (error) {
      if (error instanceof GmailAuthError) {
        return <GmailAccessStateCard state={getMailboxErrorState(error.reason)} />;
      }

      if (error instanceof MicrosoftAccessError) {
        return (
          <MailboxLoadStatePanel
            hasConnectedAccount={mailbox.connectedAccounts.length > 0}
            state={getMailboxLoadStateFromReason(
              error.reason === "MICROSOFT_SCOPE_MISSING"
                ? "MICROSOFT_SCOPE_MISSING"
                : error.reason === "MICROSOFT_ADMIN_CONSENT_REQUIRED"
                  ? "MICROSOFT_ADMIN_CONSENT_REQUIRED"
                  : "MICROSOFT_TOKEN_MISSING",
            )}
          />
        );
      }

      throw error;
    }

  const primary = getPrimaryMessage(thread);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <ThreadReadMarker
        messageId={primary.id}
        threadId={threadId}
        unread={primary.labelIds.includes("UNREAD")}
      />
      <BrandCard className="px-5 py-4" tone="strong">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link
              className="inline-flex items-center gap-2 text-sm font-medium text-[var(--text-muted)] transition hover:text-[var(--text)]"
              href={appPath("/mail/inbox")}
            >
              <ArrowLeft className="h-4 w-4" />
              Back to list
            </Link>
            <h1 className="mt-3 text-2xl font-semibold text-brand-gradient">{primary.subject}</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <form action={toggleStarAction}>
              <input name="accountId" type="hidden" value={mailbox.activeMailbox.id} />
              <input name="messageId" type="hidden" value={primary.id} />
              <input name="nextStarred" type="hidden" value={String(!primary.labelIds.includes("STARRED"))} />
              <input name="nextPath" type="hidden" value={appPath(`/mail/thread/${threadId}`)} />
              <button className={chromeButtonClassName} type="submit">
                <Star className={cn("h-4 w-4", primary.labelIds.includes("STARRED") ? "fill-[var(--accent)] text-[var(--accent)]" : "")} />
                {primary.labelIds.includes("STARRED") ? "Unstar" : "Star"}
              </button>
            </form>

            <form action={markMessageReadAction}>
              <input name="accountId" type="hidden" value={mailbox.activeMailbox.id} />
              <input name="messageId" type="hidden" value={primary.id} />
              <input name="unread" type="hidden" value={String(primary.labelIds.includes("UNREAD"))} />
              <input name="nextPath" type="hidden" value={appPath(`/mail/thread/${threadId}`)} />
              <input name="redirectTo" type="hidden" value={appPath(`/mail/thread/${threadId}`)} />
              <button className={chromeButtonClassName} type="submit">
                {primary.labelIds.includes("UNREAD") ? <MailOpen className="h-4 w-4" /> : <MailPlus className="h-4 w-4" />}
                {primary.labelIds.includes("UNREAD") ? "Mark read" : "Mark unread"}
              </button>
            </form>

            <form action={archiveMessageAction}>
              <input name="accountId" type="hidden" value={mailbox.activeMailbox.id} />
              <input name="messageId" type="hidden" value={primary.id} />
              <input name="nextPath" type="hidden" value={appPath("/mail/inbox")} />
              <input name="redirectTo" type="hidden" value={appPath("/mail/inbox")} />
              <button className={chromeButtonClassName} type="submit">
                <Archive className="h-4 w-4" />
                Archive
              </button>
            </form>

            <form action={trashMessageAction}>
              <input name="accountId" type="hidden" value={mailbox.activeMailbox.id} />
              <input name="messageId" type="hidden" value={primary.id} />
              <input name="nextPath" type="hidden" value={appPath("/mail/inbox")} />
              <input name="redirectTo" type="hidden" value={appPath("/mail/inbox")} />
              <button
                className="inline-flex items-center gap-2 rounded-full border border-[var(--accent-strong)] bg-[var(--surface-overlay)] px-4 py-2 text-sm text-[var(--text)] transition hover:border-[var(--accent-strong)] hover:bg-[var(--surface-overlay)]"
                type="submit"
              >
                <Trash2 className="h-4 w-4" />
                Trash
              </button>
            </form>
          </div>
        </div>
      </BrandCard>

      <div className="space-y-4">
        {thread.messages.map((message) => {
          const body = message.htmlBody ?? plainTextToHtml(message.textBody ?? "");

          return (
            <article className="brand-panel mx-auto w-full max-w-5xl overflow-hidden p-6" key={message.id}>
              <div className="flex flex-col gap-3 border-b border-[var(--line)] pb-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-[var(--text)]">{message.subject}</h2>
                  <p className="mt-2 text-sm text-[var(--text-muted)]">From: {message.from ?? "Unknown sender"}</p>
                  {message.to.length ? <p className="text-sm text-[var(--text-muted)]">To: {message.to.join(", ")}</p> : null}
                  {message.cc.length ? <p className="text-sm text-[var(--text-muted)]">Cc: {message.cc.join(", ")}</p> : null}
                  {message.bcc.length ? <p className="text-sm text-[var(--text-muted)]">Bcc: {message.bcc.join(", ")}</p> : null}
                </div>
                <div className="text-sm text-[var(--text-muted)]">
                  <p>{formatMailboxDate(message.date)}</p>
                  {message.messageId ? <p className="mt-1 break-all">{message.messageId}</p> : null}
                </div>
              </div>

              <div className="mt-6 overflow-hidden rounded-[24px] border border-[var(--line)] bg-[var(--surface-overlay)] p-5">
                {body ? (
                  <div
                    className="tron-email-body prose prose-invert max-w-none prose-headings:text-[var(--text)] prose-p:text-[var(--text)] prose-a:text-[var(--accent-secondary)] prose-strong:text-[var(--text)] prose-li:text-[var(--text)]"
                    dangerouslySetInnerHTML={{ __html: body }}
                  />
                ) : (
                  <p className="text-[var(--text-muted)]">This message has no renderable body.</p>
                )}
              </div>

              {message.attachments.length ? (
                <div className="mt-6 border-t border-[var(--line)] pt-4">
                  <h3 className="text-sm font-semibold text-[var(--text)]">Attachments</h3>
                  <ul className="mt-3 space-y-2">
                    {message.attachments.map((attachment) => (
                      <li
                        className="flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-[var(--line)] bg-[var(--surface-overlay)] px-4 py-3"
                        key={attachment.attachmentId}
                      >
                        <div>
                          <p className="text-sm font-medium text-[var(--text)]">{attachment.filename}</p>
                          <p className="text-xs text-[var(--text-muted)]">{`${attachment.mimeType} · ${formatAttachmentSize(attachment.size)}`}</p>
                        </div>
                        <a
                          className={chromeButtonClassName}
                          href={appPath(`/api/mail/messages/${message.id}/attachments/${attachment.attachmentId}`)}
                        >
                          <Download className="h-4 w-4" />
                          Download
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>

    </div>
  );
}
