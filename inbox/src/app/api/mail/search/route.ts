import { NextResponse } from "next/server";
import { authApiErrorResponse } from "@/lib/auth/api";
import { loadMailboxSearchData } from "@/lib/mail/mail-page-data";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const query = url.searchParams.get("q")?.trim() ?? "";
    const pageToken = url.searchParams.get("pageToken") ?? undefined;
    const limitValue = Number(url.searchParams.get("limit") ?? url.searchParams.get("maxResults") ?? "10");
    const limit = Number.isFinite(limitValue) && limitValue > 0
      ? Math.min(Math.floor(limitValue), 50)
      : 10;

    const result = await loadMailboxSearchData({ query, pageToken, limit, route: "/api/mail/search" });

    if (result.status !== "ready") return NextResponse.json(result);

    return NextResponse.json({
      ...result,
      messages: result.messages.map((message) => ({
        ...message,
        title: message.from || message.subject || "Unknown sender",
        timestamp: message.date ?? null,
        internalDate: Number(message.internalDate ?? 0),
      })),
    });
  } catch (error) {
    return authApiErrorResponse(error) ?? NextResponse.json({ error: "Unable to search the mailbox." }, { status: 500 });
  }
}
