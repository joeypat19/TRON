import type { NextConfig } from "next";

const frameAncestors = process.env.INBOX_FRAME_ANCESTORS || "'self'";

const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || process.env.APP_URL?.trim() || "";

function resolveAssetPrefix() {
  try {
    const pathname = new URL(configuredAppUrl).pathname.replace(/\/+$/, "");
    return pathname === "/inbox" ? "/inbox/" : undefined;
  } catch {
    // Railway's embedded production deployment historically relied on the
    // /inbox mount even before APP_URL was configured.
    return process.env.RAILWAY_ENVIRONMENT_NAME === "production" ? "/inbox/" : undefined;
  }
}

const nextConfig = (phase: string): NextConfig => ({
  // Embedded deployments may mount the app at /inbox/, while troninbox.com is
  // a standalone root deployment. Only the embedded build prefixes assets.
  ...(phase === "phase-production-build" && resolveAssetPrefix()
    ? { assetPrefix: resolveAssetPrefix() }
    : {}),
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: `frame-ancestors ${frameAncestors}`,
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
        ],
      },
    ];
  },
});

export default nextConfig;
