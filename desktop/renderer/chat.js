(function () {
  const activeRuns = new Map();

  function esc(value) {
    return String(value == null ? "" : value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function id(prefix) {
    const suffix = globalThis.crypto?.randomUUID?.().replaceAll("-", "") || `${Date.now()}${Math.random()}`;
    return `${prefix}_${suffix}`;
  }

  function createState() {
    return {
      conversationId: id("conversation"),
      messages: [],
      draft: "",
      modelMode: "mini",
      effort: "instant",
      attachments: [],
      pending: null,
      activity: "",
      error: null,
      pinned: false,
      split: false,
      lastRequest: null,
    };
  }

  function renderMarkdown(text) {
    const source = String(text || "");
    const parts = source.split(/```/);
    return parts.map((part, index) => {
      if (index % 2 === 1) {
        const lines = part.replace(/^\w[\w+-]*\n/, "").split("\n");
        return `<pre class="chat-code"><code>${esc(lines.join("\n"))}</code></pre>`;
      }
      const lines = part.split("\n");
      let html = "";
      let list = [];
      const flushList = () => {
        if (!list.length) return;
        html += `<ul>${list.map((item) => `<li>${inlineMarkdown(item)}</li>`).join("")}</ul>`;
        list = [];
      };
      for (const line of lines) {
        const trimmed = line.trim();
        if (/^[-*]\s+/.test(trimmed)) {
          list.push(trimmed.replace(/^[-*]\s+/, ""));
          continue;
        }
        flushList();
        if (!trimmed) continue;
        if (/^###\s+/.test(trimmed)) html += `<h4>${inlineMarkdown(trimmed.slice(4))}</h4>`;
        else if (/^##\s+/.test(trimmed)) html += `<h3>${inlineMarkdown(trimmed.slice(3))}</h3>`;
        else if (/^#\s+/.test(trimmed)) html += `<h2>${inlineMarkdown(trimmed.slice(2))}</h2>`;
        else if (/^>\s?/.test(trimmed)) html += `<blockquote>${inlineMarkdown(trimmed.replace(/^>\s?/, ""))}</blockquote>`;
        else html += `<p>${inlineMarkdown(trimmed)}</p>`;
      }
      flushList();
      return html;
    }).join("");
  }

  function inlineMarkdown(value) {
    let output = esc(value);
    output = output.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
    output = output.replace(/`([^`]+)`/g, "<code>$1</code>");
    output = output.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    output = output.replace(/__([^_]+)__/g, "<strong>$1</strong>");
    return output;
  }

  function safeMediaUrl(value) {
    const url = String(value || "");
    return /^(https?:\/\/|data:image\/)/i.test(url) ? url : "";
  }

  function blockHtml(block) {
    if (!block || typeof block !== "object") return "";
    const kind = String(block.kind || block.type || "markdown").toLowerCase();
    const text = block.text ?? block.content ?? block.markdown ?? block.value ?? "";
    if (["image", "media", "image_result"].includes(kind)) {
      const src = safeMediaUrl(block.url || block.src || block.dataUrl);
      return src ? `<figure class="chat-media"><img src="${esc(src)}" alt="${esc(block.alt || "Chat image")}"><figcaption>${esc(block.caption || "")}</figcaption></figure>` : "";
    }
    if (["artifact", "file", "document", "artifact_generation"].includes(kind)) {
      return `<div class="chat-artifact"><div class="chat-artifact-title">${esc(block.name || block.title || "Generated artifact")}</div><div class="chat-artifact-detail">${esc(block.description || text || "Available from this response")}</div></div>`;
    }
    if (["source", "citation", "link"].includes(kind) && block.url) {
      return `<a class="chat-source" href="${esc(safeMediaUrl(block.url) || "#")}" target="_blank" rel="noreferrer">${esc(block.title || block.label || block.url)}</a>`;
    }
    if (kind === "table" && Array.isArray(block.rows)) {
      return `<div class="chat-table-wrap"><table><tbody>${block.rows.map((row) => `<tr>${(Array.isArray(row) ? row : [row]).map((cell) => `<td>${inlineMarkdown(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
    }
    return renderMarkdown(typeof text === "string" ? text : JSON.stringify(text));
  }

  function messageHtml(message) {
    const role = message.role === "user" ? "user" : "assistant";
    const body = message.blocks?.length ? message.blocks.map(blockHtml).join("") : renderMarkdown(message.content || "");
    const pending = message.pending ? `<div class="chat-activity">${esc(message.activity || "Thinking…")}</div>` : "";
    return `<article class="chat-message chat-message--${role}"><div class="chat-message-role">${role === "user" ? "You" : "Infinity"}</div><div class="chat-message-body">${body || pending || "<span class='chat-placeholder'>Preparing response…</span>"}</div></article>`;
  }

  function attachmentHtml(attachment) {
    return `<span class="attachment-chip attachment-chip--composer" title="${esc(attachment.name)}"><span class="attachment-chip__name">${esc(attachment.name)}</span><button type="button" data-chat-remove-attachment="${esc(attachment.id)}" aria-label="Remove ${esc(attachment.name)}">×</button></span>`;
  }

  function render(tab) {
    const chat = tab.chat || createState();
    tab.chat = chat;
    const messages = chat.messages.length ? `<div class="chat-messages">${chat.messages.map(messageHtml).join("")}</div>` : `<div class="chat-empty"><h1>Where should we start today?</h1><p>Ask Infinity anything, search your local TRON knowledge, or work through a problem together.</p></div>`;
    const error = chat.error ? `<div class="chat-error"><span>${esc(chat.error)}</span><button type="button" data-chat-retry>Retry</button></div>` : "";
    const sendLabel = chat.pending ? "Stop" : "Send";
    const modeOptions = ["mini", "standard", "pro"].map((mode) => `<option value="${mode}"${mode === chat.modelMode ? " selected" : ""}>${mode[0].toUpperCase() + mode.slice(1)}</option>`).join("");
    const effortOptions = ["instant", "balanced", "deep"].map((effort) => `<option value="${effort}"${effort === chat.effort ? " selected" : ""}>${effort[0].toUpperCase() + effort.slice(1)}</option>`).join("");
    const effortLabel = chat.effort[0].toUpperCase() + chat.effort.slice(1);
    const sendIcon = chat.pending
      ? `<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="3.4"><path d="M9 9 23 23"/><path d="M23 9 9 23"/></g>`
      : `<g fill="currentColor" transform="rotate(-90 16 16)"><path d="M3.2 4.8 30 16 10.9 14.4Z"/><path d="M3.2 27.2 30 16 10.9 17.6Z"/></g>`;
    return `<main class="tron-page chat-page${chat.split ? " chat-page--split" : ""}">
      <aside class="chat-sidebar">
        <div class="chat-sidebar-brand"><img src="./tron-logo.png" alt="TRON"><span>Infinity</span></div>
        <button class="chat-sidebar-item chat-sidebar-item--active" type="button" data-chat-new>✦ <span>General Chat</span></button>
        <button class="chat-sidebar-item" type="button" data-chat-new>＋ <span>Start new chat</span></button>
        <button class="chat-sidebar-item" type="button" data-chat-home>⌂ <span>Back to TRON</span></button>
        <div class="chat-sidebar-note">Chat runs inside TRON. Responses can be wrong—check important information.</div>
      </aside>
      <section class="chat-main">
        <header class="chat-header"><div><span class="chat-header-eyebrow">TRONXVI</span><h1>General Chat</h1></div><a class="chat-continue" href="https://infinity.tronxvi.com/?tool=general" target="_blank" rel="noreferrer">Continue in Infinity</a></header>
        <div class="chat-scroll" data-chat-scroll>${messages}${error}</div>
        <div class="chat-composer-shell">
          <form class="composer composer--general composer--general-chat-chrome" data-chat-form>
            <div class="composer__left"><button class="button composer__attach-button" type="button" data-chat-attach aria-label="Attach files"><svg aria-hidden="true" class="composer__attach-icon" viewBox="0 0 24 24"><line x1="5" x2="19" y1="12" y2="12" stroke="currentColor" stroke-linecap="round" stroke-width="2.2"></line><line x1="5" x2="19" y1="12" y2="12" transform="rotate(90 12 12)" stroke="currentColor" stroke-linecap="round" stroke-width="2.2"></line></svg></button></div>
            <div class="composer__center"><div class="attachment-list attachment-list--composer">${chat.attachments.map(attachmentHtml).join("")}</div><div class="composer__input-wrap"><textarea class="composer__input" data-chat-input rows="1" placeholder="What's on your mind?">${esc(chat.draft)}</textarea></div></div>
            <div class="composer__actions">
              <button type="button" class="button composer__mic-button" data-chat-voice aria-label="Start voice input"><svg aria-hidden="true" class="composer__mic-icon" viewBox="0 0 24 24"><path d="M12 15.5A3.5 3.5 0 0 0 15.5 12V7.5A3.5 3.5 0 1 0 8.5 7.5V12A3.5 3.5 0 0 0 12 15.5Z" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.3"></path><path d="M18 11V12A6 6 0 0 1 6 12V11M12 18.5V21.5M8.5 21.5H15.5" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.3"></path></svg></button>
              <details class="composer__model-modes"><summary class="composer__model-trigger" aria-label="Open chat mode dropdown"><span class="composer__model-trigger-label">${esc(effortLabel)}</span><svg aria-hidden="true" class="composer__model-trigger-icon" viewBox="0 0 16 16"><path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"></path></svg></summary><div class="composer__model-options"><label class="composer__model-setting"><span class="composer__model-setting-label">Mode</span><select data-chat-mode>${modeOptions}</select></label><label class="composer__model-setting"><span class="composer__model-setting-label">Effort</span><select data-chat-effort>${effortOptions}</select></label></div></details>
              <button class="button composer__action-send" aria-label="${sendLabel}" title="${sendLabel}" type="submit"${!chat.pending && !chat.draft.trim() && !chat.attachments.length ? " disabled" : ""}><svg aria-hidden="true" class="composer__send-icon" viewBox="0 0 32 32">${sendIcon}</svg></button>
            </div>
          </form>
          <p class="composer__disclaimer">TRONXVI can make mistakes sometimes. Double-check important info.</p>
        </div>
      </section>
    </main>`;
  }

  function payloadFor(tab, userMessage, history) {
    const chat = tab.chat;
    return {
      contract: "general_chat.request.v2",
      request_id: chat.pending.requestId,
      conversation_id: chat.conversationId,
      message: userMessage.content,
      current_user_message_id: userMessage.id,
      model_mode: chat.modelMode,
      preferences: { custom_instructions: "", effort: chat.effort },
      explicit_capabilities: [],
      constraints: [],
      attachments: chat.attachments,
      thread_attachments: [],
      workspace_documents: [],
      messages: history.map((message) => ({ role: message.role, content: message.content, attachments: message.attachments || [] })),
      access_context: { has_workspace_summary: false, has_chat_history: history.length > 0, has_profile_preferences: false, has_precise_location_access: false, has_email_inbox_access: false, has_file_library_access: false, web_search_enabled: true },
      memory_context: null,
    };
  }

  function applyEvent(tab, event, rerender) {
    const chat = tab.chat;
    if (!chat.pending || String(event.requestId || "") !== chat.pending.requestId) return;
    const assistant = chat.messages.find((message) => message.id === chat.pending.assistantId);
    if (!assistant) return;
    if (event.event === "started") chat.activity = "Thinking…";
    else if (event.event === "progress") chat.activity = event.activity?.text || "Working…";
    else if (event.event === "text_delta") assistant.content += String(event.text || "");
    else if (event.event === "answer_block" && event.block) assistant.blocks.push(event.block);
    else if (["complete", "failed", "rejected"].includes(event.event)) {
      const response = event.response || {};
      const outcome = response.outcome || {};
      if (event.event === "complete") {
        const answer = response.answer;
        if (typeof answer === "string" && !assistant.content) assistant.content = answer;
        if (answer && typeof answer === "object") {
          if (typeof answer.text === "string" && !assistant.content) assistant.content = answer.text;
          if (Array.isArray(answer.blocks)) assistant.blocks.push(...answer.blocks);
        }
      } else {
        chat.error = outcome.message || "Infinity could not complete this request.";
      }
      assistant.pending = false;
      assistant.activity = "";
      chat.activity = "";
      chat.pending = null;
      activeRuns.delete(String(event.requestId));
    }
    rerender();
  }

  async function send(tab, rerender) {
    const chat = tab.chat;
    if (chat.pending) return;
    const content = chat.draft.trim();
    if (!content && !chat.attachments.length) return;
    const userMessage = { id: id("message"), role: "user", content: content || "Please review the attached files.", attachments: chat.attachments.slice() };
    const history = chat.messages.slice();
    const assistant = { id: id("message"), role: "assistant", content: "", blocks: [], pending: true, activity: "Thinking…" };
    chat.messages.push(userMessage, assistant);
    chat.lastRequest = { content: userMessage.content, attachments: userMessage.attachments };
    chat.draft = "";
    chat.attachments = [];
    chat.error = null;
    chat.pending = { requestId: id("request"), assistantId: assistant.id };
    const request = payloadFor(tab, userMessage, history);
    activeRuns.set(request.request_id, { tab, rerender });
    rerender();
    try {
      await window.tronDesktop.startChat(request);
    } catch (error) {
      chat.pending = null;
      assistant.pending = false;
      chat.error = error instanceof Error ? error.message : "TRON could not start chat.";
      activeRuns.delete(request.request_id);
      rerender();
    }
  }

  function retry(tab, rerender) {
    const last = tab.chat.lastRequest;
    if (!last || tab.chat.pending) return;
    const lastUserIndex = [...tab.chat.messages].map((message) => message.role).lastIndexOf("user");
    if (lastUserIndex >= 0) tab.chat.messages = tab.chat.messages.slice(0, lastUserIndex);
    tab.chat.draft = last.content;
    tab.chat.attachments = last.attachments || [];
    tab.chat.error = null;
    rerender();
    void send(tab, rerender);
  }

  function bind(page, tab, rerender) {
    const chat = tab.chat;
    const form = page.querySelector("[data-chat-form]");
    const input = page.querySelector("[data-chat-input]");
    input?.addEventListener("input", () => { chat.draft = input.value; });
    input?.addEventListener("keydown", (event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(tab, rerender); } });
    form?.addEventListener("submit", (event) => { event.preventDefault(); if (chat.pending) { window.tronDesktop.cancelChat(chat.pending.requestId); chat.pending = null; const assistant = chat.messages.find((message) => message.role === "assistant" && message.pending); if (assistant) { assistant.pending = false; assistant.activity = "Stopped."; } rerender(); } else void send(tab, rerender); });
    page.querySelector("[data-chat-attach]")?.addEventListener("click", async () => { try { chat.attachments.push(...await window.tronDesktop.pickAttachments()); rerender(); } catch (error) { chat.error = error instanceof Error ? error.message : "Could not attach that file."; rerender(); } });
    page.querySelector("[data-chat-mode]")?.addEventListener("change", (event) => { chat.modelMode = event.target.value; });
    page.querySelector("[data-chat-effort]")?.addEventListener("change", (event) => { chat.effort = event.target.value; });
    page.querySelector("[data-chat-new]")?.addEventListener("click", () => { tab.chat = createState(); rerender(); });
    page.querySelector("[data-chat-home]")?.addEventListener("click", () => window.tronRenderer.showHome(tab));
    page.querySelector("[data-chat-pin]")?.addEventListener("click", () => { chat.pinned = !chat.pinned; rerender(); });
    page.querySelector("[data-chat-delete]")?.addEventListener("click", () => { tab.chat = createState(); rerender(); });
    page.querySelector("[data-chat-split]")?.addEventListener("click", () => { chat.split = !chat.split; rerender(); });
    page.querySelector("[data-chat-retry]")?.addEventListener("click", () => retry(tab, rerender));
    page.querySelectorAll("[data-chat-remove-attachment]").forEach((button) => button.addEventListener("click", () => { chat.attachments = chat.attachments.filter((item) => item.id !== button.dataset.chatRemoveAttachment); rerender(); }));
    page.querySelector("[data-chat-voice]")?.addEventListener("click", () => {
      const Recognition = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;
      if (!Recognition) { chat.error = "Voice input is not available in this TRON build."; rerender(); return; }
      const recognition = new Recognition();
      recognition.lang = navigator.language || "en-US";
      recognition.onresult = (event) => { chat.draft = `${chat.draft}${chat.draft ? " " : ""}${event.results[0][0].transcript}`; rerender(); };
      recognition.onerror = () => { chat.error = "Voice input could not start."; rerender(); };
      recognition.start();
    });
  }

  window.tronChat = { createState, render, bind };
  window.tronDesktop.onChatEvent((event) => {
    const run = activeRuns.get(String(event.requestId || ""));
    if (run) applyEvent(run.tab, event, run.rerender);
  });
}());
