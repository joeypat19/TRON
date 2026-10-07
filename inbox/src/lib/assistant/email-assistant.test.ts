import { beforeEach, describe, expect, it, vi } from "vitest";

const getAppUrl = vi.fn(() => "https://troninbox.test");
const getEmailAssistantConfig = vi.fn(() => ({
  provider: "openai",
  apiKey: "test-key",
  model: "gpt-5.4-mini",
}));
const getEmailAssistantConfigIssue = vi.fn(() => null);

vi.mock("@/lib/env", () => ({
  getAppUrl: () => getAppUrl(),
  getEmailAssistantConfig: () => getEmailAssistantConfig(),
  getEmailAssistantConfigIssue: () => getEmailAssistantConfigIssue(),
}));

describe("generateEmailAssistantResponse", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAppUrl.mockReturnValue("https://troninbox.test");
    getEmailAssistantConfig.mockReturnValue({
      provider: "openai",
      apiKey: "test-key",
      model: "gpt-5.4-mini",
    });
    getEmailAssistantConfigIssue.mockReturnValue(null);
  });

  it("uses high reasoning effort for gpt-5.4-mini", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        output_text: "Summary ready.",
      }),
    } as Response);

    const { generateEmailAssistantResponse } = await import("@/lib/assistant/email-assistant");

    await generateEmailAssistantResponse({
      mode: "summarize",
      userMessage: "summarize this email",
      attachedEmailText: "This is the attached email body.",
    });

    const [, request] = fetchSpy.mock.calls[0] ?? [];
    const requestBody = JSON.parse(String(request?.body));

    expect(requestBody.model).toBe("gpt-5.4-mini");
    expect(requestBody.reasoning).toEqual({
      effort: "high",
    });
  });
});
