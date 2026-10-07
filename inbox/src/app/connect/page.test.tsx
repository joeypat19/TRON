/* eslint-disable @next/next/no-img-element */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/image", () => ({
  default: ({ alt, src }: { alt: string; src: string }) => <img alt={alt} src={src} />,
}));

vi.mock("@/components/auth/connect-gmail-button", () => ({
  ConnectGmailButton: ({ label }: { label?: string }) => <button type="button">{label ?? "Connect Gmail"}</button>,
}));

vi.mock("@/components/auth/connect-microsoft-button", () => ({
  ConnectMicrosoftButton: ({ label }: { label?: string }) => <button type="button">{label ?? "Connect Outlook"}</button>,
}));

describe("/connect page", () => {
  it("shows Gmail and Outlook connect options and hides unsupported providers", async () => {
    const { default: ConnectPage } = await import("@/app/connect/page");

    render(<ConnectPage />);

    expect(screen.getByRole("button", { name: "Connect Gmail" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Connect Outlook" })).toBeInTheDocument();
    expect(screen.queryByText("Connect Other Email")).not.toBeInTheDocument();
  });
});
