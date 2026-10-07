import { notFound } from "next/navigation";
import { MailPage } from "@/app/mail/mail-page";
import { getMailViewPreset } from "@/lib/mail/mail-view-presets";

export default async function MailViewPage({
  params,
  searchParams,
}: {
  params: Promise<{ view: string }>;
  searchParams: Promise<{ pageToken?: string; history?: string }>;
}) {
  const [{ view }, query] = await Promise.all([params, searchParams]);
  const preset = getMailViewPreset(view);

  if (!preset) {
    notFound();
  }

  return (
    <MailPage
      currentPath={`/mail/view/${encodeURIComponent(view)}`}
      emptyDescription={preset.emptyDescription}
      emptyTitle={preset.emptyTitle}
      history={query.history ? query.history.split(",").filter(Boolean) : []}
      includeQueryInPageHref={false}
      pageToken={query.pageToken}
      searchQuery={preset.query}
      title={preset.title}
    />
  );
}
