import { describe, expect, it } from "vitest";
import { buildEmailAssistantSystemPrompt, buildEmailAssistantUserPrompt } from "@/lib/assistant/email-assistant-prompt";

describe("email assistant prompt builder", () => {
  it("keeps the system prompt minimal", () => {
    const prompt = buildEmailAssistantSystemPrompt();

    expect(prompt).toContain("You are Tron Assistant");
    expect(prompt).toContain("Respond directly to the user's request.");
    expect(prompt).not.toContain("Rules:");
  });

  it("builds a compact user prompt without inventing missing context", () => {
    const prompt = buildEmailAssistantUserPrompt({
      mode: "reply",
      userMessage: "write a professional reply",
    });

    expect(prompt).toContain("Mode: reply");
    expect(prompt).toContain("User instruction: write a professional reply");
    expect(prompt).not.toContain("[Name]");
  });

  it("includes compose draft fields when they are available", () => {
    const prompt = buildEmailAssistantUserPrompt({
      mode: "compose",
      userMessage: "help me improve this draft",
      draftSubject: "Quarterly planning",
      draftText: "Can we meet next week to review the roadmap?",
      draftTo: ["recipient@example.com"],
      draftCc: ["manager@example.com"],
      draftBcc: ["legal@example.com"],
    });

    expect(prompt).toContain("Current draft fields:");
    expect(prompt).toContain("Subject: Quarterly planning");
    expect(prompt).toContain("To: recipient@example.com");
    expect(prompt).toContain("Cc: manager@example.com");
    expect(prompt).toContain("Bcc: legal@example.com");
  });

  it("includes attached email text when it is provided", () => {
    const prompt = buildEmailAssistantUserPrompt({
      mode: "summarize",
      userMessage: "summarize this",
      attachedEmailLabel: "Railway for iOS, CLI metrics",
      attachedEmailText: "Could you review this plan and reply by tomorrow?",
    });

    expect(prompt).toContain("Attached email: Railway for iOS, CLI metrics");
    expect(prompt).toContain("Could you review this plan and reply by tomorrow?");
  });

  it("includes recent conversation history and saved preferences when provided", () => {
    const prompt = buildEmailAssistantUserPrompt({
      mode: "chat",
      userMessage: "help me reply",
      conversationHistory: [
        { role: "user", text: "Summarize this email", attachedEmailLabel: "Failed production deployment" },
        { role: "assistant", text: "It is a deployment alert." },
      ],
      userPreferences: {
        prefersConcise: true,
        wantsDirectAnswers: true,
        likesDraftEmailHelp: true,
      },
    });

    expect(prompt).toContain("Saved user preferences:");
    expect(prompt).toContain("Prefer concise answers.");
    expect(prompt).toContain("Recent conversation:");
    expect(prompt).toContain("User: Summarize this email");
    expect(prompt).toContain("Context attachment: Failed production deployment");
    expect(prompt).toContain("Assistant: It is a deployment alert.");
  });

  it("does not include the older attached-context instruction rules", () => {
    const prompt = buildEmailAssistantSystemPrompt();

    expect(prompt).not.toContain("If the user says reply to this");
    expect(prompt).not.toContain("If the user says summarize this");
  });

  it("does not include tokens or secrets in prompt output", () => {
    const prompt = buildEmailAssistantUserPrompt({
      mode: "chat",
      userMessage: "summarize this email",
      draftText: "Here is the note.",
    });

    expect(prompt).not.toContain("OPENAI_API_KEY");
    expect(prompt).not.toContain("token");
    expect(prompt).not.toContain("secret");
  });
});
