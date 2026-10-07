import Link from "next/link";
import { appPath } from "@/lib/app-path";

// TODO: Replace with support@troninbox.com before launch once the inbox exists.
export const SUPPORT_EMAIL = "joeypaterson12@gmail.com";

export function SiteFooter() {
  return (
    <footer className="border-t border-[var(--line)]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-5 py-6 text-sm text-[var(--text-muted)] sm:flex-row sm:items-center sm:justify-between">
        <nav aria-label="Footer" className="flex flex-wrap items-center gap-4">
          <Link className="transition hover:text-[var(--text)]" href={appPath("/privacy")}>
            Privacy
          </Link>
          <Link className="transition hover:text-[var(--text)]" href={appPath("/terms")}>
            Terms
          </Link>
          <a className="transition hover:text-[var(--text)]" href={`mailto:${SUPPORT_EMAIL}`}>
            Contact
          </a>
        </nav>
        <p>Last updated: May 2026</p>
      </div>
    </footer>
  );
}
