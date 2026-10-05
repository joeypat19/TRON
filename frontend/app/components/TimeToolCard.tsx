"use client";

import { useEffect, useState } from "react";
import type { TimeToolResult } from "../../lib/search";

function formatTime(timestamp: number, timezone: string): string {
  return new Intl.DateTimeFormat("en-AU", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(new Date(timestamp));
}

function formatDate(timestamp: number, timezone: string): string {
  return new Intl.DateTimeFormat("en-AU", {
    timeZone: timezone,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(timestamp));
}

function formatZone(timestamp: number, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: timezone,
    timeZoneName: "short",
  }).formatToParts(new Date(timestamp));
  return parts.find((part) => part.type === "timeZoneName")?.value ?? timezone;
}

export default function TimeToolCard({ tool }: { tool: TimeToolResult }) {
  const serverTimestamp = Date.parse(tool.iso);
  const [timestamp, setTimestamp] = useState(serverTimestamp);

  useEffect(() => {
    const updateClock = () => setTimestamp(Date.now());
    updateClock();
    const interval = window.setInterval(updateClock, 1000);
    return () => window.clearInterval(interval);
  }, [serverTimestamp]);

  return (
    <section className="tool-answer time-tool-answer" aria-label={`Current time in ${tool.location}`}>
      <div className="tool-answer-heading">
        <span className="tool-answer-icon" aria-hidden="true">◷</span>
        <span>Time</span>
        <span className="tool-answer-live">Live</span>
      </div>
      <div className="tool-answer-time" aria-live="polite">{formatTime(timestamp, tool.timezone)}</div>
      <div className="tool-answer-date">{formatDate(timestamp, tool.timezone)} ({formatZone(timestamp, tool.timezone)})</div>
      <div className="tool-answer-location">{tool.location}</div>
    </section>
  );
}
