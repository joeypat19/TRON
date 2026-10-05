import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TRON",
  description: "Search the locally stored web with TRON.",
  applicationName: "TRON",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

