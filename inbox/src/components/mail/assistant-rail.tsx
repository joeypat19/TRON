"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type Dispatch,
  type FormEvent,
  type ReactNode,
  type SetStateAction,
} from "react";
import { ChevronLeft, ChevronRight, Copy, LoaderCircle, Paperclip, Sparkles, X } from "lucide-react";
import { usePathname } from "next/navigation";
import type { ComposeDraftValues } from "@/components/mail/compose-form";
import { appPath } from "@/lib/app-path";
import type { AssistantConversationTurn, AssistantUserPreferences } from "@/lib/assistant/email-assistant-prompt";
import { isAssistantDraggedEmailDataTransfer, parseAssistantDraggedEmailPayload, TRON_ASSISTANT_EMAIL_MIME } from "@/lib/assistant/email-dnd";
import { cn } from "@/lib/utils";

const ASSISTANT_RAIL_STORAGE_KEY = "troninbox-assistant-rail-open";
const ASSISTANT_MEMORY_STORAGE_KEY = "troninbox-assistant-memory";
export const COMPOSE_ASSISTANT_PANEL_WIDTH = "23rem";

type AssistantRole = "user" | "assistant";

type AssistantMessage = {
  id: string;
  role: AssistantRole;
  text: string;
  mode?: AssistantMode;
  localOnly?: boolean;
  attachedEmail?: {
    messageId: string;
    label: string;
  } | null;
};

type PersistedAssistantState = {
  messages: AssistantMessage[];
  preferences: AssistantUserPreferences;
};

type AssistantMemoryState = PersistedAssistantState & {
  hasHydratedMemory: boolean;
};

type AssistantMemoryAction =
  | { type: "hydrate"; state: PersistedAssistantState }
  | { type: "set-messages"; value: SetStateAction<AssistantMessage[]> }
  | { type: "set-preferences"; value: SetStateAction<AssistantUserPreferences> };

type AssistantApiPayload = {
  text?: string;
  mode?: AssistantMode;
  error?: string;
};

type AssistantMode = "chat" | "reply" | "rewrite" | "summarize" | "compose";

type AssistantOpenRequest = {
  source?: "compose";
  composeDraft?: ComposeDraftValues;
};

type AttachedEmailContext = {
  messageId: string;
  label: string;
  text: string;
};

type ComposeBridge = {
  draft: ComposeDraftValues;
  replaceDraft: (nextDraft: ComposeDraftValues) => void;
  insertIntoDraft: (assistantText: string) => void;
};

type AssistantRailContextValue = {
  isOpen: boolean;
  openAssistant: (request?: AssistantOpenRequest) => void;
  closeAssistant: () => void;
  toggleAssistant: () => void;
  syncComposeDraft: (
    draft: ComposeDraftValues,
    replaceDraft: (nextDraft: ComposeDraftValues) => void,
    insertIntoDraft: (assistantText: string) => void,
  ) => void;
  clearComposeDraft: () => void;
  composeBridge: ComposeBridge | null;
  presentation: "docked" | "compose-overlay";
  messages: AssistantMessage[];
  setMessages: Dispatch<SetStateAction<AssistantMessage[]>>;
  preferences: AssistantUserPreferences;
  setPreferences: Dispatch<SetStateAction<AssistantUserPreferences>>;
  hasHydratedMemory: boolean;
  resetConversation: () => void;
};

const ASSISTANT_SENTENCE_REVEAL_DELAY_MS = 350;
const ASSISTANT_SHORT_REPLY_REVEAL_DELAY_MS = 120;
const ASSISTANT_MAX_MESSAGE_HISTORY = 12;
const DEFAULT_ASSISTANT_PREFERENCES: AssistantUserPreferences = {
  prefersConcise: true,
  wantsDirectAnswers: true,
  likesDraftEmailHelp: true,
};

function assistantMemoryReducer(state: AssistantMemoryState, action: AssistantMemoryAction): AssistantMemoryState {
  if (action.type === "hydrate") {
    return {
      messages: action.state.messages,
      preferences: {
        ...DEFAULT_ASSISTANT_PREFERENCES,
        ...action.state.preferences,
      },
      hasHydratedMemory: true,
    };
  }

  if (action.type === "set-messages") {
    return {
      ...state,
      messages: typeof action.value === "function" ? action.value(state.messages) : action.value,
    };
  }

  return {
    ...state,
    preferences: typeof action.value === "function" ? action.value(state.preferences) : action.value,
  };
}

const noop = () => {};

