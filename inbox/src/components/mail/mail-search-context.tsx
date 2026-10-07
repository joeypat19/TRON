"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { SearchableMailMessage } from "@/lib/mail/search";

type SearchIndexMessage = SearchableMailMessage;

type MailSearchIndexContextValue = {
  messages: SearchIndexMessage[];
  registerSourceMessages: (sourceId: string, messages: SearchIndexMessage[]) => void;
  clearSourceMessages: (sourceId: string) => void;
};

const MailSearchIndexContext = createContext<MailSearchIndexContextValue | null>(null);

export function MailSearchIndexProvider({ children }: { children: React.ReactNode }) {
  const [sourceMessages, setSourceMessages] = useState<Record<string, SearchIndexMessage[]>>({});
  const registerSourceMessages = useCallback((sourceId: string, messages: SearchIndexMessage[]) => {
    setSourceMessages((current) => ({
      ...current,
      [sourceId]: messages,
    }));
  }, []);
  const clearSourceMessages = useCallback((sourceId: string) => {
    setSourceMessages((current) => {
      if (!(sourceId in current)) {
        return current;
      }

      const next = { ...current };
      delete next[sourceId];
      return next;
    });
  }, []);

  const value = useMemo<MailSearchIndexContextValue>(() => ({
    messages: Object.values(sourceMessages).flat(),
    registerSourceMessages,
    clearSourceMessages,
  }), [clearSourceMessages, registerSourceMessages, sourceMessages]);

  return <MailSearchIndexContext.Provider value={value}>{children}</MailSearchIndexContext.Provider>;
}

export function useMailSearchIndex() {
  const context = useContext(MailSearchIndexContext);

  if (!context) {
    return {
      messages: [],
      registerSourceMessages: () => {},
      clearSourceMessages: () => {},
    } satisfies MailSearchIndexContextValue;
  }

  return context;
}
