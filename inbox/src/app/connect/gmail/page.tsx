import { redirect } from "next/navigation";
import { ensureGmailMailboxAccountConnection } from "@/lib/mail/accounts";
import { runtimeDebugLog } from "@/lib/debug/runtime-debug";
import { appPath } from "@/lib/app-path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function toPublicConnectError(reason: string) {
  switch (reason) {
    case "DATABASE_URL_PRIVATE_HOST_ON_VERCEL":
      return "production_database_misconfigured";
    case "GMAIL_SCOPE_MISSING":
    case "GMAIL_SCOPES_MISSING":
      return "GMAIL_SCOPES_MISSING";
    case "GMAIL_PROFILE_FETCH_FAILED":
    case "GMAIL_PROFILE_FAILED":
      return "GMAIL_PROFILE_FAILED";
    case "MAILBOX_ACCOUNT_CREATE_FAILED":
    case "MAILBOX_ACCOUNT_UPDATE_FAILED":
    case "MAILBOX_UPSERT_FAILED":
      return "MAILBOX_UPSERT_FAILED";
    default:
      return reason;
  }
}

export default async function ConnectGmailPage() {
  runtimeDebugLog("gmail-connect-finalizer-start", {
    route: "/connect/gmail",
    step: "gmail-connect-finalizer",
    ok: true,
  });

  const result = await ensureGmailMailboxAccountConnection();

  if (result.status === "connected") {
    runtimeDebugLog("gmail-connect-finalizer-result", {
      route: "/connect/gmail",
      step: "gmail-connect-finalizer",
      ok: true,
      accountEmail: result.accountEmail,
    });
    redirect(appPath("/mail/inbox"));
  }

  runtimeDebugLog("gmail-connect-finalizer-result", {
    route: "/connect/gmail",
    step: "gmail-connect-finalizer",
    ok: false,
    stage: "gmail_connect_finalizer",
    mappedReason: result.reason,
    internalErrorCode: "internalErrorCode" in result ? (result.internalErrorCode ?? null) : null,
    internalErrorName: "internalErrorName" in result ? (result.internalErrorName ?? null) : null,
    internalErrorMessage: "internalErrorMessage" in result ? (result.internalErrorMessage ?? null) : null,
    providerErrorCode: "providerErrorCode" in result ? (result.providerErrorCode ?? null) : null,
    providerLongMessage: "providerLongMessage" in result ? (result.providerLongMessage ?? null) : null,
    prismaErrorCode: "prismaErrorCode" in result ? (result.prismaErrorCode ?? null) : null,
    googleHttpStatus: "googleHttpStatus" in result ? (result.googleHttpStatus ?? null) : null,
    missingEnvVars: "missingEnvVars" in result ? (result.missingEnvVars ?? []) : [],
    hasMailboxEncryptionKey: "hasMailboxEncryptionKey" in result ? (result.hasMailboxEncryptionKey ?? null) : null,
    encryptionKeyLength: "encryptionKeyLength" in result ? (result.encryptionKeyLength ?? null) : null,
  });
  redirect(appPath(`/mail/inbox?connectError=${encodeURIComponent(toPublicConnectError(result.reason ?? "UNKNOWN_MAILBOX_SETUP_FAILURE"))}`));
}
