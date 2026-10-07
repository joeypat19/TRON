import { notFound } from "next/navigation";
import { redirect } from "next/navigation";
import { appPath } from "@/lib/app-path";
import { getAuthenticatedUser } from "@/lib/auth/session";

export default async function GmailOauthDebugPage() {
  if (process.env.NODE_ENV === "production") notFound();
  if (!(await getAuthenticatedUser())) redirect(appPath("/auth"));

  return (
    <main className="mx-auto max-w-5xl space-y-8 px-6 py-10 text-sm text-white">
      <h1 className="text-3xl font-semibold">TRON Mail Diagnostics</h1>
      <section className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-5">
        <h2 className="text-xl font-semibold">Mailbox transport</h2>
        <p>TRON Mail is using the local TRON mailbox path. An authenticated TRON account is required.</p>
        <p>Google and Microsoft mailbox providers are disabled.</p>
      </section>
    </main>
  );
}
