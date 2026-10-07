import { ComposeModalLoading } from "@/components/mail/compose-modal";

export default function ComposeLoading() {
  return (
    <div className="flex h-[calc(100vh-10.5rem)] items-center justify-center">
      <div className="w-full max-w-2xl overflow-hidden rounded-[26px] border border-[var(--line)] bg-[var(--surface-overlay)] shadow-[0_30px_90px_var(--shadow-color)]">
        <ComposeModalLoading />
      </div>
    </div>
  );
}
