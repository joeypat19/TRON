"use client";

import { useEffect } from "react";
import { MailboxLoadStatePanel } from "@/components/mail/mailbox-load-state-panel";

export default function MailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Inbox mail error]", {
      message: error.message,
      digest: error.digest,
    });
  }, [error]);

  return (
    <div className="mx-auto max-w-3xl">
      <MailboxLoadStatePanel
        compact
        hasConnectedAccount
        state={{
          status: "temporary_error",
          reason: "UNKNOWN_MAILBOX_SETUP_FAILURE",
          message: "Inbox could not finish loading this mailbox view.",
          developerMessage: error.message,
        }}
      />
      <div className="mt-4 flex justify-end">
        <button
          className="inline-flex items-center justify-center rounded-full border border-[var(--line)] bg-[var(--surface-overlay)] px-5 py-3 text-sm font-medium text-[var(--text)] transition hover:border-[var(--line)] hover:bg-[var(--surface-overlay)]"
          onClick={() => reset()}
          type="button"
        >
          Retry
        </button>
      </div>
    </div>
  );
}
