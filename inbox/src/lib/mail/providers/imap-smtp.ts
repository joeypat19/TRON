import { MailboxProvider } from "@prisma/client";
import type { MailProviderAdapter } from "@/lib/mail/providers/types";
import { UnsupportedMailboxProviderError } from "@/lib/mail/providers/types";

function unsupported(): never {
  throw new UnsupportedMailboxProviderError(MailboxProvider.IMAP_SMTP);
}

export const imapSmtpProviderAdapter: MailProviderAdapter = {
  provider: MailboxProvider.IMAP_SMTP,
  implemented: false,
  async listMessages(): Promise<never> {
    return unsupported();
  },
  async getMessage(): Promise<never> {
    return unsupported();
  },
  async sendMessage(): Promise<never> {
    return unsupported();
  },
  async createDraft(): Promise<never> {
    return unsupported();
  },
  async archiveMessage(): Promise<never> {
    return unsupported();
  },
  async trashMessage(): Promise<never> {
    return unsupported();
  },
  async markRead(): Promise<never> {
    return unsupported();
  },
  async starMessage(): Promise<never> {
    return unsupported();
  },
  async listFolders(): Promise<never> {
    return unsupported();
  },
  async syncMessages(): Promise<never> {
    return unsupported();
  },
};
