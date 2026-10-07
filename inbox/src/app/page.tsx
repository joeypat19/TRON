import { redirect } from "next/navigation";
import { appPath } from "@/lib/app-path";
import { getAuthenticatedUser } from "@/lib/auth/session";

export default async function HomePage() {
  redirect(appPath((await getAuthenticatedUser()) ? "/mail/inbox" : "/auth"));
}
