export type EmailAssistantMode = "chat" | "reply" | "rewrite" | "summarize" | "compose";

export type AssistantConversationTurn = {
  role: "user" | "assistant";
  text: string;
  attachedEmailLabel?: string | null;
};

export type AssistantUserPreferences = {
  prefersConcise?: boolean;
  wantsDirectAnswers?: boolean;
  likesDraftEmailHelp?: boolean;
};

export type BuildEmailAssistantUserPromptInput = {
  mode: EmailAssistantMode;
  userMessage: string;
  draftText?: string | null;
  draftSubject?: string | null;
  draftTo?: string[] | null;
  draftCc?: string[] | null;
  draftBcc?: string[] | null;
  attachedEmailLabel?: string | null;
  attachedEmailText?: string | null;
  conversationHistory?: AssistantConversationTurn[] | null;
  userPreferences?: AssistantUserPreferences | null;
};

const MAX_MESSAGE_BODY_CHARS = 4_000;
const MAX_TOTAL_CONTEXT_CHARS = 24_000;
const MAX_HISTORY_TURNS = 8;

export function buildEmailAssistantSystemPrompt() {
  return [
    "You are Tron Assistant inside Inbox.",
    "",
    "You are a helpful AI assistant.",
    "Use any provided draft context when it is relevant.",
    "Respond directly to the user's request.",
  ].join("\n");
}

export function buildEmailAssistantUserPrompt(input: BuildEmailAssistantUserPromptInput) {
  const lines: string[] = [
    `Mode: ${input.mode}`,
    `User instruction: ${input.userMessage.trim()}`,
  ];

  const preferences = buildAssistantPreferencesSection(input.userPreferences);

  if (preferences.length) {
    lines.push("", "Saved user preferences:");
    lines.push(...preferences);
  }

  if (input.draftText?.trim()) {
    lines.push("", "Current draft text:", truncateBlock(input.draftText));
  }

  if (input.draftSubject?.trim() || input.draftTo?.length || input.draftCc?.length || input.draftBcc?.length) {
    lines.push("", "Current draft fields:");

    if (input.draftSubject?.trim()) {
      lines.push(`Subject: ${truncateInline(input.draftSubject.trim(), 998)}`);
    }

    if (input.draftTo?.length) {
      lines.push(`To: ${input.draftTo.join(", ")}`);
    }

    if (input.draftCc?.length) {
      lines.push(`Cc: ${input.draftCc.join(", ")}`);
    }

    if (input.draftBcc?.length) {
      lines.push(`Bcc: ${input.draftBcc.join(", ")}`);
    }
  }

  if (input.attachedEmailText?.trim()) {
    lines.push("", `Attached email${input.attachedEmailLabel?.trim() ? `: ${truncateInline(input.attachedEmailLabel.trim(), 200)}` : ":"}`);
    lines.push(truncateBlock(input.attachedEmailText));
  }

  const historyLines = buildConversationHistorySection(input.conversationHistory);

  if (historyLines.length) {
    lines.push("", "Recent conversation:");
    lines.push(...historyLines);
  }

  const prompt = lines.join("\n");

  logPromptDebug("assistant:prompt:built", {});

  return prompt.length > MAX_TOTAL_CONTEXT_CHARS ? `${prompt.slice(0, MAX_TOTAL_CONTEXT_CHARS - 13)}\n[truncated]` : prompt;
}

function buildAssistantPreferencesSection(preferences?: AssistantUserPreferences | null) {
  if (!preferences) {
    return [];
  }

  const lines: string[] = [];

  if (preferences.prefersConcise === true) {
    lines.push("- Prefer concise answers.");
  } else if (preferences.prefersConcise === false) {
    lines.push("- Detail is welcome when useful.");
  }

  if (preferences.wantsDirectAnswers === true) {
    lines.push("- Answer directly before adding extra context.");
  }

  if (preferences.likesDraftEmailHelp === true) {
    lines.push("- The user often wants help drafting or revising emails.");
  }

  return lines;
}

function buildConversationHistorySection(history?: AssistantConversationTurn[] | null) {
  if (!history?.length) {
    return [];
  }

  return history.slice(-MAX_HISTORY_TURNS).flatMap((turn) => {
    const lines = [`${turn.role === "user" ? "User" : "Assistant"}: ${truncateBlock(turn.text)}`];

    if (turn.attachedEmailLabel?.trim()) {
      lines.push(`Context attachment: ${truncateInline(turn.attachedEmailLabel.trim(), 200)}`);
    }

    return lines;
  });
}

function logPromptDebug(event: string, details: Record<string, unknown>) {
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  console.log(event, details);
}

function truncateInline(value?: string | null, maxLength = 600) {
  const normalized = value?.replace(/\s+/g, " ").trim() ?? "";

  if (!normalized) {
    return "";
  }

  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 1)}â€¦` : normalized;
}

function truncateBlock(value: string) {
  const normalized = value.trim();

  if (normalized.length <= MAX_MESSAGE_BODY_CHARS) {
    return normalized;
  }

  return `${normalized.slice(0, MAX_MESSAGE_BODY_CHARS - 1)}â€¦`;
}
