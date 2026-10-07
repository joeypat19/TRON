export function decodeBase64UrlToBuffer(input?: string | null) {
  if (!input) {
    return Buffer.from("");
  }

  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");

  return Buffer.from(padded, "base64");
}

export function decodeBase64Url(input?: string | null) {
  return decodeBase64UrlToBuffer(input).toString("utf8");
}