const AssistantRailContext = createContext<AssistantRailContextValue>({
  isOpen: false,
  openAssistant: noop,
  closeAssistant: noop,
  toggleAssistant: noop,
  syncComposeDraft: noop,
  clearComposeDraft: noop,
  composeBridge: null,
  presentation: "docked",
  messages: [],
  setMessages: noop as Dispatch<SetStateAction<AssistantMessage[]>>,
  preferences: DEFAULT_ASSISTANT_PREFERENCES,
  setPreferences: noop as Dispatch<SetStateAction<AssistantUserPreferences>>,
  hasHydratedMemory: false,
  resetConversation: noop,
});

function readAssistantRailPreference() {
  if (typeof window === "undefined") {
    return false;
  }

  if (typeof window.localStorage?.getItem !== "function") {
    return false;
  }

  return window.localStorage.getItem(ASSISTANT_RAIL_STORAGE_KEY) === "true";
}

function logAssistantRailDebug(event: string, details: Record<string, unknown>) {
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  console.log(event, details);
}

export function AssistantRailProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(readAssistantRailPreference);
  const [composeBridge, setComposeBridge] = useState<ComposeBridge | null>(null);
  const [presentation, setPresentation] = useState<"docked" | "compose-overlay">("docked");
  const [{ messages, preferences, hasHydratedMemory }, dispatchMemory] = useReducer(assistantMemoryReducer, {
    messages: [],
    preferences: DEFAULT_ASSISTANT_PREFERENCES,
    hasHydratedMemory: false,
  });
  const setMessages = useCallback<Dispatch<SetStateAction<AssistantMessage[]>>>((value) => {
    dispatchMemory({ type: "set-messages", value });
  }, []);
  const setPreferences = useCallback<Dispatch<SetStateAction<AssistantUserPreferences>>>((value) => {
    dispatchMemory({ type: "set-preferences", value });
  }, []);
  const assistantMemoryStorageKey = useMemo(() => (
    `${ASSISTANT_MEMORY_STORAGE_KEY}:public`
  ), []);
  const openAssistant = useCallback((request?: AssistantOpenRequest) => {
    const composeDraft = request?.composeDraft;

    setPresentation(request?.source === "compose" ? "compose-overlay" : "docked");
    setIsOpen(true);

    if (!composeDraft) {
      return;
    }

    setComposeBridge((current) => {
      if (!current) {
        return {
          draft: composeDraft,
          replaceDraft: noop,
          insertIntoDraft: noop,
        };
      }

      return {
        ...current,
        draft: {
          ...current.draft,
          ...composeDraft,
        },
      };
    });
  }, []);
  const closeAssistant = useCallback(() => setIsOpen(false), []);
  const toggleAssistant = useCallback(() => setIsOpen((current) => !current), []);
  const syncComposeDraft = useCallback((
    draft: ComposeDraftValues,
    replaceDraft: (nextDraft: ComposeDraftValues) => void,
    insertIntoDraft: (assistantText: string) => void,
  ) => {
    setComposeBridge({ draft, replaceDraft, insertIntoDraft });
  }, []);
  const clearComposeDraft = useCallback(() => {
    setComposeBridge(null);
    setPresentation("docked");
  }, []);
  const resetConversation = useCallback(() => {
    setMessages([]);
  }, [setMessages]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (typeof window.localStorage?.setItem !== "function") {
      return;
    }

    window.localStorage.setItem(ASSISTANT_RAIL_STORAGE_KEY, String(isOpen));
  }, [isOpen]);

  useEffect(() => {
    const persistedState = readPersistedAssistantState(assistantMemoryStorageKey);

    dispatchMemory({ type: "hydrate", state: persistedState });
  }, [assistantMemoryStorageKey]);

  useEffect(() => {
    if (!hasHydratedMemory || typeof window === "undefined" || typeof window.localStorage?.setItem !== "function") {
      return;
    }

    window.localStorage.setItem(assistantMemoryStorageKey, JSON.stringify({
      messages: messages.filter((message) => !message.localOnly).slice(-ASSISTANT_MAX_MESSAGE_HISTORY),
      preferences,
    } satisfies PersistedAssistantState));
  }, [assistantMemoryStorageKey, hasHydratedMemory, messages, preferences]);

  const value = useMemo<AssistantRailContextValue>(() => ({
    isOpen,
    openAssistant,
    closeAssistant,
    toggleAssistant,
    syncComposeDraft,
    clearComposeDraft,
    composeBridge,
    presentation,
    messages,
    setMessages,
    preferences,
    setPreferences,
    hasHydratedMemory,
    resetConversation,
  }), [clearComposeDraft, closeAssistant, composeBridge, hasHydratedMemory, isOpen, messages, openAssistant, preferences, presentation, resetConversation, setMessages, setPreferences, syncComposeDraft, toggleAssistant]);

  return <AssistantRailContext.Provider value={value}>{children}</AssistantRailContext.Provider>;
}

