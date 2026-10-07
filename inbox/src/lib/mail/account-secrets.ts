import "server-only";

import { db } from "@/lib/db";
import { GmailAccessError } from "@/lib/gmail/client";
import { MicrosoftAccessError } from "@/lib/microsoft/client";

export async function getMailboxRecordById(accountId: string) {
  return db.userMailboxAccount.findUnique({
    where: { id: accountId },
    select: {
      id: true,
      ownerId: true,
      provider: true,
      emailAddress: true,
      status: true,
      accessTokenEncrypted: true,
      refreshTokenEncrypted: true,
      tokenExpiresAt: true,
    },
  });
}

export async function getGmailAccessTokenForMailbox(_accountId?: string) {
  throw new GmailAccessError("TRON_MAIL_TRANSPORT_NOT_CONFIGURED", "TRON Mail does not use Google mailbox tokens.");
}

export async function getMicrosoftAccessTokenForMailbox(_accountId?: string) {
  throw new MicrosoftAccessError("TRON_MAIL_TRANSPORT_NOT_CONFIGURED", "TRON Mail does not use Microsoft mailbox tokens.");
}
