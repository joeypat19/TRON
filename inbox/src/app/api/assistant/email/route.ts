import { NextResponse } from "next/server";
import { z } from "zod";
import { AssistantNotConfiguredError, AssistantUpstreamError, generateEmailAssistantResponse } from "@/lib/assistant/email-assistant";
import type { AssistantConversationTurn, AssistantUserPreferences, EmailAssistantMode } from "@/lib/assistant/email-assistant-prompt";
import { getEmailAssistantConfig } from "@/lib/env";

const MAX_USER_MESSAGE_CHARS = 2_000;
const MAX_DRAFT_TEXT_CHARS = 8_000;
const MAX_ATTACHED_EMAIL_TEXT_CHARS = 12_000;
const MAX_DRAFT_RECIPIENTS = 25;
const MAX_HISTORY_TURNS = 12;
const MAX_HISTORY_MESSAGE_CHARS = 2_000;

const historyTurnSchema = z.object({
  role: z.enum(["user", "assistant"]),
  text: z.string().trim().min(1).max(MAX_HISTORY_MESSAGE_CHARS),
  attachedEmailLabel: z.string().trim().max(200).optional(),
});

const userPreferencesSchema = z.object({
  prefersConcise: z.boolean().optional(),
  wantsDirectAnswers: z.boolean().optional(),
  likesDraftEmailHelp: z.boolean().optional(),
});

const requestSchema = z.object({
  message: z.string().trim().min(1).max(MAX_USER_MESSAGE_CHARS),
  mode: z.enum(["chat", "reply", "rewrite", "summarize", "compose"]),
  threadId: z.string().trim().min(1).max(256).optional(),
  draftText: z.string().max(MAX_DRAFT_TEXT_CHARS).optional(),
  draftSubject: z.string().trim().max(998).optional(),
  draftTo: z.array(z.string().trim().min(1).max(320)).max(MAX_DRAFT_RECIPIENTS).optional(),
  draftCc: z.array(z.string().trim().min(1).max(320)).max(MAX_DRAFT_RECIPIENTS).optional(),
  draftBcc: z.array(z.string().trim().min(1).max(320)).max(MAX_DRAFT_RECIPIENTS).optional(),
  attachedEmailLabel: z.string().trim().max(200).optional(),
  attachedEmailText: z.string().trim().min(1).max(MAX_ATTACHED_EMAIL_TEXT_CHARS).optional(),
  history: z.array(historyTurnSchema).max(MAX_HISTORY_TURNS).optional(),
  preferences: userPreferencesSchema.optional(),
  selectedMessageId: z.string().trim().min(1).max(256).optional(),
}).strict();

export async function POST(request: Request) {
  let payload: z.infer<typeof requestSchema> | null = null;
  let failedStage = "request:start";

  logAssistantRouteDebug("assistant:route:received");

  try {
    failedStage = "json:parse";
    const requestJson = await request.json();
    const parsed = requestSchema.safeParse(requestJson);

    if (!parsed.success) {
      throw new AssistantRequestError("Assistant request is invalid.", 400);
    }

    payload = parsed.data;

    logAssistantRouteDebug("assistant:route:parsed", {
      messageLength: payload.message.length,
      mode: payload.mode,
      hasDraftContext: Boolean(payload.draftText?.trim() || payload.draftSubject?.trim() || payload.draftTo?.length || payload.draftCc?.length || payload.draftBcc?.length),
      hasAttachedEmail: Boolean(payload.attachedEmailText?.trim()),
      historyCount: payload.history?.length ?? 0,
    });

    const assistantConfig = getEmailAssistantConfig();

    failedStage = "ai";
    logAssistantRouteDebug("assistant:route:ai:start", {
      provider: assistantConfig.provider,
      model: assistantConfig.model,
      hasOpenAIKey: Boolean(assistantConfig.apiKey),
    });

    const assistantText = await generateEmailAssistantResponse({
      mode: payload.mode,
      userMessage: payload.message,
      draftText: payload.draftText,
      draftSubject: payload.draftSubject,
      draftTo: payload.draftTo,
      draftCc: payload.draftCc,
      draftBcc: payload.draftBcc,
      attachedEmailLabel: payload.attachedEmailLabel,
      attachedEmailText: payload.attachedEmailText,
      conversationHistory: payload.history as AssistantConversationTurn[] | undefined,
      userPreferences: payload.preferences as AssistantUserPreferences | undefined,
    });

    logAssistantRouteDebug("assistant:route:success", {
      status: 200,
    });

    return NextResponse.json({
      text: assistantText,
      mode: payload.mode,
    });
  } catch (error) {
    if (error instanceof AssistantNotConfiguredError) {
      logAssistantRouteFailure("assistant:route:error", {
        status: 503,
        safeReason: error.message,
        failedStage,
      });
      return NextResponse.json({ error: error.message }, { status: 503 });
    }

    if (error instanceof AssistantUpstreamError) {
      logAssistantRouteFailure("assistant:route:error", {
        status: error.status >= 400 && error.status < 600 ? error.status : 502,
        safeReason: error.message,
        failedStage,
      });

      return NextResponse.json(
        { error: error.message },
        { status: error.status >= 400 && error.status < 600 ? error.status : 502 },
      );
    }

    if (error instanceof AssistantRequestError) {
      logAssistantRouteFailure("assistant:route:error", {
        status: error.status,
        safeReason: error.message,
        failedStage,
      });

      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    logAssistantRouteFailure("assistant:route:error", {
      status: 500,
      safeReason: error instanceof Error && error.message.trim() ? error.message : "Unknown assistant error.",
      failedStage,
    });

    return NextResponse.json(
      { error: error instanceof Error && error.message.trim() ? error.message : "Unknown assistant error." },
      { status: 500 },
    );
  }
}

class AssistantRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "AssistantRequestError";
  }
}

function logAssistantRouteDebug(event: string, details?: Record<string, unknown>) {
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  if (details) {
    console.log(event, details);
    return;
  }

  console.log(event);
}

function logAssistantRouteFailure(event: string, details?: Record<string, unknown>) {
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  if (details) {
    console.log(event, details);
    return;
  }

  console.log(event);
}

export type AssistantEmailRouteResponse = {
  text: string;
  mode: EmailAssistantMode;
};
