import "server-only";

import { AuthTokenType, MailboxAccountStatus, MailboxProvider } from "@prisma/client";
import { db } from "@/lib/db";
import { AuthValidationError } from "@/lib/auth/errors";
import {
  createOpaqueToken,
  hashOpaqueToken,
  hashSecret,
  isValidEmail,
  isValidLoginCode,
  isValidPassword,
  normalizeEmail,
  verifySecret,
} from "@/lib/auth/crypto";
import { createSession, clearLoginChallenge } from "@/lib/auth/session";

const TRON_MAIL_DOMAIN = "tronxvi.com";
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_MS = 1000 * 60 * 15;
const RECOVERY_TOKEN_TTL_MS = 1000 * 60 * 30;

export function getTronMailboxAddress(userId: string) {
  const suffix = userId.replace(/[^a-z0-9]/gi, "").toLowerCase().slice(-18) || "account";
  return `user-${suffix}@${TRON_MAIL_DOMAIN}`;
}

export async function createTronAccount(input: {
  email: string;
  password: string;
  passwordConfirmation: string;
  loginCode: string;
  loginCodeConfirmation: string;
}) {
  const email = normalizeEmail(input.email);

  if (!isValidEmail(email)) throw new AuthValidationError("Enter a valid email address.");
  if (!isValidPassword(input.password)) throw new AuthValidationError("Password must be 8 to 128 characters.");
  if (input.password !== input.passwordConfirmation) throw new AuthValidationError("Passwords do not match.");
  if (!isValidLoginCode(input.loginCode)) throw new AuthValidationError("Choose a 4, 6, 8, or 10 digit login code.");
  if (input.loginCode !== input.loginCodeConfirmation) throw new AuthValidationError("Login codes do not match.");

  const passwordHash = await hashSecret(input.password);
  const loginCodeHash = await hashSecret(input.loginCode);
  const displayName = email.split("@")[0] || "TRON user";

  const user = await db.$transaction(async (transaction) => {
    const existing = await transaction.tronUser.findUnique({ where: { email } });

    if (existing) {
      throw new AuthValidationError("An account already exists for that email.");
    }

    const created = await transaction.tronUser.create({
      data: {
        email,
        displayName,
        passwordHash,
        loginCodeHash,
        loginCodeLength: input.loginCode.length,
      },
    });

    await transaction.userMailboxAccount.create({
      data: {
        ownerId: created.id,
        provider: MailboxProvider.TRON,
        emailAddress: getTronMailboxAddress(created.id),
        displayName,
        providerAccountId: created.id,
        status: MailboxAccountStatus.CONNECTED,
      },
    });

    return created;
  });

  await createSession(user.id);
  return { id: user.id, email: user.email, mailboxAddress: getTronMailboxAddress(user.id) };
}

export async function beginPasswordLogin(emailInput: string, password: string) {
  const email = normalizeEmail(emailInput);
  const user = await db.tronUser.findUnique({ where: { email } });

  if (!user || user.status !== "ACTIVE") {
    throw new AuthValidationError("Email or password is incorrect.");
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw new AuthValidationError("This account is temporarily locked. Try again later.");
  }

  const passwordMatches = await verifySecret(password, user.passwordHash);

  if (!passwordMatches) {
    const failedAttempts = user.failedLoginAttempts + 1;
    await db.tronUser.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: failedAttempts >= MAX_LOGIN_ATTEMPTS ? 0 : failedAttempts,
        lockedUntil: failedAttempts >= MAX_LOGIN_ATTEMPTS ? new Date(Date.now() + LOCKOUT_MS) : null,
      },
    });
    throw new AuthValidationError("Email or password is incorrect.");
  }

  await db.tronUser.update({
    where: { id: user.id },
    data: { failedLoginAttempts: 0, lockedUntil: null },
  });

  return { id: user.id, email: user.email, loginCodeLength: user.loginCodeLength };
}

