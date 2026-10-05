import { NextRequest } from "next/server";

const FALLBACK_GLOBE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
<rect width="64" height="64" rx="32" fill="#3c4043"/>
<circle cx="32" cy="32" r="18" fill="none" stroke="#9aa0a6" stroke-width="3"/>
<path d="M14 32h36M32 14c6 5 9 11 9 18s-3 13-9 18c-6-5-9-11-9-18s3-13 9-18Z" fill="none" stroke="#9aa0a6" stroke-width="2.5"/>
</svg>`;

function fallbackResponse(): Response {
  return new Response(FALLBACK_GLOBE_SVG, {
    headers: {
      "Cache-Control": "public, max-age=3600",
      "Content-Type": "image/svg+xml",
    },
  });
}

export async function GET(request: NextRequest): Promise<Response> {
  const domain = request.nextUrl.searchParams.get("domain")?.trim();
  if (!domain) return fallbackResponse();

  const backendUrl = process.env.BACKEND_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:938";
  const url = new URL("/api/favicon", backendUrl);
  url.searchParams.set("domain", domain);

  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return fallbackResponse();

    const body = await response.arrayBuffer();
    return new Response(body, {
      headers: {
        "Cache-Control": response.headers.get("cache-control") ?? "public, max-age=86400",
        "Content-Type": response.headers.get("content-type") ?? "image/svg+xml",
      },
    });
  } catch {
    return fallbackResponse();
  }
}
