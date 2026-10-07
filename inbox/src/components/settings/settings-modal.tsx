"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { ConnectGmailButton } from "@/components/auth/connect-gmail-button";
import { ConnectMicrosoftButton } from "@/components/auth/connect-microsoft-button";

type SettingsModalProps = {
  connectedAccounts: Array<{
    id: string;
    provider: string;
    emailAddress: string;
    status: string;
  }>;
  isOpen: boolean;
  onClose: () => void;
};

export function SettingsModal({ connectedAccounts, isOpen, onClose }: SettingsModalProps) {
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" data-testid="settings-modal-root">
      <button
        aria-label="Close settings"
        className="absolute inset-0 bg-[var(--surface-overlay)] backdrop-blur-md"
        data-testid="settings-modal-backdrop"
        onClick={onClose}
        type="button"
      />
      <div
        aria-modal="true"
        className="relative z-10 flex max-h-[80vh] w-full max-w-3xl flex-col overflow-hidden rounded-[28px] border border-[var(--line)] bg-[var(--surface-overlay)] shadow-[0_28px_80px_var(--shadow-color)]"
        role="dialog"
      >
        <div className="flex items-center justify-between gap-4 border-b border-[var(--line)] px-6 py-5">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[var(--accent)]">Settings</p>
            <h2 className="mt-2 text-2xl font-semibold text-[var(--text)]">Workspace settings</h2>
          </div>
          <button
            aria-label="Close settings"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[var(--text-muted)] transition hover:bg-[var(--surface-overlay)] hover:text-[var(--text)]"
            onClick={onClose}
            type="button"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-6">
          <div className="grid gap-6">
            <section className="grid gap-6" data-testid="settings-modal-accounts">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-[var(--text)]">Accounts</h3>
                  <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                    Refresh or reconnect Gmail from here without leaving your inbox.
                  </p>
                </div>
                <div className="w-full md:w-auto">
                  <div className="flex flex-col gap-3 md:flex-row">
                    <ConnectGmailButton buttonClassName="min-h-11 w-full md:w-auto" label="Add Gmail" />
                    <ConnectMicrosoftButton buttonClassName="min-h-11 w-full md:w-auto" label="Add Outlook" />
                  </div>
                </div>
              </div>

              {connectedAccounts.length ? (
                <div className="grid gap-3">
                  {connectedAccounts.map((account) => (
                    <div
                      className="rounded-[22px] border border-[var(--line)] bg-[var(--surface-overlay)] px-5 py-4"
                      key={account.id}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-base font-medium text-[var(--text)]">{account.emailAddress}</p>
                          <p className="mt-1 text-sm text-[var(--text-muted)]">{account.status}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-[22px] border border-[var(--line)] bg-[var(--surface-overlay)] px-5 py-6">
                  <p className="text-base font-medium text-[var(--text)]">No mailbox accounts connected yet</p>
                  <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">Connect Gmail or Outlook to start loading your inbox.</p>
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
