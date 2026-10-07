import { describe, expect, it } from "vitest";
import { getProviderAdapter } from "@/lib/mail/providers";
import { getConnectableProviders, providerDirectory } from "@/lib/mail/providers/catalog";

describe("mail provider registry", () => {
  it("shows only supported provider labels", () => {
    expect(providerDirectory.GMAIL.shortName).toBe("Gmail");
    expect(providerDirectory.MICROSOFT.shortName).toBe("Outlook");
  });

  it("shows Gmail and Outlook in the connectable UI list", () => {
    expect(getConnectableProviders().map((provider) => provider.title)).toEqual(["Connect Gmail", "Connect Outlook"]);
  });

  it("rejects unsupported legacy providers in the backend", () => {
    expect(() => getProviderAdapter("IMAP_SMTP")).toThrow(/supported mailbox provider/i);
  });
});
