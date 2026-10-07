import "server-only";

export type SafeDatabaseUrlInfo = {
  exists: boolean;
  malformed: boolean;
  protocol: string | null;
  host: string | null;
  port: string | null;
  isLocalhost: boolean;
  isPrivateIpHost: boolean;
  isInternalHostname: boolean;
  usesRailwayInternal: boolean;
  isPrivateHost: boolean;
};

const PRIVATE_IPV4_RANGES = [
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^192\.168\./,
] as const;

export function inspectDatabaseUrl(value: string | undefined): SafeDatabaseUrlInfo {
  const trimmed = value?.trim();

  if (!trimmed) {
    return {
      exists: false,
      malformed: false,
      protocol: null,
      host: null,
      port: null,
      isLocalhost: false,
      isPrivateIpHost: false,
      isInternalHostname: false,
      usesRailwayInternal: false,
      isPrivateHost: false,
    };
  }

  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase();
    const protocol = parsed.protocol;
    const malformed = protocol !== "postgresql:" && protocol !== "postgres:";
    const isLocalhost = host === "localhost" || host === "127.0.0.1" || host === "::1";
    const isPrivateIpHost =
      PRIVATE_IPV4_RANGES.some((pattern) => pattern.test(host)) ||
      host.startsWith("fc") ||
      host.startsWith("fd") ||
      host.startsWith("fe80:");
    const usesRailwayInternal = host.includes("railway.internal");
    const isInternalHostname =
      usesRailwayInternal ||
      host.endsWith(".internal") ||
      host.endsWith(".local") ||
      host.endsWith(".lan") ||
      host === "db";

    return {
      exists: true,
      malformed,
      protocol,
      host,
      port: parsed.port || null,
      isLocalhost,
      isPrivateIpHost,
      isInternalHostname,
      usesRailwayInternal,
      isPrivateHost: isLocalhost || isPrivateIpHost || isInternalHostname,
    };
  } catch {
    return {
      exists: true,
      malformed: true,
      protocol: null,
      host: null,
      port: null,
      isLocalhost: false,
      isPrivateIpHost: false,
      isInternalHostname: false,
      usesRailwayInternal: false,
      isPrivateHost: false,
    };
  }
}
