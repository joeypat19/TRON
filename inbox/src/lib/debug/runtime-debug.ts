export function sanitizeDebugData(data: Record<string, unknown>) {
  const redact = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(redact);
    if (value && typeof value === "object") {
      return Object.fromEntries(Object.entries(value).map(([key, entry]) => [
        key,
        /token|secret|authorization|cookie/i.test(key) ? "[REDACTED]" : redact(entry),
      ]));
    }
    if (typeof value === "string" && value.length > 120) {
      return `${value.slice(0, 40)}...[truncated:${value.length}]`;
    }
    return value;
  };

  return redact(data) as Record<string, unknown>;
}

export function withoutTokenValue<T>(value: T) {
  return sanitizeDebugData(value as Record<string, unknown>) as T;
}

export function getErrorDebugDetails(error: unknown) {
  return { errorName: error instanceof Error ? error.name : typeof error };
}

export function runtimeDebugLog(event: string, data: Record<string, unknown> = {}) {
  if (process.env.NODE_ENV !== "test") {
    console.info(`[tron-mail:${event}]`, sanitizeDebugData(data));
  }
}

export async function withRuntimeDebugStep<T>(_event: string, _data: Record<string, unknown>, work: () => Promise<T> | T) {
  return work();
}
