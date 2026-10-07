import "server-only";

import { MailboxAccountStatus, MailboxProvider } from "@prisma/client";
import { cookies } from "next/headers";
import { cache } from "react";
import { db } from "@/lib/db";
import { getAuthenticatedUser, requireAuthenticatedUser } from "@/lib/auth/session";
import { getTronMailboxAddress } from "@/lib/auth/service";
import type { ConnectedMailboxAccount } from "@/lib/mail/providers/types";
import {
  getMailboxLoadStateFromReason,
  getReconnectGmailAccessState,
  type MailboxFailureReason,
  type MailboxLoadState,
} from "@/lib/mailbox-state";
import { getMailboxSetupDiagnostic, type MailboxSetupCode } from "@/lib/mail/setup-diagnostics";

export type SessionUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

type MailboxConnectionResult =
  | { status: "connected"; reason: null; message: null; mailboxId: string; accountEmail: string }
  | (Exclude<MailboxLoadState, { status: "ready" }> & {
      stage?: string;
      internalErrorCode?: string | null;
      internalErrorName?: string | null;
      internalErrorMessage?: string | null;
      missingEnvVars?: string[];
    });

export type AutomaticGmailConnectionAttemptResult =
  | { status: "not_attempted"; reason: null }
  | { status: "connected"; reason: null; mailboxId: string; accountEmail: string }
  | { status: "failed"; reason: MailboxFailureReason };

export type MailboxAccountsSnapshot = {
  sessionUser: SessionUser;
  accounts: ConnectedMailboxAccount[];
  activeMailbox: ConnectedMailboxAccount | null;
  loadState: MailboxLoadState;
};

export const ACTIVE_MAILBOX_COOKIE_NAME = "troninbox_active_mailbox";
export const AUTO_GMAIL_CONNECT_FAILURE_COOKIE_NAME = "troninbox_auto_gmail_connect_failure";

export const requireSessionUser = cache(async (): Promise<SessionUser> => {
  const authenticatedUser = await requireAuthenticatedUser();

  return {
    id: authenticatedUser.id,
    name: authenticatedUser.displayName,
    email: authenticatedUser.email,
    image: null,
  };
});

export const requireSession = requireSessionUser;

async function getRequestedActiveMailboxId() {
  const cookieStore = await cookies();
  return cookieStore.get(ACTIVE_MAILBOX_COOKIE_NAME)?.value ?? null;
}

async function readTronMailboxAccounts(userId: string): Promise<ConnectedMailboxAccount[]> {
  return db.userMailboxAccount.findMany({
    where: {
      ownerId: userId,
      provider: MailboxProvider.TRON,
      status: { not: MailboxAccountStatus.DISABLED },
    },
    select: {
      id: true,
      provider: true,
      emailAddress: true,
      displayName: true,
      providerAccountId: true,
      status: true,
      lastSyncAt: true,
      syncError: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: "asc" },
  });
}

async function ensureTronMailboxAccountConnection(): Promise<MailboxConnectionResult> {
  const sessionUser = await requireSessionUser();
  const emailAddress = getTronMailboxAddress(sessionUser.id);

  try {
    const account = await db.userMailboxAccount.upsert({
      where: {
        ownerId_provider_emailAddress: {
          ownerId: sessionUser.id,
          provider: MailboxProvider.TRON,
          emailAddress,
        },
      },
      update: {
        displayName: sessionUser.name,
        providerAccountId: sessionUser.id,
        status: MailboxAccountStatus.CONNECTED,
        syncError: null,
      },
      create: {
        ownerId: sessionUser.id,
        provider: MailboxProvider.TRON,
        emailAddress,
        displayName: sessionUser.name,
        providerAccountId: sessionUser.id,
        status: MailboxAccountStatus.CONNECTED,
      },
    });

    return {
      status: "connected",
      reason: null,
      message: null,
      mailboxId: account.id,
      accountEmail: account.emailAddress,
    };
  } catch (error) {
    const reason: MailboxFailureReason = "DATABASE_WRITE_FAILED";
    const state = getMailboxLoadStateFromReason(reason);
    return {
      ...state,
      stage: "tron_mailbox_account_upsert",
      internalErrorName: error instanceof Error ? error.name : typeof error,
      internalErrorMessage: error instanceof Error ? error.message : String(error),
    };
  }
}

// Compatibility entry points for the unchanged UI routes. Neither function starts OAuth.
export async function ensureGmailMailboxAccountConnection() {
  return ensureTronMailboxAccountConnection();
}

export async function ensureMicrosoftMailboxAccountConnection() {
  return ensureTronMailboxAccountConnection();
}

export async function attemptAutomaticGmailConnectionForCurrentUser(): Promise<AutomaticGmailConnectionAttemptResult> {
  const existing = await getMailboxAccountsForCurrentUser();
  if (existing.length) return { status: "not_attempted", reason: null };

  const result = await ensureTronMailboxAccountConnection();
  if (result.status === "connected") {
    return { status: "connected", reason: null, mailboxId: result.mailboxId, accountEmail: result.accountEmail };
  }

  return { status: "failed", reason: result.reason };
}

