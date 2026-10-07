"use client";

import { useCallback, useEffect, useState } from "react";
import { COMPOSE_ASSISTANT_PANEL_WIDTH, useAssistantRail } from "@/components/mail/assistant-rail";
import { ComposeForm, type ComposeDraftValues } from "@/components/mail/compose-form";

type ComposeModalProps = {
  activeMailboxEmail?: string | null;
  draft: ComposeDraftValues;
  isOpen: boolean;
  onClose: () => void;
  onDraftChange: (draft: ComposeDraftValues) => void;
  onSent: () => void;
};

export function ComposeModal({ activeMailboxEmail, draft, isOpen, onClose, onDraftChange, onSent }: ComposeModalProps) {
  const { isOpen: isAssistantOpen, presentation } = useAssistantRail();
  const isDesktopComposeLayoutShifted = isAssistantOpen && presentation === "compose-overlay";
  const [isMinimized, setIsMinimized] = useState(false);

  const handleRequestClose = useCallback(() => {
    if (hasDraftContent(draft) && !window.confirm("Close this draft? Unsaved content will be lost.")) {
      return;
    }

    setIsMinimized(false);
    onClose();
  }, [draft, onClose]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        handleRequestClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleRequestClose, isOpen]);

  const handleSent = useCallback(() => {
    setIsMinimized(false);
    onSent();
  }, [onSent]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className={isMinimized ? "fixed inset-0 z-50 overflow-hidden pointer-events-none" : "fixed inset-0 z-50 overflow-hidden"}
      data-compose-minimized={isMinimized ? "true" : "false"}
      data-testid="compose-modal-root"
    >
      {!isMinimized ? (
        <button
          aria-label="Close compose"
          className="absolute inset-0 bg-[var(--surface-overlay)] backdrop-blur-md"
          data-testid="compose-modal-backdrop"
          onClick={handleRequestClose}
          type="button"
        />
      ) : null}
      <div
        className={isMinimized ? "pointer-events-none absolute inset-0 z-10 flex overflow-visible" : "absolute inset-0 z-10 flex items-center justify-center overflow-hidden p-4"}
        data-compose-assistant-open={isDesktopComposeLayoutShifted ? "true" : "false"}
        data-testid="compose-modal-layout-shell"
      >
        <div
          className={isMinimized ? "pointer-events-auto flex w-full" : "flex w-full items-center justify-center max-xl:max-w-full xl:absolute xl:inset-y-0 xl:left-0 xl:p-4"}
          data-testid="compose-modal-dialog-slot"
          style={isDesktopComposeLayoutShifted ? { width: `calc(100% - ${COMPOSE_ASSISTANT_PANEL_WIDTH})` } : undefined}
        >
          <ComposeForm
            activeMailboxEmail={activeMailboxEmail}
            defaultValues={draft}
            mode="modal"
            onCancel={handleRequestClose}
            onDraftChange={onDraftChange}
            onMinimizedChange={setIsMinimized}
            onSent={handleSent}
          />
        </div>
      </div>
    </div>
  );
}

function hasDraftContent(draft: ComposeDraftValues) {
  return Boolean(
    draft.to?.trim()
      || draft.cc?.trim()
      || draft.bcc?.trim()
      || draft.subject?.trim()
      || draft.body?.trim()
      || draft.attachments?.length,
  );
}

export function ComposeModalLoading() {
  return (
    <div
      className="flex min-h-[28rem] flex-col items-center justify-center gap-4 px-6 py-12 text-center"
      data-testid="compose-modal-loading"
    >
      <div
        aria-hidden="true"
        className="h-11 w-11 animate-spin rounded-full border-2 border-[var(--line)] border-t-[var(--accent-strong)]"
        data-testid="compose-modal-spinner"
      />
      <p className="text-sm font-medium text-[var(--text-muted)]">Loading compose</p>
    </div>
  );
}
