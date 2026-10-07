import { NextResponse } from "next/server";
/** Inbox is public for now; only preserve old embedded URLs. */
export default function proxy(request: Request) {
  const url = new URL(request.url);

  if (
    (url.hostname === "troninbox.com" || url.hostname === "www.troninbox.com") &&
    url.pathname.startsWith("/inbox/")
  ) {
    url.pathname = url.pathname.replace(/^\/inbox(?=\/)/, "") || "/";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next|\\.well-known(?:/.*)?$|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
  ],
};
