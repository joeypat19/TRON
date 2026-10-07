import { describe, expect, it } from "vitest";
import {
  classifyMailboxSetupError,
  getMailboxSetupDiagnostic,
  getMailboxSetupCodeFromError,
} from "@/lib/mail/setup-diagnostics";

describe("mailbox setup diagnostics", () => {
  it("maps malformed database URLs", () => {
    expect(getMailboxSetupCodeFromError(new Error("Invalid connection string"))).toBe("DATABASE_URL_MALFORMED");
  });

  it("maps database auth failures", () => {
    expect(
      getMailboxSetupCodeFromError({
        code: "P1000",
        message: "Authentication failed against database server",
      }),
    ).toBe("DATABASE_AUTH_FAILED");
  });

  it("maps database schema failures", () => {
    expect(
      getMailboxSetupCodeFromError({
        code: "P2021",
        message: "The table does not exist",
      }),
    ).toBe("PRISMA_SCHEMA_NOT_DEPLOYED");
  });

  it("maps Gmail scope failures", () => {
    expect(
      getMailboxSetupCodeFromError({
        status: 403,
        message: "Request had insufficient authentication scopes.",
      }),
    ).toBe("GMAIL_SCOPE_MISSING");
  });

  it("maps blocked Google access failures", () => {
    expect(classifyMailboxSetupError(new Error("Access blocked: This app isn't verified"), "oauth").code).toBe(
      "GOOGLE_OAUTH_BLOCKED_ACCESS",
    );
  });

  it("returns recommended fixes for known codes", () => {
    const diagnostic = getMailboxSetupDiagnostic("DATABASE_URL_PRIVATE_HOST_ON_VERCEL", "db_connect");

    expect(diagnostic.userMessage).toBe("Inbox cannot reach the mailbox database.");
    expect(diagnostic.recommendedAction).toMatch(/public TCP proxy URL/i);
  });
});