export function useAssistantRail() {
  return useContext(AssistantRailContext);
}

export function AssistantRail({
  variant = "docked",
  visible = true,
}: {
  variant?: "docked" | "sidebar";
  visible?: boolean;
} = {}) {
  const { isOpen, closeAssistant, openAssistant, presentation } = useAssistantRail();
  const isComposeOverlay = isOpen && presentation === "compose-overlay";

  if (variant === "sidebar") {
    return (
      <>
        {!isComposeOverlay && visible ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden" data-testid="assistant-sidebar-panel">
            <AssistantRailPanel onClose={closeAssistant} showClose={false} />
          </div>
        ) : null}

        {isComposeOverlay ? (
          <div className="pointer-events-none fixed inset-y-0 right-0 z-[60] flex w-full justify-end overflow-hidden">
            <aside
              className="pointer-events-auto flex h-full max-h-screen w-full translate-x-0 flex-col overflow-hidden border-l border-[var(--line)] bg-[var(--bg)] shadow-[-24px_0_70px_var(--shadow-color)] transition-transform duration-300 max-xl:max-w-[23.5rem]"
              data-testid="assistant-compose-overlay"
              style={{ maxWidth: COMPOSE_ASSISTANT_PANEL_WIDTH }}
            >
              <AssistantRailPanel onClose={closeAssistant} />
            </aside>
          </div>
        ) : null}
      </>
    );
  }

  return (
    <>
      {!isComposeOverlay ? (
        <aside
          className={cn(
            "hidden h-full min-h-0 shrink-0 overflow-hidden border-l border-[var(--line)] bg-[var(--surface-overlay)] backdrop-blur-xl xl:flex xl:flex-col",
            isOpen ? "xl:w-[22.5rem]" : "xl:w-16",
          )}
        >
          {isOpen ? (
            <AssistantRailPanel
              onClose={closeAssistant}
            />
          ) : (
            <CollapsedRailButton onOpen={openAssistant} />
          )}
        </aside>
      ) : null}

      {!isOpen ? (
        <button
          aria-label="Open assistant rail"
          className="fixed right-4 top-1/2 z-30 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--surface-overlay)] text-[var(--accent)] shadow-[0_18px_34px_var(--shadow-color)] transition hover:border-[var(--line)] hover:bg-[var(--surface-overlay)] xl:hidden"
          onClick={() => openAssistant()}
          type="button"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      ) : null}

      {isOpen && !isComposeOverlay ? (
        <div className="fixed inset-0 z-40 xl:hidden">
          <button
            className="absolute inset-0 bg-[var(--surface-overlay)] backdrop-blur-sm"
            onClick={closeAssistant}
            type="button"
          />
          <aside className="absolute inset-y-0 right-0 z-10 flex h-full max-h-screen w-full max-w-[23.5rem] flex-col overflow-hidden border-l border-[var(--line)] bg-[var(--surface-overlay)] shadow-[0_24px_70px_var(--shadow-color)]">
            <AssistantRailPanel onClose={closeAssistant} />
          </aside>
        </div>
      ) : null}

      {isComposeOverlay ? (
        <div className="pointer-events-none fixed inset-y-0 right-0 z-[60] flex w-full justify-end overflow-hidden">
          <aside
            className="pointer-events-auto flex h-full max-h-screen w-full translate-x-0 flex-col overflow-hidden border-l border-[var(--line)] bg-[var(--bg)] shadow-[-24px_0_70px_var(--shadow-color)] transition-transform duration-300 max-xl:max-w-[23.5rem]"
            data-testid="assistant-compose-overlay"
            style={{ maxWidth: COMPOSE_ASSISTANT_PANEL_WIDTH }}
          >
            <AssistantRailPanel onClose={closeAssistant} />
          </aside>
        </div>
      ) : null}
    </>
  );
}

function CollapsedRailButton({
  onOpen,
}: {
  onOpen: () => void;
}) {
  return (
    <div className="relative flex h-full min-h-0 flex-col items-center justify-between py-4 transition-colors">
      <button
        className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--surface-overlay)] text-[var(--accent)] transition hover:border-[var(--line)] hover:bg-[var(--surface-overlay)]"
        onClick={onOpen}
        title="Open assistant rail"
        type="button"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <div className="flex -rotate-180 items-center gap-2 [writing-mode:vertical-rl]">
        <span className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[var(--text-muted)]">Assistant</span>
      </div>
    </div>
  );
}

