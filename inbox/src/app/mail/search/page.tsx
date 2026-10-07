import { redirect } from "next/navigation";
import { MailPage } from "@/app/mail/mail-page";
import { buildMailViewHref, getMailViewPreset, type MailViewKey } from "@/lib/mail/mail-view-presets";
import { appPath } from "@/lib/app-path";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; pageToken?: string; history?: string; view?: string }>;
}) {
  const params = await searchParams;
  const preset = getMailViewPreset(params.view);

  if (preset && params.view) {
    const nextParams = new URLSearchParams();

    if (params.pageToken) {
      nextParams.set("pageToken", params.pageToken);
    }

    if (params.history) {
      nextParams.set("history", params.history);
    }

    redirect(appPath(`${buildMailViewHref(params.view as MailViewKey)}${nextParams.size ? `?${nextParams.toString()}` : ""}`));
  }

  return (
    <MailPage
      currentPath="/mail/search"
      emptyDescription={params.q ? "No Gmail messages matched this search." : "Enter a Gmail search query above."}
      emptyTitle={params.q ? "No messages" : "Search your mail"}
      history={params.history ? params.history.split(",").filter(Boolean) : []}
      pageToken={params.pageToken}
      searchMode
      searchQuery={params.q}
      title={params.q ? "Search results" : "Search"}
    />
  );
}
