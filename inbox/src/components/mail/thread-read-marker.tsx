"use client";

import { useEffect } from "react";
import { appPath } from "@/lib/app-path";

export function ThreadReadMarker({
  messageId,
  threadId,
  unread,
}: {
  messageId: string;
  threadId: string;
  unread: boolean;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      console.info("[mail-thread] thread render completed", { threadId, messageId, unread });
    }

    if (!unread) {
      return;
    }

    if (process.env.NODE_ENV === "development") {
      console.info("[mail-thread] mark-read started", { threadId, messageId });
    }

    void fetch(appPath(`/api/mail/messages/${encodeURIComponent(messageId)}`), {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "read",
        messageId,
        nextUnread: false,
        sourceColumnId: "unread",
      }),
    }).finally(() => {
      if (process.env.NODE_ENV === "development") {
        console.info("[mail-thread] mark-read request completed", { threadId, messageId });
      }
    });
  }, [messageId, threadId, unread]);

  return null;
}
