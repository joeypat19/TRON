import { NextResponse } from "next/server";
import { z } from "zod";
import { GmailAuthError, getGmailAccessState } from "@/lib/gmail/client";
import { MicrosoftAccessError } from "@/lib/microsoft/client";
import { getPrimaryConnectedMailboxForCurrentUser, requireSession } from "@/lib/mail/accounts";
import { getProviderAdapter } from "@/lib/mail/providers";
import { UnsupportedMailboxProviderError } from "@/lib/mail/providers/types";
import { getMailboxLoadStateMessage } from "@/lib/mailbox-state";

const mutationSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("star"),
    messageId: z.string().min(1),
    nextStarred: z.boolean(),
  }),
  z.object({
    type: z.literal("read"),
    messageId: z.string().min(1),
    nextUnread: z.boolean(),
    sourceColumnId: z.enum(["unread", "opened", "composed"]),
  }),
  z.object({
    type: z.literal("archive"),
    messageId: z.string().min(1),
    sourceColumnId: z.enum(["unread", "opened", "composed"]),
  }),
  z.object({
    type: z.literal("trash"),
    messageId: z.string().min(1),
    sourceColumnId: z.enum(["unread", "opened", "composed"]),
  }),
]);

function getActionErrorMessage(error: unknown) {
  if (error instanceof GmailAuthError) {
    return getGmailAccessState(error).description;
  }

  if (error instanceof MicrosoftAccessError) {
    return getMailboxLoadStateMessage(
      error.reason === "MICROSOFT_SCOPE_MISSING"
        ? "MICROSOFT_SCOPE_MISSING"
        : error.reason === "MICROSOFT_ADMIN_CONSENT_REQUIRED"
          ? "MICROSOFT_ADMIN_CONSENT_REQUIRED"
          : "MICROSOFT_TOKEN_MISSING",
    );
  }

  if (error instanceof UnsupportedMailboxProviderError) {
    return "This mailbox is not available in Inbox yet.";
  }

  return error instanceof Error ? error.message : "A mailbox error occurred.";
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ messageId: string }> },
) {
  try {
    await requireSession();
    const mailbox = await getPrimaryConnectedMailboxForCurrentUser();

    if (!mailbox) {
      return NextResponse.json({ error: "Connect an email account to continue." }, { status: 400 });
    }

    const { messageId } = await context.params;
    const provider = getProviderAdapter(mailbox.provider);
    const message = await provider.getMessage(mailbox, messageId);

    if (!message?.id) {
      return NextResponse.json({ error: "Message not found." }, { status: 404 });
    }

    return NextResponse.json({
      id: message.id,
      subject: message.subject,
      from: message.from,
      snippet: message.snippet,
      textBody: message.textBody ?? null,
      htmlBody: message.htmlBody ?? null,
    });
  } catch (error) {
    return NextResponse.json({ error: getActionErrorMessage(error) }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    await requireSession();
    const mailbox = await getPrimaryConnectedMailboxForCurrentUser();

    if (!mailbox) {
      return NextResponse.json({ error: "Connect an email account to continue." }, { status: 400 });
    }

    const parsed = mutationSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid mailbox action payload." }, { status: 400 });
    }

    const provider = getProviderAdapter(mailbox.provider);
    const mutation = parsed.data;

    if (mutation.type === "star") {
      await provider.starMessage(mailbox, mutation.messageId, mutation.nextStarred);
    }

    if (mutation.type === "read") {
      await provider.markRead(mailbox, mutation.messageId, !mutation.nextUnread);
    }

    if (mutation.type === "archive") {
      await provider.archiveMessage(mailbox, mutation.messageId);
    }

    if (mutation.type === "trash") {
      await provider.trashMessage(mailbox, mutation.messageId);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: getActionErrorMessage(error) }, { status: 500 });
  }
}
