import { redirect } from "next/navigation";
import { appPath } from "@/lib/app-path";

export default async function HomePage() {
  redirect(appPath("/mail/inbox"));
}
