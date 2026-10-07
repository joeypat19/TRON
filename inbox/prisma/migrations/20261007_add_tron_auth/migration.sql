CREATE TYPE "AuthUserStatus" AS ENUM ('ACTIVE', 'DISABLED');

CREATE TYPE "AuthTokenType" AS ENUM ('EMAIL_VERIFICATION', 'PASSWORD_RESET', 'LOGIN_CODE_RESET');

CREATE TABLE "TronUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT,
    "passwordHash" TEXT NOT NULL,
    "loginCodeHash" TEXT NOT NULL,
    "loginCodeLength" INTEGER NOT NULL,
    "emailVerifiedAt" TIMESTAMP(3),
    "status" "AuthUserStatus" NOT NULL DEFAULT 'ACTIVE',
    "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TronUser_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuthSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuthLoginChallenge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthLoginChallenge_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuthRecoveryToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "type" "AuthTokenType" NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthRecoveryToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TronUser_email_key" ON "TronUser"("email");
CREATE INDEX "TronUser_status_idx" ON "TronUser"("status");
CREATE UNIQUE INDEX "AuthSession_tokenHash_key" ON "AuthSession"("tokenHash");
CREATE INDEX "AuthSession_userId_expiresAt_idx" ON "AuthSession"("userId", "expiresAt");
CREATE UNIQUE INDEX "AuthLoginChallenge_tokenHash_key" ON "AuthLoginChallenge"("tokenHash");
CREATE INDEX "AuthLoginChallenge_userId_expiresAt_idx" ON "AuthLoginChallenge"("userId", "expiresAt");
CREATE UNIQUE INDEX "AuthRecoveryToken_tokenHash_key" ON "AuthRecoveryToken"("tokenHash");
CREATE INDEX "AuthRecoveryToken_userId_type_expiresAt_idx" ON "AuthRecoveryToken"("userId", "type", "expiresAt");

ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "TronUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuthLoginChallenge" ADD CONSTRAINT "AuthLoginChallenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "TronUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuthRecoveryToken" ADD CONSTRAINT "AuthRecoveryToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "TronUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
