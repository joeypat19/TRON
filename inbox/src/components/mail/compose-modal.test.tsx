import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ComposeModal } from "@/components/mail/compose-modal";

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

describe("ComposeModal", () => {
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
    Element.prototype.scrollIntoView = vi.fn();
  });

  it("removes the blurred backdrop while minimized and restores it when reopened", async () => {
    const user = userEvent.setup();

    render(
      <ComposeModal
        activeMailboxEmail="owner@example.com"
        draft={{ to: "person@example.com", subject: "Draft subject", body: "Draft body" }}
        isOpen
        onClose={vi.fn()}
        onDraftChange={vi.fn()}
        onSent={vi.fn()}
      />,
    );

    await screen.findByRole("dialog", undefined, { timeout: 10_000 });
    expect(screen.getByTestId("compose-modal-backdrop")).toHaveClass("backdrop-blur-md");

    await user.click(screen.getByRole("button", { name: "Minimize compose" }));

    expect(screen.queryByTestId("compose-modal-backdrop")).not.toBeInTheDocument();
    expect(screen.getByTestId("minimized-compose-bar")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Draft subject/i }));

    await waitFor(() => {
      expect(screen.getByTestId("compose-modal-backdrop")).toHaveClass("backdrop-blur-md");
    });
    expect(screen.getByDisplayValue("person@example.com")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Draft subject")).toBeInTheDocument();
  });
});
