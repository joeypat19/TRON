type MailListLoadingProps = {
  title?: string;
};

export function MailListLoading({ title = "Loading messages" }: MailListLoadingProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="border-b border-[var(--line)] px-4 py-3">
        <div className="h-4 w-28 rounded-full bg-[var(--surface-overlay)]" aria-hidden />
        <span className="sr-only">{title}</span>
      </div>
      <div className="divide-y divide-[var(--line)]">
        {Array.from({ length: 8 }).map((_, index) => (
          <div className="grid min-h-[64px] grid-cols-[auto_minmax(10rem,14rem)_minmax(0,1fr)] gap-3 px-4 py-3" key={`${title}-${index}`}>
            <div className="h-5 w-5 rounded-full bg-[var(--surface-overlay)]" />
            <div className="space-y-2">
              <div className="h-3 w-28 rounded-full bg-[var(--surface-overlay)]" />
              <div className="h-3 w-20 rounded-full bg-[var(--surface-overlay)]" />
            </div>
            <div className="space-y-2">
              <div className="h-3 w-1/2 rounded-full bg-[var(--surface-overlay)]" />
              <div className="h-3 w-5/6 rounded-full bg-[var(--surface-overlay)]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
