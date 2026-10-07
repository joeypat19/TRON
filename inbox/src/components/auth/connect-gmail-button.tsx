"use client";

import { useState } from "react";
import { BrandButton } from "@/components/ui/brand-button";
import { appPath } from "@/lib/app-path";

type ConnectGmailButtonProps = {
  label?: string;
  buttonClassName?: string;
  showNote?: boolean;
};

type GmailConnectStartResponse =
  | { status: "connected" }
  | { status: "oauth_required"; reason: string }
  | { status: "failed"; reason: string };

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

function sanitizeClientError(error: unknown) {
  if (!error || typeof error !== "object") {
    return { message: typeof error === "string" ? error : String(error) };
  }

  const candidate = error as {
    code?: string;
    message?: string;
    errors?: Array<{ code?: string; message?: string; longMessage?: string }>;
  };

  return {
    code: candidate.code ?? candidate.errors?.[0]?.code,
    message: candidate.errors?.[0]?.longMessage ?? candidate.errors?.[0]?.message ?? candidate.message,
  };
}

export function ConnectGmailButton({
  label = "Connect Gmail",
  buttonClassName,
  showNote = false,
}: ConnectGmailButtonProps) {
  const [isWorking, setIsWorking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const pending = isWorking;

  async function handleClick() {
    setErrorMessage(null);

    try {
      setIsWorking(true);

      const response = await fetch(appPath("/api/mail/connect/gmail/start"), {
        method: "POST",
      });
      const result = (await response.json()) as GmailConnectStartResponse;

      if (result.status === "connected") {
        window.location.assign(appPath("/mail/inbox"));
        return;
      }

      if (result.status === "oauth_required") {
        setErrorMessage("TRON Mail is local-only; Google mailbox connections are disabled.");
        setIsWorking(false);
        return;
      }

      window.location.assign(appPath(`/mail/inbox?connectError=${encodeURIComponent(toPublicConnectError(result.reason))}`));
    } catch (error) {
      const sanitizedError = sanitizeClientError(error);

      setIsWorking(false);
      setErrorMessage(sanitizedError.message ?? "Gmail connection could not start. Please try again.");
    }
  }

  return (
    <div className="w-full">
      <BrandButton
        className={buttonClassName ?? "min-h-11 w-full"}
        disabled={pending}
        onClick={() => {
          void handleClick();
        }}
        type="button"
      >
        {pending ? "Redirecting to Google..." : label}
      </BrandButton>
      {errorMessage ? (
        <p className="mt-3 text-center text-sm leading-6 text-[var(--accent-strong)]" role="alert">
          {errorMessage}
        </p>
      ) : null}
      {showNote ? <p className="mt-4 text-center text-xs leading-5 text-[var(--text-muted)]">Google is required to connect Gmail.</p> : null}
    </div>
  );
}
