-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "MailboxProvider" AS ENUM ('GMAIL', 'MICROSOFT', 'IMAP_SMTP');

-- CreateEnum
CREATE TYPE "MailboxAccountStatus" AS ENUM ('CONNECTED', 'SYNCING', 'NEEDS_REAUTH', 'ERROR', 'DISABLED');

-- CreateTable
CREATE TABLE "UserMailboxAccount" (
    "id" TEXT NOT NULL,
    "clerkUserId" TEXT NOT NULL,
    "provider" "MailboxProvider" NOT NULL,
    "emailAddress" TEXT NOT NULL,
    "displayName" TEXT,
    "providerAccountId" TEXT,
    "accessTokenEncrypted" TEXT,
    "refreshTokenEncrypted" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "scopesJson" TEXT,
    "imapHost" TEXT,
    "imapPort" INTEGER,
    "imapSecurity" TEXT,
    "smtpHost" TEXT,
    "smtpPort" INTEGER,
    "smtpSecurity" TEXT,
    "usernameEncrypted" TEXT,
    "passwordEncrypted" TEXT,
    "status" "MailboxAccountStatus" NOT NULL DEFAULT 'CONNECTED',
    "lastSyncAt" TIMESTAMP(3),
    "syncCursor" TEXT,
    "syncError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserMailboxAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MailboxMessage" (
    "id" TEXT NOT NULL,
    "clerkUserId" TEXT NOT NULL,
    "mailboxAccountId" TEXT NOT NULL,
    "provider" "MailboxProvider" NOT NULL,
    "sourceEmail" TEXT NOT NULL,
    "providerMessageId" TEXT NOT NULL,
    "providerThreadId" TEXT,
    "providerConversationId" TEXT,
    "subject" TEXT NOT NULL,
    "fromName" TEXT,
    "fromEmail" TEXT NOT NULL,
    "toJson" TEXT NOT NULL,
    "ccJson" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "snippet" TEXT,
    "plainTextBody" TEXT,
    "sanitizedHtmlBody" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "isStarred" BOOLEAN NOT NULL DEFAULT false,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "isTrashed" BOOLEAN NOT NULL DEFAULT false,
    "hasAttachments" BOOLEAN NOT NULL DEFAULT false,
    "sortCategory" TEXT,
    "sortScore" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MailboxMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserMailboxAccount_clerkUserId_provider_status_idx" ON "UserMailboxAccount"("clerkUserId", "provider", "status");

-- CreateIndex
CREATE UNIQUE INDEX "UserMailboxAccount_clerkUserId_provider_emailAddress_key" ON "UserMailboxAccount"("clerkUserId", "provider", "emailAddress");

-- CreateIndex
CREATE INDEX "MailboxMessage_clerkUserId_date_idx" ON "MailboxMessage"("clerkUserId", "date");

-- CreateIndex
CREATE INDEX "MailboxMessage_clerkUserId_provider_sourceEmail_idx" ON "MailboxMessage"("clerkUserId", "provider", "sourceEmail");

-- CreateIndex
CREATE UNIQUE INDEX "MailboxMessage_mailboxAccountId_providerMessageId_key" ON "MailboxMessage"("mailboxAccountId", "providerMessageId");

-- AddForeignKey
ALTER TABLE "MailboxMessage" ADD CONSTRAINT "MailboxMessage_mailboxAccountId_fkey" FOREIGN KEY ("mailboxAccountId") REFERENCES "UserMailboxAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