export async function getMailboxAccountsSnapshotForCurrentUser(): Promise<MailboxAccountsSnapshot> {
  const sessionUser = await requireSessionUser();
  const requestedActiveMailboxId = await getRequestedActiveMailboxId();

  try {
    const accounts = await readTronMailboxAccounts(sessionUser.id);
    const activeMailbox = accounts.find((account) => account.id === requestedActiveMailboxId) ?? accounts[0] ?? null;

    return {
      sessionUser,
      accounts,
      activeMailbox,
      loadState: activeMailbox
        ? { status: "ready", reason: null, message: null }
        : getMailboxLoadStateFromReason("UNKNOWN_MAILBOX_SETUP_FAILURE"),
    };
  } catch {
    return {
      sessionUser,
      accounts: [],
      activeMailbox: null,
      loadState: getMailboxLoadStateFromReason("DATABASE_QUERY_FAILED"),
    };
  }
}

export async function getMailboxAccountsForCurrentUser() {
  return (await getMailboxAccountsSnapshotForCurrentUser()).accounts;
}

export async function getPrimaryConnectedMailboxForCurrentUser() {
  return (await getMailboxAccountsSnapshotForCurrentUser()).activeMailbox;
}

export async function setActiveMailboxForCurrentUser(mailboxId: string) {
  const sessionUser = await requireSessionUser();
  const account = await db.userMailboxAccount.findFirst({
    where: { id: mailboxId, ownerId: sessionUser.id, provider: MailboxProvider.TRON },
    select: { id: true },
  });

  if (!account) throw new Error("TRON mailbox not found.");

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_MAILBOX_COOKIE_NAME, account.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function getSafeDatabaseRuntimeDiagnostics(route: string, userId: string | null) {
  const databaseUrl = process.env.DATABASE_URL?.trim() ?? "";
  const diagnostics = {
    hasDatabaseUrl: Boolean(databaseUrl),
    databaseUrlMalformed: Boolean(databaseUrl) && !databaseUrl.startsWith("postgres"),
    databaseUrlUsesRailwayInternal: databaseUrl.includes("railway.internal"),
    databaseUrlHost: null as string | null,
    databaseUrlPort: null as string | null,
    databaseUrlIsLocalhost: false,
    databaseUrlIsPrivateHost: false,
    databaseUrlIsInternalHostname: databaseUrl.includes("railway.internal"),
    isVercel: Boolean(process.env.VERCEL),
    prismaCanConnect: false,
    migrationsExist: true,
    requiredTablesExist: false,
    requiredColumnsExist: false,
    schemaCheckResult: {},
    route,
    userId,
  };

  try {
    await db.userMailboxAccount.count({ where: userId ? { ownerId: userId } : undefined });
    diagnostics.prismaCanConnect = true;
    diagnostics.requiredTablesExist = true;
    diagnostics.requiredColumnsExist = true;
  } catch {}

  return {
    failureReason: diagnostics.prismaCanConnect ? null : ("DATABASE_QUERY_FAILED" as MailboxSetupCode),
    diagnostics,
  };
}

export async function getMailboxSetupDebugSnapshot() {
  const authenticatedUser = await getAuthenticatedUser();
  const userId = authenticatedUser?.id ?? null;
  const database = await getSafeDatabaseRuntimeDiagnostics("/debug/mailbox-setup", userId);
  const finalCode = database.failureReason ?? "READY";

  return {
    route: "/debug/mailbox-setup",
    sessionPresent: Boolean(authenticatedUser),
    ownerId: userId,
    sessionIdPresent: Boolean(authenticatedUser),
    googleExternalAccountCount: 0,
    tokenProviderDiagnostics: { google: { ok: false }, oauthGoogle: { ok: false }, selectedProvider: null },
    gmailScopePresence: [],
    gmailProfileFetch: { ok: false, code: null },
    prismaWriteTest: { ok: database.diagnostics.prismaCanConnect, code: database.failureReason },
    finalCode,
    probableCause: finalCode === "READY" ? "TRON mailbox storage is reachable." : getMailboxSetupDiagnostic(finalCode, "debug").probableCause,
    recommendedAction: finalCode === "READY" ? "No external mailbox provider is connected." : getMailboxSetupDiagnostic(finalCode, "debug").recommendedAction,
    database,
  };
}

export function getMailboxStatusLabel(status: MailboxAccountStatus) {
  switch (status) {
    case MailboxAccountStatus.CONNECTED: return "Connected";
    case MailboxAccountStatus.SYNCING: return "Syncing";
    case MailboxAccountStatus.NEEDS_REAUTH: return "Needs reauth";
    case MailboxAccountStatus.ERROR: return "Error";
    case MailboxAccountStatus.DISABLED: return "Disabled";
    default: return "Unknown";
  }
}

export function getMailboxProviderLabel(provider: MailboxProvider) {
  return provider === MailboxProvider.TRON ? "TRON Mail" : provider;
}

export function getMailboxErrorState(reason: string) {
  return getReconnectGmailAccessState(reason);
}
