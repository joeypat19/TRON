import type { Metadata } from "next";
import { getAppUrl } from "@/lib/env";
import { appPath } from "@/lib/app-path";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(getAppUrl()),
  title: {
    default: "Inbox",
    template: "%s | Inbox",
  },
  applicationName: "Inbox",
  description: "Fast mailbox access with Inbox.",
  manifest: appPath("/manifest.webmanifest"),
  icons: {
    icon: appPath("/brand/tron-logo.png"),
    apple: appPath("/brand/tron-logo.png"),
  },
  category: "productivity",
  openGraph: {
    title: "Inbox",
    description: "A sleek standalone TRON mailbox.",
    siteName: "Inbox",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Inbox",
    description: "A sleek standalone TRON mailbox.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col bg-[var(--bg)]">
        <script defer src={appPath("/tronxvi-tool-theme-bridge.js")} />
        {children}
      </body>
    </html>
  );
}
