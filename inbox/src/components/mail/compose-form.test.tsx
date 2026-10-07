import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ComposeForm } from "@/components/mail/compose-form";

const refresh = vi.fn();
const push = vi.fn();
const sendMessageAction = vi.fn();
const saveDraftAction = vi.fn();
const discardDraftAction = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push,
    refresh,
  }),
}));

vi.mock("@/app/mail/actions", () => ({
  sendMessageAction: (...args: unknown[]) => sendMessageAction(...args),
  saveDraftAction: (...args: unknown[]) => saveDraftAction(...args),
  discardDraftAction: (...args: unknown[]) => discardDraftAction(...args),
}));

describe("ComposeForm", () => {
  beforeEach(() => {
    refresh.mockReset();
    push.mockReset();
    sendMessageAction.mockReset();
    saveDraftAction.mockReset();
    discardDraftAction.mockReset();
    sendMessageAction.mockResolvedValue({ error: "", success: "", draftId: "" });
    saveDraftAction.mockResolvedValue({ error: "", success: "", draftId: "draft_123" });
    discardDraftAction.mockResolvedValue({ error: "", success: "", draftId: "" });
    Object.defineProperty(window, "localStorage", {
      value: {
        getItem: vi.fn(() => "false"),
        setItem: vi.fn(),
      },
      configurable: true,
    });
    Object.defineProperty(window, "confirm", {
      value: vi.fn(() => true),
      configurable: true,
    });
    Object.defineProperty(window, "open", {
      value: vi.fn(() => ({
        document: {
          write: vi.fn(),
          close: vi.fn(),
        },
        focus: vi.fn(),
        print: vi.fn(),
      })),
      configurable: true,
    });
    Element.prototype.scrollIntoView = vi.fn();
  });

  it("shows Cc and Bcc fields and includes them in the send payload", async () => {
    const user = userEvent.setup();
    let capturedFormData: FormData | null = null;
    sendMessageAction.mockImplementation(async (_prev: unknown, formData: FormData) => {
      capturedFormData = formData;
      return { error: "", success: "", draftId: "" };
    });

    render(<ComposeForm activeMailboxEmail="owner@example.com" mode="modal" />);

    await user.click(screen.getByRole("button", { name: "Cc" }));
    await user.click(screen.getByRole("button", { name: "Bcc" }));
    await user.type(screen.getByLabelText("To"), "to@example.com");
    await user.type(screen.getByLabelText("Cc"), "cc@example.com");
    await user.type(screen.getByLabelText("Bcc"), "bcc@example.com");
    await user.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => expect(sendMessageAction).toHaveBeenCalled());
    expect(capturedFormData?.get("to")).toBe("to@example.com");
    expect(capturedFormData?.get("cc")).toBe("cc@example.com");
    expect(capturedFormData?.get("bcc")).toBe("bcc@example.com");
  });

  it("does not render visible Recipients copy in compose", () => {
    render(<ComposeForm activeMailboxEmail="owner@example.com" mode="modal" />);

    expect(screen.queryByText("Recipients")).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Recipients")).not.toBeInTheDocument();
    expect(screen.getByLabelText("To")).toHaveAttribute("placeholder", "");
  });

  it("minimizes and restores without losing the draft", async () => {
    const user = userEvent.setup();

    render(<ComposeForm activeMailboxEmail="owner@example.com" mode="modal" />);

    await user.type(screen.getByLabelText("To"), "person@example.com");
    await user.type(screen.getByLabelText("Subject"), "Draft subject");
    await user.click(screen.getByRole("button", { name: "Minimize compose" }));

    expect(screen.getByText("Draft subject")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /draft subject/i }));
    expect(screen.getByDisplayValue("person@example.com")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Draft subject")).toBeInTheDocument();
  });

  it("places the assistant action with the draft controls", () => {
    render(<ComposeForm activeMailboxEmail="owner@example.com" mode="modal" />);

    const draftActions = screen.getByTestId("compose-draft-actions");

    expect(draftActions).toContainElement(screen.getByTestId("compose-assistant-button"));
    expect(draftActions).toContainElement(screen.getByRole("button", { name: "Save draft" }));
    expect(draftActions).toContainElement(screen.getByTestId("compose-discard-button"));
  });

  it("toggles full screen without losing the draft", async () => {
    const user = userEvent.setup();

    render(<ComposeForm activeMailboxEmail="owner@example.com" mode="modal" />);

    await user.type(screen.getByLabelText("Subject"), "Fullscreen draft");
    await user.click(screen.getByRole("button", { name: "Full screen" }));
    expect(screen.getByRole("button", { name: "Exit full screen" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("Fullscreen draft")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Exit full screen" }));
    expect(screen.getByRole("button", { name: "Full screen" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("Fullscreen draft")).toBeInTheDocument();
  });

  it("inserts a link into the rich body editor", async () => {
    const user = userEvent.setup();

    render(<ComposeForm activeMailboxEmail="owner@example.com" mode="modal" />);

    const body = screen.getByRole("textbox", { name: "Body" });
    const execCommand = vi.fn((command: string, _showUi: boolean, value?: string) => {
      if (!(body instanceof HTMLDivElement)) {
        return true;
      }

      if (command === "insertHTML") {
        body.innerHTML += String(value ?? "");
        body.dispatchEvent(new InputEvent("input", { bubbles: true }));
      }

      return true;
    });
    Object.defineProperty(document, "execCommand", {
      value: execCommand,
      configurable: true,
    });

    await user.click(screen.getByRole("button", { name: "Insert link" }));
    await user.clear(screen.getByPlaceholderText("https://example.com"));
    await user.type(screen.getByPlaceholderText("https://example.com"), "https://example.com");
    await user.type(screen.getByPlaceholderText("Text"), "Example");
    await user.click(screen.getByRole("button", { name: "Apply" }));

    expect(execCommand).toHaveBeenCalledWith("insertHTML", false, "<a href=\"https://example.com/\">Example</a>");
    expect(body.innerHTML).toContain("https://example.com/");
    expect(body.innerHTML).toContain(">Example<");
  });

  it("inserts an emoji into the rich body editor", async () => {
    const user = userEvent.setup();

    render(<ComposeForm activeMailboxEmail="owner@example.com" mode="modal" />);

    const body = screen.getByRole("textbox", { name: "Body" });
    const execCommand = vi.fn((command: string, _showUi: boolean, value?: string) => {
      if (!(body instanceof HTMLDivElement)) {
        return true;
      }

      if (command === "insertHTML") {
        body.innerHTML += String(value ?? "");
        body.dispatchEvent(new InputEvent("input", { bubbles: true }));
      }

      return true;
    });
    Object.defineProperty(document, "execCommand", {
      value: execCommand,
      configurable: true,
    });

    await user.click(screen.getByRole("button", { name: "Insert emoji" }));
    await user.click(screen.getByRole("button", { name: "✨" }));

    expect(body.textContent).toContain("✨");
  });

  it("shows only real items in more options and does not render Google Drive or confidential mode", async () => {
    const user = userEvent.setup();

    render(<ComposeForm activeMailboxEmail="owner@example.com" mode="modal" />);

    await user.click(screen.getByRole("button", { name: "More options" }));

    expect(screen.getByText(/Default to full screen/i)).toBeInTheDocument();
    expect(screen.getByText(/Plain text mode/i)).toBeInTheDocument();
    expect(screen.getByText(/Spell check/i)).toBeInTheDocument();
    expect(screen.getByText("Print")).toBeInTheDocument();
    expect(screen.queryByText(/Google Drive|Drive/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Confidential/i)).not.toBeInTheDocument();
  });
});
