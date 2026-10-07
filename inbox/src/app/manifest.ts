import type { MetadataRoute } from "next";
import { appPath } from "@/lib/app-path";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Inbox",
    short_name: "Inbox",
    description: "Inbox is a live mailbox workspace for focused inbox, thread, search, and compose flows.",
    start_url: appPath("/"),
    display: "standalone",
    background_color: "transparent",
    theme_color: "transparent",
    icons: [
      {
        src: appPath("/brand/tron-logo.png"),
        sizes: "1254x1254",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
