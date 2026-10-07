import type { ProviderComposeAttachment } from "@/lib/mail/providers/types";

type ComposeFields = {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  bodyHtml?: string;
  isHtml?: boolean;
  attachments?: ProviderComposeAttachment[];
};

function normalizeHeaderValue(value: string) {
  return value.replace(/\r?\n/g, " ").trim();
}

function encodeBase64Url(value: string) {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function encodeTransferBase64(value: Buffer | string) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/.{1,76}/g, "$&\r\n")
    .trim();
}

function createBoundary(label: string) {
  return `troninbox-${label}-${Math.random().toString(36).slice(2, 12)}`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br />");
}

function normalizeHtmlBody(body: string, bodyHtml?: string, isHtml = false) {
  if (bodyHtml?.trim()) {
    return bodyHtml.trim();
  }

  if (isHtml) {
    return body.trim();
  }

  return escapeHtml(body);
}

function buildTextPart(body: string) {
  return [
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 7bit",
    "",
    body,
  ].join("\r\n");
}

function buildHtmlPart(html: string) {
  return [
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: 7bit",
    "",
    html,
  ].join("\r\n");
}

function buildMultipartAlternative(body: string, html: string, boundary: string) {
  return [
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    buildTextPart(body),
    `--${boundary}`,
    buildHtmlPart(html),
    `--${boundary}--`,
  ].join("\r\n");
}

function buildInlinePart(attachment: ProviderComposeAttachment) {
  const headers = [
    `Content-Type: ${attachment.mimeType}; name="${normalizeHeaderValue(attachment.filename)}"`,
    "Content-Transfer-Encoding: base64",
    `Content-Disposition: inline; filename="${normalizeHeaderValue(attachment.filename)}"`,
  ];

  if (attachment.contentId) {
    headers.push(`Content-ID: <${normalizeHeaderValue(attachment.contentId)}>`);
  }

  return [
    ...headers,
    "",
    encodeTransferBase64(Buffer.from(attachment.contentBase64, "base64")),
  ].join("\r\n");
}

function buildAttachmentPart(attachment: ProviderComposeAttachment) {
  return [
    `Content-Type: ${attachment.mimeType}; name="${normalizeHeaderValue(attachment.filename)}"`,
    "Content-Transfer-Encoding: base64",
    `Content-Disposition: attachment; filename="${normalizeHeaderValue(attachment.filename)}"`,
    "",
    encodeTransferBase64(Buffer.from(attachment.contentBase64, "base64")),
  ].join("\r\n");
}

export function buildRawMimeMessage({
  to,
  cc = [],
  bcc = [],
  subject,
  body,
  bodyHtml,
  isHtml = false,
  attachments = [],
}: ComposeFields) {
  const normalizedSubject = normalizeHeaderValue(subject);
  const inlineAttachments = attachments.filter((attachment) => attachment.inline);
  const fileAttachments = attachments.filter((attachment) => !attachment.inline);
  const shouldUseHtml = Boolean(bodyHtml?.trim() || isHtml || inlineAttachments.length);
  const html = shouldUseHtml ? normalizeHtmlBody(body, bodyHtml, isHtml) : undefined;

  const headers = [
    `To: ${to.join(", ")}`,
    cc.length ? `Cc: ${cc.join(", ")}` : "",
    bcc.length ? `Bcc: ${bcc.join(", ")}` : "",
    `Subject: ${normalizedSubject}`,
    "MIME-Version: 1.0",
  ].filter(Boolean);

  let bodySection = "";

  if (!attachments.length && !shouldUseHtml) {
    bodySection = [
      'Content-Type: text/plain; charset="UTF-8"',
      "Content-Transfer-Encoding: 7bit",
      "",
      body,
    ].join("\r\n");
  } else if (!attachments.length && html) {
    const alternativeBoundary = createBoundary("alternative");
    bodySection = buildMultipartAlternative(body, html, alternativeBoundary);
  } else {
    const mixedBoundary = createBoundary("mixed");
    const parts: string[] = [];

    if (html && inlineAttachments.length) {
      const relatedBoundary = createBoundary("related");
      const alternativeBoundary = createBoundary("alternative");

      parts.push([
        `Content-Type: multipart/related; boundary="${relatedBoundary}"`,
        "",
        `--${relatedBoundary}`,
        buildMultipartAlternative(body, html, alternativeBoundary),
        ...inlineAttachments.flatMap((attachment) => [`--${relatedBoundary}`, buildInlinePart(attachment)]),
        `--${relatedBoundary}--`,
      ].join("\r\n"));
    } else if (html) {
      const alternativeBoundary = createBoundary("alternative");
      parts.push(buildMultipartAlternative(body, html, alternativeBoundary));
    } else {
      parts.push(buildTextPart(body));
    }

    for (const attachment of fileAttachments) {
      parts.push(buildAttachmentPart(attachment));
    }

    bodySection = [
      `Content-Type: multipart/mixed; boundary="${mixedBoundary}"`,
      "",
      ...parts.flatMap((part) => [`--${mixedBoundary}`, part]),
      `--${mixedBoundary}--`,
    ].join("\r\n");
  }

  return encodeBase64Url(`${headers.join("\r\n")}\r\n${bodySection}\r\n`);
}
