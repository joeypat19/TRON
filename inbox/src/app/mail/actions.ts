"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  getGmailAccessState,
  GmailAuthError,
} from "@/lib/gmail/client";
import { MicrosoftAccessError } from "@/lib/microsoft/client";
import { getPrimaryConnectedMailboxForCurrentUser, requireSession, setActiveMailboxForCurrentUser } from "@/lib/mail/accounts";
import { getProviderAdapter } from "@/lib/mail/providers";
import type { ProviderComposeAttachment } from "@/lib/mail/providers/types";
import { UnsupportedMailboxProviderError } from "@/lib/mail/providers/types";
import { getMailboxLoadStateMessage } from "@/lib/mailbox-state";
import { appPath, stripAppMount } from "@/lib/app-path";

function parseRecipients(value: FormDataEntryValue | null) {
  return String(value ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function assertNonEmptyRecipients(to: string[]) {
  if (!to.length) {
    throw new Error("At least one recipient is required.");
  }
}

function parseComposeAttachments(value: FormDataEntryValue | null): ProviderComposeAttachment[] {
  const raw = String(value ?? "").trim();

  if (!raw) {
    return [];
  }

  const parsed = JSON.parse(raw) as unknown;

  if (!Array.isArray(parsed)) {
    throw new Error("Invalid compose attachments.");
  }

  return parsed.flatMap((item) => {
    if (!item || typeof item !== "object") {
      return [];
    }

    const candidate = item as Partial<ProviderComposeAttachment>;

    if (
      typeof candidate.filename !== "string"
      || typeof candidate.mimeType !== "string"
      || typeof candidate.contentBase64 !== "string"
    ) {
      return [];
    }

    return [{
      filename: candidate.filename,
      mimeType: candidate.mimeType,
      contentBase64: candidate.contentBase64,
      inline: candidate.inline === true,
      contentId: typeof candidate.contentId === "string" ? candidate.contentId : undefined,
    }];
  });
}

async function assertSignedIn() {
  await requireSession();
}

async function requireActiveMailbox() {
  const mailbox = await getPrimaryConnectedMailboxForCurrentUser();

  if (!mailbox) {
    throw new Error("Connect an email account to continue.");
  }

  return mailbox;
}

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

export async function refreshMailboxAction() {
  revalidatePath("/mail");
  revalidatePath("/mail/inbox");
}

export async function setActiveMailboxAction(formData: FormData) {
  await assertSignedIn();
  const mailboxId = String(formData.get("mailboxId") ?? "");
  const nextPath = stripAppMount(String(formData.get("nextPath") ?? "/mail/inbox"));

  if (!mailboxId) {
    throw new Error("A mailbox id is required to switch accounts.");
  }

  await setActiveMailboxForCurrentUser(mailboxId);

  revalidatePath("/mail");
  revalidatePath("/mail/inbox");
  redirect(appPath(nextPath));
}

export async function toggleStarAction(formData: FormData) {
  await assertSignedIn();
  const mailbox = await requireActiveMailbox();
  const messageId = String(formData.get("messageId"));
  const nextStarred = String(formData.get("nextStarred")) === "true";
  const nextPath = stripAppMount(String(formData.get("nextPath") ?? "/mail/inbox"));
  const provider = getProviderAdapter(mailbox.provider);

  await provider.starMessage(mailbox, messageId, nextStarred);

  revalidatePath(nextPath);
}

export async function markMessageReadAction(formData: FormData) {
  await assertSignedIn();
  const mailbox = await requireActiveMailbox();
  const messageId = String(formData.get("messageId"));
  const unread = String(formData.get("unread")) === "true";
  const nextPath = stripAppMount(String(formData.get("nextPath") ?? "/mail/inbox"));
  const redirectTo = String(formData.get("redirectTo") ?? "");
  const provider = getProviderAdapter(mailbox.provider);

  await provider.markRead(mailbox, messageId, unread);

  revalidatePath(nextPath);

  if (redirectTo) {
    redirect(appPath(redirectTo));
  }
}

export async function archiveMessageAction(formData: FormData) {
  await assertSignedIn();
  const mailbox = await requireActiveMailbox();
  const messageId = String(formData.get("messageId"));
  const nextPath = stripAppMount(String(formData.get("nextPath") ?? "/mail/inbox"));
  const redirectTo = String(formData.get("redirectTo") ?? "");
  const provider = getProviderAdapter(mailbox.provider);

  await provider.archiveMessage(mailbox, messageId);
  revalidatePath(nextPath);

  if (redirectTo) {
    redirect(appPath(redirectTo));
  }
}

export async function trashMessageAction(formData: FormData) {
  await assertSignedIn();
  const mailbox = await requireActiveMailbox();
  const messageId = String(formData.get("messageId"));
  const nextPath = stripAppMount(String(formData.get("nextPath") ?? "/mail/inbox"));
  const redirectTo = String(formData.get("redirectTo") ?? "");
  const provider = getProviderAdapter(mailbox.provider);

  await provider.trashMessage(mailbox, messageId);
  revalidatePath(nextPath);

  if (redirectTo) {
    redirect(appPath(redirectTo));
  }
}

export async function bulkMessageAction(formData: FormData) {
  await assertSignedIn();
  const mailbox = await requireActiveMailbox();
  const provider = getProviderAdapter(mailbox.provider);
  const messageIds = String(formData.get("messageIds") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const action = String(formData.get("bulkAction") ?? "");
  const nextPath = stripAppMount(String(formData.get("nextPath") ?? "/mail/inbox"));

  await Promise.all(
    messageIds.map(async (messageId) => {
      if (action === "archive") {
        await provider.archiveMessage(mailbox, messageId);
        return;
      }

      if (action === "trash") {
        await provider.trashMessage(mailbox, messageId);
        return;
      }

      if (action === "read") {
        await provider.markRead(mailbox, messageId, true);
        return;
      }

      if (action === "unread") {
        await provider.markRead(mailbox, messageId, false);
      }
    }),
  );

  revalidatePath(nextPath);
}

export async function sendMessageAction(
  _prevState: { error: string; success: string } | undefined,
  formData: FormData,
) {
  try {
    await assertSignedIn();
    const mailbox = await requireActiveMailbox();
    const provider = getProviderAdapter(mailbox.provider);
    const to = parseRecipients(formData.get("to"));
    const cc = parseRecipients(formData.get("cc"));
    const bcc = parseRecipients(formData.get("bcc"));
    const subject = String(formData.get("subject") ?? "");
    const body = String(formData.get("body") ?? "");
    const bodyHtml = String(formData.get("bodyHtml") ?? "");
    const plainTextMode = String(formData.get("plainTextMode") ?? "") === "true";
    const attachments = parseComposeAttachments(formData.get("attachmentsJson"));

    assertNonEmptyRecipients(to);

    await provider.sendMessage(mailbox, {
      to,
      cc,
      bcc,
      subject,
      body,
      bodyHtml: bodyHtml || undefined,
      plainTextMode,
      attachments,
    });

    const draftId = String(formData.get("draftId") ?? "");

    if (draftId && provider.deleteDraft) {
      await provider.deleteDraft(mailbox, draftId);
    }

    revalidatePath("/mail/inbox");

    return {
      error: "",
      success: "Email sent.",
    };
  } catch (error) {
    return {
      success: "",
      error: getActionErrorMessage(error),
    };
  }
}

export async function saveDraftAction(
  _prevState: { error: string; success: string; draftId: string } | undefined,
  formData: FormData,
) {
  try {
    await assertSignedIn();
    const mailbox = await requireActiveMailbox();
    const provider = getProviderAdapter(mailbox.provider);
    const to = parseRecipients(formData.get("to"));
    const cc = parseRecipients(formData.get("cc"));
    const bcc = parseRecipients(formData.get("bcc"));
    const subject = String(formData.get("subject") ?? "");
    const body = String(formData.get("body") ?? "");
    const bodyHtml = String(formData.get("bodyHtml") ?? "");
    const plainTextMode = String(formData.get("plainTextMode") ?? "") === "true";
    const attachments = parseComposeAttachments(formData.get("attachmentsJson"));
    const draftId = String(formData.get("draftId") ?? "");

    const draft = draftId
      ? provider.updateDraft
        ? await provider.updateDraft(mailbox, {
          draftId,
          to,
          cc,
          bcc,
          subject,
          body,
          bodyHtml: bodyHtml || undefined,
          plainTextMode,
          attachments,
        })
        : null
      : await provider.createDraft(mailbox, {
          to,
          cc,
          bcc,
          subject,
          body,
          bodyHtml: bodyHtml || undefined,
          plainTextMode,
          attachments,
        });

    revalidatePath("/mail/compose");

    return {
      error: "",
      success: "Draft saved.",
      draftId: draft?.id ?? draftId ?? "",
    };
  } catch (error) {
    return {
      success: "",
      draftId: "",
      error: getActionErrorMessage(error),
    };
  }
}

export async function discardDraftAction(formData: FormData) {
  await assertSignedIn();
  const mailbox = await requireActiveMailbox();
  const provider = getProviderAdapter(mailbox.provider);
  const draftId = String(formData.get("draftId") ?? "");

  if (draftId && provider.deleteDraft) {
    await provider.deleteDraft(mailbox, draftId);
  }

  redirect(appPath("/mail/inbox"));
}