function AssistantRailPanel({
  onClose,
  showClose = true,
}: {
  onClose: () => void;
  showClose?: boolean;
}) {
  const pathname = usePathname();
  const { composeBridge, hasHydratedMemory, messages, preferences, resetConversation, setMessages, setPreferences } = useAssistantRail();
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [attachmentWarning, setAttachmentWarning] = useState<string | null>(null);
  const [attachedEmailContext, setAttachedEmailContext] = useState<AttachedEmailContext | null>(null);
  const [isDropActive, setIsDropActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isAttachingEmail, setIsAttachingEmail] = useState(false);
  const messageEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const nextMessageId = useRef(0);
  const revealTimeoutIdsRef = useRef<number[]>([]);
  const revealSequenceRef = useRef(0);

  useEffect(() => {
    if (!hasHydratedMemory || messages.length) {
      return;
    }

    setMessages([createMessage("assistant", "Hey — if you need help with an email, I’m here to help.", undefined, true)]);
  }, [hasHydratedMemory, messages.length, setMessages]);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages, isLoading, attachedEmailContext, isAttachingEmail, attachmentWarning]);

  useEffect(() => {
    nextMessageId.current = Math.max(nextMessageId.current, messages.length);
  }, [messages.length]);

  useEffect(() => {
    syncTextareaHeight(inputRef.current);
  }, [input, attachedEmailContext]);

  useEffect(() => () => {
    revealSequenceRef.current += 1;
    clearRevealTimeouts(revealTimeoutIdsRef.current);
  }, []);

  function createMessage(
    role: AssistantRole,
    text: string,
    mode?: AssistantMode,
    localOnly = false,
    attachedEmail?: AssistantMessage["attachedEmail"],
  ): AssistantMessage {
    nextMessageId.current += 1;
    return {
      id: `${role}-${nextMessageId.current}`,
      role,
      text,
      mode,
      localOnly,
      attachedEmail: attachedEmail ?? null,
    };
  }

  async function submitPrompt() {
    const trimmed = input.trim();

    if (!trimmed || isLoading) {
      return;
    }

    const attachedEmailForRequest = attachedEmailContext;
    const mode = inferAssistantMode(trimmed, Boolean(composeBridge?.draft.body?.trim()));
    const nextPreferences = mergeAssistantPreferences(preferences, inferAssistantPreferences(trimmed, mode));
    const nextUserMessage = createMessage(
      "user",
      trimmed,
      mode,
      false,
      attachedEmailForRequest
        ? {
          messageId: attachedEmailForRequest.messageId,
          label: attachedEmailForRequest.label,
        }
        : null,
    );

    setMessages((current) => [...current, nextUserMessage]);
    setPreferences(nextPreferences);
    setInput("");
    setError(null);
    setAttachmentWarning(null);
    setAttachedEmailContext(null);
    setIsLoading(true);

    try {
      const requestBody = {
        message: trimmed,
        mode,
        threadId: extractThreadId(pathname) ?? undefined,
        draftText: composeBridge?.draft.body?.trim() || undefined,
        draftSubject: composeBridge?.draft.subject?.trim() || undefined,
        draftTo: parseRecipientList(composeBridge?.draft.to),
        draftCc: parseRecipientList(composeBridge?.draft.cc),
        draftBcc: parseRecipientList(composeBridge?.draft.bcc),
        attachedEmailLabel: attachedEmailForRequest?.label,
        attachedEmailText: attachedEmailForRequest?.text,
        history: buildAssistantHistoryForRequest(messages),
        preferences: nextPreferences,
      };

      logAssistantRailDebug("assistant:client:send", {
        messageLength: trimmed.length,
        mode,
        hasAttachedEmail: Boolean(attachedEmailForRequest?.text),
      });

      const response = await fetch(appPath("/api/assistant/email"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });
      const payload = await readAssistantApiPayload(response);

      logAssistantRailDebug("assistant response received", {
        ok: response.ok,
        status: response.status,
        mode: payload.mode ?? mode,
        hasText: Boolean(payload.text?.trim()),
        error: payload.error ?? null,
      });

      if (!response.ok || !payload.text) {
        throw new Error(payload.error || "Assistant failed. Try again.");
      }

      await revealAssistantMessage(payload.text ?? "", payload.mode ?? mode);
    } catch (requestError) {
      logAssistantRailDebug("assistant response failed", {
        message: requestError instanceof Error ? requestError.message : "Unknown assistant request error",
      });
      setError(requestError instanceof Error ? requestError.message : "Assistant failed. Try again.");
    } finally {
      setIsLoading(false);
    }
  }

  async function revealAssistantMessage(text: string, mode: AssistantMode) {
    const segments = splitAssistantMessageIntoSentences(text);
    const assistantMessage = createMessage("assistant", "", mode);
    const sequenceId = revealSequenceRef.current + 1;

    revealSequenceRef.current = sequenceId;

    setMessages((current) => [...current, assistantMessage]);

    if (!segments.length) {
      setMessages((current) => current.map((message) => (
        message.id === assistantMessage.id
          ? { ...message, text }
          : message
      )));
      return;
    }

    clearRevealTimeouts(revealTimeoutIdsRef.current);

    for (let index = 0; index < segments.length; index += 1) {
      const delay = getAssistantRevealDelay(segments, index);

      await waitForRevealStep(delay, revealTimeoutIdsRef.current);

      if (revealSequenceRef.current !== sequenceId) {
        return;
      }

      setMessages((current) => current.map((message) => (
        message.id === assistantMessage.id
          ? {
            ...message,
            text: segments.slice(0, index + 1).join(" ").replace(/\s+/g, " ").trim(),
          }
          : message
      )));
    }
  }

  function handleInputChange(event: ChangeEvent<HTMLTextAreaElement>) {
    setInput(event.target.value);
    syncTextareaHeight(event.target);
  }

  async function attachDroppedEmail(event: DragEvent<HTMLElement>) {
    if (!isAssistantDraggedEmailDataTransfer(event.dataTransfer.types)) {
      return false;
    }

    event.preventDefault();
    setIsDropActive(false);
    setAttachmentWarning(null);

    const payload = parseAssistantDraggedEmailPayload(event.dataTransfer.getData(TRON_ASSISTANT_EMAIL_MIME));

    if (!payload?.messageId) {
      setAttachmentWarning("Could not attach email content. You can still send your chat message.");
      return false;
    }

    setIsAttachingEmail(true);

    try {
      const response = await fetch(appPath(`/api/mail/messages/${encodeURIComponent(payload.messageId)}`), {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      });

      const messagePayload = await readAssistantApiPayload(response) as AssistantApiPayload & {
        subject?: string;
        from?: string;
        snippet?: string;
        textBody?: string | null;
        htmlBody?: string | null;
      };

      if (!response.ok) {
        throw new Error(messagePayload.error || "Could not attach email content.");
      }

      const emailText = getAttachedEmailText(messagePayload.textBody, messagePayload.htmlBody, messagePayload.snippet);

      if (!emailText) {
        throw new Error("Could not attach email content.");
      }

      const label = messagePayload.subject?.trim() || payload.subject?.trim() || payload.sender?.trim() || payload.messageId;

      setAttachedEmailContext({
        messageId: payload.messageId,
        label,
        text: emailText,
      });

      return true;
    } catch {
      setAttachmentWarning("Could not attach email content. You can still send your chat message.");
      return false;
    } finally {
      setIsAttachingEmail(false);
    }
  }

  function handleDropZoneEvent(event: DragEvent<HTMLElement>) {
    if (!isAssistantDraggedEmailDataTransfer(event.dataTransfer.types)) {
      return false;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setIsDropActive(true);
    return true;
  }

  function handleDropZoneLeave(event: DragEvent<HTMLElement>) {
    const relatedTarget = event.relatedTarget;

    if (relatedTarget instanceof Node && event.currentTarget.contains(relatedTarget)) {
      return;
    }

    setIsDropActive(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitPrompt();
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-start justify-between gap-3 border-b border-[var(--line)] px-4 py-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">Tron Assistant</p>
          <h2 className="mt-2 text-lg font-semibold text-[var(--text)]">Assistant</h2>
        </div>
        <div className="flex items-center gap-1">
          <button
            aria-label="Reset assistant chat"
            className="inline-flex h-10 items-center justify-center rounded-full px-3 text-xs text-[var(--text-muted)] transition hover:bg-[var(--surface-overlay)] hover:text-[var(--text)]"
            onClick={resetConversation}
            type="button"
          >
            Reset
          </button>
          {showClose ? (
            <button
              aria-label="Close assistant"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[var(--text-muted)] transition hover:bg-[var(--surface-overlay)] hover:text-[var(--text)]"
              onClick={onClose}
              type="button"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <div
          className={cn("relative flex-1 overflow-y-auto px-4 py-4 transition-colors", isDropActive ? "bg-[var(--surface-overlay)]" : "")}
          data-testid="assistant-messages"
          onDragEnter={(event) => void handleDropZoneEvent(event)}
          onDragLeave={handleDropZoneLeave}
          onDragOver={(event) => void handleDropZoneEvent(event)}
          onDrop={(event) => void attachDroppedEmail(event)}
        >
          <div className="space-y-3">
            {messages.map((message) => (
              <AssistantBubble key={message.id} message={message} />
            ))}
            {isDropActive ? (
              <div className="rounded-[18px] border border-dashed border-[var(--line)] bg-[var(--surface-overlay)] px-3 py-2 text-sm text-[var(--text)]">
                Drop email here to attach its contents to your next message
              </div>
            ) : null}
            {isAttachingEmail ? (
              <div className="flex justify-start">
                <div className="inline-flex items-center gap-2 rounded-[18px] border border-[var(--line)] bg-[var(--surface-overlay)] px-3 py-2 text-sm text-[var(--text-muted)]">
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  Attaching email...
                </div>
              </div>
            ) : null}
            {isLoading ? (
              <div className="flex justify-start">
                <div className="inline-flex items-center gap-2 rounded-[18px] border border-[var(--line)] bg-[var(--surface-overlay)] px-3 py-2 text-sm text-[var(--text-muted)]">
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  Writing...
                </div>
              </div>
            ) : null}
            {error ? (
              <div className="flex justify-start">
                <div className="max-w-[80%] rounded-[18px] border border-[var(--accent-strong)] bg-[var(--surface-overlay)] px-3 py-2 text-sm text-[var(--text)]">
                  {error}
                </div>
              </div>
            ) : null}
            {attachmentWarning ? (
              <div className="flex justify-start">
                <div className="max-w-[80%] rounded-[18px] border border-[var(--accent-secondary)] bg-[var(--surface-overlay)] px-3 py-2 text-sm text-[var(--accent-secondary)]">
                  {attachmentWarning}
                </div>
              </div>
            ) : null}
            <div ref={messageEndRef} />
          </div>
        </div>

        <div
          className={cn("border-t border-[var(--line)] px-4 py-4 transition-colors", isDropActive ? "bg-[var(--surface-overlay)]" : "")}
          data-testid="assistant-input-drop-zone"
          onDragEnter={(event) => void handleDropZoneEvent(event)}
          onDragLeave={handleDropZoneLeave}
          onDragOver={(event) => void handleDropZoneEvent(event)}
          onDrop={(event) => void attachDroppedEmail(event)}
        >
          <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
            {attachedEmailContext ? (
              <div className="flex flex-wrap gap-2" data-testid="assistant-context-chips">
                <div
                  className="inline-flex max-w-full items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--surface-overlay)] px-3 py-2 text-xs text-[var(--text)]"
                  data-testid={`assistant-context-chip-${attachedEmailContext.messageId}`}
                >
                  <Paperclip className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]" />
                  <span className="truncate">Attached email: {attachedEmailContext.label}</span>
                  <button
                    aria-label={`Remove ${attachedEmailContext.label} attachment`}
                    className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[var(--text-muted)] transition hover:bg-[var(--surface-overlay)] hover:text-[var(--text)]"
                    onClick={() => setAttachedEmailContext(null)}
                    type="button"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ) : null}
            <textarea
              className="h-[3.125rem] max-h-40 w-full resize-none overflow-hidden rounded-[20px] border border-[var(--line)] bg-[var(--surface-overlay)] px-4 py-[0.8125rem] text-sm leading-6 text-[var(--text)] placeholder:text-[var(--text-muted)] focus:border-[var(--line)] focus:outline-none"
              onChange={handleInputChange}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void submitPrompt();
                }
              }}
              placeholder="Summarize this email for me"
              ref={inputRef}
              rows={1}
              value={input}
            />
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-[var(--text-muted)]">
                {attachedEmailContext
                  ? `Using attached email context: ${attachedEmailContext.label}.`
                  : composeBridge?.draft.body?.trim()
                  ? "Using current draft context."
                  : "Chatting with Tron Assistant."}
              </p>
              <button
                className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-[var(--line)] bg-[var(--surface-overlay)] px-4 text-sm text-[var(--text)] transition hover:border-[var(--line)] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isLoading || !input.trim()}
                type="submit"
              >
                {isLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 text-[var(--accent)]" />}
                {isLoading ? "Working..." : "Ask"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function AssistantBubble({ message }: { message: AssistantMessage }) {
  const { composeBridge } = useAssistantRail();
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");
  const canReplaceDraft = Boolean(composeBridge?.replaceDraft) && canApplyToCompose(message.mode);
  const canInsertIntoDraft = Boolean(composeBridge?.insertIntoDraft) && canApplyToCompose(message.mode);

  async function handleCopy() {
    await navigator.clipboard.writeText(message.text);
    setCopyState("copied");
    window.setTimeout(() => setCopyState("idle"), 1_500);
  }

  return (
    <div className={cn("flex w-full", message.role === "user" ? "justify-end" : "justify-start")} data-testid={`assistant-bubble-${message.role}`}>
      <div
        className={cn(
          "w-fit max-w-[80%] rounded-[20px] px-3 py-3 text-sm",
          message.role === "user"
            ? "ml-auto border border-[var(--line)] bg-[var(--surface-overlay)] text-[var(--text)]"
            : "border border-[var(--line)] bg-[var(--surface-overlay)] text-[var(--text)]",
        )}
      >
        {message.attachedEmail ? (
          <div className="mb-3 flex flex-wrap gap-2" data-testid={`assistant-message-attachment-${message.id}`}>
            <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--surface-overlay)] px-3 py-1.5 text-xs text-inherit">
              <Paperclip className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">Attached email: {message.attachedEmail.label}</span>
            </div>
          </div>
        ) : null}
        <p className="whitespace-pre-wrap break-words">{message.text}</p>
        {message.role === "assistant" && !message.localOnly ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              className="inline-flex items-center gap-1 rounded-full border border-[var(--line)] px-3 py-1.5 text-xs text-[var(--text)] transition hover:border-[var(--line)]"
              onClick={() => void handleCopy()}
              type="button"
            >
              <Copy className="h-3.5 w-3.5" />
              {copyState === "copied" ? "Copied" : "Copy"}
            </button>
            {canInsertIntoDraft && composeBridge ? (
              <button
                className="inline-flex items-center gap-1 rounded-full border border-[var(--line)] px-3 py-1.5 text-xs text-[var(--text)] transition hover:border-[var(--line)]"
                onClick={() => composeBridge.insertIntoDraft(message.text)}
                type="button"
              >
                Insert into compose
              </button>
            ) : null}
            {canReplaceDraft && composeBridge ? (
              <button
                className="inline-flex items-center gap-1 rounded-full border border-[var(--line)] px-3 py-1.5 text-xs text-[var(--text)] transition hover:border-[var(--line)]"
                onClick={() => composeBridge.replaceDraft(applyAssistantTextToDraft(composeBridge.draft, message.text))}
                type="button"
              >
                Replace draft
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

async function readAssistantApiPayload(response: Response): Promise<AssistantApiPayload> {
  const contentType = typeof response.headers?.get === "function"
    ? response.headers.get("content-type") ?? ""
    : "";

  if (contentType.includes("application/json") || typeof response.json === "function") {
    try {
      return (await response.json()) as AssistantApiPayload;
    } catch {
      // Fall through to text parsing below when the response body is not valid JSON.
    }
  }

  try {
    const text = await response.text();
    return text.trim() ? { error: text.trim() } : {};
  } catch {
    return {};
  }
}

function getAttachedEmailText(textBody?: string | null, htmlBody?: string | null, snippet?: string | null) {
  const preferred = textBody?.trim() || stripHtml(htmlBody) || snippet?.trim() || "";

  if (!preferred) {
    return "";
  }

  return preferred.length > 8_000 ? `${preferred.slice(0, 7_999)}…` : preferred;
}

function stripHtml(value?: string | null) {
  if (!value) {
    return "";
  }

  if (typeof DOMParser === "undefined") {
    return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }

  const document = new DOMParser().parseFromString(value, "text/html");
  return document.body.textContent?.replace(/\s+/g, " ").trim() ?? "";
}

function splitAssistantMessageIntoSentences(text: string) {
  const normalized = text.trim();

  if (!normalized) {
    return [];
  }

  const sentenceMatches = normalized
    .replace(/\n{2,}/g, "\n")
    .match(/[^.!?\n]+[.!?]+(?:["')\]]+)?|[^.!?\n]+$/g)
    ?.map((segment) => segment.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  if (!sentenceMatches?.length || sentenceMatches.length === 1) {
    return [normalized];
  }

  return sentenceMatches;
}

function clearRevealTimeouts(timeoutIds: number[]) {
  timeoutIds.forEach((timeoutId) => window.clearTimeout(timeoutId));
  timeoutIds.length = 0;
}

function waitForRevealStep(delayMs: number, timeoutIds: number[]) {
  if (delayMs <= 0) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    const timeoutId = window.setTimeout(() => {
      const timeoutIndex = timeoutIds.indexOf(timeoutId);

      if (timeoutIndex >= 0) {
        timeoutIds.splice(timeoutIndex, 1);
      }

      resolve();
    }, delayMs);

    timeoutIds.push(timeoutId);
  });
}

function getAssistantRevealDelay(segments: string[], index: number) {
  if (segments.length === 1) {
    return ASSISTANT_SHORT_REPLY_REVEAL_DELAY_MS;
  }

  if (index === 0) {
    return ASSISTANT_SHORT_REPLY_REVEAL_DELAY_MS;
  }

  return ASSISTANT_SENTENCE_REVEAL_DELAY_MS;
}

function syncTextareaHeight(textarea: HTMLTextAreaElement | null) {
  if (!textarea) {
    return;
  }

  textarea.style.height = "auto";
  const nextHeight = Math.min(textarea.scrollHeight, 160);
  textarea.style.height = `${Math.max(nextHeight, 50)}px`;
  textarea.style.overflowY = textarea.scrollHeight > 160 ? "auto" : "hidden";
}

function readPersistedAssistantState(storageKey: string): PersistedAssistantState {
  if (typeof window === "undefined" || typeof window.localStorage?.getItem !== "function") {
    return {
      messages: [],
      preferences: DEFAULT_ASSISTANT_PREFERENCES,
    };
  }

  try {
    const raw = window.localStorage.getItem(storageKey);

    if (!raw) {
      return {
        messages: [],
        preferences: DEFAULT_ASSISTANT_PREFERENCES,
      };
    }

    const parsed = JSON.parse(raw) as Partial<PersistedAssistantState>;

    return {
      messages: Array.isArray(parsed.messages)
        ? parsed.messages
            .filter((message): message is AssistantMessage => Boolean(
              message &&
              typeof message === "object" &&
              (message.role === "user" || message.role === "assistant") &&
              typeof message.text === "string",
            ))
            .slice(-ASSISTANT_MAX_MESSAGE_HISTORY)
        : [],
      preferences: {
        ...DEFAULT_ASSISTANT_PREFERENCES,
        ...(parsed.preferences ?? {}),
      },
    };
  } catch {
    return {
      messages: [],
      preferences: DEFAULT_ASSISTANT_PREFERENCES,
    };
  }
}

function buildAssistantHistoryForRequest(messages: AssistantMessage[]): AssistantConversationTurn[] {
  return messages
    .filter((message) => !message.localOnly && message.text.trim())
    .slice(-ASSISTANT_MAX_MESSAGE_HISTORY)
    .map((message) => ({
      role: message.role,
      text: message.text,
      attachedEmailLabel: message.attachedEmail?.label ?? null,
    }));
}

function mergeAssistantPreferences(
  current: AssistantUserPreferences,
  updates: Partial<AssistantUserPreferences>,
): AssistantUserPreferences {
  return {
    ...current,
    ...Object.fromEntries(Object.entries(updates).filter(([, value]) => value !== undefined)),
  };
}

function inferAssistantPreferences(message: string, mode: AssistantMode): Partial<AssistantUserPreferences> {
  const normalized = message.trim().toLowerCase();
  const updates: Partial<AssistantUserPreferences> = {};

  if (/\b(concise|brief|short|shorter)\b/.test(normalized)) {
    updates.prefersConcise = true;
  }

  if (/\b(detailed|detail|longer|more context)\b/.test(normalized)) {
    updates.prefersConcise = false;
  }

  if (/\b(direct|straight to the point|just answer)\b/.test(normalized)) {
    updates.wantsDirectAnswers = true;
  }

  if (mode === "reply" || mode === "rewrite" || mode === "compose") {
    updates.likesDraftEmailHelp = true;
  }

  return updates;
}

function canApplyToCompose(mode?: AssistantMode) {
  return mode === "reply" || mode === "rewrite" || mode === "compose";
}

function applyAssistantTextToDraft(currentDraft: ComposeDraftValues, assistantText: string): ComposeDraftValues {
  const parsed = parseAssistantDraft(assistantText);

  return {
    ...currentDraft,
    subject: parsed.subject ?? currentDraft.subject ?? "",
    body: parsed.body,
  };
}

function parseAssistantDraft(text: string) {
  const normalized = text.trim();
  const subjectMatch = normalized.match(/^Subject:\s*(.+)$/im);
  const bodyMatch = normalized.match(/(?:^Body:\s*\n?)([\s\S]+)$/im);

  return {
    subject: subjectMatch?.[1]?.trim(),
    body: bodyMatch?.[1]?.trim() || normalized,
  };
}

function extractThreadId(pathname: string) {
  const match = /^\/mail\/thread\/([^/]+)/.exec(pathname);
  return match?.[1] ?? null;
}

function inferAssistantMode(message: string, hasDraft: boolean): AssistantMode {
  const normalized = message.trim().toLowerCase();

  if (/\b(summarize|summary|what is this email about|what do they want|action items)\b/.test(normalized)) {
    return "summarize";
  }

  if (hasDraft && /\b(shorter|professional|warmer|direct|grammar|less aggressive|rewrite|reword|fix)\b/.test(normalized)) {
    return "rewrite";
  }

  if (/\b(reply|respond|decline|interested|ask for more information|write a professional reply)\b/.test(normalized)) {
    return "reply";
  }

  if (/\b(write an email|draft a follow-up|cold email|complaint email|compose)\b/.test(normalized)) {
    return "compose";
  }

  return "chat";
}

function parseRecipientList(value?: string) {
  const recipients = value
    ?.split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  return recipients?.length ? recipients : undefined;
}