export async function completeCodeLogin(rawChallengeToken: string, loginCode: string) {
  const challenge = await db.authLoginChallenge.findUnique({
    where: { tokenHash: hashOpaqueToken(rawChallengeToken) },
    include: { user: true },
  });

  if (!challenge || challenge.expiresAt <= new Date() || challenge.user.status !== "ACTIVE") {
    await clearLoginChallenge();
    throw new AuthValidationError("Your login challenge expired. Start again.");
  }

  if (challenge.attempts >= MAX_LOGIN_ATTEMPTS) {
    await db.authLoginChallenge.delete({ where: { id: challenge.id } });
    await clearLoginChallenge();
    throw new AuthValidationError("Too many incorrect code attempts. Start again.");
  }

  const matches = isValidLoginCode(loginCode, challenge.user.loginCodeLength)
    && await verifySecret(loginCode, challenge.user.loginCodeHash);

  if (!matches) {
    await db.authLoginChallenge.update({
      where: { id: challenge.id },
      data: { attempts: { increment: 1 } },
    });
    throw new AuthValidationError("That login code is incorrect.");
  }

  await db.authLoginChallenge.delete({ where: { id: challenge.id } });
  await clearLoginChallenge();
  await createSession(challenge.user.id);

  return { id: challenge.user.id, email: challenge.user.email };
}

export async function createRecoveryToken(userId: string, type: AuthTokenType) {
  const rawToken = createOpaqueToken();

  await db.authRecoveryToken.deleteMany({ where: { userId, type, usedAt: null } });
  await db.authRecoveryToken.create({
    data: {
      userId,
      type,
      tokenHash: hashOpaqueToken(rawToken),
      expiresAt: new Date(Date.now() + RECOVERY_TOKEN_TTL_MS),
    },
  });

  return rawToken;
}

export async function getAuthUserByEmail(emailInput: string) {
  return db.tronUser.findUnique({ where: { email: normalizeEmail(emailInput) } });
}

export async function completeRecoveryToken(input: {
  token: string;
  type: AuthTokenType;
  password?: string;
  passwordConfirmation?: string;
  loginCode?: string;
  loginCodeConfirmation?: string;
}) {
  const recoveryToken = await db.authRecoveryToken.findUnique({
    where: { tokenHash: hashOpaqueToken(input.token) },
    include: { user: true },
  });

  if (!recoveryToken || recoveryToken.type !== input.type || recoveryToken.usedAt || recoveryToken.expiresAt <= new Date()) {
    throw new AuthValidationError("That recovery link is invalid or expired.");
  }

  if (input.type === AuthTokenType.PASSWORD_RESET) {
    if (!input.password || !isValidPassword(input.password)) {
      throw new AuthValidationError("Password must be 8 to 128 characters.");
    }
    if (input.password !== input.passwordConfirmation) {
      throw new AuthValidationError("Passwords do not match.");
    }

    await db.$transaction(async (transaction) => {
      await transaction.tronUser.update({
        where: { id: recoveryToken.userId },
        data: { passwordHash: await hashSecret(input.password as string), failedLoginAttempts: 0, lockedUntil: null },
      });
      await transaction.authRecoveryToken.update({ where: { id: recoveryToken.id }, data: { usedAt: new Date() } });
      await transaction.authSession.deleteMany({ where: { userId: recoveryToken.userId } });
      await transaction.authLoginChallenge.deleteMany({ where: { userId: recoveryToken.userId } });
    });
  } else if (input.type === AuthTokenType.LOGIN_CODE_RESET) {
    const loginCode = input.loginCode ?? "";
    if (!isValidLoginCode(loginCode) || loginCode !== input.loginCodeConfirmation) {
      throw new AuthValidationError("Choose a matching 4, 6, 8, or 10 digit login code.");
    }

    await db.$transaction(async (transaction) => {
      await transaction.tronUser.update({
        where: { id: recoveryToken.userId },
        data: { loginCodeHash: await hashSecret(loginCode), loginCodeLength: loginCode.length },
      });
      await transaction.authRecoveryToken.update({ where: { id: recoveryToken.id }, data: { usedAt: new Date() } });
      await transaction.authSession.deleteMany({ where: { userId: recoveryToken.userId } });
      await transaction.authLoginChallenge.deleteMany({ where: { userId: recoveryToken.userId } });
    });
  } else {
    await db.tronUser.update({
      where: { id: recoveryToken.userId },
      data: { emailVerifiedAt: new Date() },
    });
    await db.authRecoveryToken.update({ where: { id: recoveryToken.id }, data: { usedAt: new Date() } });
  }
}
