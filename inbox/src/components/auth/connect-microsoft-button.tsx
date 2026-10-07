"use client";

import { useState } from "react";
import { BrandButton } from "@/components/ui/brand-button";
import { appPath } from "@/lib/app-path";
import { getMailboxSetupDiagnostic } from "@/lib/mail/setup-diagnostics";

type ConnectMicrosoftButtonProps = {
  label?: string;
  buttonClassName?: string;
};

type MicrosoftConnectStartResponse =
  | { status: "connected" }
  | { status: "oauth_required"; reason: string }
  | { status: "failed"; reason: string };

const REVERIFICATION_CANCELLED_MESSAGE = "Outlook verification was cancelled before the connection could continue.";

type ClientErrorSnapshot = {
  code?: string;
  message?: string;
};

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

function toPublicMicrosoftError({ code, message }: ClientErrorSnapshot) {
  switch (code) {
    case "session_reverification_required":
      return "TRON Mail needs you to verify your identity before Outlook can be connected.";
    case "reverification_cancelled":
      return REVERIFICATION_CANCELLED_MESSAGE;
    case "MICROSOFT_TOKEN_MISSING":
    case "MICROSOFT_SCOPE_MISSING":
    case "MICROSOFT_ADMIN_CONSENT_REQUIRED":
    case "MICROSOFT_RECONNECT_REQUIRED":
      return getMailboxSetupDiagnostic(code, "connect_button").userMessage;
    default:
      return message ?? "Outlook connection could not start. Please try again.";
  }
}

export function ConnectMicrosoftButton({
  label = "Connect Outlook",
  buttonClassName,
}: ConnectMicrosoftButtonProps) {
  const [isWorking, setIsWorking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const pending = isWorking;

  async function handleClick() {
    setErrorMessage(null);

    try {
      setIsWorking(true);

      const response = await fetch(appPath("/api/mail/connect/microsoft/start"), {
        method: "POST",
      });
      const result = (await response.json()) as MicrosoftConnectStartResponse;

      if (result.status === "connected") {
        window.location.assign(appPath("/mail/inbox"));
        return;
      }

      if (result.status === "oauth_required") {
        setErrorMessage("TRON Mail is local-only; Microsoft mailbox connections are disabled.");
        setIsWorking(false);
        return;
      }

      window.location.assign(appPath(`/mail/inbox?connectError=${encodeURIComponent(result.reason)}`));
    } catch (error) {
      const sanitizedError = sanitizeClientError(error);

      setIsWorking(false);
      setErrorMessage(toPublicMicrosoftError(sanitizedError));
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
        {pending ? "Redirecting to Microsoft..." : label}
      </BrandButton>
      {errorMessage ? (
        <p className="mt-3 text-center text-sm leading-6 text-[var(--accent-strong)]" role="alert">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
