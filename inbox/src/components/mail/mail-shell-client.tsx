"use client";

import {
  BadgePlus,
  ChevronDown,
  Filter,
  Inbox,
  LogOut,
  Mail,
  Menu,
  PenSquare,
  Send,
  Settings,
  Sparkles,
  Star,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState, type ComponentType, type ReactNode } from "react";
import {
  AssistantRail,
  AssistantRailProvider,
} from "@/components/mail/assistant-rail";
import { ComposeModal } from "@/components/mail/compose-modal";
import type { ComposeDraftValues } from "@/components/mail/compose-form";
import { MailAccountSwitcher } from "@/components/mail/mail-account-switcher";
import { MailSearchIndexProvider } from "@/components/mail/mail-search-context";
import { SearchForm } from "@/components/mail/search-form";
import { SettingsModal } from "@/components/settings/settings-modal";
import { appPath, stripAppMount } from "@/lib/app-path";
import type { MailboxProviderValue } from "@/lib/mail/shared";
import { buildMailViewHref, getMailSystemLabelTitle, getMailViewPreset, type MailViewKey } from "@/lib/mail/mail-view-presets";
import type { MailboxLoadState } from "@/lib/mailbox-state";
import { cn } from "@/lib/utils";

type MailLabel = {
  id: string;
  name: string;
  kind: "system" | "user";
};

export type MailShellProps = {
  children: ReactNode;
  account: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
  activeMailbox: {
    id: string;
    provider: MailboxProviderValue;
    emailAddress: string;
  } | null;
  connectedAccounts: Array<{
    id: string;
    provider: MailboxProviderValue;
    emailAddress: string;
    status: string;
  }>;
  labels: MailLabel[];
  loadState: MailboxLoadState;
};

type ShellNavItem = {
  label: string;
  href?: string;
  icon: ComponentType<{ className?: string }>;
  action?: "compose" | "settings";
  title?: string;
};

const FILTER_PRESETS = [
  { label: "Unread", href: appPath(buildMailViewHref("unread")), query: "is:unread" },
  { label: "Starred", href: appPath(buildMailViewHref("starred")), query: "is:starred" },
  { label: "Has attachment", href: appPath(`/mail/search?q=${encodeURIComponent("has:attachment")}`), query: "has:attachment" },
  { label: "Sent", href: appPath(buildMailViewHref("sent")), query: "in:sent" },
] as const;

function getViewKeyFromPathname(pathname: string) {
  const match = /^\/mail\/view\/([^/]+)/.exec(pathname);

  return match?.[1] ?? null;
}

function getProductTitle(pathname: string, labels: MailLabel[]) {
  if (pathname.startsWith("/mail/compose")) {
    return "Compose";
  }

  if (pathname.startsWith("/mail/thread")) {
    return "Thread";
  }

  if (pathname.startsWith("/mail/search")) {
    return "Search";
  }

  if (pathname.startsWith("/mail/view/")) {
    return getMailViewPreset(getViewKeyFromPathname(pathname))?.title ?? "Mailbox";
  }

  if (pathname.startsWith("/mail/label/")) {
    const labelId = decodeURIComponent(pathname.split("/mail/label/")[1] ?? "");
    return getMailSystemLabelTitle(labelId, labels.find((label) => label.id === labelId)?.name);
  }

  return "Inbox";
}

function isActiveRoute(pathname: string, href?: string) {
  if (!href) {
    return false;
  }

  const internalPathname = stripAppMount(pathname);
  const internalHref = stripAppMount(href);

  if (internalHref === "/mail/inbox") {
    return internalPathname === internalHref;
  }

  return internalPathname === internalHref || internalPathname.startsWith(`${internalHref}/`);
}

