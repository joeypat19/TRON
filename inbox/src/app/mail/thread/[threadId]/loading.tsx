export default function ThreadLoading() {
  return (
    <div className="flex min-h-[calc(100vh-10.5rem)] flex-1 items-center justify-center px-6 py-12">
      <div className="flex flex-col items-center text-center">
        <div
          aria-hidden="true"
          className="thread-loading-spinner h-12 w-12 rounded-full border-[3px] border-[var(--line)] border-t-[var(--accent)]"
        />
        <p className="mt-6 text-base font-medium text-[var(--text)]">Loading email...</p>
        <div
          aria-label="Loading email"
          className="mt-3 flex items-center gap-2"
          role="status"
        >
          <span className="thread-loading-worm h-2.5 w-2.5 rounded-full bg-[var(--accent)]" />
          <span className="thread-loading-worm h-2.5 w-2.5 rounded-full bg-[var(--accent)]" />
          <span className="thread-loading-worm h-2.5 w-2.5 rounded-full bg-[var(--accent)]" />
        </div>
      </div>
    </div>
  );
}
