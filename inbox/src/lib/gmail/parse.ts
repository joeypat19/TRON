import type { MailMessage } from "@/lib/mail/types";

export function plainTextToHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br />");
}

export function parseGmailMessage() {
  throw new Error("External Gmail message parsing is not part of TRON Mail.");
}

export type ParsedMailMessage = MailMessage;
