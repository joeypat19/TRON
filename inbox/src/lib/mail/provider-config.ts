import type { MailboxProvider } from "@prisma/client";

export const SUPPORTED_MAILBOX_PROVIDERS = [
  "TRON",
] as const satisfies readonly MailboxProvider[];

export const CONNECTABLE_MAILBOX_PROVIDERS = [
  "GMAIL",
  "MICROSOFT",
] as const satisfies readonly MailboxProvider[];

export const REQUIRED_GMAIL_SCOPES = [
  // Retained as an empty compatibility list for the unchanged connector UI.
] as const;

export const OPTIONAL_GMAIL_PROFILE_SCOPES = [
] as const;

export const REQUIRED_MICROSOFT_SCOPES = [
] as const;

export function isSupportedMailboxProvider(provider: MailboxProvider): provider is (typeof SUPPORTED_MAILBOX_PROVIDERS)[number] {
  return SUPPORTED_MAILBOX_PROVIDERS.includes(provider as (typeof SUPPORTED_MAILBOX_PROVIDERS)[number]);
}

export function isConnectableMailboxProvider(provider: MailboxProvider): provider is (typeof CONNECTABLE_MAILBOX_PROVIDERS)[number] {
  return CONNECTABLE_MAILBOX_PROVIDERS.includes(provider as (typeof CONNECTABLE_MAILBOX_PROVIDERS)[number]);
}

export function getMissingMailboxScopes(
  grantedScopes: readonly string[],
  requiredScopes: readonly string[],
) {
  const granted = new Set(grantedScopes);
  return requiredScopes.filter((scope) => !granted.has(scope));
}
