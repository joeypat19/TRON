import { NextResponse } from "next/server";
import { loadInboxSectionData, loadMailPageData, type MailSectionId } from "@/lib/mail/mail-page-data";

const MAIL_SECTIONS: MailSectionId[] = ["unread", "opened", "composed"];

export async function GET(request: Request) {
  const url = new URL(request.url);
  const requestedSection = url.searchParams.get("section");
  const section = MAIL_SECTIONS.find((value) => value === requestedSection) ?? null;
  const labelIds = url.searchParams.getAll("labelId").filter(Boolean);
  const query = url.searchParams.get("q") ?? undefined;
  const pageToken = url.searchParams.get("pageToken") ?? undefined;
  const history = (url.searchParams.get("history") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const currentPath = url.searchParams.get("currentPath") ?? "/mail/inbox";
  const route = url.searchParams.get("route") ?? "/api/mail/messages";
  const includeQueryInPageHref = url.searchParams.get("includeQueryInPageHref") !== "false";

  if (section) {
    const result = await loadInboxSectionData(section, {
      pageToken,
      route,
    });

    return NextResponse.json(result);
  }

  const result = await loadMailPageData({
    route,
    currentPath,
    labelIds: labelIds.length ? labelIds : undefined,
    searchQuery: query,
    includeQueryInPageHref,
    pageToken,
    history,
  });

  return NextResponse.json(result);
}
