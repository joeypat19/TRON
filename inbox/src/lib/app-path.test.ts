import { afterEach, describe, expect, it, vi } from "vitest";

describe("appPath", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("keeps local development rooted at the Inbox app", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");

    const { appPath } = await import("@/lib/app-path");

    expect(appPath("/mail/inbox")).toBe("/mail/inbox");
  });

  it("preserves the Infinity mount in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://infinity.tronxvi.com/inbox");

    const { appPath, stripAppMount } = await import("@/lib/app-path");

    expect(appPath("/mail/inbox")).toBe("/inbox/mail/inbox");
    expect(appPath("/api/mail/messages")).toBe("/inbox/api/mail/messages");
    expect(stripAppMount("/inbox/mail/inbox")).toBe("/mail/inbox");
  });

  it("preserves the Infinity mount on Railway production even when NODE_ENV is not exposed", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("RAILWAY_ENVIRONMENT_NAME", "production");

    const { appPath } = await import("@/lib/app-path");

    expect(appPath("/mail/inbox")).toBe("/inbox/mail/inbox");
  });
});
