import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ThreadLoading from "@/app/mail/thread/[threadId]/loading";

describe("/mail/thread/[threadId] loading", () => {
  it("renders the thread-specific loading state instead of the inbox columns skeleton", () => {
    const { container } = render(<ThreadLoading />);

    expect(screen.getByText("Loading email...")).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Loading email" })).toBeInTheDocument();
    expect(container.querySelector(".thread-loading-spinner")).not.toBeNull();
    expect(container.querySelectorAll(".thread-loading-worm")).toHaveLength(3);
    expect(screen.queryByText("Syncing your mailbox...")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Unread" })).not.toBeInTheDocument();
  });
});
