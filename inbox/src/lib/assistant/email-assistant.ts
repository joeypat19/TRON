import "server-only";

import { getAppUrl, getEmailAssistantConfig, getEmailAssistantConfigIssue } from "@/lib/env";
import {
  buildEmailAssistantSystemPrompt,
  buildEmailAssistantUserPrompt,
  type BuildEmailAssistantUserPromptInput,
  type EmailAssistantMode,
} from "@/lib/assistant/email-assistant-prompt";

const DEFAULT_ASSISTANT_MODEL = "gpt-5.4-mini";
const MAX_OUTPUT_TOKENS = 1_500;

export class AssistantNotConfiguredError extends Error {
  constructor(message = "Assistant is not configured.") {
    super(message);
    this.name = "AssistantNotConfiguredError";
  }
}

export class AssistantUpstreamError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly upstreamMessage?: string,
  ) {
    super(message);
    this.name = "AssistantUpstreamError";
  }
}

export async function generateEmailAssistantResponse(input: BuildEmailAssistantUserPromptInput & { mode: EmailAssistantMode }) {
  const configIssue = getEmailAssistantConfigIssue();

  if (configIssue) {
    throw new AssistantNotConfiguredError(configIssue);
  }

  const config = getEmailAssistantConfig();
  const apiKey = config.apiKey;
  const model = config.model || DEFAULT_ASSISTANT_MODEL;

  if (!apiKey) {
    throw new AssistantNotConfiguredError("Assistant is not configured. Missing OPENAI_API_KEY.");
  }

  const promptInput = buildEmailAssistantUserPrompt(input);

  logEmailAssistantDebug("assistant upstream request starting", {
    model,
    mode: input.mode,
    hasDraftContext: Boolean(input.draftText?.trim() || input.draftSubject?.trim() || input.draftTo?.length || input.draftCc?.length || input.draftBcc?.length),
  });

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      instructions: buildEmailAssistantSystemPrompt(),
      input: promptInput,
      max_output_tokens: MAX_OUTPUT_TOKENS,
      reasoning: getAssistantReasoningSettings(model),
      text: {
        verbosity: "medium",
      },
      metadata: {
        app: "troninbox",
        mode: input.mode,
        origin: getAppUrl(),
      },
    }),
  });

  const payload = (await response.json()) as OpenAIResponsesApiResponse | { error?: { message?: string } };

  logEmailAssistantDebug("assistant upstream response received", {
    status: response.status,
    ok: response.ok,
    hasOutputText: Boolean("output_text" in payload && typeof payload.output_text === "string" && payload.output_text.trim()),
    upstreamError: "error" in payload ? payload.error?.message ?? null : null,
  });

  if (!response.ok) {
    const errorMessage = "error" in payload ? payload.error?.message : undefined;
    throw new AssistantUpstreamError(
      getSafeAssistantErrorMessage(response.status, errorMessage),
      response.status,
      errorMessage,
    );
  }

  const text = readOpenAIOutputText(payload);

  if (!text) {
    throw new AssistantUpstreamError("Assistant returned an empty response.", 502);
  }

  logEmailAssistantDebug("assistant upstream response parsed", {
    status: response.status,
    outputLength: text.trim().length,
  });

  return text.trim();
}

function getAssistantReasoningSettings(model: string) {
  if (model === "gpt-5.4-mini") {
    return {
      effort: "high" as const,
    };
  }

  return {
    effort: "high" as const,
  };
}

type OpenAIResponsesApiResponse = {
  output?: Array<{
    type?: string;
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
  output_text?: string;
};

function readOpenAIOutputText(payload: OpenAIResponsesApiResponse | { error?: { message?: string } }) {
  if ("output_text" in payload && typeof payload.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text;
  }

  if (!("output" in payload) || !Array.isArray(payload.output)) {
    return "";
  }

  return payload.output
    .flatMap((item) => item.content ?? [])
    .filter((content) => content.type === "output_text" && typeof content.text === "string")
    .map((content) => content.text ?? "")
    .join("\n")
    .trim();
}

function getSafeAssistantErrorMessage(status: number, errorMessage?: string) {
  const normalized = errorMessage?.toLowerCase() ?? "";

  if (status === 401 || normalized.includes("incorrect api key") || normalized.includes("invalid api key")) {
    return "Assistant credentials were rejected. Check OPENAI_API_KEY.";
  }

  if (status === 429 || normalized.includes("rate limit") || normalized.includes("quota")) {
    return "Assistant is temporarily rate-limited. Try again.";
  }

  if (normalized.includes("model") && (normalized.includes("access") || normalized.includes("not found") || normalized.includes("does not exist"))) {
    return "Assistant model is unavailable. Check EMAIL_ASSISTANT_MODEL and API access.";
  }

  if (status >= 500) {
    return "Assistant provider failed. Try again.";
  }

  if (errorMessage?.trim()) {
    return errorMessage.trim();
  }

  return `Assistant request failed with status ${status}.`;
}

function logEmailAssistantDebug(event: string, details: Record<string, unknown>) {
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  console.log(`[email-assistant] ${event}`, details);
}
