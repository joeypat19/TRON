"use client";

import {
  ChevronDown,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Maximize2,
  Minus,
  MoreHorizontal,
  Paperclip,
  PenTool,
  SendHorizonal,
  SmilePlus,
  Sparkles,
  Trash2,
  Type,
  Underline,
  X,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
  Eraser,
  Check,
} from "lucide-react";
import {
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useRouter } from "next/navigation";
import { discardDraftAction, saveDraftAction, sendMessageAction } from "@/app/mail/actions";
import { COMPOSE_ASSISTANT_PANEL_WIDTH, useAssistantRail } from "@/components/mail/assistant-rail";
import { appPath } from "@/lib/app-path";
import { BrandButton } from "@/components/ui/brand-button";
import { BrandInput } from "@/components/ui/brand-input";
import type { ProviderComposeAttachment } from "@/lib/mail/providers/types";
import { cn } from "@/lib/utils";

const DEFAULT_FULLSCREEN_STORAGE_KEY = "troninbox-compose-default-fullscreen";
const MAX_ATTACHMENT_SIZE_BYTES = 5 * 1024 * 1024;
const EMOJI_OPTIONS = ["😀", "😂", "🙂", "😉", "😍", "🙏", "👍", "🎉", "🔥", "✨", "❤️", "✅"];

export type ComposeDraftAttachment = ProviderComposeAttachment & {
  id: string;
  previewUrl?: string;
};

export type ComposeDraftValues = {
  to?: string;
  cc?: string;
  bcc?: string;
  subject?: string;
  body?: string;
  bodyHtml?: string;
  plainTextMode?: boolean;
  attachments?: ComposeDraftAttachment[];
};

type ComposeFormProps = {
  draftId?: string;
  defaultValues?: ComposeDraftValues;
  activeMailboxEmail?: string | null;
  mode?: "page" | "modal";
  onCancel?: () => void;
  onDraftChange?: (draft: ComposeDraftValues) => void;
  onMinimizedChange?: (isMinimized: boolean) => void;
  onSent?: () => void;
};

type ComposeActionState = {
  error: string;
  success: string;
  draftId: string;
};

type LinkDialogState = {
  open: boolean;
  href: string;
  text: string;
};

const initialState: ComposeActionState = {
  error: "",
  success: "",
  draftId: "",
};