function SidebarSection({
  title,
  items,
  pathname,
  composeOpen,
  onCompose,
  onSettings,
  onNavigate,
}: {
  title: string;
  items: ShellNavItem[];
  pathname: string;
  composeOpen: boolean;
  onCompose: () => void;
  onSettings: () => void;
  onNavigate: () => void;
}) {
  const navLinkClass = (active: boolean, disabled = false) =>
    cn(
      "flex items-center gap-3 rounded-[18px] px-4 py-3 text-sm font-medium transition",
      active
        ? "border border-[var(--line)] bg-[var(--surface-overlay)] text-[var(--text)] shadow-[inset_0_0_0_1px_var(--accent-glow)]"
        : "text-[var(--text-muted)] hover:bg-[var(--surface-overlay)] hover:text-[var(--text)]",
      disabled ? "cursor-not-allowed opacity-60" : "",
    );

  return (
    <div>
      <p className="mb-2 px-4 text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">{title}</p>
      <nav className="space-y-1.5">
        {items.map((item) => {
          const active = item.action === "compose" ? composeOpen : isActiveRoute(pathname, item.href);

          if (item.action === "compose") {
            return (
              <button
                className={navLinkClass(active)}
                data-testid="sidebar-compose-button"
                key={item.label}
                onClick={onCompose}
                type="button"
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          }

          if (item.action === "settings") {
            return (
              <button
                className={navLinkClass(active)}
                data-testid="sidebar-settings-link"
                key={item.label}
                onClick={onSettings}
                type="button"
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          }

          if (!item.href) {
            return (
              <button
                className={navLinkClass(false, true)}
                disabled
                key={item.label}
                title={item.title ?? "Not implemented yet."}
                type="button"
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          }

          return (
            <Link
              className={navLinkClass(active)}
              href={item.href}
              key={item.label}
              onClick={onNavigate}
              title={item.title}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function SearchToolbar() {
  const router = useRouter();
  const [filtersOpen, setFiltersOpen] = useState(false);

  return (
    <div className="relative flex min-w-[16rem] flex-1 items-center gap-2 md:max-w-3xl">
      <div className="min-w-0 flex-1">
        <SearchForm />
      </div>

      <div className="relative">
        <button
          className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--surface-overlay)] text-[var(--text-muted)] transition hover:border-[var(--line)] hover:text-[var(--text)]"
          onClick={() => setFiltersOpen((current) => !current)}
          title="Search filters"
          type="button"
        >
          <Filter className="h-4 w-4" />
        </button>

        {filtersOpen ? (
          <div className="absolute right-0 top-[calc(100%+0.75rem)] z-40 w-64 rounded-[24px] border border-[var(--line)] bg-[var(--surface-overlay)] p-4 shadow-[0_20px_50px_var(--shadow-color)]">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">Real search operators</p>
            <div className="mt-3 grid gap-2">
              {FILTER_PRESETS.map((preset) => (
                <button
                  className="rounded-[16px] border border-[var(--line)] bg-[var(--surface-overlay)] px-4 py-3 text-left text-sm text-[var(--text)] transition hover:border-[var(--line)] hover:bg-[var(--surface-overlay)]"
                  key={preset.query}
                  onClick={() => {
                    setFiltersOpen(false);
                    router.push(preset.href);
                  }}
                  type="button"
                >
                  <div className="font-medium">{preset.label}</div>
                  <div className="mt-1 text-xs text-[var(--text-muted)]">{preset.query}</div>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function MailShellClient({
  children,
  account,
  activeMailbox,
  connectedAccounts,
  labels,
}: MailShellProps) {
  const pathname = usePathname();
  const internalPathname = stripAppMount(pathname);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarView, setSidebarView] = useState<"assistant" | "options">("options");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeDraft, setComposeDraft] = useState<ComposeDraftValues>({});
  const title = getProductTitle(internalPathname, labels);
  const showMailboxSearch =
    internalPathname.startsWith("/mail/inbox")
    || internalPathname.startsWith("/mail/search")
    || internalPathname.startsWith("/mail/view/")
    || internalPathname.startsWith("/mail/label/");
  const mainScrollClassName = showMailboxSearch ? "overflow-hidden" : "overflow-y-auto";

  async function signOut() {
    await fetch(appPath("/api/auth/logout"), { method: "POST" });
    window.location.assign(appPath("/auth"));
  }

  const customLabels = useMemo(
    () => labels.filter((label) => label.kind === "user").sort((left, right) => left.name.localeCompare(right.name)),
    [labels],
  );

  const mailNavItems = useMemo<ShellNavItem[]>(() => [
    { label: "Inbox", href: appPath("/mail/inbox"), icon: Inbox },
    { label: "Compose", icon: PenSquare, action: "compose" },
    { label: "Unread", href: appPath(buildMailViewHref("unread")), icon: Mail },
    { label: "Starred", href: appPath(buildMailViewHref("starred")), icon: Star },
    { label: "Snoozed", href: appPath(buildMailViewHref("snoozed")), icon: Sparkles },
    { label: "Sent", href: appPath(buildMailViewHref("sent")), icon: Send },
    { label: "Drafts", href: appPath(buildMailViewHref("drafts")), icon: PenSquare },
  ], []);

  const systemNavItems = useMemo<ShellNavItem[]>(() => [
    { label: "Spam", href: appPath(buildMailViewHref("spam")), icon: Sparkles },
    { label: "Trash", href: appPath(buildMailViewHref("trash")), icon: Trash2 },
  ], []);

  const categoryNavItems = useMemo<ShellNavItem[]>(() => {
    const categoryViews: MailViewKey[] = ["promotions", "social", "updates"];

    return categoryViews.reduce<ShellNavItem[]>((items, view) => {
      const preset = getMailViewPreset(view);

      if (!preset) {
        return items;
      }

      items.push({
        label: preset.title,
        href: appPath(buildMailViewHref(view)),
        icon: BadgePlus,
      });

      return items;
    }, []);
  }, []);

  const toolNavItems = useMemo<ShellNavItem[]>(() => [
    { label: "Settings", icon: Settings, action: "settings" },
  ], []);

  return (
    <div className="h-screen overflow-hidden bg-[var(--bg)] text-[var(--text)]" data-testid="product-shell">
      <MailSearchIndexProvider>
        <AssistantRailProvider>
          <div className="flex h-screen overflow-hidden">
            <aside
              className={cn(
                "fixed inset-y-0 left-0 z-30 flex w-72 flex-col overflow-hidden border-r border-[var(--line)] bg-[var(--surface-overlay)] px-4 py-5 backdrop-blur-xl transition md:translate-x-0",
                sidebarOpen ? "translate-x-0" : "-translate-x-full",
              )}
            >
              <div className="mb-4 flex items-center gap-2">
                <div
                  aria-label="Inbox sidebar view"
                  className="grid min-w-0 flex-1 grid-cols-2 gap-1 rounded-[18px] border border-[var(--line)] bg-[var(--surface)] p-1"
                  role="tablist"
                >
                  <button
                    aria-selected={sidebarView === "assistant"}
                    className={cn(
                      "inline-flex min-w-0 items-center justify-center gap-2 rounded-[14px] px-2 py-2 text-xs font-semibold transition",
                      sidebarView === "assistant"
                        ? "bg-[var(--accent)] text-[var(--accent-contrast)]"
                        : "text-[var(--text-muted)] hover:bg-[var(--surface-overlay)] hover:text-[var(--text)]",
                    )}
                    data-testid="sidebar-assistant-tab"
                    onClick={() => setSidebarView("assistant")}
                    role="tab"
                    type="button"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Assistant
                  </button>
                  <button
                    aria-selected={sidebarView === "options"}
                    className={cn(
                      "inline-flex min-w-0 items-center justify-center gap-2 rounded-[14px] px-2 py-2 text-xs font-semibold transition",
                      sidebarView === "options"
                        ? "bg-[var(--accent)] text-[var(--accent-contrast)]"
                        : "text-[var(--text-muted)] hover:bg-[var(--surface-overlay)] hover:text-[var(--text)]",
                    )}
                    data-testid="sidebar-options-tab"
                    onClick={() => setSidebarView("options")}
                    role="tab"
                    type="button"
                  >
                    <Settings className="h-3.5 w-3.5" />
                    Options
                  </button>
                </div>
                <button
                  aria-label="Close Inbox sidebar"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[var(--text-muted)] transition hover:bg-[var(--surface-overlay)] md:hidden"
                  onClick={() => setSidebarOpen(false)}
                  type="button"
                >
                  <Menu className="h-5 w-5" />
                </button>
              </div>

              <div className="brand-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto pr-1">
                <AssistantRail variant="sidebar" visible={sidebarView === "assistant"} />

                {sidebarView === "options" ? (
                  <div className="flex flex-col gap-6">
                <SidebarSection
                  composeOpen={composeOpen}
                  items={mailNavItems}
                  onCompose={() => {
                    setSidebarOpen(false);
                    setComposeOpen(true);
                  }}
                  onNavigate={() => setSidebarOpen(false)}
                  onSettings={() => {
                    setSidebarOpen(false);
                    setSettingsOpen(true);
                  }}
                  pathname={internalPathname}
                  title="Mail"
                />

                <SidebarSection
                  composeOpen={composeOpen}
                  items={systemNavItems}
                  onCompose={() => setComposeOpen(true)}
                  onNavigate={() => setSidebarOpen(false)}
                  onSettings={() => setSettingsOpen(true)}
                  pathname={pathname}
                  title="System"
                />

                <SidebarSection
                  composeOpen={composeOpen}
                  items={categoryNavItems}
                  onCompose={() => setComposeOpen(true)}
                  onNavigate={() => setSidebarOpen(false)}
                  onSettings={() => setSettingsOpen(true)}
                  pathname={pathname}
                  title="Categories"
                />

                {customLabels.length ? (
                  <div>
                    <div className="mb-2 flex items-center justify-between px-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">Labels</p>
                      <ChevronDown className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                    </div>
                    <div className="space-y-1.5">
                      {customLabels.map((label) => (
                        <Link
                          className={cn(
                            "mx-0 flex items-center gap-3 rounded-[18px] px-4 py-3 text-sm font-medium transition",
                            internalPathname === `/mail/label/${label.id}`
                              ? "border border-[var(--line)] bg-[var(--surface-overlay)] text-[var(--text)]"
                              : "text-[var(--text-muted)] hover:bg-[var(--surface-overlay)] hover:text-[var(--text)]",
                          )}
                          href={appPath(`/mail/label/${encodeURIComponent(label.id)}`)}
                          key={label.id}
                          onClick={() => setSidebarOpen(false)}
                        >
                          <span className="h-2.5 w-2.5 rounded-full bg-[var(--accent)]" />
                          {label.name}
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : null}

                <SidebarSection
                  composeOpen={composeOpen}
                  items={toolNavItems}
                  onCompose={() => setComposeOpen(true)}
                  onNavigate={() => setSidebarOpen(false)}
                  onSettings={() => {
                    setSidebarOpen(false);
                    setSettingsOpen(true);
                  }}
                  pathname={internalPathname}
                  title="Tools"
                />
                  </div>
                ) : null}
              </div>
            </aside>

            <div className="flex h-screen min-w-0 flex-1 flex-col overflow-hidden md:pl-72">
              <div className="flex h-screen min-w-0 flex-1 overflow-hidden">
                <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
                  <header className="sticky top-0 z-20 border-b border-[var(--line)] bg-[var(--surface-overlay)] px-4 py-4 backdrop-blur-xl">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <button
                          className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[var(--text-muted)] transition hover:bg-[var(--surface-overlay)] md:hidden"
                          onClick={() => setSidebarOpen(true)}
                          type="button"
                        >
                          <Menu className="h-5 w-5" />
                        </button>
                        <div>
                          <h1 className="text-lg font-semibold text-[var(--text)]">{title}</h1>
                          {activeMailbox?.emailAddress ? (
                            <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">{activeMailbox.emailAddress}</p>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex min-w-0 flex-1 justify-center">
                        {showMailboxSearch ? <SearchToolbar /> : null}
                      </div>

                      <div className="flex items-center justify-end gap-3" data-testid="mail-header-user-menu">
                        <div className="hidden text-right sm:block">
                          <p className="max-w-52 truncate text-sm font-medium text-[var(--text)]">{account.email}</p>
                          <p className="text-xs text-[var(--text-muted)]">TRON account</p>
                        </div>
                        <MailAccountSwitcher
                          accounts={connectedAccounts}
                          activeMailboxId={activeMailbox?.id ?? null}
                        />
                        <button
                          aria-label="Sign out"
                          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--surface-overlay)] text-[var(--text-muted)] transition hover:border-[var(--accent)] hover:text-[var(--text)]"
                          onClick={signOut}
                          title="Sign out"
                          type="button"
                        >
                          <LogOut className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </header>

                  <main className={cn("flex min-h-0 flex-1 flex-col p-4 pb-24 md:p-6", mainScrollClassName)}>{children}</main>
                </div>

              </div>
            </div>

            {sidebarOpen ? (
              <button
                className="fixed inset-0 z-20 bg-black/60 backdrop-blur-sm md:hidden"
                onClick={() => setSidebarOpen(false)}
                type="button"
              />
            ) : null}

            <nav className="fixed inset-x-4 bottom-4 z-30 grid grid-cols-3 gap-2 rounded-[24px] border border-[var(--line)] bg-[var(--surface-overlay)] p-2 shadow-[0_18px_50px_var(--shadow-color)] backdrop-blur-xl md:hidden">
              <Link
                className="flex flex-col items-center gap-1 rounded-[18px] px-3 py-2 text-xs text-[var(--text-muted)] transition hover:bg-[var(--surface-overlay)] hover:text-[var(--text)]"
                href={appPath("/mail/inbox")}
              >
                <Inbox className="h-4 w-4" />
                Mail
              </Link>
              <button
                className="flex flex-col items-center gap-1 rounded-[18px] px-3 py-2 text-xs text-[var(--text-muted)] transition hover:bg-[var(--surface-overlay)] hover:text-[var(--text)]"
                onClick={() => setComposeOpen(true)}
                type="button"
              >
                <PenSquare className="h-4 w-4" />
                Compose
              </button>
              <button
                className="flex flex-col items-center gap-1 rounded-[18px] px-3 py-2 text-xs text-[var(--text-muted)] transition hover:bg-[var(--surface-overlay)] hover:text-[var(--text)]"
                onClick={() => {
                  setSettingsOpen(true);
                }}
                type="button"
              >
                <Settings className="h-4 w-4" />
                Settings
              </button>
            </nav>

            <SettingsModal
              connectedAccounts={connectedAccounts}
              isOpen={settingsOpen}
              onClose={() => setSettingsOpen(false)}
            />
            <ComposeModal
              activeMailboxEmail={activeMailbox?.emailAddress ?? null}
              draft={composeDraft}
              isOpen={composeOpen}
              onClose={() => setComposeOpen(false)}
              onDraftChange={setComposeDraft}
              onSent={() => {
                setComposeDraft({});
                setComposeOpen(false);
              }}
            />
          </div>
        </AssistantRailProvider>
      </MailSearchIndexProvider>
    </div>
  );
}
