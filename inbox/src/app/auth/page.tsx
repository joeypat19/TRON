import { redirect } from "next/navigation";
import { AuthPageClient } from "@/components/auth/auth-page-client";
import { appPath } from "@/lib/app-path";
import { getAuthenticatedUser } from "@/lib/auth/session";

export default async function AuthPage() {
  if (await getAuthenticatedUser()) {
    redirect(appPath("/mail/inbox"));
  }

  return <AuthPageClient />;
}