export function ComposeForm({
  draftId,
  defaultValues,
  activeMailboxEmail,
  mode = "page",
  onCancel,
  onDraftChange,
  onMinimizedChange,
  onSent,
}: ComposeFormProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const plainTextRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const drawingCanvasRef = useRef<HTMLCanvasElement>(null);
  const editorViewportRef = useRef<HTMLDivElement>(null);
  const savedSelectionRef = useRef<Range | null>(null);
  const isDrawingRef = useRef(false);
  const [showCc, setShowCc] = useState(Boolean(defaultValues?.cc));
  const [showBcc, setShowBcc] = useState(Boolean(defaultValues?.bcc));
  const [showFormatting, setShowFormatting] = useState(false);
  const [showSendMenu, setShowSendMenu] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [linkDialog, setLinkDialog] = useState<LinkDialogState>({ open: false, href: "", text: "" });
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [spellCheckEnabled, setSpellCheckEnabled] = useState(true);
  const [isMinimized, setIsMinimized] = useState(false);
  const [defaultFullscreen, setDefaultFullscreen] = useState(readDefaultFullscreenPreference);
  const { openAssistant, syncComposeDraft, clearComposeDraft, presentation, isOpen: isAssistantOpen } = useAssistantRail();
  const [isFullscreen, setIsFullscreen] = useState(defaultFullscreen);
  const [localError, setLocalError] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<ComposeDraftAttachment[]>(defaultValues?.attachments ?? []);
  const [plainTextMode, setPlainTextMode] = useState(defaultValues?.plainTextMode ?? false);
  const [values, setValues] = useState<ComposeDraftValues>(() => {
    const initialBody = defaultValues?.body ?? "";
    const initialHtml = defaultValues?.bodyHtml ?? (looksLikeHtml(initialBody) ? initialBody : escapeHtmlWithBreaks(initialBody));

    return {
      to: defaultValues?.to ?? "",
      cc: defaultValues?.cc ?? "",
      bcc: defaultValues?.bcc ?? "",
      subject: defaultValues?.subject ?? "",
      body: looksLikeHtml(initialBody) ? extractTextFromHtml(initialBody) : initialBody,
      bodyHtml: initialHtml,
      plainTextMode: defaultValues?.plainTextMode ?? false,
      attachments: defaultValues?.attachments ?? [],
    };
  });
  const [sendState, sendAction, sendPending] = useActionState(sendMessageAction, initialState);
  const [draftState, draftAction, draftPending] = useActionState(saveDraftAction, initialState);

  const draftSnapshot = useMemo<ComposeDraftValues>(() => ({
    to: values.to ?? "",
    cc: values.cc ?? "",
    bcc: values.bcc ?? "",
    subject: values.subject ?? "",
    body: values.body ?? "",
    bodyHtml: values.bodyHtml ?? "",
    plainTextMode,
    attachments,
  }), [attachments, plainTextMode, values]);
  const preparedHtmlBody = useMemo(
    () => (plainTextMode ? "" : replaceInlineAssetSources(values.bodyHtml ?? "", attachments)),
    [attachments, plainTextMode, values.bodyHtml],
  );
  const attachmentsJson = useMemo(
    () =>
      JSON.stringify(
        attachments.map((attachment) => ({
          filename: attachment.filename,
          mimeType: attachment.mimeType,
          contentBase64: attachment.contentBase64,
          inline: attachment.inline,
          contentId: attachment.contentId,
        })),
      ),
    [attachments],
  );
  const isComposeOverlay = isAssistantOpen && presentation === "compose-overlay";

  useEffect(() => {
    if (!plainTextMode && editorRef.current && editorRef.current.innerHTML !== (values.bodyHtml ?? "")) {
      editorRef.current.innerHTML = values.bodyHtml ?? "";
    }
  }, [plainTextMode, values.bodyHtml]);

  useEffect(() => {
    if (sendState.success) {
      router.refresh();
      onSent?.();

      if (!onSent) {
        router.push(appPath("/mail/inbox"));
      }
    }
  }, [onSent, router, sendState.success]);

  useEffect(() => {
    if (draftState.success && draftState.draftId) {
      const form = formRef.current;
      const draftField = form?.elements.namedItem("draftId") as HTMLInputElement | null;

      if (draftField) {
        draftField.value = draftState.draftId;
      }
    }
  }, [draftState.draftId, draftState.success]);

  useEffect(() => {
    onDraftChange?.(draftSnapshot);
  }, [draftSnapshot, onDraftChange]);

  useEffect(() => {
    onMinimizedChange?.(isMinimized);
  }, [isMinimized, onMinimizedChange]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.localStorage?.setItem !== "function") {
      return;
    }

    window.localStorage.setItem(DEFAULT_FULLSCREEN_STORAGE_KEY, String(defaultFullscreen));
  }, [defaultFullscreen]);

  const applyDraftValues = useCallback((nextDraft: ComposeDraftValues) => {
    const nextPlainTextMode = nextDraft.plainTextMode ?? plainTextMode;
    const nextBody = nextDraft.body ?? "";
    const nextHtml = nextDraft.bodyHtml ?? (nextPlainTextMode ? escapeHtmlWithBreaks(nextBody) : escapeHtmlWithBreaks(nextBody));

    setValues({
      to: nextDraft.to ?? "",
      cc: nextDraft.cc ?? "",
      bcc: nextDraft.bcc ?? "",
      subject: nextDraft.subject ?? "",
      body: nextBody,
      bodyHtml: nextHtml,
      plainTextMode: nextPlainTextMode,
      attachments: nextDraft.attachments ?? attachments,
    });
    setPlainTextMode(nextPlainTextMode);
    if (nextDraft.attachments) {
      setAttachments(nextDraft.attachments);
    }
    setShowCc(Boolean(nextDraft.cc));
    setShowBcc(Boolean(nextDraft.bcc));
  }, [attachments, plainTextMode]);

  const updateField = useCallback((field: keyof ComposeDraftValues, value: string) => {
    setValues((current) => ({
      ...current,
      [field]: value,
    }));
  }, []);

  const syncEditorStateFromDom = useCallback(() => {
    if (!editorRef.current) {
      return;
    }

    const html = normalizeEditorHtml(editorRef.current.innerHTML);
    const text = extractTextFromHtml(html);

    setValues((current) => ({
      ...current,
      body: text,
      bodyHtml: html,
    }));
  }, []);

  function saveSelection() {
    const selection = window.getSelection();

    if (!selection?.rangeCount) {
      return;
    }

    const range = selection.getRangeAt(0);

    if (editorRef.current?.contains(range.commonAncestorContainer)) {
      savedSelectionRef.current = range.cloneRange();
    }
  }

  const focusEditor = useCallback(() => {
    if (plainTextMode) {
      plainTextRef.current?.focus();
      return;
    }

    editorRef.current?.focus();
  }, [plainTextMode]);

  const restoreSelection = useCallback(() => {
    if (plainTextMode) {
      return;
    }

    const selection = window.getSelection();

    if (!selection || !editorRef.current) {
      return;
    }

    selection.removeAllRanges();

    if (savedSelectionRef.current) {
      selection.addRange(savedSelectionRef.current);
      return;
    }

    const range = document.createRange();
    range.selectNodeContents(editorRef.current);
    range.collapse(false);
    selection.addRange(range);
  }, [plainTextMode]);

  function runEditorCommand(command: string, value?: string) {
    if (plainTextMode || typeof document.execCommand !== "function") {
      return;
    }

    focusEditor();
    restoreSelection();
    document.execCommand(command, false, value);
    syncEditorStateFromDom();
  }

  const insertHtmlAtCursor = useCallback((html: string) => {
    if (plainTextMode || !editorRef.current) {
      return;
    }

    focusEditor();
    restoreSelection();
    document.execCommand("insertHTML", false, html);
    syncEditorStateFromDom();
  }, [focusEditor, plainTextMode, restoreSelection, syncEditorStateFromDom]);

  const insertTextAtCursor = useCallback((text: string) => {
    if (plainTextMode && plainTextRef.current) {
      const textarea = plainTextRef.current;
      const start = textarea.selectionStart ?? textarea.value.length;
      const end = textarea.selectionEnd ?? textarea.value.length;
      const nextValue = `${textarea.value.slice(0, start)}${text}${textarea.value.slice(end)}`;

      textarea.value = nextValue;
      textarea.selectionStart = textarea.selectionEnd = start + text.length;
      updateField("body", nextValue);
      return;
    }

    insertHtmlAtCursor(text.replace(/\n/g, "<br />"));
  }, [insertHtmlAtCursor, plainTextMode, updateField]);

  const insertAssistantDraft = useCallback((assistantText: string) => {
    const parsed = parseAssistantDraft(assistantText);

    if (!values.subject?.trim() && parsed.subject) {
      updateField("subject", parsed.subject);
    }

    insertTextAtCursor(`\n${parsed.body}`.trimStart());
  }, [insertTextAtCursor, updateField, values.subject]);

  useEffect(() => {
    syncComposeDraft(
      draftSnapshot,
      (nextDraft) => {
        applyDraftValues(nextDraft);
      },
      (assistantText) => {
        insertAssistantDraft(assistantText);
      },
    );

    return () => {
      clearComposeDraft();
    };
  }, [applyDraftValues, clearComposeDraft, draftSnapshot, insertAssistantDraft, syncComposeDraft]);

  async function readFiles(files: FileList | null, inline: boolean) {
    if (!files?.length) {
      return;
    }

    setLocalError(null);
    const nextAttachments: ComposeDraftAttachment[] = [];

    for (const file of Array.from(files)) {
      if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
        setLocalError(`${file.name} is larger than 5 MB.`);
        continue;
      }

      const dataUrl = await readFileAsDataUrl(file);
      const base64 = dataUrl.split(",")[1] ?? "";
      const assetId = `asset-${createComposeId()}`;
      const contentId = `tron-${assetId}@compose`;

      nextAttachments.push({
        id: assetId,
        filename: file.name,
        mimeType: file.type || "application/octet-stream",
        contentBase64: base64,
        inline,
        contentId,
        previewUrl: dataUrl,
      });

      if (inline) {
        insertHtmlAtCursor(
          `<img alt="${escapeAttribute(file.name)}" data-compose-asset-id="${assetId}" src="${dataUrl}" style="max-width: 100%; border-radius: 12px; margin: 8px 0;" />`,
        );
      }
    }

    if (nextAttachments.length) {
      setAttachments((current) => [...current, ...nextAttachments]);
    }
  }

  function removeAttachment(id: string) {
    setAttachments((current) => current.filter((attachment) => attachment.id !== id));

    if (!plainTextMode && editorRef.current) {
      editorRef.current
        .querySelectorAll(`[data-compose-asset-id="${id}"]`)
        .forEach((node) => node.remove());
      syncEditorStateFromDom();
    }
  }

  function openLinkDialog() {
    if (plainTextMode) {
      return;
    }

    saveSelection();
    const selection = window.getSelection();
    const selectedText = selection?.toString().trim() ?? "";

    setLinkDialog({
      open: true,
      href: "https://",
      text: selectedText,
    });
  }

  function applyLink() {
    const sanitizedHref = sanitizeUrl(linkDialog.href);

    if (!sanitizedHref) {
      setLocalError("Enter a valid URL.");
      return;
    }

    setLocalError(null);

    if (linkDialog.text.trim()) {
      insertHtmlAtCursor(`<a href="${escapeAttribute(sanitizedHref)}">${escapeHtml(linkDialog.text.trim())}</a>`);
    } else {
      runEditorCommand("createLink", sanitizedHref);
    }

    setLinkDialog({ open: false, href: "", text: "" });
  }

  function togglePlainTextMode() {
    if (plainTextMode) {
      const nextHtml = escapeHtmlWithBreaks(values.body ?? "");
      setValues((current) => ({
        ...current,
        bodyHtml: nextHtml,
      }));
      setPlainTextMode(false);
      return;
    }

    setValues((current) => ({
      ...current,
      body: extractTextFromHtml(current.bodyHtml ?? ""),
    }));
    setPlainTextMode(true);
    setShowFormatting(false);
    setShowEmojiPicker(false);
    setShowMoreOptions(false);
    setIsDrawingMode(false);
  }

  function handleCloseRequest() {
    if (hasDraftContent(draftSnapshot)) {
      const confirmed = window.confirm("Close this draft? Unsaved content will be lost.");

      if (!confirmed) {
        return;
      }
    }

    onCancel?.();
  }

  function handleDiscard(event?: MouseEvent<HTMLButtonElement>) {
    if (hasDraftContent(draftSnapshot) && !window.confirm("Discard this draft? Unsaved content will be lost.")) {
      event?.preventDefault();
      return;
    }

    if (!draftId) {
      event?.preventDefault();
      onCancel?.();
    }
  }

  function toggleDrawingMode() {
    if (plainTextMode) {
      return;
    }

    setIsDrawingMode((current) => !current);
    window.setTimeout(() => resizeDrawingCanvas(), 0);
  }

  function resizeDrawingCanvas() {
    const canvas = drawingCanvasRef.current;
    const container = editorViewportRef.current;

    if (!canvas || !container) {
      return;
    }

    const rect = container.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    const context = canvas.getContext("2d");

    if (!context) {
      return;
    }

    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim();
    context.lineWidth = 3;
  }

  function getCanvasPoint(event: ReactPointerEvent<HTMLCanvasElement>) {
    const rect = drawingCanvasRef.current?.getBoundingClientRect();

    if (!rect) {
      return { x: 0, y: 0 };
    }

    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }

  function startDrawing(event: ReactPointerEvent<HTMLCanvasElement>) {
    const context = drawingCanvasRef.current?.getContext("2d");

    if (!context) {
      return;
    }

    const point = getCanvasPoint(event);
    isDrawingRef.current = true;
    context.beginPath();
    context.moveTo(point.x, point.y);
  }

  function drawStroke(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!isDrawingRef.current) {
      return;
    }

    const context = drawingCanvasRef.current?.getContext("2d");

    if (!context) {
      return;
    }

    const point = getCanvasPoint(event);
    context.lineTo(point.x, point.y);
    context.stroke();
  }

  function stopDrawing() {
    isDrawingRef.current = false;
  }

  function clearDrawing() {
    const canvas = drawingCanvasRef.current;
    const context = canvas?.getContext("2d");

    if (!canvas || !context) {
      return;
    }

    context.clearRect(0, 0, canvas.width, canvas.height);
  }

  async function finishDrawing() {
    const canvas = drawingCanvasRef.current;

    if (!canvas) {
      return;
    }

    const dataUrl = canvas.toDataURL("image/png");
    const base64 = dataUrl.split(",")[1] ?? "";
    const assetId = `drawing-${createComposeId()}`;
    const contentId = `tron-${assetId}@compose`;

    setAttachments((current) => [
      ...current,
      {
        id: assetId,
        filename: "drawing.png",
        mimeType: "image/png",
        contentBase64: base64,
        inline: true,
        contentId,
        previewUrl: dataUrl,
      },
    ]);

    insertHtmlAtCursor(
      `<img alt="Drawing" data-compose-asset-id="${assetId}" src="${dataUrl}" style="max-width: 100%; border-radius: 12px; margin: 8px 0;" />`,
    );
    clearDrawing();
    setIsDrawingMode(false);
  }

  const modalFrameClassName = cn(
    "relative flex w-full flex-col overflow-hidden rounded-[24px] border border-[var(--line)] bg-[var(--surface-overlay)] shadow-[0_30px_90px_var(--shadow-color),0_0_42px_var(--accent-glow)]",
    mode === "modal"
      ? isFullscreen
        ? "h-[calc(100vh-2rem)] max-w-none"
        : "max-h-[86vh] max-w-4xl"
      : "brand-panel-strong mx-auto max-w-4xl",
  );

  if (isMinimized && mode === "modal") {
    return (
      <div
        data-testid="minimized-compose-bar"
        className="fixed bottom-4 z-[70] w-[20rem] overflow-hidden rounded-[20px] border border-[var(--line)] bg-[var(--surface-overlay)] shadow-[0_18px_50px_var(--shadow-color)]"
        style={isComposeOverlay ? { right: `calc(${COMPOSE_ASSISTANT_PANEL_WIDTH} + 1rem)` } : { right: "1rem" }}
      >
        <button
          className="flex w-full items-center justify-between px-4 py-3 text-left"
          onClick={() => setIsMinimized(false)}
          type="button"
        >
          <div>
            <div className="text-sm font-medium text-[var(--text)]">{values.subject?.trim() || "New Message"}</div>
            <div className="text-xs text-[var(--text-muted)]">{values.to?.trim() || "Draft preserved"}</div>
          </div>
          <div className="flex items-center gap-2 text-[var(--text-muted)]">
            <Maximize2 className="h-4 w-4" />
          </div>
        </button>
      </div>
    );
  }

  return (
    <form
      aria-modal={mode === "modal" ? true : undefined}
      action={sendAction}
      className={modalFrameClassName}
      ref={formRef}
      role={mode === "modal" ? "dialog" : undefined}
    >
      <input defaultValue={draftId} name="draftId" type="hidden" />
      <input name="body" type="hidden" value={values.body ?? ""} />
      <input name="bodyHtml" type="hidden" value={preparedHtmlBody} />
      <input name="plainTextMode" type="hidden" value={String(plainTextMode)} />
      <input name="attachmentsJson" type="hidden" value={attachmentsJson} />

      <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
        <div>
          <h2 className="text-base font-semibold text-[var(--text)]">New Message</h2>
          {activeMailboxEmail ? <p className="mt-1 text-xs text-[var(--text-muted)]">{activeMailboxEmail}</p> : null}
        </div>
        <div className="flex items-center gap-1">
          <button
            aria-label="Minimize compose"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[var(--text-muted)] transition hover:bg-[var(--surface-overlay)] hover:text-[var(--text)]"
            onClick={() => setIsMinimized(true)}
            type="button"
          >
            <Minus className="h-4 w-4" />
          </button>
          <button
            aria-label={isFullscreen ? "Exit full screen" : "Full screen"}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[var(--text-muted)] transition hover:bg-[var(--surface-overlay)] hover:text-[var(--text)]"
            onClick={() => setIsFullscreen((current) => !current)}
            type="button"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
          <button
            aria-label="Close compose"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[var(--text-muted)] transition hover:bg-[var(--surface-overlay)] hover:text-[var(--text)]"
            onClick={handleCloseRequest}
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="border-b border-[var(--line)] px-4">
          <div className="flex min-h-12 items-center gap-3 border-b border-[var(--line)] transition-colors">
            <span className="w-12 text-sm text-[var(--text-muted)]">To</span>
            <input
              aria-label="To"
              className="h-12 flex-1 border-0 border-transparent bg-transparent px-0 py-0 text-sm text-[var(--text)] outline-none ring-0 ring-offset-0 placeholder:text-[var(--text-muted)] focus:border-transparent focus:outline-none focus:ring-0 focus:ring-offset-0 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
              name="to"
              onChange={(event) => updateField("to", event.target.value)}
              placeholder=""
              required
              value={values.to}
            />
            <button
              className="rounded-full px-2 py-1 text-xs text-[var(--accent)] focus:outline-none focus-visible:bg-[var(--surface-overlay)] focus-visible:outline-none"
              onClick={() => setShowCc(true)}
              type="button"
            >
              Cc
            </button>
            <button
              className="rounded-full px-2 py-1 text-xs text-[var(--accent)] focus:outline-none focus-visible:bg-[var(--surface-overlay)] focus-visible:outline-none"
              onClick={() => setShowBcc(true)}
              type="button"
            >
              Bcc
            </button>
          </div>

          {showCc ? (
            <div className="flex min-h-12 items-center gap-3 border-b border-[var(--line)] transition-colors">
              <span className="w-12 text-sm text-[var(--text-muted)]">Cc</span>
              <input
                aria-label="Cc"
                className="h-12 flex-1 border-0 border-transparent bg-transparent px-0 py-0 text-sm text-[var(--text)] outline-none ring-0 ring-offset-0 placeholder:text-[var(--text-muted)] focus:border-transparent focus:outline-none focus:ring-0 focus:ring-offset-0 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
                name="cc"
                onChange={(event) => updateField("cc", event.target.value)}
                placeholder=""
                value={values.cc}
              />
            </div>
          ) : null}

          {showBcc ? (
            <div className="flex min-h-12 items-center gap-3 transition-colors">
              <span className="w-12 text-sm text-[var(--text-muted)]">Bcc</span>
              <input
                aria-label="Bcc"
                className="h-12 flex-1 border-0 border-transparent bg-transparent px-0 py-0 text-sm text-[var(--text)] outline-none ring-0 ring-offset-0 placeholder:text-[var(--text-muted)] focus:border-transparent focus:outline-none focus:ring-0 focus:ring-offset-0 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
                name="bcc"
                onChange={(event) => updateField("bcc", event.target.value)}
                placeholder=""
                value={values.bcc}
              />
            </div>
          ) : null}
        </div>

        <div className="border-b border-[var(--line)] px-4">
          <input
            aria-label="Subject"
            className="h-12 w-full border-0 border-transparent bg-transparent px-0 py-0 text-sm text-[var(--text)] outline-none ring-0 ring-offset-0 placeholder:text-[var(--text-muted)] focus:border-transparent focus:outline-none focus:ring-0 focus:ring-offset-0 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
            name="subject"
            onChange={(event) => updateField("subject", event.target.value)}
            placeholder="Subject"
            value={values.subject}
          />
        </div>

        <div className="relative flex min-h-0 flex-1 flex-col px-4 py-4">
          <div className="relative min-h-0 flex-1 overflow-hidden" ref={editorViewportRef}>
            {plainTextMode ? (
              <textarea
                aria-label="Body"
                className="h-full min-h-[24rem] w-full resize-none border-0 border-transparent bg-transparent px-0 py-0 text-sm leading-6 text-[var(--text)] outline-none ring-0 ring-offset-0 placeholder:text-[var(--text-muted)] focus:border-transparent focus:outline-none focus:ring-0 focus:ring-offset-0 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
                name="body-editor"
                onChange={(event) => updateField("body", event.target.value)}
                placeholder="Write your message"
                ref={plainTextRef}
                spellCheck={spellCheckEnabled}
                value={values.body}
              />
            ) : (
              <div
                aria-label="Body"
                aria-multiline="true"
                className={cn(
                  "relative h-full min-h-[24rem] overflow-y-auto border-0 border-transparent px-0 py-0 text-sm leading-6 text-[var(--text)] outline-none ring-0 ring-offset-0 focus:border-transparent focus:outline-none focus:ring-0 focus:ring-offset-0 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0",
                  !(values.body?.trim()) && "before:pointer-events-none before:absolute before:left-0 before:top-0 before:text-sm before:text-[var(--text-muted)] before:content-[attr(data-placeholder)]",
                )}
                contentEditable
                data-placeholder="Write your message"
                onBlur={saveSelection}
                onInput={syncEditorStateFromDom}
                onKeyUp={saveSelection}
                onMouseUp={saveSelection}
                ref={editorRef}
                role="textbox"
                spellCheck={spellCheckEnabled}
                suppressContentEditableWarning
                tabIndex={0}
              />
            )}

            {isDrawingMode ? (
              <div className="absolute inset-0 z-20 bg-[var(--surface-overlay)]">
                <div className="absolute right-3 top-3 flex items-center gap-2 rounded-full bg-[var(--surface-overlay)] p-2">
                  <button className="inline-flex h-8 items-center gap-1 rounded-full px-3 text-xs text-[var(--text)]" onClick={() => void finishDrawing()} type="button">
                    <Check className="h-3.5 w-3.5" />
                    Done
                  </button>
                  <button className="inline-flex h-8 items-center gap-1 rounded-full px-3 text-xs text-[var(--text)]" onClick={clearDrawing} type="button">
                    <Eraser className="h-3.5 w-3.5" />
                    Clear
                  </button>
                  <button className="inline-flex h-8 items-center gap-1 rounded-full px-3 text-xs text-[var(--text)]" onClick={() => { clearDrawing(); setIsDrawingMode(false); }} type="button">
                    Cancel
                  </button>
                </div>
                <canvas
                  className="h-full w-full cursor-crosshair touch-none"
                  onPointerDown={startDrawing}
                  onPointerLeave={stopDrawing}
                  onPointerMove={drawStroke}
                  onPointerUp={stopDrawing}
                  ref={drawingCanvasRef}
                />
              </div>
            ) : null}
          </div>

          {!plainTextMode && showFormatting ? (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-[16px] border border-[var(--line)] bg-[var(--surface-overlay)] px-3 py-2">
              <ToolbarIconButton icon={Bold} label="Bold" onClick={() => runEditorCommand("bold")} />
              <ToolbarIconButton icon={Italic} label="Italic" onClick={() => runEditorCommand("italic")} />
              <ToolbarIconButton icon={Underline} label="Underline" onClick={() => runEditorCommand("underline")} />
              <ToolbarIconButton icon={ListOrdered} label="Numbered list" onClick={() => runEditorCommand("insertOrderedList")} />
              <ToolbarIconButton icon={List} label="Bulleted list" onClick={() => runEditorCommand("insertUnorderedList")} />
              <ToolbarIconButton icon={AlignLeft} label="Align left" onClick={() => runEditorCommand("justifyLeft")} />
              <ToolbarIconButton icon={AlignCenter} label="Align center" onClick={() => runEditorCommand("justifyCenter")} />
              <ToolbarIconButton icon={AlignRight} label="Align right" onClick={() => runEditorCommand("justifyRight")} />
              <ToolbarIconButton icon={Type} label="Clear formatting" onClick={() => runEditorCommand("removeFormat")} />
            </div>
          ) : null}

          {attachments.filter((attachment) => !attachment.inline).length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {attachments.filter((attachment) => !attachment.inline).map((attachment) => (
                <div className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--surface-overlay)] px-3 py-2 text-xs text-[var(--text)]" key={attachment.id}>
                  <Paperclip className="h-3.5 w-3.5" />
                  <span>{attachment.filename}</span>
                  <button className="text-[var(--text-muted)]" onClick={() => removeAttachment(attachment.id)} type="button">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          {linkDialog.open ? (
            <div className="absolute left-4 top-4 z-30 w-[22rem] rounded-[18px] border border-[var(--line)] bg-[var(--surface-overlay)] p-4 shadow-[0_20px_50px_var(--shadow-color)]">
              <p className="text-sm font-medium text-[var(--text)]">Insert link</p>
              <BrandInput
                className="mt-3"
                onChange={(event) => setLinkDialog((current) => ({ ...current, href: event.target.value }))}
                placeholder="https://example.com"
                value={linkDialog.href}
              />
              <BrandInput
                className="mt-3"
                onChange={(event) => setLinkDialog((current) => ({ ...current, text: event.target.value }))}
                placeholder="Text"
                value={linkDialog.text}
              />
              <div className="mt-3 flex justify-end gap-2">
                <BrandButton onClick={() => setLinkDialog({ open: false, href: "", text: "" })} tone="secondary" type="button">Cancel</BrandButton>
                <BrandButton onClick={applyLink} tone="primary" type="button">Apply</BrandButton>
              </div>
            </div>
          ) : null}
        </div>

        <div className="border-t border-[var(--line)] px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <button
                  className="inline-flex h-10 items-center gap-2 rounded-full bg-[var(--accent-strong)] px-4 text-sm font-medium text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={sendPending}
                  type="submit"
                >
                  <SendHorizonal className="h-4 w-4" />
                  {sendPending ? "Sending..." : "Send"}
                </button>
                <button
                  aria-label="Send options"
                  className="absolute right-1 top-1 inline-flex h-8 w-8 items-center justify-center rounded-full text-white/80 hover:bg-white/10"
                  disabled={sendPending}
                  onClick={() => setShowSendMenu((current) => !current)}
                  type="button"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
                {showSendMenu ? (
                  <div className="absolute bottom-[calc(100%+0.5rem)] left-0 w-40 rounded-[16px] border border-[var(--line)] bg-[var(--surface-overlay)] p-2 shadow-[0_20px_50px_var(--shadow-color)]">
                    <button className="w-full rounded-[12px] px-3 py-2 text-left text-sm text-[var(--text)] hover:bg-[var(--surface-overlay)]" type="submit">
                      Send now
                    </button>
                  </div>
                ) : null}
              </div>

              <button aria-label="Formatting options" className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[var(--text-muted)] transition hover:bg-[var(--surface-overlay)] hover:text-[var(--text)]" onClick={() => setShowFormatting((current) => !current)} type="button">
                <Type className="h-4 w-4" />
              </button>
              <button aria-label="Attach file" className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[var(--text-muted)] transition hover:bg-[var(--surface-overlay)] hover:text-[var(--text)]" onClick={() => fileInputRef.current?.click()} type="button">
                <Paperclip className="h-4 w-4" />
              </button>
              {!plainTextMode ? (
                <>
                  <button aria-label="Insert link" className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[var(--text-muted)] transition hover:bg-[var(--surface-overlay)] hover:text-[var(--text)]" onClick={openLinkDialog} type="button">
                    <Link2 className="h-4 w-4" />
                  </button>
                  <div className="relative">
                    <button aria-label="Insert emoji" className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[var(--text-muted)] transition hover:bg-[var(--surface-overlay)] hover:text-[var(--text)]" onClick={() => setShowEmojiPicker((current) => !current)} type="button">
                      <SmilePlus className="h-4 w-4" />
                    </button>
                    {showEmojiPicker ? (
                      <div className="absolute bottom-[calc(100%+0.5rem)] left-0 grid w-56 grid-cols-6 gap-2 rounded-[16px] border border-[var(--line)] bg-[var(--surface-overlay)] p-3 shadow-[0_20px_50px_var(--shadow-color)]">
                        {EMOJI_OPTIONS.map((emoji) => (
                          <button
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-lg hover:bg-[var(--surface-overlay)]"
                            key={emoji}
                            onClick={() => {
                              insertTextAtCursor(emoji);
                              setShowEmojiPicker(false);
                            }}
                            type="button"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <button aria-label="Insert image" className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[var(--text-muted)] transition hover:bg-[var(--surface-overlay)] hover:text-[var(--text)]" onClick={() => imageInputRef.current?.click()} type="button">
                    <ImagePlus className="h-4 w-4" />
                  </button>
                  <button aria-label="Drawing mode" className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[var(--text-muted)] transition hover:bg-[var(--surface-overlay)] hover:text-[var(--text)]" onClick={() => { toggleDrawingMode(); }} type="button">
                    <PenTool className="h-4 w-4" />
                  </button>
                </>
              ) : null}

              <div className="relative">
                <button aria-label="More options" className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[var(--text-muted)] transition hover:bg-[var(--surface-overlay)] hover:text-[var(--text)]" onClick={() => setShowMoreOptions((current) => !current)} type="button">
                  <MoreHorizontal className="h-4 w-4" />
                </button>
                {showMoreOptions ? (
                  <div className="absolute bottom-[calc(100%+0.5rem)] left-0 w-56 rounded-[16px] border border-[var(--line)] bg-[var(--surface-overlay)] p-2 shadow-[0_20px_50px_var(--shadow-color)]">
                    <MoreMenuItem
                      label={defaultFullscreen ? "Default to full screen: On" : "Default to full screen: Off"}
                      onClick={() => {
                        setDefaultFullscreen((current) => !current);
                      }}
                    />
                    <MoreMenuItem
                      label={plainTextMode ? "Plain text mode: On" : "Plain text mode: Off"}
                      onClick={togglePlainTextMode}
                    />
                    <MoreMenuItem
                      label={spellCheckEnabled ? "Spell check: On" : "Spell check: Off"}
                      onClick={() => setSpellCheckEnabled((current) => !current)}
                    />
                    <MoreMenuItem
                      label="Print"
                      onClick={() => printComposeDraft(values.subject ?? "", preparedHtmlBody || escapeHtmlWithBreaks(values.body ?? ""))}
                    />
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2" data-testid="compose-draft-actions">
              {mode === "modal" ? (
                <button
                  className="inline-flex h-10 items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--surface-overlay)] px-4 text-sm text-[var(--text)] transition hover:border-[var(--line)]"
                  data-testid="compose-assistant-button"
                  onClick={() => openAssistant({
                    source: "compose",
                    composeDraft: draftSnapshot,
                  })}
                  type="button"
                >
                  <Sparkles className="h-4 w-4 text-[var(--accent)]" />
                  Assistant
                </button>
              ) : null}
              <BrandButton disabled={draftPending} formAction={draftAction} tone="secondary" type="submit">
                {draftPending ? "Saving..." : "Save draft"}
              </BrandButton>
              <button
                aria-label="Discard draft"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[var(--accent-strong)] transition hover:bg-[var(--accent-strong)] hover:text-[var(--text)]"
                data-testid="compose-discard-button"
                formAction={discardDraftAction}
                onClick={handleDiscard}
                type="submit"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {localError ? <p className="px-4 pb-3 text-sm text-[var(--accent-strong)]">{localError}</p> : null}
      {sendState.error ? <p className="px-4 pb-3 text-sm text-[var(--accent-strong)]">{sendState.error}</p> : null}
      {draftState.error ? <p className="px-4 pb-3 text-sm text-[var(--accent-strong)]">{draftState.error}</p> : null}
      {draftState.success ? <p className="px-4 pb-3 text-sm text-[var(--accent)]">{draftState.success}</p> : null}

      <input hidden multiple onChange={(event) => void readFiles(event.target.files, false)} ref={fileInputRef} type="file" />
      <input hidden accept="image/*" multiple onChange={(event) => void readFiles(event.target.files, true)} ref={imageInputRef} type="file" />
    </form>
  );
}

function ToolbarIconButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Bold;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={label}
      className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[var(--text-muted)] transition hover:bg-[var(--surface-overlay)] hover:text-[var(--text)]"
      onClick={onClick}
      type="button"
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

function MoreMenuItem({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button className="w-full rounded-[12px] px-3 py-2 text-left text-sm text-[var(--text)] hover:bg-[var(--surface-overlay)]" onClick={onClick} type="button">
      {label}
    </button>
  );
}

function readDefaultFullscreenPreference() {
  if (typeof window === "undefined") {
    return false;
  }

  if (typeof window.localStorage?.getItem !== "function") {
    return false;
  }

  return window.localStorage.getItem(DEFAULT_FULLSCREEN_STORAGE_KEY) === "true";
}

function looksLikeHtml(value: string) {
  return /<\/?[a-z][\s\S]*>/i.test(value);
}

function extractTextFromHtml(value: string) {
  if (typeof window === "undefined") {
    return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }

  const container = document.createElement("div");
  container.innerHTML = value;
  return container.textContent?.replace(/\u00a0/g, " ").trim() ?? "";
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeHtmlWithBreaks(value: string) {
  return escapeHtml(value).replace(/\n/g, "<br />");
}

function normalizeEditorHtml(value: string) {
  return value.trim() || "<div><br></div>";
}

function sanitizeUrl(value: string) {
  try {
    const url = new URL(value);

    if (!["http:", "https:", "mailto:"].includes(url.protocol)) {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

function escapeAttribute(value: string) {
  return value.replace(/"/g, "&quot;");
}

function hasDraftContent(draft: ComposeDraftValues) {
  return Boolean(
    draft.to?.trim()
      || draft.cc?.trim()
      || draft.bcc?.trim()
      || draft.subject?.trim()
      || draft.body?.trim()
      || draft.attachments?.length,
  );
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.readAsDataURL(file);
  });
}

function replaceInlineAssetSources(html: string, attachments: ComposeDraftAttachment[]) {
  if (typeof window === "undefined") {
    return html;
  }

  const container = document.createElement("div");
  container.innerHTML = html;

  container.querySelectorAll("img[data-compose-asset-id]").forEach((node) => {
    const assetId = node.getAttribute("data-compose-asset-id");
    const attachment = attachments.find((item) => item.id === assetId && item.inline && item.contentId);

    if (attachment?.contentId) {
      node.setAttribute("src", `cid:${attachment.contentId}`);
    }
  });

  return container.innerHTML;
}

function printComposeDraft(subject: string, html: string) {
  const popup = window.open("", "_blank", "noopener,noreferrer,width=900,height=700");

  if (!popup) {
    return;
  }

  popup.document.write(`
    <html>
      <head><title>${escapeHtml(subject || "Draft")}</title></head>
      <body style="font-family: Arial, sans-serif; padding: 24px;">
        <h1>${escapeHtml(subject || "Draft")}</h1>
        <div>${html}</div>
      </body>
    </html>
  `);
  popup.document.close();
  popup.focus();
  popup.print();
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

function createComposeId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
