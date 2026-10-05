"use client";

import { FormEvent, useRef, useState } from "react";

type SpeechResult = { transcript: string };
type SpeechRecognitionEventLike = Event & {
  results: ArrayLike<ArrayLike<SpeechResult> & { isFinal: boolean }>;
};

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

type IconName = "plus" | "mic" | "lens" | "sparkle" | "arrow";

function Icon({ name }: { name: IconName }) {
  const common = {
    className: "ui-icon",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  switch (name) {
    case "plus":
      return <svg {...common}><path d="M12 5v14M5 12h14" /></svg>;
    case "mic":
      return <svg {...common}><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M6 11a6 6 0 0 0 12 0M12 17v4M9 21h6" /></svg>;
    case "lens":
      return <svg {...common}><path d="M8 4H6a2 2 0 0 0-2 2v2M16 4h2a2 2 0 0 1 2 2v2M8 20H6a2 2 0 0 1-2-2v-2M16 20h2a2 2 0 0 0 2-2v-2" /><rect x="7" y="7" width="10" height="10" rx="2" /></svg>;
    case "sparkle":
      return <svg {...common} fill="currentColor" stroke="none"><path d="m12 2 1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2Zm6.5 13 .8 2.7L22 19l-2.7.8L18.5 22l-.8-2.2L15 19l2.7-1.3.8-2.7Z" /></svg>;
    case "arrow":
      return <svg {...common}><path d="M5 12h13M13 6l6 6-6 6" /></svg>;
  }
}

export default function SearchBox({
  initialQuery = "",
  compact = false,
}: {
  initialQuery?: string;
  compact?: boolean;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [listening, setListening] = useState(false);
  const [voiceMessage, setVoiceMessage] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const transcriptRef = useRef("");

  function submitSearch(event?: FormEvent<HTMLFormElement>) {
    if (!query.trim()) {
      event?.preventDefault();
      inputRef.current?.focus();
    }
  }

  function startVoiceSearch() {
    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Recognition) {
      setVoiceMessage("Voice search is not supported in this browser.");
      return;
    }

    if (listening) {
      recognitionRef.current?.stop();
      return;
    }

    const recognition = new Recognition();
    recognition.lang = navigator.language || "en-US";
    recognition.continuous = false;
    recognition.interimResults = true;
    transcriptRef.current = "";
    setVoiceMessage("Listening…");

    recognition.onstart = () => setListening(true);
    recognition.onresult = (event) => {
      let transcript = "";
      for (let index = 0; index < event.results.length; index += 1) {
        transcript += event.results[index][0]?.transcript ?? "";
      }
      transcript = transcript.trim();
      transcriptRef.current = transcript;
      setQuery(transcript);
      if (inputRef.current) inputRef.current.value = transcript;
    };
    recognition.onerror = () => {
      setListening(false);
      setVoiceMessage("Voice search could not hear that. Try again.");
    };
    recognition.onend = () => {
      setListening(false);
      const transcript = transcriptRef.current.trim();
      setVoiceMessage("");
      if (transcript && formRef.current) formRef.current.requestSubmit();
    };

    recognitionRef.current = recognition;
    recognition.start();
  }

  return (
    <div className={`search-box-wrap${compact ? " compact" : ""}`}>
      <form ref={formRef} className="search-form" action="/search" method="get" onSubmit={submitSearch}>
        <div className="search-shell">
          <span className="search-plus" aria-hidden="true"><Icon name="plus" /></span>
          <input
            ref={inputRef}
            name="q"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="TRON Search"
            placeholder="Ask TRON"
            autoComplete="off"
          />
          <button
            type="button"
            className={`search-action${listening ? " listening" : ""}`}
            aria-label={listening ? "Stop voice search" : "Search by voice"}
            title={listening ? "Stop listening" : "Search by voice"}
            onClick={startVoiceSearch}
          >
            <Icon name="mic" />
          </button>
          <button type="button" className="search-action disabled-action" aria-label="Visual search unavailable" title="Visual search is not available yet" disabled>
            <Icon name="lens" />
          </button>
          <button type="button" className="ai-button" aria-label="Ask Infinity coming soon" title="Ask Infinity is coming soon">
            <Icon name="sparkle" /><span>Ask Infinity</span><Icon name="arrow" />
          </button>
        </div>
      </form>
      {voiceMessage && <p className="voice-message" role="status">{voiceMessage}</p>}
    </div>
  );
}
