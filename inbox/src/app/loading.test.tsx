import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Loading from "@/app/loading";

describe("app loading screen", () => {
  it("renders a clean syncing screen without the old logo card or grid background", () => {
    const { container } = render(<Loading />);

    expect(screen.getByText("Inbox")).toBeInTheDocument();
    expect(screen.getByText("Syncing")).toBeInTheDocument();
    expect(container.querySelector(".brand-grid")).toBeNull();
    expect(container.querySelector(".brand-panel-strong")).toBeNull();
  });
});
