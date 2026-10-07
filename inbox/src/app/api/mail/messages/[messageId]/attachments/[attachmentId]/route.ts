import { NextResponse } from "next/server";
import { decodeBase64UrlToBuffer } from "@/lib/gmail/decode";
import { GmailAuthError } from "@/lib/gmail/client";
import { MicrosoftAccessError } from "@/lib/microsoft/client";
import { getPrimaryConnectedMailboxForCurrentUser } from "@/lib/mail/accounts";
import { getProviderAdapter } from "@/lib/mail/providers";
import { UnsupportedMailboxProviderError } from "@/lib/mail/providers/types";

export async function GET(
  _request: Request,
  context: { params: Promise<{ messageId: string; attachmentId: string }> },
) {
  const { messageId, attachmentId } = await context.params;
  const mailbox = await getPrimaryConnectedMailboxForCurrentUser();

  if (!mailbox) {
    return NextResponse.json({ error: "Mailbox not connected" }, { status: 412 });
  }

  const provider = getProviderAdapter(mailbox.provider);

  if (!provider.getAttachments || !provider.downloadAttachment) {
    return NextResponse.json({ error: "Attachments are not available for this provider" }, { status: 501 });
  }

  try {
    const attachments = await provider.getAttachments(mailbox, messageId);
    const attachment = attachments.find((item) => item.attachmentId === attachmentId);

    if (!attachment) {
      return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
    }

    const encoded = await provider.downloadAttachment(mailbox, messageId, attachmentId);
    const content = encoded.includes("-") || encoded.includes("_")
      ? decodeBase64UrlToBuffer(encoded)
      : Buffer.from(encoded, "base64");

    return new NextResponse(content, {
      headers: {
        "Content-Type": attachment.mimeType,
        "Content-Disposition": `attachment; filename="${attachment.filename}"`,
      },
    });
  } catch (error) {
    if (error instanceof GmailAuthError) {
      const status =
        error.reason === "GMAIL_SCOPE_MISSING"
          ? 403
          : error.reason === "GOOGLE_OAUTH_TOKEN_MISSING"
            ? 412
            : error.reason === "GOOGLE_RECONNECT_REQUIRED"
              ? 401
              : 502;

      return NextResponse.json({ error: error.message, reason: error.reason }, { status });
    }

    if (error instanceof MicrosoftAccessError) {
      const status =
        error.reason === "MICROSOFT_SCOPE_MISSING"
          ? 403
          : error.reason === "MICROSOFT_ADMIN_CONSENT_REQUIRED"
            ? 403
            : 401;

      return NextResponse.json({ error: error.message, reason: error.reason }, { status });
    }

    if (error instanceof UnsupportedMailboxProviderError) {
      return NextResponse.json({ error: "Attachments are not available for this mailbox." }, { status: 501 });
    }

    throw error;
  }
}
