import "server-only";
import type { MailboxProvider } from "@prisma/client";
import { tronProviderAdapter } from "@/lib/mail/providers/tron";
import type { MailProviderAdapter } from "@/lib/mail/providers/types";
import { UnsupportedMailboxProviderError } from "@/lib/mail/providers/types";
import { isSupportedMailboxProvider } from "@/lib/mail/provider-config";

const supportedProviderAdapters = {
  TRON: tronProviderAdapter,
} satisfies Record<"TRON", MailProviderAdapter>;

export function getProviderAdapter(provider: MailboxProvider) {
  if (!isSupportedMailboxProvider(provider)) {
    throw new UnsupportedMailboxProviderError(provider);
  }

  if (provider !== "TRON") {
    throw new UnsupportedMailboxProviderError(provider);
  }

  return supportedProviderAdapters.TRON;
}

export function getImplementedProviders() {
  return Object.values(supportedProviderAdapters).filter((adapter) => adapter.implemented);
}
