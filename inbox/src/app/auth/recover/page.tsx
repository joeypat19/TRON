import { RecoveryPageClient } from "@/components/auth/recovery-page-client";

export default async function RecoveryPage({ searchParams }: { searchParams: Promise<{ token?: string; type?: string }> }) {
  const params = await searchParams;
  return <RecoveryPageClient initialToken={params.token ?? ""} initialType={params.type === "login_code" ? "login_code" : "password"} />;
}
